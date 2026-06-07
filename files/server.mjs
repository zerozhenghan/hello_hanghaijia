import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");
const dataPath = path.join(
  workspaceRoot,
  "生财通讯录",
  "outputs",
  "20260606-广州大课现场群-生财通讯录整理.json"
);
const graphProfilesPath = path.join(workspaceRoot, "生财通讯录", "outputs", "graph_profiles.json");
const graphRelationsPath = path.join(workspaceRoot, "生财通讯录", "outputs", "graph_relations.json");
const configPath = path.join(workspaceRoot, "api配置.md");
const PORT = Number(process.env.PORT || 8787);

let peopleCache;
let configCache;
let profileMatchCache;

const GRAPH_TAG_RULES = [
  { label: "AI应用", group: "AI", words: ["AI", "人工智能", "智能体", "GPT", "Claude", "AIGC", "大模型"] },
  { label: "AI写作", group: "AI", words: ["AI写作", "写作", "文案", "公众号", "文章"] },
  { label: "AI视频", group: "AI", words: ["AI视频", "AI 视频", "漫剧", "短剧", "数字人", "剪辑", "视频"] },
  { label: "技术团队", group: "技术", words: ["技术团队", "开发", "软件", "程序", "系统", "SaaS", "工具", "自动化"] },
  { label: "私域社群", group: "私域", words: ["私域", "社群", "微信群", "社群运营", "会员", "陪跑"] },
  { label: "知识付费", group: "知识付费", words: ["知识付费", "课程", "训练营", "付费会员", "咨询", "陪跑"] },
  { label: "个人IP", group: "内容", words: ["个人IP", "IP", "自媒体", "博主", "内容"] },
  { label: "小红书", group: "内容", words: ["小红书", "笔记", "种草"] },
  { label: "视频号", group: "内容", words: ["视频号", "直播", "短视频", "抖音", "快手"] },
  { label: "电商", group: "电商", words: ["电商", "淘宝", "天猫", "京东", "拼多多", "闲鱼", "店铺"] },
  { label: "跨境出海", group: "出海", words: ["跨境", "出海", "独立站", "亚马逊", "欧美", "海外", "Google", "Affiliate"] },
  { label: "供应链", group: "供应链", words: ["供应链", "工厂", "源头工厂", "生产", "选品", "货源"] },
  { label: "品牌增长", group: "增长", words: ["品牌", "新消费", "增长", "营销", "投放", "广告"] },
  { label: "本地生活", group: "本地", words: ["本地生活", "门店", "线下", "连锁", "实体店", "餐饮"] },
  { label: "教育培训", group: "教育", words: ["教育", "培训", "留学", "职业规划", "简历", "家长"] },
  { label: "投资资源", group: "资本", words: ["投资", "融资", "资本", "项目", "合伙"] },
  { label: "健康身心", group: "健康", words: ["健康", "瑜伽", "中医", "医疗", "心理", "身心"] },
  { label: "企业服务", group: "企业服务", words: ["企业服务", "B端", "B2B", "客户", "销售", "CRM"] }
];

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function text(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function statusLabel(status) {
  if (status === "matched") return "已匹配";
  if (status === "needs_review") return "待确认";
  if (status === "unmatched") return "未匹配";
  return "现场群成员";
}

function normalizeRow(row, index) {
  const scName = safeText(row["生财姓名"]);
  const groupName = safeText(row["群成员名称"] || row["群成员昵称"]);
  const name = scName || groupName || `现场群成员 ${index + 1}`;
  const city = safeText(row["城市"]);
  const province = safeText(row["省份"]);
  const intro = safeText(row["介绍"] || row["候选介绍"]);
  const status = safeText(row["匹配状态"]);
  const number = safeText(row["生财编号"] || row["候选生财编号"]);
  const location = [province, city].filter(Boolean).join(" ");
  const role = [location, statusLabel(status)].filter(Boolean).join(" · ");
  const tags = [
    location,
    statusLabel(status),
    number ? `编号 ${number}` : ""
  ].filter(Boolean);

  return {
    id: `row-${index + 1}`,
    name,
    role,
    intro,
    tags,
    meta: {
      status,
      groupName,
      number,
      avatar: safeText(row["头像本地路径"] || row["候选头像本地路径"])
    },
    searchText: safeText([name, groupName, role, intro, tags.join(" ")].join(" "))
  };
}

async function loadPeople() {
  if (peopleCache) return peopleCache;
  const raw = await readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const people = rows.map(normalizeRow);
  const summary = data.summary || {};
  peopleCache = { people, summary, count: people.length };
  return peopleCache;
}

async function loadConfig() {
  if (configCache) return configCache;

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

  configCache = {
    apiKey: process.env.OPENAI_API_KEY || fileConfig.apiKey,
    baseUrl: process.env.OPENAI_BASE_URL || fileConfig.baseUrl || "https://api.openai.com",
    model: process.env.OPENAI_MODEL || fileConfig.model || "gpt-4.1-mini",
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 12000)
  };
  return configCache;
}

