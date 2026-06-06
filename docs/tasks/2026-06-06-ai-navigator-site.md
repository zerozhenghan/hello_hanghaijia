# 任务：AI 航海家人脉雷达网站开发与发布

## 背景

用户已有一个单页网站原型，路径为 `files/index.html`，页面内写死了示例名片，并在前端保留 AI API 直连配置。用户希望将网站名片替换成 `生财通讯录` 中现场群整理结果，并要求名片推荐和 AI 调用都走后端逻辑，不能把数据和 API Key 写死在前端。

用户提供了 `api配置.md`，其中包含 OpenAI Responses 风格接口配置和本地 API Key。用户明确指定数据源使用 `生财通讯录/outputs/20260606-广州大课现场群-生财通讯录整理.json`，共 496 行现场群整理结果。

后续用户继续提出移动端适配、标题文案调整、换一批推荐、上一批回看、GitHub 推送、仓库开源状态确认和网站口语化介绍等需求。

## 目标

1. 将网站从纯前端原型改为前后端结构。
2. 后端读取现场群整理结果 496 行。
3. 后端调用 AI API 生成推荐，不在前端暴露密钥。
4. 前端展示推荐人、推荐理由、契合点和破冰开场白。
5. 支持移动端适配。
6. 支持“换一批”推荐，且不重复推荐历史出现过的人。
7. 支持“查看上一批”回看历史批次，同时继续换新时仍排除所有历史推荐记录。
8. 将代码提交并推送到 GitHub 仓库。
9. 记录本次完整开发过程。

## 任务类型

中 / 大改动：新功能、后端接入、前后端交互、部署配置、GitHub 推送。

## 开发前约束

1. 不修改无关文件
2. 不重构整体架构，除非用户明确要求
3. 不删除已有功能
4. 先定位问题，再修改代码
5. 修改前先说明预计影响范围

## AI 开发计划

- 本次任务类型：中 / 大改动，包含后端新增、前端改造、数据接入、AI 接入、移动端适配、Git 发布。
- 需要阅读的文档：
  - `任务记录规则_空白模板.md`
  - `api配置.md`
  - `RENDER_DEPLOY.md`
- 需要检查的文件：
  - `files/index.html`
  - `生财通讯录/outputs/20260606-广州大课现场群-生财通讯录整理.json`
  - `.gitignore`
  - `package.json`
  - `render.yaml`
- 预计修改的文件：
  - `files/index.html`
  - `files/server.mjs`
  - `.gitignore`
  - `package.json`
  - `render.yaml`
  - `RENDER_DEPLOY.md`
  - `.env.example`
  - `docs/tasks/2026-06-06-ai-navigator-site.md`
- 执行步骤：
  1. 查看项目结构、Git 状态和现有页面实现。
  2. 确认数据源和 API 配置。
  3. 新增 Node 后端，读取 496 行现场群整理结果。
  4. 将 AI 调用迁移到后端。
  5. 改造前端，只调用后端接口。
  6. 加入移动端适配。
  7. 加入换一批推荐与历史排重。
  8. 加入上一批回看。
  9. 验证接口、页面和 Git 状态。
  10. 配置 GitHub 远程仓库并推送。
  11. 确认仓库公开状态。
  12. 整理网站介绍和任务记录。

## AI 执行记录

- 阅读了：
  - `files/index.html`
  - `api配置.md`
  - `任务记录规则_空白模板.md`
  - `package.json`
  - `render.yaml`
  - `RENDER_DEPLOY.md`
- 检查了：
  - `git status --short`
  - `git remote -v`
  - `git log --oneline`
  - `生财通讯录/outputs/20260606-广州大课现场群-生财通讯录整理.json`
  - `api配置.md` 的模型、base_url 和 API Key 配置方式
  - GitHub 仓库 `zerozhenghan/hello_hanghaijia` 的公开状态
