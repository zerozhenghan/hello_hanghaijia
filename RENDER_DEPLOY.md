# Render 部署说明

这个项目是一个 Node.js Web Service：

- 前端入口：`files/index.html`
- 后端入口：`files/server.mjs`
- 启动命令：`npm start`
- 数据文件：`生财通讯录/outputs/20260606-广州大课现场群-生财通讯录整理.json`

## 1. 上传到 GitHub

建议新建一个私有仓库，然后把当前目录上传到 GitHub。

不要上传：

- `api配置.md`
- `.env`
- `.env.*`
- 压缩包
- 头像、浏览器缓存、原始卡片等生成文件

这些已经在 `.gitignore` 里排除了。

## 2. 在 Render 创建服务

推荐方式：New + Blueprint，选择这个 GitHub 仓库。Render 会自动读取根目录的 `render.yaml`。

如果手动创建 Web Service，配置如下：

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Plan: Free

## 3. 配置环境变量

在 Render 的 Environment 里填写：

```text
OPENAI_API_KEY=你的 API Key
OPENAI_BASE_URL=你的 OpenAI 兼容接口地址
OPENAI_MODEL=gpt-4.1-mini
```

如果使用官方 OpenAI，`OPENAI_BASE_URL` 可以填：

```text
https://api.openai.com
```

如果使用第三方中转，填对应的 base url。

## 4. 验证

部署成功后，打开 Render 给你的网址。

也可以访问：

```text
https://你的-render域名/api/people/count
```

如果返回类似下面的 JSON，说明后端和数据文件正常：

```json
{"count":496,"summary":{"matched":298,"needs_review":16,"unmatched":182}}
```

## 5. 常见问题

如果页面提示 AI 接口失败，优先检查：

- `OPENAI_API_KEY` 是否填错
- `OPENAI_BASE_URL` 是否需要带 `/v1`，当前代码两种都兼容
- `OPENAI_MODEL` 是否是你的接口支持的模型

Render Free 服务无人访问时会休眠，第一次打开可能需要等几十秒。