function bigrams(input) {
  const s = safeText(input).replace(/\s+/g, "");
  const grams = [];
  for (let i = 0; i < s.length - 1; i += 1) grams.push(s.slice(i, i + 2));
  return grams;
}

function prefilter(query, people, excludedIds = [], cap = 40) {
  const excluded = new Set(excludedIds);
  const usefulPeople = people.filter((p) => p.searchText.length > 4 && !excluded.has(p.id));
  if (usefulPeople.length <= cap) return usefulPeople;

  const q = new Set(bigrams(query));
  return usefulPeople
    .map((p) => {
      let hit = 0;
      for (const gram of bigrams(p.searchText)) {
        if (q.has(gram)) hit += 1;
      }
      if (safeText(query).includes(p.name)) hit += 30;
      return { person: p, hit };
    })
    .sort((a, b) => b.hit - a.hit)
    .slice(0, cap)
    .map((x) => x.person);
}

function compactArray(value, max = 6) {
  return Array.isArray(value) ? value.map(safeText).filter(Boolean).slice(0, max) : [];
}

function profileSearchText(profile) {
  return safeText([
    profile.name,
    profile.city,
    profile.location,
    profile.summary,
    profile.intro,
    ...compactArray(profile.industries, 12),
    ...compactArray(profile.roles, 12),
    ...compactArray(profile.resources, 12),
    ...compactArray(profile.needs, 12),
    ...compactArray(profile.strengths, 12),
    ...compactArray(profile.business_model, 12),
    ...compactArray(profile.customer_segments, 12),
    ...compactArray(profile.collaboration_angles, 12),
    ...compactArray(profile.keywords, 16),
    ...compactArray(profile.evidence, 4)
  ].join(" "));
}

function normalizeProfile(profile) {
  const id = safeText(profile.id);
  const city = safeText(profile.city || profile.location);
  const stage = safeText(profile.stage);
  const tags = [
    ...compactArray(profile.industries, 3),
    ...compactArray(profile.resources, 3),
    ...compactArray(profile.needs, 2),
    city
  ].filter(Boolean).slice(0, 8);

  return {
    id,
    name: safeText(profile.name) || id,
    role: [city, stage].filter(Boolean).join(" · "),
    intro: safeText(profile.summary || profile.intro),
    tags,
    profile: {
      industries: compactArray(profile.industries),
      roles: compactArray(profile.roles),
      resources: compactArray(profile.resources),
      needs: compactArray(profile.needs),
      strengths: compactArray(profile.strengths),
      businessModel: compactArray(profile.business_model),
      customers: compactArray(profile.customer_segments),
      collaboration: compactArray(profile.collaboration_angles),
      keywords: compactArray(profile.keywords, 10),
      evidence: compactArray(profile.evidence, 3),
      summary: safeText(profile.summary),
      stage,
      number: safeText(profile.number),
      city
    },
    searchText: profileSearchText(profile)
  };
}

