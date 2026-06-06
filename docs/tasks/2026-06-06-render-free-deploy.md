# 任务：AI 航海家网站 Render Free 部署准备与上线协助

## 背景

用户希望为 `/Users/zhenghan/Desktop/ai 编程项目/黑客松作业/files` 下的网站选择低成本服务器方案，并最终使用 Render Free 部署。

项目形态经检查后确认为：

- 前端：`files/index.html`
- 后端：`files/server.mjs`
- 运行方式：Node.js 原生 HTTP 服务
- 后端接口：`/api/people/count`、`/api/match`
- 数据来源：`生财通讯录/outputs/20260606-广州大课现场群-生财通讯录整理.json`
- AI 配置来源：本地 `api配置.md` 或环境变量

会话中先讨论了腾讯云轻量应用服务器、Oracle Cloud、Cloudflare、Vercel、Render 等方案，最终用户选择 Render Free。

## 目标

1. 判断该网站适合什么服务器或托管平台。
2. 将项目整理为 Render Free 可以部署的结构。
3. 避免把本地密钥文件上传到 GitHub。
4. 协助用户在 Render 上创建 Blueprint 服务。
5. 指导用户补齐 AI 环境变量。
6. 记录本次会话和部署过程。

## 任务类型

部署准备 / 配置整理 / 上线协助 / 任务记录。

## 开发前约束

1. 不修改无关文件
2. 不重构整体架构，除非用户明确要求
3. 不删除已有功能
4. 先定位问题，再修改代码
5. 修改前先说明预计影响范围

## AI 开发计划

- 本次任务类型：中等改动，主要是部署配置和文档补充。
- 需要阅读的文档：`任务记录规则_空白模板.md`
- 需要检查的文件：`files/index.html`、`files/server.mjs`、`.gitignore`、`api配置.md`
- 预计修改的文件：`.gitignore`、`package.json`、`render.yaml`、`.env.example`、`RENDER_DEPLOY.md`、`docs/tasks/2026-06-06-render-free-deploy.md`
- 执行步骤：
  - 检查项目目录和 Git 状态。
  - 判断项目是否为纯前端或需要 Node 后端。
  - 补 Render 所需启动配置。
  - 排除密钥、压缩包和不必要的大量生成文件。
  - 本地验证 Node 服务和数据接口。
  - 协助用户在 Render 创建 Blueprint。
  - 指导用户配置 AI 环境变量。
  - 记录完整过程。

## AI 执行记录

- 阅读了：
  - `files/index.html`
  - `files/server.mjs`
  - `.gitignore`
  - `任务记录规则_空白模板.md`
- 检查了：
  - 项目文件结构
  - Git 状态
  - GitHub remote
  - Render 所需入口
  - 通讯录 JSON 文件位置
  - 本地 AI 配置中的 base url 和 model
- 发现问题：
  - 项目不是纯前端，不能只用 GitHub Pages 或 Cloudflare Pages 静态部署。
  - 后端依赖本地 JSON 和 AI API Key，必须使用支持 Node 后端和环境变量的平台。
  - `api配置.md` 含本地密钥，不能上传。
  - 通讯录数据属于敏感数据，GitHub 仓库建议设置为 Private。
  - 本地默认端口 `8787` 已被占用，验证时改用 `8790`。
- 采用方案：
  - 使用 Render Free Web Service。
  - 保持现有 `files/server.mjs` 结构不变。
  - 在仓库根目录新增 `package.json` 和 `render.yaml`。
  - 使用 Render 环境变量注入 AI 配置。
  - 通过 `.gitignore` 排除密钥、压缩包、头像、浏览器缓存、卡片等非部署必需内容。

## 修改记录

- 修改文件：`.gitignore`
- 修改内容：
  - 排除 `.env`、`.env.*`、`api配置.md`
  - 排除 `*.zip`
  - 排除 `生财通讯录/.browser-profile/`
  - 排除 `生财通讯录/avatars/`
  - 排除 `生财通讯录/cards/`
  - 排除 `生财通讯录/outputs/*`
  - 仅保留部署需要的 `生财通讯录/outputs/20260606-广州大课现场群-生财通讯录整理.json`
- 修改原因：避免上传密钥和大量非必要生成文件，同时保留后端运行所需数据。
- 影响范围：只影响 Git 跟踪范围，不影响运行逻辑。

- 修改文件：`package.json`
- 修改内容：
  - 新增项目名称、Node ESM 类型、启动脚本。
  - `start` 命令为 `node files/server.mjs`
  - `dev` 命令为 `PORT=8787 node files/server.mjs`
  - 指定 Node 版本 `>=20`
- 修改原因：让 Render 能识别并启动 Node 服务。
- 影响范围：新增部署启动入口，不改业务逻辑。

