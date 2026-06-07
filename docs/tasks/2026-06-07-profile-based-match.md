# 任务：首页匹配改用结构化画像数据

## 背景

当前项目已经有第二版图谱数据：

- `生财通讯录/outputs/graph_profiles.json`：298 个人物结构化画像
- `生财通讯录/outputs/graph_relations.json`：213 条人物关系
- `files/graph.html`：图谱页面
- `files/server.mjs`：已接入 `/api/graph`

用户确认希望首页 `/api/match` 也使用这份最新画像数据，并在保证匹配质量的同时提升 AI 生成速度。

当前首页匹配仍主要使用 `20260606-广州大课现场群-生财通讯录整理.json` 的原始 496 行数据，通过 2-gram 预筛 60 人，再让 AI 从候选人里生成 8 张滑卡。

## 目标

1. 首页 `/api/match` 优先使用 `graph_profiles.json` 的 298 人结构化画像。
2. 使用本地结构化打分先筛出高质量候选，减少发给 AI 的数据量。
3. AI 只处理 Top 16 左右的压缩画像，并输出 8 个推荐结果。
4. 继续支持历史 `excludeIds` 排重。
5. AI 失败时用结构化画像兜底，保证页面可用。
6. 将 `graph_profiles.json` 和 `graph_relations.json` 纳入可交付版本。

## 任务类型

中等改动：后端匹配逻辑调整 + 数据文件纳入交付 + 任务记录。

## 开发前约束

1. 不修改无关文件
2. 不重构整体架构，除非用户明确要求
3. 不删除已有功能
4. 先定位问题，再修改代码
5. 修改前先说明预计影响范围

## AI 开发计划

- 本次任务类型：中等改动
- 需要阅读的文档：
  - `任务记录规则_空白模板.md`
  - `docs/tasks/2026-06-07-swipe-card-match.md`
- 需要检查的文件：
  - `files/server.mjs`
  - `生财通讯录/outputs/graph_profiles.json`
  - `生财通讯录/outputs/graph_relations.json`
  - `.gitignore`
- 预计修改的文件：
  - `files/server.mjs`
  - `.gitignore`
  - `docs/tasks/2026-06-07-profile-based-match.md`
- 预计纳入 Git 的文件：
  - `生财通讯录/outputs/graph_profiles.json`
  - `生财通讯录/outputs/graph_relations.json`
- 执行步骤：
  1. 创建 checkpoint：`checkpoint-before-profile-match-20260607`
  2. 新增任务记录。
  3. 增加结构化画像读取和缓存。
  4. 增加画像字段本地打分。
  5. 改 `/api/match` 优先使用画像候选。
  6. 缩短 AI prompt，发 Top 16 压缩画像。
  7. 增加画像兜底推荐。
  8. 验证接口返回 8 人、排重有效、页面仍可用。
  9. 提交并推送。

## AI 执行记录

- 阅读了：
  - `files/server.mjs`
  - `graph_profiles.json` 样例字段
  - `graph_relations.json` 样例字段
  - `.gitignore`
- 检查了：
  - `/api/graph` 已能返回 `ai-profile-v2`
  - `graph_profiles.json` 内 `profiles.length = 298`
  - `graph_relations.json` 内 `relations.length = 213`
  - 当前 `/api/match` 仍调用 `loadPeople()` 和原始 496 行数据
- 发现问题：
  - 首页匹配没有直接用结构化画像。
  - AI prompt 发给模型的候选信息仍偏原始，文本量较大。
  - `graph_profiles.json` 和 `graph_relations.json` 当前被 `.gitignore` 忽略。
- 采用方案：
  - 首页匹配优先读取结构化画像。
  - 用本地规则对 industries、resources、needs、strengths、business_model、customer_segments、collaboration_angles、keywords、summary、evidence 等字段做打分。
  - 只把 Top 16 压缩画像交给 AI。
  - 保留原始通讯录作为兜底。

