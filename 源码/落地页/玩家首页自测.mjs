import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import { 合并首页精选, 构建玩家首页模型, 清洗精选数据, 核对本机精选覆盖, 读取首页存档 } from './玩家首页模型.js';
import { 构建选择展示文案 } from '../公共工具/选择文案.js';

const 当前目录 = dirname(fileURLToPath(import.meta.url));
const 项目根 = resolve(当前目录, '../..');
const 精选 = JSON.parse(await readFile(resolve(项目根, '公共资源/showcase.json'), 'utf8'));
const 剧情 = JSON.parse(await readFile(resolve(项目根, '公共资源/games/ninth-seat/story.json'), 'utf8'));

function 断言(条件, 消息) {
  if (!条件) throw new Error(消息);
}

const 首页 = 构建玩家首页模型(精选, 剧情);
断言(首页.storyReady, '正式旗舰剧情未生成可用首页模型');
断言(首页.defaultSlug === 精选.default, '首页旗舰未跟随正式 showcase.default');
断言(首页.playHref === '/play?game=ninth-seat', '玩家主 CTA 未精确指向旗舰作品');
断言(
  首页.playAction.mode === 'start' &&
    首页.playAction.label === '进入《第九席》' &&
    首页.playAction.shortLabel === '开始故事',
  '无存档首页没有产出统一的开始 CTA',
);
断言(首页.preview?.nodeId === 剧情.startNodeId, '真实试玩预览没有从 startNodeId 构建');
断言(首页.characters.length === 剧情.cast.characters.length, '角色区过滤了剧情声明的关键人物');
断言(
  首页.characters.map((角色) => 角色.name).join('|') === 剧情.cast.characters.map((角色) => 角色.name).join('|'),
  '角色区顺序或姓名没有来自正式 cast',
);
断言(首页.progress.memories.length === 0, '无存档首页提前泄露了剧情 effect memory');
断言(首页.endings.every((结局) => !结局.secret), '无存档首页提前泄露隐藏结局');
断言(首页.endings.length === 3, '公开阶段结果数量与正式剧情不一致');
断言(!Object.hasOwn(首页, 'totalEndingCount'), '首页模型暴露了包含隐藏结果的总数');
断言(首页.preview.choices[0].label === 剧情.nodes[剧情.startNodeId].choices[0].label, '开场预览丢失正式主行动文案');
断言(!首页.preview.choices[0].intent, '与 label 重复的 intent 仍进入开场预览');
断言(!Object.hasOwn(首页.preview.choices[0], 'consequence'), '开场预览提前暴露了选择后果');
断言(首页.routes.length === 3, '首页没有消费正式 homepage.routes 契约');
const 正式私聊角色 = [...new Set(
  Object.values(剧情.nodes)
    .flatMap((节点) => 节点.choices ?? [])
    .map((选择) => 选择.effect?.route)
    .filter((route) => 剧情.cast.characters.some((角色) => 角色.id === route)),
)];
断言(
  首页.routes.find((路线) => 路线.id === 'private')?.characterIds.join('|') === 正式私聊角色.join('|'),
  '首页私人路线角色与剧情实际 route 不一致',
);
console.log('  ✓ 首页模型：旗舰、开场、完整 cast 与无剧透初始状态');

const 第一条合法记忆 = 剧情.nodes[剧情.startNodeId].hotspots[0].effect.memories[0];
const 隐藏结局 = Object.values(剧情.nodes).find((节点) => 节点.ending?.tier === 'secret');
const 有效进度首页 = 构建玩家首页模型(精选, 剧情, {
  gameId: 精选.default,
  storyId: 剧情.id,
  loopCount: 2,
  memories: [第一条合法记忆, '<script>伪造记忆</script>'],
  persistentMemories: [第一条合法记忆],
  unlockedEndings: [隐藏结局.id, 'fake-ending'],
  visitedNodes: [剧情.startNodeId, 'fake-node'],
  lastSavedAt: 1,
});
断言(
  有效进度首页.progress.memories.length === 1 && 有效进度首页.progress.memories[0] === 第一条合法记忆,
  '首页存档没有按正式剧情白名单清洗记忆',
);
断言(有效进度首页.progress.unlockedEndings.length === 1, '首页存档没有过滤伪造结局');
断言(有效进度首页.endings.some((结局) => 结局.id === 隐藏结局.id && 结局.unlocked), '已解锁隐藏结局未被正确恢复');
断言(
  有效进度首页.playAction.mode === 'resume' &&
    有效进度首页.playAction.label === '继续《第九席》' &&
    有效进度首页.playAction.shortLabel === '继续故事',
  '有效存档没有产出统一的续玩 CTA',
);