async function loadProfileMatchData() {
  if (profileMatchCache) return profileMatchCache;
  try {
    const profilesData = await readJson(graphProfilesPath);
    const profiles = Array.isArray(profilesData.profiles) ? profilesData.profiles.map(normalizeProfile).filter((p) => p.id) : [];
    profileMatchCache = {
      profiles,
      count: profiles.length,
      generatedAt: safeText(profilesData.generatedAt),
      model: safeText(profilesData.model),
      source: safeText(profilesData.source)
    };
    return profileMatchCache;
  } catch {
    profileMatchCache = { profiles: [], count: 0, generatedAt: "", model: "", source: "" };
    return profileMatchCache;
  }
}

function tokenSet(textValue) {
  const text = safeText(textValue).toLowerCase();
  const chunks = text.match(/[a-z0-9]+|[\u4e00-\u9fa5]{2,}/g) || [];
  const grams = bigrams(text).filter((gram) => /[\u4e00-\u9fa5]/.test(gram));
  return new Set([...chunks, ...grams]);
}

function overlapScore(queryTokens, textValue, weight) {
  if (!textValue) return 0;
  let hit = 0;
  for (const token of tokenSet(textValue)) {
    if (queryTokens.has(token)) hit += 1;
  }
  return hit * weight;
}

function scoreProfileCandidate(profile, query, excludeIds) {
  if (excludeIds.has(profile.id)) return null;
  const queryTokens = tokenSet(query);
  let score = 0;
  score += overlapScore(queryTokens, profile.profile.industries.join(" "), 8);
  score += overlapScore(queryTokens, profile.profile.resources.join(" "), 9);
  score += overlapScore(queryTokens, profile.profile.needs.join(" "), 10);
  score += overlapScore(queryTokens, profile.profile.strengths.join(" "), 7);
  score += overlapScore(queryTokens, profile.profile.businessModel.join(" "), 5);
  score += overlapScore(queryTokens, profile.profile.customers.join(" "), 5);
  score += overlapScore(queryTokens, profile.profile.collaboration.join(" "), 8);
  score += overlapScore(queryTokens, profile.profile.keywords.join(" "), 7);
  score += overlapScore(queryTokens, profile.profile.summary, 4);
  score += overlapScore(queryTokens, profile.profile.evidence.join(" "), 3);
  score += overlapScore(queryTokens, profile.searchText, 1);
  if (safeText(query).includes(profile.name)) score += 40;
  return { profile, score };
}

function prefilterProfiles(query, profiles, excludedIds = [], cap = 16) {
  const excluded = new Set(excludedIds);
  const scored = profiles
    .map((profile) => scoreProfileCandidate(profile, query, excluded))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const positives = scored.filter((item) => item.score > 0).slice(0, cap);
  if (positives.length >= Math.min(8, cap)) return positives.map((item) => item.profile);
  return scored.slice(0, cap).map((item) => item.profile);
}

function buildPrompt({ intro, need, candidates }) {
  const list = candidates.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    intro: p.intro,
    tags: p.tags,
    profile: p.profile ? {
      industries: p.profile.industries,
      roles: p.profile.roles,
      resources: p.profile.resources,
      needs: p.profile.needs,
      strengths: p.profile.strengths,
      businessModel: p.profile.businessModel,
      customers: p.profile.customers,
      collaboration: p.profile.collaboration,
      keywords: p.profile.keywords,
      evidence: p.profile.evidence,
      summary: p.profile.summary
    } : undefined
  }));

  return `你是一个高端企业家社群的「AI 人脉顾问」。下面是现场群整理出的参会者名单 JSON。一位成员会告诉你他的身份和当前诉求，请你从名单里挑出最值得他主动链接的 8 人。

硬性要求：
1. 只推荐真正契合的人；优先返回 8 人，如果确实不足 8 人，就如实在 note 里说明，宁缺毋滥，不要硬凑。
2. 给每人一个 0-100 的匹配分 score，分数要拉开差距、有区分度。
3. reason 必须引用对方简介里的具体事实，不要空泛。
4. synergy 说明双方各能给对方带来什么，体现互惠。
5. icebreaker 写一句这位成员可以直接发出去的话，自然、具体、不尬。
6. 全部用简体中文。
7. 输出必须是合法 JSON。第一个字符必须是 {，最后一个字符必须是 }。

只返回一个 JSON 对象，不要任何解释文字、不要 markdown 代码块，格式严格如下：
{"matches":[{"id":"参会者id","score":88,"reason":"...","synergy":"...","icebreaker":"..."}],"note":"一句总体点评，可空"}

参会者名单：
${JSON.stringify(list)}

这位成员的身份：${intro || "（未填写）"}
这位成员的诉求：${need}`;
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