## 修改记录

- 修改文件：`files/server.mjs`
  - 修改内容：
    - 新增 `graph_profiles.json` 画像读取、缓存和标准化逻辑。
    - 新增结构化画像本地打分和 Top 16 预筛逻辑。
    - `/api/match` 优先使用 298 个结构化画像，返回 `matchSource: "graph_profiles"`、`profileCount`、`candidateCount`。
    - 保留 `excludeIds` 排重；画像数据存在时不会退回旧原始 496 行，避免历史推荐重复。
    - AI 调用优先走 Chat Completions，并增加 `OPENAI_TIMEOUT_MS` 超时配置。
    - AI 超时或失败时，用结构化画像字段生成 8 个兜底推荐、协同点和破冰话术。
  - 修改原因：让首页匹配真正使用最新清理后的结构化画像数据，并减少 AI 输入规模，提高响应稳定性。
  - 影响范围：`/api/match` 数据来源和新增返回字段；前端原有滑卡字段兼容，不需要改接口消费逻辑。

- 修改文件：`.gitignore`
  - 修改内容：允许提交 `graph_profiles.json` 和 `graph_relations.json`。
  - 修改原因：两份文件是当前可交付版本的数据源。
  - 影响范围：只影响 Git 纳入范围，不影响运行逻辑。

- 修改文件：`.env.example`
  - 修改内容：新增 `OPENAI_TIMEOUT_MS=12000` 示例。
  - 修改原因：让部署环境可以按需控制 AI 超时。
  - 影响范围：只影响环境变量说明。

- 新增文件：`生财通讯录/outputs/graph_profiles.json`
  - 修改内容：298 个人物结构化画像。
  - 修改原因：首页匹配和图谱的数据源。
  - 影响范围：`/api/match`、`/api/graph`。

- 新增文件：`生财通讯录/outputs/graph_relations.json`
  - 修改内容：213 条人物关系。
  - 修改原因：图谱页的人物关系数据源。
  - 影响范围：`/api/graph`。

## 验证记录

- 验证方式：
  - `node --check files/server.mjs`
  - `node --check 生财通讯录/build-graph-data.mjs`
  - `curl http://localhost:8787/api/graph`
  - `POST http://localhost:8787/api/match`
  - `POST http://localhost:8787/api/match` 携带上一批 `excludeIds`
  - `POST http://localhost:8787/api/match` 携带全部 298 个画像 ID 作为 `excludeIds`
- 验证场景：
  - 图谱 API 是否读取第二版画像关系数据。
  - 首页匹配是否使用 `graph_profiles`。
  - 首页匹配是否返回 8 人。
  - AI 超时后是否用结构化画像兜底返回。
  - 下一批推荐是否不重复。
  - 全部画像被排除后是否不会回退旧数据。
- 验证结果：
  - `/api/graph` 返回 `version: ai-profile-v2`，统计为 298 人、100 标签、29 城市、213 关系。
  - `/api/match` 返回 `matchSource: graph_profiles`、`profileCount: 298`、`candidateCount: 16`、`matches.length: 8`。
  - 首次测试耗时约 12.09 秒，外部模型超时后成功进入结构化画像兜底。
  - 第二批携带第一批 8 个 ID 后，返回 8 个新 ID，交集为空。
  - 携带全部 298 个画像 ID 后，返回 `candidateCount: 0`、`matches.length: 0`，没有回退旧原始数据。
- 未验证项：
  - 未在真实手机浏览器重新手动滑卡。
  - 未对每条 AI 画像逐条人工校验准确性。

## 结果

已完成。首页匹配现在优先使用最新 298 个结构化画像，并通过本地预筛把 AI 候选压缩到 16 人；AI 慢或失败时仍能用画像字段生成推荐结果，保证演示可用。

## 遗留问题

暂无。

## 文档更新判断

- 是否需要更新项目文档：本次先更新任务记录。
- 是否需要更新方法论 SOP：否。