const 跨作品首页 = 构建玩家首页模型(精选, 剧情, {
  gameId: 'another-story',
  storyId: 'another-story',
  memories: [第一条合法记忆],
  unlockedEndings: [隐藏结局.id],
});
断言(!跨作品首页.progress.hasSave, '跨作品存档污染了旗舰首页');
断言(跨作品首页.playAction.mode === 'start', '跨作品存档错把首页 CTA 变成续玩');
const 无归属首页 = 构建玩家首页模型(精选, 剧情, {
  memories: [第一条合法记忆],
  unlockedEndings: [隐藏结局.id],
});
断言(!无归属首页.progress.hasSave, '无 storyId/gameId 的歧义存档进入了旗舰首页');
globalThis.window = {
  localStorage: {
    getItem: (键) => 键 === 'interactive-cinema-save:ninth-seat:v2'
      ? JSON.stringify({ memories: [第一条合法记忆], visitedNodes: [剧情.startNodeId] })
      : null,
  },
};
const 专属键旧档首页 = 构建玩家首页模型(精选, 剧情, 读取首页存档('ninth-seat'));
断言(
  专属键旧档首页.progress.hasSave && 专属键旧档首页.playAction.mode === 'resume',
  '从当前作品专属 key 读取的无身份早期存档没有与播放器保持续玩语义一致',
);
const bundled旧档首页 = 构建玩家首页模型(精选, 剧情, {
  gameId: 'bundled',
  memories: [第一条合法记忆],
  unlockedEndings: [隐藏结局.id],
});
断言(!bundled旧档首页.progress.hasSave, '歧义 bundled 旧档进入了旗舰首页');
const 稳定归属首页 = 构建玩家首页模型(精选, 剧情, {
  gameId: 'bundled',
  storyId: 剧情.id,
  memories: [第一条合法记忆],
});
断言(稳定归属首页.progress.hasSave, '带稳定 storyId 的跨运行身份存档被错误拒绝');
断言(稳定归属首页.playAction.mode === 'resume', '稳定 storyId 存档没有切换续玩 CTA');
console.log('  ✓ 首页存档：合法进度恢复并续玩，跨作品数据隔离');

const 完全重复文案 = 构建选择展示文案({
  label: '保全原始证据',
  intent: '保全原始证据。',
  caption: ' 保全原始证据 ',
  consequence: '这是选择后才应显示的后果。',
});
断言(
  完全重复文案.label === '保全原始证据' && !完全重复文案.intent && !完全重复文案.caption,
  '选择 helper 没有去除标点与空白差异造成的重复文案',
);
const 隐藏前缀文案 = 构建选择展示文案({
  label: '【隐藏】恢复人的否决权',
  intent: '恢复人的否决权',
  caption: '只有先前保留边界时才会出现。',
});
断言(!隐藏前缀文案.intent && !!隐藏前缀文案.caption, '选择 helper 没有忽略展示前缀或误删新说明');
const 信息不同文案 = 构建选择展示文案({
  label: '暂停直播',
  intent: '先保全证据',
  caption: '你将承担延误的职业风险。',
});
断言(!!信息不同文案.intent && !!信息不同文案.caption, '选择 helper 误删了真正新增的意图或说明');
console.log('  ✓ 选择文案：label 为主，intent / caption 按语义去重，后果不进预览');

const 回退清单 = 清洗精选数据({
  default: 'missing',
  featured: [精选.featured[0], null, 精选.featured[0], { slug: '../bad', title: '坏条目' }],
});
断言(回退清单.default === 精选.featured[0].slug, '坏默认 slug 未回退首个健康条目');
断言(回退清单.featured.length === 1, '精选清洗未去除坏条目或重复条目');
const 同slug覆盖 = 合并首页精选(精选, 精选, {
  featured: [精选.default],
  entries: [{
    slug: 精选.default,
    title: '伪造旗舰',
    tagline: '本机伪造梗概',
    cover: '/fake-cover.png',
  }],
});
const 合并后旗舰 = 同slug覆盖.featured.find((条目) => 条目.slug === 精选.default);
断言(
  合并后旗舰.title === 精选.featured[0].title && 合并后旗舰.cover === 精选.featured[0].cover,
  '本机同 slug 条目篡改了固定旗舰元数据',
);

