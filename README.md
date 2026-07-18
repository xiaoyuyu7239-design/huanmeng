# 幻梦

这是面向年轻女性的关系叙事产品「幻梦」Vite + React 本地版，包含玩家优先首页、互动故事播放器、历史世界归档、创作者介绍页，以及分为快速创作与专业模式的浏览器本机创作台。剧情与多媒体资源默认从 `公共资源/` 读取，播放器在断网时仍可使用本地内容。

## 本地运行

需要 Node.js `22.23.1` 与 npm `10.9.x`；版本分别固定在 `.nvmrc` 和 `packageManager`。

```bash
npm ci
npm run dev
```

默认地址为 `http://127.0.0.1:5173`。主要入口：

- `/`：玩家优先首页
- `/play` 或 `/game`：播放器；可用 `?game=<slug>` 指定作品
- `/play?game=ninth-seat`：《第九席》第一章直达入口
- `/play?game=<slug>&preview=draft&from=creator`：仅供创作台打开的已保存草稿试玩
- `/worlds`：历史互动实验归档
- `/creators`：创作者能力与 EvoMap 二级介绍页
- `/creator`：创作台

创作台默认进入快速创作，新项目直接提供“开场 + 两项选择 + 两个结局”的最小可试玩骨架，并依次整理角色圣经、叙事关系、节点情绪与一致性资产；切换到专业模式后可继续编辑完整剧情节点、机制、媒体与发布校验。两种模式共用同一份草稿，不会生成平行项目。校验结果可展开查看全部错误与警告，阻塞一致性规则必须给出通过、未通过或带理由的豁免结论。

创作台可以把当前浏览器中的草稿、上次发布快照与精选配置导出为版本化 JSON 创作包。导入会先执行 dry-run 并列出新增、覆盖和拒绝原因，只有再次确认后才写入；覆盖前会下载当前仓备份，任一存储读写失败都会回滚，不把半份数据留在浏览器里。创作包只在本机生成和读取，不会上传。

`game` 只接受小写字母、数字、短横线和下划线组成的规范 slug。显式作品不存在、损坏或地址非法时，播放器显示独立错误页，不会静默改播《第九席》或写入其他作品存档；草稿试玩严格只读取该项目当前草稿，缺失或损坏时也不会回退到上次发布版本。未指定 `game` 的普通 `/play` 才会使用本机默认、静态默认和内置离线兜底。

玩家首页会从当前作品的有效存档决定主入口：首次游玩显示“进入”，已有进度显示“继续”。开场三项内容仅是选择预览，进入播放器后才由玩家真正提交；重复的意图、行动和说明会自动去重。播放器抽屉、选择反馈和剧情阶段支持完整焦点进入/返回；360° 调查可用方向键转向、`+` / `-` 缩放、`Home` 复位，也可从“全部线索”列表访问初始视野外的线索。

《第九席》的四个章节私聊与林渺同盟复盘开放最多三轮自由表达；清除正文不会重置同节点轮数。AI 只识别玩家的沟通意图，玩家可见台词始终从正式故事中的作者定稿回应选取。未配置真实模型时，界面会明确显示“AI 未接入”，并使用本地意图匹配；原有剧情选择和结局始终可以继续。浏览器与服务端共用现实危机边界，明确自伤表达会在外发前退出角色扮演，离线时也只显示非角色安全支持。

## 检查与构建

```bash
npm test
npm run build
npm run verify:release
npm start
```

`npm test` 会运行剧情引擎、创作台、《第九席》内容路线、资源引用、玩家 UI、玩家首页数据/SSR 契约、关系 AI 安全测试和页面壳层回归；生产文件输出到 `dist/`。`npm run verify:release` 还会重建真实发布产物，检查版本清单、体积、疑似密钥、SPA/API、健康探针、缓存、Range，以及 Node 与 Sites 兼容 Worker 的作者备用关系回应。`npm start` 默认监听 `0.0.0.0:4173`，本机可从 `http://127.0.0.1:4173` 访问；`/livez` 表示进程存活，`/readyz` 表示当前不可变产物可接流量。

