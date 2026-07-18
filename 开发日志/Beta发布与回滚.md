# 幻梦 Beta 发布与回滚手册

本手册对应 `0.9.x-beta`。当前线上能力固定为 `aiMode=fallback`：关系私聊使用随作品发布、经过内容校验的作者回应，不调用外部模型。只有另行完成共享原子保护、供应商硬额度、数据政策和生产烟测后，才允许设计 `model` 发布模式。

## 1. 环境矩阵

| 环境 | 入口 | 用途 | AI 模式 | 数据 |
| --- | --- | --- | --- | --- |
| local | 主仓 `npm run dev` / `npm start` | 开发、自动化与产品预览 | fallback；显式配置完整生产保护后 Node 可显示 model | 当前浏览器 localStorage |
| gate | 主仓 `npm run verify:release` | 测试、构建、产物与 Node/Sites 兼容门禁 | 强制 fallback | 无持久数据 |
| Beta | 妙搭全栈 HTTPS | 对外体验验证；Vite 客户端 + 最小 Nest 同源适配层 | 固定 fallback | 玩家存档与创作项目仍在访问者浏览器 |

Node 版本固定为 `.nvmrc`，依赖只能通过 lockfile 安装。生产密钥不得进入 `VITE_*`、源码、Git、浏览器 localStorage、构建产物或 CI Artifact。首次 Sites 创建返回平台内部错误且没有生成站点；`部署/sites-worker.js` 与 `.openai/hosting.json` 只作为兼容交付物保留，不是本轮线上来源。

## 2. 发布产物合同

主仓 `npm run build` 在 Vite 产物之外生成：

- `dist/release.json`：产品、版本、完整 Git commit、清洁源码证明、构建时间、Beta/AI 模式、关键文件 SHA-256 与体积门禁；
- `dist/server/index.js`：Sites 兼容 Worker；
- `dist/.openai/hosting.json`：不含密钥的托管资源引用。

发布时把同一份 `dist/release.json` 同步到妙搭交付仓的 `server/data/release.json` 与 `client/public/release.json`。妙搭仓构建生成可独立启动的 `dist/server` 和 `dist/client`；Nest 层只提供静态文件、精确 SPA 路由、健康检查与同源作者回应，不持久化玩家正文。

主仓发布包不得超过 500 MiB，任一文件不得超过 20 MiB。门禁会重算清单内全部关键产物的体积与 SHA-256，并扫描发布包和 Git 已跟踪文本中的私钥、API Key、guard token、会话密钥、`.env`、`.pem` 与 `.key`；不因文件超过 3 MiB 跳过。脏工作树只能生成明确标记的本地预览清单，Node、Worker 与发布烟测均拒绝把它当作可发布版本。GitHub 工作流已固定 Node/npm、`npm ci` 与 `npm run verify:release`；没有可访问的 GitHub 远端时只能报告工作流已建立和本地同命令结果，不能声称远端 CI 已执行。

## 3. 发布前检查

1. 在创作台导出当前创作包；确认文件中包含草稿、上次发布快照与精选摘要。
2. 在主仓运行 `npm ci`（清洁环境）与 `npm run verify:release`，不得跳过失败项或降低断言。
3. 提交主仓，从无修改、无未跟踪文件的 HEAD 再次构建；确认 `dist/release.json` 的 `commit/source.head` 等于准备发布的 Git commit、`source.clean=true`、`aiMode=fallback`。
4. 将清单同步到妙搭交付仓的服务端和公开静态目录；运行 `npm run verify:release` 与生产依赖审计。
5. 确认妙搭交付仓没有单文件超过 20 MiB、`.env.local` 未被 Git 跟踪，随后提交并推送 `sprint/default`。
6. 创建妙搭版本并等待状态为 `finished`；得到 HTTPS 地址后设置公开访问，再做线上验证。本地 `127.0.0.1` 地址不算发布成功。

## 4. 上线验证

逐项验证并记录版本与时间：

- `/` 返回玩家首页；
- `/play?game=ninth-seat` 进入《第九席》；
- `/play?game=does-not-exist` 显示作品不可用状态，不静默换作品；
- `/api/relationship-chat/status` 返回 `mode=fallback`、`configured=false`；
- 一次合法关系请求返回作者回应，跨域和注入请求被拒绝，响应与日志均不泄露玩家正文；
- `/livez` 返回 `status=live`；
- `/readyz` 返回 `status=ready`，且 version/commit 与 `/release.json` 一致；
- `/release.json`、旗舰剧情 JSON 和一项媒体资源可读取；媒体 Range 返回 206；
- 未知 `/api/*` 返回 JSON 404，未列入白名单的页面不被首页软 200 掩盖；
- 320×568、390×844 与桌面端人工检查无操作遮挡，键盘可完成首页进入、对白、选择、浮层与调查线索路径。

健康探针只公开版本、commit、Beta 模式与 AI 模式，不公开路径、环境变量、密钥或供应商信息。访问日志不得包含玩家正文、Cookie、Authorization、prompt 或本机绝对路径。

## 5. 故障降级

- 关系接口异常：客户端继续使用当前正式故事内的作者备用回应；不得临时把浏览器直连模型作为修复。
- `readyz` 非 200：停止引流，不要用 `/` 的偶然 200 代替就绪判断。
- 静态媒体异常：保持当前线上版本，不覆盖发布；核对源提交、`release.json`、Range 与缓存层。
- 新版创作台导入异常：不清空 localStorage，保留导出包和自动生成的覆盖前备份，回到上一版本处理。

## 6. 回滚

1. 在妙搭版本历史中选择最近一次已验收、绑定明确源提交的版本，核对其中 `/release.json` 的 commit 与版本。
2. 切换前让创作者导出当前创作包；玩家存档仍留在同一 HTTPS origin，不主动清理。
3. 重新发布上一已验收版本，或从其不可变 Git 提交创建回滚版本；禁止在生产容器内执行 `git checkout`、`git reset` 或现场重构旧包。
4. 等待发布状态为 `finished`，再重复“上线验证”的全部健康、旗舰、错误页、API 与 Range 检查。
5. 用回滚前创作包执行 dry-run，确认旧版本不会破坏未来 schema；验证一个已有《第九席》存档仍能续玩。
6. 记录回滚原因、受影响版本、开始/恢复时间和后续修复负责人。

如果上一版本不能安全读取新创作包，只允许保持包离线备份，禁止为了兼容而让旧客户端覆盖未来数据。