- 发现问题：
  - 原网站为纯前端单页，名片数据和 AI 配置都在前端。
  - 前端直连 AI 会暴露 API Key。
  - 项目初始没有 Git commit，也没有 GitHub remote。
  - 本机没有 `gh` 命令，HTTPS push 缺少 GitHub 凭据。
  - 本机已有 GitHub SSH key，但 SSH config 未配置。
  - `api配置.md` 明文包含 API Key，必须忽略。
- 采用方案：
  - 新增 `files/server.mjs` 作为 Node 后端。
  - 后端从本地数据文件读取 496 行。
  - 后端读取环境变量或 `api配置.md`，调用 OpenAI Responses 风格接口。
  - 前端只调用 `/api/people/count` 和 `/api/match`。
  - `.gitignore` 排除密钥、zip、头像、浏览器缓存、大量生成文件，仅保留部署所需 JSON。
  - 通过已有 SSH key 配置 GitHub 远程并推送。

## 修改记录

- 修改文件：`.gitignore`
  - 修改内容：忽略 `.env`、`api配置.md`、zip、头像、cards、浏览器缓存、`.codex-build`、非必要 outputs 文件；保留现场群整理 JSON。
  - 修改原因：避免提交密钥、大文件和无关生成资产。
  - 影响范围：只影响 Git 跟踪规则。

- 修改文件：`.env.example`
  - 修改内容：新增 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 示例。
  - 修改原因：方便部署时配置环境变量。
  - 影响范围：部署配置说明。

- 修改文件：`package.json`
  - 修改内容：新增 Node 项目基础配置、`start` 和 `dev` 脚本。
  - 修改原因：让 Render 或本地能用 `npm start` 启动后端服务。
  - 影响范围：启动方式。

- 修改文件：`render.yaml`
  - 修改内容：新增 Render Web Service 配置。
  - 修改原因：方便用户后续部署。
  - 影响范围：部署配置。

- 修改文件：`RENDER_DEPLOY.md`
  - 修改内容：新增 Render 部署说明、环境变量说明、验证方式和常见问题。
  - 修改原因：沉淀部署流程。
  - 影响范围：文档。

- 新增文件：`files/server.mjs`
  - 修改内容：
    - 提供静态文件服务。
    - 提供 `GET /api/people/count`。
    - 提供 `POST /api/match`。
    - 读取现场群整理 JSON。
    - 归一化参会者字段。
    - 用中文 2-gram 做候选预筛。
    - 调用 OpenAI Responses 风格 AI 接口。
    - 支持 `excludeIds` 排除已推荐历史。
  - 修改原因：实现后端数据和 AI 推荐逻辑。
  - 影响范围：新增后端运行入口。

- 修改文件：`files/index.html`
  - 修改内容：
    - 删除前端写死示例名片数组和前端 AI API 配置。
    - 改为调用后端 `/api/people/count` 和 `/api/match`。
    - 标题改为“你好航海家”。
    - footer 改为“基于现场群整理结果”。
    - 移动端适配：边距、标题、输入框、示例标签横向滚动、卡片换行、复制按钮位置。
    - 增加“换一批”按钮。
    - 增加历史推荐 `seenIds`，向后端传 `excludeIds`。
    - 增加批次历史 `batches`、当前批次 `currentBatchIndex`。
    - 增加“查看上一批”按钮，支持回看上一批。
  - 修改原因：实现用户要求的前端交互和后端化。
  - 影响范围：页面展示和推荐交互。

- 修改文件：`生财通讯录/outputs/20260606-广州大课现场群-生财通讯录整理.json`
  - 修改内容：未改内容，仅作为部署所需数据文件纳入 Git。
  - 修改原因：后端运行需要读取 496 行现场群整理结果。
  - 影响范围：数据源。

- 修改文件：`/Users/zhenghan/.ssh/config`
  - 修改内容：配置 GitHub SSH 使用已有 key `~/.ssh/id_ed25519_zerozhenghan_github`。
  - 修改原因：HTTPS push 缺少凭据，本机已有可用 GitHub SSH key。
  - 影响范围：本机 GitHub SSH 连接。

## 验证记录

