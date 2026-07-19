// 首页选展配置：主视觉立绘与核心体验舞台的展品清单，换展只改这里。
// 生成首页文摘.mjs 按此预计算展示数据写入 homepage-digest.json（首页包不内联整部剧情），
// 改完必须重跑 node 源码/公共工具/生成首页文摘.mjs——玩家首页自测会强制两者同步。

// 主视觉立绘选展：跨作品女主拼贴（首项为 main 主位，依次 front / back 纵深层）。
// 只填作品 slug——立绘、姓名、作品名从文摘的正式 cast 解析。
export const 主视觉选展 = ['ninth-seat', 'project-20260620-002835', 'night-ferry'];

// 核心体验舞台：从平台真实作品里选画面效果最好的带 CG 节点。
// 2026-07-17 选展：《云巅修缮录》开场（星穹大殿 CG + 女主开场独白）；
// 备选：《第十五封愿望》s03-old-library-wishbox（旧图书馆愿望箱）。
export const 体验选展 = { slug: 'project-20260620-002835', nodeId: 's00-arrival' };
