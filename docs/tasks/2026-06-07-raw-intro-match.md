# 任务：首页匹配改回原始用户介绍

## 背景

当前首页 `/api/match` 使用 `graph_profiles.json` 的结构化画像做本地预筛，再交给 AI 推荐。用户反馈标签/画像字段的匹配方式不准，希望改回第一版：直接使用抓取通讯录里的原始用户介绍进行匹配。

## 目标

1. 首页匹配重新使用原始通讯录数据 `20260606-广州大课现场群-生财通讯录整理.json`。
2. 不再用 `graph_profiles.json` 的标签、资源、需求、关键词等字段做首页推荐预筛。
3. 保留滑卡、换一批、历史排重、AI 调用、超时兜底。
4. 不修改图谱页面和 `/api/graph`。

## 任务类型

中等改动：后端首页匹配逻辑调整，保留其他功能不动。

## 开发前约束

1. 不修改无关文件。
2. 不删除图谱数据和图谱功能。
3. 不改前端滑卡逻辑。
4. 不提交 API key、`.env` 或原始未跟踪资料。
5. 修改前创建回撤点。

## AI 开发计划

- 回撤点：`checkpoint-before-raw-intro-match-20260607`
- 预计修改文件：
  - `files/server.mjs`
  - `docs/tasks/2026-06-07-raw-intro-match.md`
- 执行步骤：
  1. 创建回撤点。
  2. 新增任务记录。
  3. 修改 `/api/match`，候选人改为 `prefilter(`${intro} ${need}`, people, excludeIds)`。
  4. 返回包装改为 `withPeople(...)`。
  5. `matchSource` 固定返回 `raw_directory`。
  6. 验证接口返回 8 人、第二批不重复、图谱接口不受影响。

## AI 执行记录

- 已检查当前 Git 状态，存在未跟踪资料文件，本次不纳入。
- 已检查 `files/server.mjs` 中 `/api/match` 当前仍优先使用结构化画像。
- 已创建回撤点：`checkpoint-before-raw-intro-match-20260607`。

## 修改记录

- 修改文件：`files/server.mjs`
  - 修改内容：
    - `/api/match` 候选人来源改回 `loadPeople()` 读取的原始通讯录。
    - 候选预筛改回 `prefilter(`${intro} ${need}`, people, excludeIds)`。
    - AI 返回结果改回 `withPeople(...)` 包装。
    - `matchSource` 固定返回 `raw_directory`。
    - 移除首页匹配响应里的 `profileCount`，避免误以为首页仍使用结构化画像。
  - 修改原因：用户反馈标签画像匹配不准，需要回到原始介绍文本，让 AI 基于完整用户介绍判断。
  - 影响范围：只影响首页 `/api/match`；不影响 `/api/graph`、图谱页面、滑卡前端和换批排重。

- 新增文件：`docs/tasks/2026-06-07-raw-intro-match.md`
  - 修改内容：记录本次改动目标、计划、验证和结果。
  - 修改原因：按任务规则沉淀中等改动过程。
  - 影响范围：文档记录。

## 验证记录

- 验证方式：
  - `node --check files/server.mjs`
  - 重启本地服务 `http://localhost:8787/`
  - `GET /`
  - `GET /api/graph`
  - `POST /api/match`
  - `POST /api/match` 携带上一批 `excludeIds`
- 验证场景：
  - 首页是否可访问。
  - 图谱接口是否保持第二版画像图谱。
  - 首页匹配是否回到原始通讯录。
  - 首页匹配是否仍返回 8 人。
  - 下一批是否不重复。
- 验证结果：
  - 首页返回 HTTP 200。
  - `/api/graph` 仍返回 `version: ai-profile-v2`，298 人、213 关系。
  - `/api/match` 返回 `matchSource: raw_directory`、`corpusCount: 496`、`candidateCount: 60`、`matches.length: 8`。
  - `/api/match` 响应里不再包含 `profileCount`。
  - 第二批携带第一批 8 个 ID 后，返回 8 个新 ID，交集为空。
- 未验证项：
  - 未在真实手机上手动滑卡。
  - AI 接口当前仍可能超时，超时后会沿用已有兜底逻辑。

## 结果

已完成。首页匹配已改回第一版原始用户介绍文本，不再使用结构化标签/画像字段做首页推荐。

## 遗留问题

暂无。

## 文档更新判断

- 是否需要更新项目文档：本次更新任务记录。
- 是否需要更新方法论 SOP：否。