const 旧缓存 = {
  default: 'draft-only',
  featured: ['draft-only', 'invalid-published', 精选.featured[1].slug, 'published-local'],
  entries: [
    { slug: 'draft-only', title: '未发布草稿标题', tagline: '未发布草稿梗概' },
    { slug: 'invalid-published', title: '坏发布卡片', tagline: '没有真实可加载起点' },
    { ...精选.featured[1], title: '缓存伪造的静态标题' },
    { slug: 'published-local', title: '缓存里的旧标题', tagline: '缓存里的旧梗概' },
  ],
};
const 已发布本机项目 = {
  slug: 'published-local',
  title: '冻结玩家版本',
  storyBible: '来自已发布快照的简介\n不会泄露草稿',
  story: {
    startNodeId: 'start',
    nodes: { start: { id: 'start', panorama: '/panoramas/published.webp', choices: [], ending: { title: '完成' } } },
  },
  manifest: { assets: [] },
};
const 核对后覆盖 = 核对本机精选覆盖(旧缓存, {
  'draft-only': { project: { slug: 'draft-only', title: '未发布草稿标题' }, updatedAt: 1 },
  'published-local': {
    project: { ...已发布本机项目, title: '发布后的新草稿' },
    publishedProject: 已发布本机项目,
    updatedAt: 3,
    publishedAt: 2,
  },
  'invalid-published': {
    project: { slug: 'invalid-published' },
    publishedProject: { slug: 'invalid-published', title: '坏发布卡片', story: { startNodeId: 'missing', nodes: {} } },
    updatedAt: 3,
    publishedAt: 2,
  },
}, 精选);
断言(!核对后覆盖.featured.includes('draft-only'), '旧精选缓存仍保留未发布本机草稿');
断言(!核对后覆盖.featured.includes('invalid-published'), '无法加载的坏发布快照仍进入首页形成死卡');
断言(核对后覆盖.featured.includes(精选.featured[1].slug), '正式静态精选被旧缓存迁移误删');
断言(
  核对后覆盖.entries[0].title === '冻结玩家版本' && 核对后覆盖.entries[0].tagline === '来自已发布快照的简介',
  '本机精选未从 publishedProject 重建，仍信任旧缓存或后续草稿元数据',
);
console.log('  ✓ 精选兼容：坏默认、重复条目与越界 slug 安全回退');

const 区块源码 = await readFile(resolve(当前目录, '心界玩家区块.jsx'), 'utf8');
for (const 禁止硬编码 of ['s00-blue-salon', 'lu_chenzhou', 'zhou_yan', 'he_qingye', 'shen_que']) {
  断言(!区块源码.includes(禁止硬编码), `首页展示组件硬编码了剧情结构标识：${禁止硬编码}`);
}

delete globalThis.window;
delete globalThis.document;
delete globalThis.localStorage;
const 服务 = await createServer({
  root: 项目根,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false },
});