- 修改文件：`render.yaml`
- 修改内容：
  - 新增 Render Blueprint 配置。
  - 服务类型为 Web Service。
  - Runtime 为 Node。
  - Plan 为 Free。
  - Build Command 为 `npm install`。
  - Start Command 为 `npm start`。
  - 声明 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 环境变量。
- 修改原因：让 Render 可以从 GitHub 仓库自动创建服务。
- 影响范围：只影响 Render 部署。

- 修改文件：`.env.example`
- 修改内容：
  - 新增 `OPENAI_API_KEY`
  - 新增 `OPENAI_BASE_URL=https://api.openai.com`
  - 新增 `OPENAI_MODEL=gpt-4.1-mini`
- 修改原因：提供环境变量模板。
- 影响范围：文档和配置示例，不影响运行。

- 修改文件：`RENDER_DEPLOY.md`
- 修改内容：
  - 记录 Render 部署步骤。
  - 记录环境变量填写方式。
  - 记录验证接口 `/api/people/count`。
  - 记录常见 AI 配置问题。
- 修改原因：方便用户后续自行复现部署流程。
- 影响范围：文档，不影响运行。

- 修改文件：`docs/tasks/2026-06-06-render-free-deploy.md`
- 修改内容：记录本次完整会话和部署过程。
- 修改原因：满足任务记录规则。
- 影响范围：文档，不影响运行。

## 验证记录

- 验证方式：
  - 本地启动：
    - `PORT=8790 npm start`
  - 数据接口请求：
    - `curl -s http://localhost:8790/api/people/count`
  - Git 忽略规则检查：
    - `git check-ignore -v api配置.md .env files.zip files/ai-navigator-site.zip ...`
  - GitHub remote 检查：
    - `git remote -v`
    - `git ls-remote origin HEAD 'refs/heads/*'`
- 验证场景：
  - 确认 Render 启动命令能跑。
  - 确认后端能读到通讯录 JSON。
  - 确认 `api配置.md` 不会被上传。
  - 确认 GitHub 仓库 remote 为 `git@github.com:zerozhenghan/hello_hanghaijia.git`。
  - 确认远端 `main` 分支指向提交 `1a84dca`。
- 验证结果：
  - 本地服务在 `8790` 端口启动成功。
  - `/api/people/count` 返回：

```json
{"count":496,"summary":{"matched":298,"needs_review":16,"unmatched":182}}
```

  - `api配置.md`、`.env`、压缩包、头像、浏览器缓存、卡片等均被 `.gitignore` 排除。
  - 用户反馈：推送后已经可以在手机访问网站。
- 未验证项：
  - `/api/match` 真实 AI 调用未完整验证；测试时请求超过 30 秒未返回，已停止等待。
  - Render 上 AI 环境变量配置后的最终匹配结果，需要用户在 Render 配好变量后再次测试。
  - 未确认 GitHub 仓库是否为 Private，建议用户自行确认。

## 结果

项目已具备 Render Free 部署条件，并已通过 GitHub 仓库 `zerozhenghan/hello_hanghaijia` 进入 Render Blueprint 创建流程。

Render 创建过程中用户已完成：

- New + Blueprint
- 选择仓库 `zerozhenghan/hello_hanghaijia`
- Blueprint Name 填写为 `hello-hanghaijia`
- Branch 使用 `main`
- Blueprint Path 留空
- 创建 Web Service `ai-navigator-site`

用户反馈网站已经可在手机访问，说明前端和基础后端部署成功。

AI 配置后续需要在 Render 服务的 Environment 中补齐：

```text
OPENAI_API_KEY=完整 API Key
OPENAI_BASE_URL=https://lucen.cc
OPENAI_MODEL=gpt-5.5
```

其中本地仅确认过：

- `OPENAI_API_KEY` 存在，未记录完整值。
- `OPENAI_BASE_URL=https://lucen.cc`
- `OPENAI_MODEL=gpt-5.5`

## 遗留问题

1. 需要用户在 Render 的 `ai-navigator-site` 服务中配置 AI 环境变量。
2. 配置后需要重新部署或等待 Render 自动部署。
3. 需要重新测试网页里的“帮我找人”功能。
4. 建议确认 GitHub 仓库为 Private，因为仓库中包含通讯录 JSON。
5. 如果后续继续修改代码，需要 `git add`、`git commit`、`git push origin main`，Render 若开启 Auto-Deploy 会自动同步最新版本。

## 文档更新判断

- 是否需要更新项目文档：已新增 `RENDER_DEPLOY.md`
- 是否需要更新方法论 SOP：暂不需要。本次经验偏项目部署记录，已写入任务文档。

📌 来源：2026-06-06 Codex 会话：服务器选型、Render Free 部署准备、GitHub/Render 联动、AI 环境变量配置
🎯 应用：后续复盘 AI 航海家网站部署流程、排查 Render 部署和 AI 配置问题