async function callAi(prompt) {
  const config = await loadConfig();
  if (!config.apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，请检查 api配置.md 或环境变量");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  const chatResponse = await fetch(chatEndpoint(config.baseUrl), {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 3000
    })
  }).finally(() => clearTimeout(timer));

  const chatData = await chatResponse.json().catch(() => ({}));
  if (!chatResponse.ok) {
    const message = chatData.error?.message || chatData.message || `HTTP ${chatResponse.status}`;
    throw new Error(`AI 接口调用失败：${message}`);
  }

  const chatText = safeText(chatData.choices?.[0]?.message?.content || collectText(chatData));
  if (chatText) return parseAiJson(chatText);

  const response = await fetch(responsesEndpoint(config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      input: prompt,
      max_output_tokens: 3000,
      store: false
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.message || `HTTP ${response.status}`;
    throw new Error(`AI 接口调用失败：${message}`);
  }

  return parseAiJson(data.output_text || collectText(data.output));
}

function withPeople(matches, people) {
  const byId = new Map(people.map((p) => [p.id, p]));
  return (matches || [])
    .filter((match) => byId.has(match.id))
    .slice(0, 8)
    .map((match) => {
      const person = byId.get(match.id);
      return {
        id: person.id,
        score: Math.max(0, Math.min(100, Math.round(Number(match.score) || 0))),
        reason: safeText(match.reason),
        synergy: safeText(match.synergy),
        icebreaker: safeText(match.icebreaker),
        person: {
          id: person.id,
          name: person.name,
          role: person.role,
          intro: person.intro,
          tags: person.tags
        }
      };
    });
}

function withProfilePeople(matches, profiles) {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return (matches || [])
    .filter((match) => byId.has(match.id))
    .slice(0, 8)
    .map((match) => {
      const person = byId.get(match.id);
      return {
        id: person.id,
        score: Math.max(0, Math.min(100, Math.round(Number(match.score) || 0))),
        reason: safeText(match.reason),
        synergy: safeText(match.synergy),
        icebreaker: safeText(match.icebreaker),
        person: {
          id: person.id,
          name: person.name,
          role: person.role,
          intro: person.intro,
          tags: person.tags
        }
      };
    });
}

function fallbackMatches(candidates, intro, need) {
  return candidates.slice(0, 8).map((person, index) => {
    const p = person.profile || {};
    const resources = compactArray(p.resources, 3);
    const needs = compactArray(p.needs, 3);
    const collaboration = compactArray(p.collaboration, 3);
    const evidence = compactArray(p.evidence, 2);
    const sourceText = safeText(p.summary || person.intro || person.searchText || "对方信息较少，但与当前诉求有关键词相关。");
    const introSnippet = sourceText.length > 180 ? `${sourceText.slice(0, 180)}...` : sourceText;
    const score = Math.max(62, 86 - index * 3);
    const resourceText = resources.length ? `可提供：${resources.join("、")}` : introSnippet;
    const needText = needs.length ? `对方关注：${needs.join("、")}` : "可以先做资源和场景互相判断";
    const collaborationText = collaboration.length ? collaboration.join("、") : "资源互换、业务交流、合作可能性判断";
    const evidenceText = evidence.length ? `依据：${evidence.join("；")}` : `依据：${introSnippet}`;
    const selfIntro = safeText(intro).replace(/[。,.，；;、]+$/g, "").slice(0, 42);
    const selfText = selfIntro ? `我这边${selfIntro.startsWith("我") ? selfIntro.slice(1) : `是${selfIntro}`}` : "我这边正在找合适的合作资源";
    return {
      id: person.id,
      score,
      reason: `${resourceText}。${evidenceText}`,
      synergy: `你当前关注「${safeText(need).slice(0, 48)}」，对方方向适合围绕「${collaborationText}」先聊一轮。${needText}。`,
      icebreaker: `你好，我看到你这边${resources.length ? `有${resources.slice(0, 2).join("、")}相关资源` : "和我当前关注的方向比较相关"}。${selfText}，想和你简单交流下是否有合作或互相介绍资源的机会。`
    };
  });
}

