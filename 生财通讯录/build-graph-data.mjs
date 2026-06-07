import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(
  __dirname,
  "outputs",
  "20260606-广州大课现场群-生财通讯录整理.json"
);
const profilesPath = path.join(__dirname, "outputs", "graph_profiles.json");
const relationsPath = path.join(__dirname, "outputs", "graph_relations.json");
const configPath = path.join(workspaceRoot, "api配置.md");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  })
);

const limit = Number(args.get("limit") || 0);
const force = args.has("force");
const batchSize = Number(args.get("batch") || 8);

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compact(value, max = 1100) {
  const text = safeText(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function normalizeList(value, max = 6) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(safeText).filter(Boolean))].slice(0, max);
}

function normalizeRow(row, index) {
  const scName = safeText(row["生财姓名"]);
  const groupName = safeText(row["群成员名称"] || row["群成员昵称"]);
  const name = scName || groupName || `现场群成员 ${index + 1}`;
  const city = safeText(row["城市"]);
  const province = safeText(row["省份"]);
  const location = [province, city].filter(Boolean).join(" ");
  const intro = safeText(row["介绍"] || row["候选介绍"]);
  return {
    id: `row-${index + 1}`,
    name,
    groupName,
    city,
    province,
    location,
    intro,
    status: safeText(row["匹配状态"]),
    number: safeText(row["生财编号"] || row["候选生财编号"])
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadConfig() {
  let fileConfig = {};
  try {
    const raw = await readFile(configPath, "utf8");
    fileConfig = {
      apiKey: raw.match(/"OPENAI_API_KEY"\s*:\s*"([^"]+)"/)?.[1],
      baseUrl: raw.match(/base_url\s*=\s*"([^"]+)"/)?.[1],
      model: raw.match(/^model\s*=\s*"([^"]+)"/m)?.[1]
    };
  } catch {
    fileConfig = {};
  }

  return {
    apiKey: process.env.OPENAI_API_KEY || fileConfig.apiKey,
    baseUrl: process.env.OPENAI_BASE_URL || fileConfig.baseUrl || "https://api.openai.com",
    model: process.env.OPENAI_MODEL || fileConfig.model || "gpt-4.1-mini"
  };
}

