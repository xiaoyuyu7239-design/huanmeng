# 衍境·心界

这是面向年轻女性的关系叙事产品「衍境·心界」Vite + React 本地版，包含玩家优先首页、互动故事播放器、历史世界归档、创作者介绍页，以及分为快速创作与专业模式的浏览器本机创作台。剧情与多媒体资源默认从 `公共资源/` 读取，播放器在断网时仍可使用本地内容。

## 本地运行

需要 Node.js 18 或更高版本。

```bash
npm install
npm run dev
```

默认地址为 `http://127.0.0.1:5173`。主要入口：

- `/`：玩家优先首页
- `/play` 或 `/game`：播放器；可用 `?game=<slug>` 指定作品
- `/play?game=ninth-seat`：《第九席》第一章直达入口
- `/worlds`：历史互动实验归档
- `/creators`：创作者能力与 EvoMap 二级介绍页
- `/creator`：创作台

创作台默认进入快速创作，依次整理角色圣经、叙事关系、节点情绪与一致性资产；切换到专业模式后可继续编辑完整剧情节点、机制、媒体与发布校验。两种模式共用同一份项目数据，不会生成平行草稿。

《第九席》的四个章节私聊与林渺同盟复盘开放最多三轮自由表达；清除正文不会重置同节点轮数。AI 只识别玩家的沟通意图，玩家可见台词始终从正式故事中的作者定稿回应选取。未配置真实模型时，界面会明确显示“AI 未接入”，并使用本地意图匹配；原有剧情选择和结局始终可以继续。浏览器与服务端共用现实危机边界，明确自伤表达会在外发前退出角色扮演，离线时也只显示非角色安全支持。

## 检查与构建

```bash
npm test
npm run build
npm start
```

`npm test` 会运行剧情引擎、创作台、《第九席》内容路线、资源引用、心界 UI、玩家首页数据/SSR 契约、关系 AI 安全测试和页面壳层回归；生产文件输出到 `dist/`。`npm start` 默认监听 `0.0.0.0:4173`，本机可从 `http://127.0.0.1:4173` 访问构建产物与同源关系 AI 代理。

## 关系 AI 服务端配置

复制 `.env.example` 中的配置到服务进程环境变量。生产密钥只能使用无 `VITE_` 前缀的服务端变量：

```bash
RELATIONSHIP_AI_BASE_URL=https://provider.example/v1
RELATIONSHIP_AI_API_KEY=replace-on-server
RELATIONSHIP_AI_MODEL=your-model
RELATIONSHIP_AI_DATA_POLICY_CONFIRMED=true
RELATIONSHIP_AI_SESSION_SECRET=replace-with-at-least-32-random-characters
RELATIONSHIP_AI_GUARD_URL=https://your-shared-guard.example
RELATIONSHIP_AI_GUARD_TOKEN=replace-on-server
RELATIONSHIP_AI_PROVIDER_HARD_BUDGET_CONFIRMED=true
```

只有模型凭据、数据保留确认、至少 32 字符的服务端会话密钥、共享原子保护服务和供应商账户硬额度确认全部存在时，才会调用 OpenAI-compatible `/chat/completions`；否则强制使用作者回应。频次、日 Token 预算、输出上限与超时见 `.env.example`。接口只支持同源，不提供跨域白名单。

服务端只接受正式作品、节点、角色、玩家单条表达和轮次 ID，不接受浏览器提交的会话身份、模型、system prompt、角色圣经、状态补丁或剧情跳转。匿名会话由服务端签名 HttpOnly Cookie 建立。模型只能返回 `intent` 与 `safety`，额外的 `reply`、摘要、剧情事实或状态字段会使整次输出作废；服务端再按意图选择作者定稿台词并生成确定性表达标签，二者都不会写入剧情状态。

共享保护服务需提供两个服务端接口：`POST /relationship-ai/reserve` 原子检查独立 IP 小时限额、IP + 节点轮次、签名会话并发、全局并发、全局日预算和轮次幂等，返回 `allow`、`deny` 或带已提交响应描述的 `replay`；`POST /relationship-ai/commit` 用供应商 `usage.total_tokens` 结算预留，并只保存不含台词/摘要的幂等描述。重放时服务端会从当前正式故事合同重新生成作者台词与表达标签，不能信任共享缓存提供的玩家可见文本。保护服务超时、异常或返回无效合同都会在调用模型前 fail closed。部署方可用共享 Redis/KV 实现，但不能用单 Node 进程 Map 冒充全局保护。

`npm start` 按生产运行时启用 Secure + HttpOnly + SameSite Cookie。默认用直连 socket IP 限流；经 TLS 负载均衡器/反向代理部署时，必须在 `.env.example` 中同时填写代理的精确 `RELATIONSHIP_AI_TRUSTED_PROXY_IPS` 与固定 `RELATIONSHIP_AI_TRUST_PROXY_HOPS`。服务端只在直连地址命中白名单后从 `X-Forwarded-For` 右侧按跳数取客户端 IP，不会盲信浏览器伪造的转发头。纯 HTTP 本地模型联调可显式设置 `RELATIONSHIP_AI_COOKIE_SECURE=false`，线上不得关闭。

## 数据与浏览器存储

- 静态作品：`公共资源/games/<slug>/story.json`
- 静态作品的可选创作资料：`公共资源/games/<slug>/creator.json`
- 首页精选：`公共资源/showcase.json`
- 全景、视频、语音、音乐和界面素材：`公共资源/` 下对应目录
- 创作台本机项目、精选、快速/专业模式偏好与非敏感显示偏好：保存在当前站点的浏览器 `localStorage`
- 玩家存档：按作品分别保存在当前站点的浏览器 `localStorage`
- 关系私聊正文与确定性表达标签：只保留在当前页面内存，离开场景即清除，不进入玩家存档或存档码
- 关系 AI 匿名会话：仅使用服务端签名的 HttpOnly Cookie；浏览器脚本不能读取或自行轮换身份

旧版本残留在 `creator:browser-settings:v1` 的 API Key 会在创作台读取设置时自动删除。清理站点数据会同时删除本机创作项目、偏好和玩家存档。不要把真实 API Key 写进源码、`VITE_*` 变量或提交到仓库。

## 部署注意

推荐用 `npm run build && npm start` 或把 `服务端/关系AI代理.js` 接到部署平台的同源 Node/Serverless 路由。各页面由前端按 URL 路径分发；部署到静态托管平台时，需要把 `/play`、`/game`、`/worlds`、`/creators`、`/creator` 及其尾斜杠形式回写到 `index.html`，否则直接刷新子路径可能由托管平台返回 404。纯静态托管没有 `/api`，玩家端会明确显示服务不可用并回退作者回应。

真实模型默认 fail closed。多实例或单实例正式部署都必须先接入共享 KV/Redis 的原子保护，并在模型供应商后台设置账户硬额度；本地备用模式不需要这些外部依赖。

创作台当前已实现本机项目管理、角色圣经、关系图、情绪曲线、一致性资产、节点编辑、校验、精选管理和发布到本机播放器。`story.cast` 始终是角色姓名、立绘、声线、可发展关系与初始关系值的运行时权威源；`project.authoring` 只保存以角色或节点 id 关联的作者资料。依赖 DeepSeek、图片、语音或音乐服务的生成能力若仍显示“尚未接入”，代表该外部调用尚未启用，不会在后台偷偷发送密钥或产生费用。