function graphTagsFor(person) {
  const textValue = person.searchText.toLowerCase();
  return GRAPH_TAG_RULES
    .filter((rule) => rule.words.some((word) => textValue.includes(word.toLowerCase())))
    .map((rule) => ({
      label: rule.label,
      group: rule.group
    }))
    .slice(0, 6);
}

function compactIntro(intro) {
  const clean = safeText(intro);
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

function edgeReason(commonTags, sameCity) {
  const parts = [];
  if (commonTags.length) parts.push(`共同方向：${commonTags.join("、")}`);
  if (sameCity) parts.push(`同城：${sameCity}`);
  return parts.join("；");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function addUniqueNode(nodes, ids, node) {
  if (ids.has(node.id)) return;
  ids.add(node.id);
  nodes.push(node);
}

function profileTags(profile) {
  return [
    ...(Array.isArray(profile.industries) ? profile.industries : []),
    ...(Array.isArray(profile.resources) ? profile.resources : []),
    ...(Array.isArray(profile.needs) ? profile.needs : []),
    ...(Array.isArray(profile.strengths) ? profile.strengths : [])
  ].map(safeText).filter(Boolean);
}

function compactList(value, max = 6) {
  return Array.isArray(value) ? value.map(safeText).filter(Boolean).slice(0, max) : [];
}

function buildGeneratedGraph(profilesData, relationsData, summary) {
  const profiles = Array.isArray(profilesData.profiles) ? profilesData.profiles : [];
  const relations = Array.isArray(relationsData.relations) ? relationsData.relations : [];
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const tagMap = new Map();
  const cityMap = new Map();

  function addTag(personId, label, group) {
    const clean = safeText(label);
    if (!clean) return;
    const id = `tag:${group}:${clean}`;
    const current = tagMap.get(id) || { label: clean, group, count: 0 };
    current.count += 1;
    tagMap.set(id, current);
    edges.push({
      id: `${personId}->${id}`,
      source: personId,
      target: id,
      type: group,
      weight: group === "需求" ? 1.15 : 1,
      reason: `${group}：${clean}`
    });
  }

  profiles.forEach((profile) => {
    const id = safeText(profile.id);
    if (!id) return;
    const tags = profileTags(profile);
    addUniqueNode(nodes, nodeIds, {
      id,
      label: safeText(profile.name) || id,
      type: "person",
      group: "成员",
      radius: 8 + Math.min(5, tags.length * 0.45),
      role: [safeText(profile.location), safeText(profile.stage)].filter(Boolean).join(" · "),
      intro: safeText(profile.summary || profile.intro),
      city: safeText(profile.city),
      tags: tags.slice(0, 10),
      profile: {
        industries: compactList(profile.industries),
        roles: compactList(profile.roles),
        resources: compactList(profile.resources),
        needs: compactList(profile.needs),
        strengths: compactList(profile.strengths),
        businessModel: compactList(profile.business_model),
        customers: compactList(profile.customer_segments),
        collaboration: compactList(profile.collaboration_angles),
        evidence: compactList(profile.evidence, 3),
        summary: safeText(profile.summary),
        stage: safeText(profile.stage)
      }
    });

    compactList(profile.industries).forEach((item) => addTag(id, item, "行业"));
    compactList(profile.resources).forEach((item) => addTag(id, item, "资源"));
    compactList(profile.needs).forEach((item) => addTag(id, item, "需求"));
    compactList(profile.strengths).forEach((item) => addTag(id, item, "能力"));

    const city = safeText(profile.city || profile.location);
    if (city) {
      const cityId = `city:${city}`;
      cityMap.set(cityId, { label: city, count: (cityMap.get(cityId)?.count || 0) + 1 });
      edges.push({
        id: `${id}->${cityId}`,
        source: id,
        target: cityId,
        type: "同城",
        weight: 0.65,
        reason: `所在地：${city}`
      });
    }
  });

  const visibleTags = [...tagMap.entries()]
    .filter(([, tag]) => tag.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 100);

  visibleTags.forEach(([id, tag]) => {
    addUniqueNode(nodes, nodeIds, {
      id,
      label: tag.label,
      type: "tag",
      group: tag.group,
      radius: 10 + Math.min(12, tag.count * 0.42),
      count: tag.count
    });
  });

  cityMap.forEach((city, id) => {
    if (city.count < 2) return;
    addUniqueNode(nodes, nodeIds, {
      id,
      label: city.label,
      type: "city",
      group: "城市",
      radius: 10 + Math.min(12, city.count * 0.45),
      count: city.count
    });
  });

  relations
    .filter((relation) => nodeIds.has(relation.source) && nodeIds.has(relation.target))
    .slice(0, 520)
    .forEach((relation) => {
      edges.push({
        id: safeText(relation.id) || `${relation.source}<->${relation.target}`,
        source: safeText(relation.source),
        target: safeText(relation.target),
        type: safeText(relation.type) || "业务关联",
        weight: Math.min(4, Number(relation.weight) || 1 + Number(relation.score || 0) / 30),
        score: Math.max(0, Math.min(100, Math.round(Number(relation.score) || 0))),
        reason: safeText(relation.reason),
        synergy: safeText(relation.synergy),
        evidence: compactList(relation.evidence, 3),
        icebreaker: safeText(relation.icebreaker),
        tags: compactList(relation.tags, 6)
      });
    });

  const visibleEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return {
    version: "ai-profile-v2",
    generatedAt: profilesData.generatedAt,
    summary,
    stats: {
      people: profiles.length,
      tags: visibleTags.length,
      cities: [...cityMap.values()].filter((city) => city.count >= 2).length,
      relations: relations.length
    },
    filters: ["行业", "资源", "需求", "能力", "城市", "资源互补", "同赛道", "可请教"],
    nodes,
    edges: visibleEdges
  };
}

async function loadGeneratedGraph(summary) {
  try {
    const [profilesData, relationsData] = await Promise.all([
      readJson(graphProfilesPath),
      readJson(graphRelationsPath)
    ]);
    if (!Array.isArray(profilesData.profiles) || !profilesData.profiles.length) return null;
    return buildGeneratedGraph(profilesData, relationsData, summary);
  } catch {
    return null;
  }
}

function buildGraph(people, summary) {
  const usefulPeople = people
    .filter((person) => person.meta.status === "matched" && person.intro)
    .map((person) => {
      const tags = graphTagsFor(person);
      const city = safeText(person.role.split(" · ")[0]);
      return { ...person, graphTags: tags, city };
    })
    .filter((person) => person.graphTags.length || person.city)
    .slice(0, 180);

  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const tagMap = new Map();
  const cityMap = new Map();

  function addNode(node) {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  }

  usefulPeople.forEach((person) => {
    addNode({
      id: person.id,
      label: person.name,
      type: "person",
      group: "成员",
      radius: 12 + Math.min(8, person.graphTags.length * 1.4),
      role: person.role,
      intro: compactIntro(person.intro),
      tags: person.graphTags.map((tag) => tag.label),
      city: person.city,
      status: person.meta.status
    });

    person.graphTags.forEach((tag) => {
      const tagId = `tag:${tag.label}`;
      tagMap.set(tagId, { label: tag.label, group: tag.group, count: (tagMap.get(tagId)?.count || 0) + 1 });
      edges.push({
        id: `${person.id}->${tagId}`,
        source: person.id,
        target: tagId,
        type: "业务标签",
        weight: 1,
        reason: `关联业务：${tag.label}`
      });
    });

    if (person.city) {
      const cityId = `city:${person.city}`;
      cityMap.set(cityId, { label: person.city, count: (cityMap.get(cityId)?.count || 0) + 1 });
      edges.push({
        id: `${person.id}->${cityId}`,
        source: person.id,
        target: cityId,
        type: "同城",
        weight: 0.6,
        reason: `所在地：${person.city}`
      });
    }
  });

  tagMap.forEach((tag, id) => {
    addNode({
      id,
      label: tag.label,
      type: "tag",
      group: tag.group,
      radius: 13 + Math.min(14, tag.count * 0.55),
      count: tag.count
    });
  });

  cityMap.forEach((city, id) => {
    if (city.count < 2) return;
    addNode({
      id,
      label: city.label,
      type: "city",
      group: "城市",
      radius: 10 + Math.min(12, city.count * 0.45),
      count: city.count
    });
  });

  const peopleEdges = [];
  for (let i = 0; i < usefulPeople.length; i += 1) {
    const a = usefulPeople[i];
    const aTags = new Set(a.graphTags.map((tag) => tag.label));
    for (let j = i + 1; j < usefulPeople.length; j += 1) {
      const b = usefulPeople[j];
      const commonTags = b.graphTags.map((tag) => tag.label).filter((label) => aTags.has(label));
      const sameCity = a.city && a.city === b.city ? a.city : "";
      const score = commonTags.length * 18 + (sameCity ? 8 : 0);
      if (score < 36) continue;
      peopleEdges.push({
        id: `${a.id}<->${b.id}`,
        source: a.id,
        target: b.id,
        type: sameCity && commonTags.length ? "同城同赛道" : "同赛道",
        weight: Math.min(4, 1 + score / 28),
        score,
        reason: edgeReason(commonTags, sameCity),
        tags: commonTags
      });
    }
  }

  const selectedPeopleEdges = peopleEdges
    .sort((a, b) => b.score - a.score)
    .slice(0, 260);

  edges.push(...selectedPeopleEdges);

  return {
    summary,
    stats: {
      people: usefulPeople.length,
      tags: tagMap.size,
      cities: [...cityMap.values()].filter((city) => city.count >= 2).length,
      relations: selectedPeopleEdges.length
    },
    filters: [...new Set(GRAPH_TAG_RULES.map((rule) => rule.group))],
    nodes,
    edges
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/people/count") {
    const { count, summary } = await loadPeople();
    return json(res, 200, { count, summary });
  }

  if (req.method === "GET" && req.url === "/api/graph") {
    const { people, summary } = await loadPeople();
    const generatedGraph = await loadGeneratedGraph(summary);
    if (generatedGraph) return json(res, 200, generatedGraph);
    return json(res, 200, buildGraph(people, summary));
  }

  if (req.method === "POST" && req.url === "/api/match") {
    const body = await readBody(req);
    const intro = safeText(body.intro);
    const need = safeText(body.need);
    const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds.map(safeText).filter(Boolean) : [];
    if (!need) return json(res, 400, { error: "请先填写你的诉求" });

    const { people, count } = await loadPeople();
    const candidates = prefilter(`${intro} ${need}`, people, excludeIds);

    if (!candidates.length) {
      return json(res, 200, {
        matches: [],
        note: "已经没有更多未推荐过的候选人了，可以换一个更具体的诉求再试。",
        corpusCount: count,
        candidateCount: 0,
        matchSource: "raw_directory"
      });
    }

    let aiResult;
    try {
      aiResult = await callAi(buildPrompt({ intro, need, candidates }));
    } catch (error) {
      aiResult = {
        matches: fallbackMatches(candidates, intro, need),
        note: "已先为你整理出 8 位相关候选人，可以左右滑快速筛选，滑完后会生成你想认识的联系人列表。"
      };
    }
    return json(res, 200, {
      matches: withPeople(aiResult.matches, candidates),
      note: safeText(aiResult.note),
      corpusCount: count,
      candidateCount: candidates.length,
      matchSource: "raw_directory"
    });
  }

  return json(res, 404, { error: "API 不存在" });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(__dirname, requested));

  if (!filePath.startsWith(__dirname)) return text(res, 403, "Forbidden");

  try {
    await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    createReadStream(filePath).pipe(res);
  } catch {
    text(res, 404, "Not found");
  }
}

createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    json(res, 500, { error: error.message || "服务器错误" });
  }
}).listen(PORT, () => {
  console.info(`AI 航海家已启动：http://localhost:${PORT}`);
});