每次构建都会生成 `dist/release.json`，记录 `0.9.x-beta` 版本、完整 Git commit、源码是否清洁、构建时间、Beta/AI 模式与关键文件 SHA-256。脏工作树构建会明确标为不可发布；`npm run verify:release` 只接受清洁 HEAD，并重算关键产物哈希。缺少文件、摘要不一致或清单字段越界时，生产进程拒绝启动，`/readyz` 返回 503。

## 关系 AI 服务端配置

公开 Beta 当前固定使用 `aiMode=fallback`：私聊仍从正式故事的作者合同选择回应，不调用模型供应商，也不会把作者备用回应显示成“实时生成”。下面的真实模型配置只适用于后续受控 Node 环境，不是本轮 HTTPS Beta 的必填项。

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
- 创作台本机项目：同一条目内的 `project` 是可编辑草稿，`publishedProject` 是最后一次成功发布的冻结玩家版本；普通 `/play` 与首页精选只读玩家版本，显式草稿试玩才会读取草稿
- 创作台精选、快速/专业模式偏好与非敏感显示偏好：保存在当前站点的浏览器 `localStorage`
- 创作台版本化 JSON 创作包：由用户主动下载或导入，用于更换域名、清理浏览器或回滚前的离线备份；不包含服务端密钥
- 玩家存档：按作品分别保存在当前站点的浏览器 `localStorage`
- 关系私聊正文与确定性表达标签：只保留在当前页面内存，离开场景即清除，不进入玩家存档或存档码
- 关系 AI 匿名会话：仅使用服务端签名的 HttpOnly Cookie；浏览器脚本不能读取或自行轮换身份

旧版本残留在 `creator:browser-settings:v1` 的 API Key 会在创作台读取设置时自动删除。清理站点数据会同时删除本机创作项目、偏好和玩家存档。不要把真实 API Key 写进源码、`VITE_*` 变量或提交到仓库。

## 部署注意

Level 9 的 Beta 主拓扑是妙搭全栈 HTTPS：Vite 客户端与最小 Nest 同源适配层共同交付 `/play`、`/game`、`/worlds`、`/creators`、`/creator`、健康探针和作者备用关系接口；未知页面和未知 `/api/*` 不会被首页软 200 掩盖。首次 Sites 创建没有生成站点，因此仅保留经过同一发布门禁的 Sites Worker 作为兼容入口，不把它写成已上线环境。主仓 Node 运行时继续用于本地预览或受控内网源站，不建议把裸 HTTP 端口直接暴露公网。

正式发布、上线验证、故障降级和不可变版本回滚步骤见 [`开发日志/Beta发布与回滚.md`](开发日志/Beta发布与回滚.md)。发布前必须先导出创作包，线上链接必须通过 `/readyz`、旗舰玩家入口、错误页、fallback 关系状态和媒体 Range 验证；`127.0.0.1` 地址不能冒充公开发布。

真实模型默认 fail closed。多实例或单实例正式部署都必须先接入共享 KV/Redis 的原子保护，并在模型供应商后台设置账户硬额度；本地备用模式不需要这些外部依赖。

创作台当前已实现本机项目管理、角色圣经、关系图、情绪曲线、一致性资产、节点编辑、完整 QA 明细、精选管理和发布到本机播放器。发布校验有错误时只保存草稿，存储边界也会再次拒绝写入，因此上一次成功发布的玩家版本不会被失败草稿覆盖；首页精选只允许已发布本机作品。`story.cast` 始终是角色姓名、立绘、声线、可发展关系与初始关系值的运行时权威源；`project.authoring` 只保存以角色或节点 id 关联的作者资料。依赖 DeepSeek、图片、语音或音乐服务的生成能力若仍显示“尚未接入”，代表该外部调用尚未启用，不会在后台偷偷发送密钥或产生费用。