try {
  const { default: 落地页应用 } = await 服务.ssrLoadModule('/源码/落地页/落地页应用.jsx');
  const html = renderToString(React.createElement(落地页应用));
  断言(html.includes('class="lp lp-heartscape"'), '首页未渲染心界根壳层');
  断言((html.match(/<main/g) ?? []).length === 1, '首页必须且只能有一个 main');
  断言(html.includes('<main id="main-content" tabindex="-1">'), 'skip link 目标 main 不可程序化获得焦点');
  断言((html.match(/<h1/g) ?? []).length === 1, '首页必须且只能有一个 h1');
  断言(html.includes('这一次，故事会记住'), 'SSR 首屏没有玩家价值承诺');
  断言(html.includes('href="/play?game=ninth-seat"'), 'SSR 首屏没有精确旗舰玩家入口');
  断言(html.includes('进入《第九席》') && html.includes('开始故事'), 'SSR 无存档入口没有消费统一开始 CTA');
  断言(
    html.includes('AI 未接入时明确使用作者预设回应') && !html.includes('AI 关系层将在后续阶段接入'),
    '玩家首页页脚仍把已交付的受约束关系回应写成未来能力',
  );
  for (const 姓名 of [剧情.cast.protagonist.name, ...剧情.cast.characters.map((角色) => 角色.name)]) {
    断言(html.includes(姓名), `SSR 角色区缺少正式 cast：${姓名}`);
  }
  for (const 玩家内容 of ['开场选择预览', '故事记住的', '按你的方式同行', '结局不只回答']) {
    断言(html.includes(玩家内容), `SSR 玩家路径缺少：${玩家内容}`);
  }
  断言((html.match(/class="hx-choice-card reveal"/g) ?? []).length === 3, '开场预览未渲染三张非交互选择卡');
  断言(!html.includes('<a class="hx-choice-card reveal"'), '开场预览卡仍然是会伪提交选择的链接');
  断言((html.match(/进入故事后亲自选择/g) ?? []).length === 1, '开场预览区没有收口为唯一的进入故事 CTA');
  断言(!html.includes('行动意图 ·'), '开场 label 与 intent 相同时仍重复显示意图');
  for (const 选择 of 剧情.nodes[剧情.startNodeId].choices) {
    断言(!html.includes(选择.consequence), `开场预览提前剧透选择后果：${选择.id}`);
  }
  for (const 旧首页内容 of ['EvoMap', 'Flux.1 Dev', '智能体写剧本', '/landing/char-', 'experience-showcase.mp4']) {
    断言(!html.includes(旧首页内容), `玩家首页仍渲染旧创作者内容：${旧首页内容}`);
  }
  for (const 旧作品 of 精选.featured.filter((条目) => 条目.slug !== 精选.default)) {
    断言(!html.includes(旧作品.title), `玩家首页直接渲染了历史作品标题：${旧作品.title}`);
    断言(!html.includes(旧作品.tagline), `玩家首页直接渲染了历史作品梗概：${旧作品.title}`);
  }
  断言(!html.includes(隐藏结局.ending.title), 'SSR 提前渲染隐藏结局标题');
  console.log('  ✓ 无浏览器 SSR：首页语义、旗舰 CTA、七名角色与玩家路径同步可见');

  const {
    玩家主视觉,
    真实选择区,
    多结局区,
    玩家结尾CTA,
  } = await 服务.ssrLoadModule('/源码/落地页/心界玩家区块.jsx');
  const { 导航栏, 页脚 } = await 服务.ssrLoadModule('/源码/落地页/导航与页脚.jsx');
  const 续玩html = renderToString(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(导航栏, { playAction: 有效进度首页.playAction }),
      React.createElement(玩家主视觉, { 首页: 有效进度首页 }),
      React.createElement(真实选择区, { 首页: 有效进度首页 }),
      React.createElement(多结局区, { 首页: 有效进度首页 }),
      React.createElement(玩家结尾CTA, { 首页: 有效进度首页 }),
      React.createElement(页脚, { playAction: 有效进度首页.playAction }),
    ),
  );
  for (const 续玩文案 of ['继续《第九席》', '继续故事', '继续走向结果', '你的进度已被记住', '从上次保存的现场继续']) {
    断言(续玩html.includes(续玩文案), `有存档入口缺少续玩语义：${续玩文案}`);
  }
  断言(!续玩html.includes('开始第一章') && !续玩html.includes('将在零点亮起'), '有存档末屏仍伪装成首次开始');
  const 应用源码 = await readFile(resolve(当前目录, '落地页应用.jsx'), 'utf8');
  断言(应用源码.includes('hx-mobile-cta') && 应用源码.includes('{首页.playAction.label}'), '移动固定入口没有消费统一 CTA');
  console.log('  ✓ 续玩语义：首屏、导航、预览、结局区、末屏与页脚一致');

  const { default: 创作者介绍应用 } = await 服务.ssrLoadModule('/源码/落地页/创作者介绍应用.jsx');
  const 创作者html = renderToString(React.createElement(创作者介绍应用));
  断言(创作者html.includes('<main'), '二级创作者页缺少 main');
  断言(创作者html.includes('EvoMap'), 'EvoMap 没有迁移到二级创作者页');
  断言(创作者html.includes('href="/creator"'), '二级创作者页没有保留旧工作台入口');
  断言(创作者html.includes('AI 不直接修改路线、数值或结局'), '二级创作者页没有说明真实 AI 边界');
  console.log('  ✓ 二级创作者页：EvoMap、能力边界与旧工作台入口可见');

  const { default: 世界归档应用 } = await 服务.ssrLoadModule('/源码/落地页/世界归档应用.jsx');
  const 归档html = renderToString(React.createElement(世界归档应用));
  断言(归档html.includes('<main') && 归档html.includes('互动实验档案'), '历史世界二级归档未渲染');
  for (const 旧作品 of 精选.featured.filter((条目) => 条目.slug !== 精选.default)) {
    断言(归档html.includes(旧作品.title), `历史归档缺少作品：${旧作品.title}`);
    断言(归档html.includes(`/play?game=${旧作品.slug}`), `历史归档缺少直达入口：${旧作品.slug}`);
  }
  console.log('  ✓ 历史世界归档：旧作品退出旗舰 DOM 后仍可直接游玩');
} finally {
  await 服务.close();
}

console.log('玩家首页自测：全部通过');
