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
const configPath = path.join(workspaceRoot, "api配置.md");
const PORT = Number(process.env.PORT || 8787);

let peopleCache;
let configCache;

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
    model: process.env.OPENAI_MODEL || fileConfig.model || "gpt-4.1-mini"
  };
  return configCache;
}

function bigrams(input) {
  const s = safeText(input).replace(/\s+/g, "");
  const grams = [];
  for (let i = 0; i < s.length - 1; i += 1) grams.push(s.slice(i, i + 2));
  return grams;
}

function prefilter(query, people, excludedIds = [], cap = 60) {
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

function buildPrompt({ intro, need, candidates }) {
  const list = candidates.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    intro: p.intro,
    tags: p.tags
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

function fallbackMatches(candidates, intro, need) {
  return candidates.slice(0, 8).map((person, index) => {
    const sourceText = safeText(person.intro || person.searchText || "对方信息较少，但与当前诉求有关键词相关。");
    const introSnippet = sourceText.length > 180 ? `${sourceText.slice(0, 180)}...` : sourceText;
    const score = Math.max(62, 86 - index * 3);
    return {
      id: person.id,
      score,
      reason: `候选人信息与诉求存在相关性：${introSnippet}`,
      synergy: `你当前关注「${safeText(need).slice(0, 48)}」，可以先和对方围绕资源、场景和合作机会做一次轻量交流，判断是否值得继续深入。`,
      icebreaker: `你好，我看到你的介绍里有一些和我当前诉求相关的方向。我这边${intro ? `是${safeText(intro).slice(0, 42)}` : "正在找合适的合作资源"}，想和你简单交流下是否有合作或互相介绍资源的机会。`
    };
  });
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
        candidateCount: 0
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
      matches: withPeople(aiResult.matches, people),
      note: safeText(aiResult.note),
      corpusCount: count,
      candidateCount: candidates.length
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