function responsesEndpoint(baseUrl) {
  const clean = baseUrl.replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/responses` : `${clean}/v1/responses`;
}

function chatEndpoint(baseUrl) {
  const clean = baseUrl.replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

function collectText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join("");
  if (typeof value === "object") {
    if (typeof value.output_text === "string") return value.output_text;
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    return Object.values(value).map(collectText).join("");
  }
  return "";
}

function parseAiJson(textValue) {
  const clean = safeText(textValue).replace(/```json/gi, "").replace(/```/g, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 没有返回可解析的 JSON");
  }
  return JSON.parse(clean.slice(start, end + 1));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJsonWithRetry(url, body, config, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.error?.message || data.message || `HTTP ${response.status}`;
        throw new Error(message);
      }
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(1600 * attempt);
    }
  }
  throw lastError;
}

function buildProfilePrompt(batch) {
  const people = batch.map((person) => ({
    id: person.id,
    name: person.name,
    city: person.location || person.city,
    intro: compact(person.intro)
  }));

  return `你是一个企业家社群的人脉图谱分析师。请从成员自我介绍里抽取结构化人物画像，用于后续生成业务关系图谱。

要求：
1. 只基于原文，不要编造。
2. 重点抽取业务、资源、需求、能力、合作方向。
3. 数组字段每项尽量短，最多 6 项。
4. evidence 放 1-3 条最能支持画像的原文短句或事实，必须来自原文。
5. stage 用简短中文描述，如：探索期、已跑通业务、增长期、成熟业务、资源型、服务型。
6. 输出必须是合法 JSON，第一个字符是 {，最后一个字符是 }。

返回格式：
{"profiles":[{"id":"row-1","summary":"一句话画像","industries":[],"roles":[],"resources":[],"needs":[],"strengths":[],"business_model":[],"customer_segments":[],"collaboration_angles":[],"stage":"...","keywords":[],"evidence":[]}]}

成员列表：
${JSON.stringify(people)}`;
}

async function callAi(prompt, config) {
  if (!config.apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，请检查 api配置.md 或环境变量");
  }

  try {
    const chatData = await postJsonWithRetry(chatEndpoint(config.baseUrl), {
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4500
    }, config);
    return parseAiJson(chatData.choices?.[0]?.message?.content || collectText(chatData));
  } catch (chatError) {
    const data = await postJsonWithRetry(responsesEndpoint(config.baseUrl), {
      model: config.model,
      input: prompt,
      max_output_tokens: 4500,
      store: false
    }, config);
    const responseText = safeText(data.output_text || collectText(data.output));
    if (responseText) return parseAiJson(responseText);
    throw chatError;
  }
}

function fallbackProfile(person) {
  const intro = person.intro;
  const keywords = [
    "AI", "私域", "社群", "知识付费", "小红书", "电商", "跨境", "出海",
    "供应链", "工厂", "投放", "品牌", "视频", "直播", "技术", "教育"
  ].filter((word) => intro.toLowerCase().includes(word.toLowerCase()));
  return {
    id: person.id,
    name: person.name,
    city: person.city,
    province: person.province,
    location: person.location,
    summary: compact(intro, 80),
    industries: keywords.slice(0, 4),
    roles: [],
    resources: [],
    needs: [],
    strengths: [],
    business_model: [],
    customer_segments: [],
    collaboration_angles: keywords.slice(0, 3),
    stage: "待补充",
    keywords,
    evidence: intro ? [compact(intro, 80)] : [],
    intro: compact(intro, 420)
  };
}

function normalizeProfile(profile, person) {
  return {
    id: person.id,
    name: person.name,
    city: person.city,
    province: person.province,
    location: person.location,
    number: person.number,
    summary: safeText(profile.summary) || compact(person.intro, 80),
    industries: normalizeList(profile.industries),
    roles: normalizeList(profile.roles),
    resources: normalizeList(profile.resources),
    needs: normalizeList(profile.needs),
    strengths: normalizeList(profile.strengths),
    business_model: normalizeList(profile.business_model),
    customer_segments: normalizeList(profile.customer_segments),
    collaboration_angles: normalizeList(profile.collaboration_angles),
    stage: safeText(profile.stage) || "待补充",
    keywords: normalizeList(profile.keywords, 10),
    evidence: normalizeList(profile.evidence, 3),
    intro: compact(person.intro, 420)
  };
}

function tokens(values) {
  return new Set(
    values
      .flatMap((value) => safeText(value).split(/[、,，/｜|;；\s]+/))
      .map((value) => value.toLowerCase())
      .filter((value) => value.length >= 2)
  );
}

function overlap(a, b) {
  const hits = [];
  for (const item of a) {
    if (b.has(item)) hits.push(item);
  }
  return hits;
}

function textMatch(listA, listB) {
  const result = [];
  listA.forEach((a) => {
    listB.forEach((b) => {
      const left = safeText(a);
      const right = safeText(b);
      if (!left || !right) return;
      if (left.includes(right) || right.includes(left)) result.push(left.length <= right.length ? left : right);
      const aTokens = tokens([left]);
      const bTokens = tokens([right]);
      if (overlap(aTokens, bTokens).length) result.push(left.length <= right.length ? left : right);
    });
  });
  return [...new Set(result)].slice(0, 4);
}

function mature(profile) {
  return /创始|主理|负责人|操盘|已跑通|成熟|增长|百万|千万|上市|团队|会员|利润|营收/.test(
    [profile.stage, profile.summary, profile.roles.join(" "), profile.evidence.join(" ")].join(" ")
  );
}

function buildRelation(a, b) {
  const commonIndustries = overlap(tokens(a.industries), tokens(b.industries));
  const commonKeywords = overlap(tokens(a.keywords), tokens(b.keywords));
  const resourceToNeed = [
    ...textMatch([...a.resources, ...a.strengths, ...a.collaboration_angles], b.needs),
    ...textMatch([...b.resources, ...b.strengths, ...b.collaboration_angles], a.needs)
  ].slice(0, 4);
  const sameCity = a.city && b.city && a.city === b.city ? a.city : "";
  const mentorFit = commonIndustries.length && mature(a) !== mature(b);

  let score = 0;
  score += Math.min(32, commonIndustries.length * 12);
  score += Math.min(20, commonKeywords.length * 5);
  score += Math.min(34, resourceToNeed.length * 17);
  if (sameCity) score += 8;
  if (mentorFit) score += 8;
  if (score < 34) return null;

  let type = "同赛道";
  if (resourceToNeed.length) type = "资源互补";
  if (mentorFit && !resourceToNeed.length) type = "可请教";
  if (sameCity && score >= 42) type = `${type}+同城`;

  const shared = [...new Set([...commonIndustries, ...commonKeywords])].slice(0, 5);
  const reasonParts = [];
  if (resourceToNeed.length) reasonParts.push(`互补点：${resourceToNeed.join("、")}`);
  if (shared.length) reasonParts.push(`共同方向：${shared.join("、")}`);
  if (sameCity) reasonParts.push(`同城：${sameCity}`);

  const sourceNeed = a.needs[0] ? `${a.name} 关注「${a.needs[0]}」` : "";
  const targetNeed = b.needs[0] ? `${b.name} 关注「${b.needs[0]}」` : "";
  const sourceResource = a.resources[0] || a.strengths[0] || a.collaboration_angles[0] || "";
  const targetResource = b.resources[0] || b.strengths[0] || b.collaboration_angles[0] || "";
  const synergy = [
    sourceResource ? `${a.name}可提供：${sourceResource}` : "",
    targetResource ? `${b.name}可提供：${targetResource}` : "",
    sourceNeed,
    targetNeed
  ].filter(Boolean).join("；");

  return {
    id: `${a.id}<->${b.id}`,
    source: a.id,
    target: b.id,
    type,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reason: reasonParts.join("；") || "双方业务方向存在明显交集。",
    synergy: synergy || "双方可以围绕业务方向、资源和合作机会做一次轻量交流。",
    evidence: [...a.evidence.slice(0, 1), ...b.evidence.slice(0, 1)].filter(Boolean),
    icebreaker: `你好，我看到你也在关注${shared[0] || resourceToNeed[0] || "相近业务方向"}，我这边也在做相关探索，想和你简单交流下有没有互相介绍资源或合作的机会。`,
    tags: shared,
    weight: Math.min(4, 1 + score / 30)
  };
}

function buildRelations(profiles) {
  const relations = [];
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const relation = buildRelation(profiles[i], profiles[j]);
      if (relation) relations.push(relation);
    }
  }
  return relations
    .sort((a, b) => b.score - a.score)
    .slice(0, 520);
}

async function main() {
  const config = await loadConfig();
  const source = await readJson(sourcePath, {});
  const rows = Array.isArray(source.rows) ? source.rows : [];
  const people = rows
    .map(normalizeRow)
    .filter((person) => person.status === "matched" && person.intro)
    .slice(0, limit || undefined);

  const existing = await readJson(profilesPath, { profiles: [] });
  const existingMap = new Map((existing.profiles || []).map((profile) => [profile.id, profile]));
  const profiles = [];

  await mkdir(path.dirname(profilesPath), { recursive: true });

  for (let i = 0; i < people.length; i += batchSize) {
    const batch = people.slice(i, i + batchSize);
    const reused = batch.filter((person) => existingMap.has(person.id) && !force);
    reused.forEach((person) => profiles.push(existingMap.get(person.id)));

    const pending = batch.filter((person) => force || !existingMap.has(person.id));
    if (!pending.length) {
      console.info(`复用画像 ${i + reused.length}/${people.length}`);
      continue;
    }

    console.info(`AI 抽取画像 ${i + 1}-${i + pending.length}/${people.length}`);
    try {
      const result = await callAi(buildProfilePrompt(pending), config);
      const byId = new Map((result.profiles || []).map((profile) => [profile.id, profile]));
      pending.forEach((person) => {
        profiles.push(normalizeProfile(byId.get(person.id) || {}, person));
      });
    } catch (error) {
      console.warn(`本批 AI 失败，使用本地兜底：${error.message}`);
      pending.forEach((person) => profiles.push(fallbackProfile(person)));
    }

    await writeFile(
      profilesPath,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        source: path.relative(workspaceRoot, sourcePath),
        model: config.model,
        count: profiles.length,
        profiles
      }, null, 2),
      "utf8"
    );
  }

  const orderedProfiles = people
    .map((person) => profiles.find((profile) => profile.id === person.id) || existingMap.get(person.id))
    .filter(Boolean);
  const relations = buildRelations(orderedProfiles);

  await writeFile(
    profilesPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: path.relative(workspaceRoot, sourcePath),
      model: config.model,
      count: orderedProfiles.length,
      profiles: orderedProfiles
    }, null, 2),
    "utf8"
  );

  await writeFile(
    relationsPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: path.relative(workspaceRoot, profilesPath),
      count: relations.length,
      relations
    }, null, 2),
    "utf8"
  );

  console.info(`完成：${orderedProfiles.length} 个画像，${relations.length} 条关系`);
  console.info(`画像：${profilesPath}`);
  console.info(`关系：${relationsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