- 验证方式：命令行语法检查
  - 验证场景：检查 Node 后端语法。
  - 验证命令：`node --check files/server.mjs`
  - 验证结果：通过。
  - 未验证项：无。

- 验证方式：接口验证
  - 验证场景：读取现场群人数。
  - 验证命令：`curl -s http://localhost:8787/api/people/count`
  - 验证结果：返回 `{"count":496,"summary":{"matched":298,"needs_review":16,"unmatched":182}}`。
  - 未验证项：无。

- 验证方式：AI 推荐接口验证
  - 验证场景：输入跨境电商、海外仓、供应链诉求。
  - 验证结果：AI 返回 4 位推荐人，包含推荐理由、契合点、破冰开场白、note、candidateCount。
  - 未验证项：没有做高并发测试。

- 验证方式：排重验证
  - 验证场景：向 `/api/match` 传入历史 `excludeIds`。
  - 验证结果：返回 4 个新 ID，重复数为 `0`。
  - 未验证项：未穷尽 496 人全部轮换后的极限状态。

- 验证方式：前端静态验证
  - 验证场景：检查页面是否包含“换一批”“查看上一批”“seenIds”“batches”等关键逻辑。
  - 验证结果：页面 HTML 已返回相关内容。
  - 未验证项：没有用真实手机逐屏手动验收。

- 验证方式：脚本语法验证
  - 验证场景：提取 `index.html` 中内联 script，用 `new Function(script)` 做语法检查。
  - 验证结果：通过。
  - 未验证项：浏览器交互未用自动化工具完整跑通。

- 验证方式：GitHub 推送验证
  - 验证场景：配置远程仓库并推送。
  - 验证结果：
    - `git remote` 为 `git@github.com:zerozhenghan/hello_hanghaijia.git`
    - `main` 已推送到 GitHub
    - 最新远端 commit 为 `f2aa75f feat: 支持推荐批次回看`
  - 未验证项：GitHub Pages 或 Render 部署未实际配置。

- 验证方式：仓库公开状态验证
  - 验证场景：查询 GitHub API。
  - 验证结果：
    - 仓库 `zerozhenghan/hello_hanghaijia`
    - `private: false`
    - `visibility: public`
    - `license: null`
  - 未验证项：未添加开源协议。

## 结果

已完成一个可本地运行并已推送 GitHub 的 AI 航海家人脉推荐网站。

网站能力：

1. 基于现场群整理结果 496 行推荐人脉。
2. 用户输入身份和诉求后，AI 返回 3-4 位推荐对象。
3. 每个推荐对象包含匹配分、推荐理由、契合点、破冰开场白和标签。
4. 支持复制破冰开场白。
5. 支持移动端适配。
6. 支持“换一批”，并排除历史所有推荐过的人。
7. 支持“查看上一批”回看历史批次。
8. API Key 不暴露在前端，部署时可通过环境变量配置。
9. 已推送到 GitHub 仓库：`https://github.com/zerozhenghan/hello_hanghaijia`

本次提交：

- `1a84dca feat: 接入现场群通讯录和 AI 推荐`
- `f2aa75f feat: 支持推荐批次回看`

## 遗留问题

1. 仓库当前是 public，但没有 `LICENSE`，严格意义上还没有明确开源许可。
2. 本地仍有未跟踪的原始资料文件，包括：
   - `任务记录规则_空白模板.md`
   - `生财通讯录/export-scys-directory.mjs`
   - `生财通讯录/航海家通讯录.csv`
   - `生财通讯录/航海家通讯录.json`
   - `生财通讯录/航海家通讯录.md`
3. 未实际部署到 Render。
4. 未用真实手机做完整人工验收。
5. `api配置.md` 仍在本地明文保存 API Key，已被 `.gitignore` 忽略，但后续上线建议统一改为环境变量。

## 文档更新判断

- 是否需要更新项目文档：是。已新增 `RENDER_DEPLOY.md`，本记录也补充完整任务过程。
- 是否需要更新方法论 SOP：否。本次没有沉淀新的通用开发 SOP。
