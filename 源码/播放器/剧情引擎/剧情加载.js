// ============================================================================
// 这个文件是播放器的「片库管理员」：整个放映厅只有这一位管理员（模块级单例），
// 他手里永远挂着一部"正在放映的片子"（默认是随包自带的《第九席》拷贝），
// 谁来问"现在放哪部、从哪一幕开始、有哪些数值规则"，他都直接把手上的东西给你看；
// 有人喊"换片"（loadStoryBySlug / setActiveStory），他先验片没坏，再整卷替换。
// 对应线上打包产物 story-BDynpsCw.js（分析文档：剧情引擎分析.md）。
//
// 【导出清单（与线上模块完全等价 + 一个入口契约别名）】
//   STORY_TITLE                 string   当前剧情标题（live binding，换片后自动更新）
//   STORY_ID                    string   当前剧情稳定作品 id（用于存档码归属）
//   START_NODE_ID               string   起始节点 id
//   storyContent                object?  当前剧情内容呈现契约（布局、主题、调查模式）
//   storyMechanics              object?  当前剧情 mechanics（可能为 undefined）
//   storyCast                   object   当前剧情角色阵容（主角 + 角色列表）
//   storyNodes                  object   节点字典 { [nodeId]: node }
//   storyNodeList               array    节点数组（换片时同步重算）
//   ACTIVE_GAME_ID              string   当前剧情 slug（清洗后），初始 "ninth-seat"
//   setActiveStory(story, slug) void     校验后整体切换剧情，校验失败抛错
//   loadStoryBySlug(slug, options) async→boolean  默认已发布快照→线上；allowDraft 才可试玩草稿
//   按slug加载剧情(slug, options)   async→boolean  同 loadStoryBySlug（main.jsx 的硬契约名）
//   getScoreDefinitions()       ScoreDef[]     规范化后的全部分数定义（每次现算）
//   getScoreDefinition(id)      ScoreDef|undefined
//   getVisibleScoreDefinitions() ScoreDef[]    过滤掉 visibility==="hidden" 的
// ============================================================================

// 内置兜底剧情：线上版是把 56KB 的 JSON 字符串直接压进代码里；我们直接 import
// 公共资源里的同一部作品（Vite 会在打包时把它内联成 JS 模块，效果一致）。
// 这样即使断网/线上 story.json 拉不到，播放器也永远有片可放。
import 兜底剧情 from '../../../公共资源/games/ninth-seat/story.json';

// 创作端本机仓库：project 是草稿，publishedProject 是玩家端默认读取的冻结快照。
const 浏览器项目仓库键 = 'creator:browser-projects:v1';
const 支持的表情 = new Set([
  'neutral',
  'focused',
  'concerned',
  'guarded',
  'vulnerable',
  'resolute',
  'warm',
  'warning',
]);

// scores 缺失/全非法时的兜底分数定义（原样照抄线上）
const 兜底分数定义 = [
  {
    id: 'career',
    label: '身份',
    initial: 32,
    min: 0,
    max: 100,
    visibility: 'debug',
    tone: 'route',
  },
  {
    id: 'integrity',
    label: '真相',
    initial: 38,
    min: 0,
    max: 100,
    visibility: 'debug',
    tone: 'truth',
  },
  {
    id: 'stress',
    label: '压力',
    initial: 45,
    min: 0,
    max: 100,
    visibility: 'debug',
    tone: 'pressure',
    warnAt: 70,
  },
];

// 分数 id → 中文标签字典（字典优先于作者自定义 label，原样照抄线上）
const 分数中文字典 = {
  career: '身份',
  integrity: '真相',
  stress: '压力',
  pressure: '压力',
  truth: '真相',
  trust: '信任',
  evidence: '证据',
  comfort: '安心',
  suspicion: '疑点',
  discretion: '谨慎',
  insight: '洞察',
  progress: '进展',
  seal_fragments: '碎片',
  fox_trust: '狐族信任',
  demon_corruption: '妖化侵蚀',
  memory_truth: '前世真相',
  sacrifice_resolve: '牺牲意志',
  human_alignment: '人类倾向',
};

// 输入剧情对象 → 检查最基本的骨架（有 nodes、有 startNodeId、起始节点真的存在）→ 不合格直接抛错
// 报错文案与线上逐字一致（英文），别翻译。
function 校验剧情骨架(story) {
  if (
    !story ||
    typeof story !== 'object' ||
    !story.nodes ||
    typeof story.nodes !== 'object' ||
    Array.isArray(story.nodes) ||
    typeof story.startNodeId !== 'string' ||
    !story.startNodeId
  )
    throw new Error('Story data is malformed: missing nodes or startNodeId.');
  if (!story.nodes[story.startNodeId])
    throw new Error(`Story start node "${story.startNodeId}" is missing.`);
}

// 模块一加载就先验自带的片子，坏了宁可 import 时就炸（和线上行为一致）
校验剧情骨架(兜底剧情);
// 内置兜底也使用正式稳定 slug：在线、离线共用同一存档格，且不会误读旧默认作品的
// interactive-cinema-save:bundled:v2。"bundled" 只保留为通用加载身份；存档归属以
// 稳定 storyId 或当前正式 slug 判断，不再自动接收无法识别来源的旧 bundled 码。
const 已规范化兜底剧情 = 规范化剧情(兜底剧情, 'ninth-seat');

// ---- 模块级单例状态（ES module live binding：这里重新赋值，所有 import 方同步看到）----
export let STORY_TITLE = 已规范化兜底剧情.title;
export let STORY_ID = 已规范化兜底剧情.id;
export const BUNDLED_STORY_ID = 已规范化兜底剧情.id;
export let START_NODE_ID = 已规范化兜底剧情.startNodeId;
export let storyContent = 已规范化兜底剧情.content;
export let storyMechanics = 已规范化兜底剧情.mechanics;
export let storyCast = 已规范化兜底剧情.cast;
export let storyNodes = 已规范化兜底剧情.nodes;
export let storyNodeList = Object.values(storyNodes);
export let ACTIVE_GAME_ID = 'ninth-seat';

// 输入(剧情对象, slug) → 校验、规范化后把模块级状态整卷替换 → 无返回值；
// 校验失败抛错、状态不动。规范化集中发生在加载边界，消费方由此始终拿到稳定字段形状。
export function setActiveStory(story, slug = 'bundled') {
  校验剧情骨架(story);
  const 安全slug = 清洗slug(slug);
  const 安全剧情 = 规范化剧情(story, 安全slug);
  STORY_TITLE = 安全剧情.title;
  STORY_ID = 安全剧情.id;
  START_NODE_ID = 安全剧情.startNodeId;
  storyContent = 安全剧情.content;
  storyMechanics = 安全剧情.mechanics;
  storyCast = 安全剧情.cast;
  storyNodes = 安全剧情.nodes;
  storyNodeList = Object.values(安全剧情.nodes);
  ACTIVE_GAME_ID = 安全slug;
}

// () → 当前剧情里使用现代嵌套 relationships 的角色 id 列表。
// 状态工厂和存档消毒据此扩展关系表，不再把作者自定义角色静默丢掉。
export function getRelationshipCharacterIds() {
  const 角色们 = new Set(
    storyCast.characters.filter((角色) => 角色.relationship.enabled).map((角色) => 角色.id),
  );
  for (const 节点 of storyNodeList) {
    for (const 条目 of [...节点.hotspots, ...节点.choices]) {
      for (const [角色, 增量组] of Object.entries(条目.effect?.relationships ?? {}))
        if (是合法关系角色(角色) && 是普通对象(增量组)) 角色们.add(角色);
      for (const 条件 of Array.isArray(条目.condition?.minRelationship) ? 条目.condition.minRelationship : [])
        if (是合法关系角色(条件?.character)) 角色们.add(条件.character);
    }
  }
  return [...角色们];
}

// 角色档案全部属于 story，而非玩家存档；换片后这些 getter 会立即读取新阵容。
export function getStoryProtagonist() {
  return storyCast.protagonist;
}

export function getStoryCharacter(id) {
  return storyCast.characters.find((角色) => 角色.id === id) ?? null;
}

export function getStoryCharacterList() {
  return [...storyCast.characters];
}

export function getStoryCharacterIds() {
  return storyCast.characters.map((角色) => 角色.id);
}

// 输入 slug / 选项 → 默认先读本机已发布快照，再去线上拉 /games/<slug>/story.json。
// 只有创作台显式传 allowDraft:true，才会把草稿放到已发布快照之前用于试玩。
// 为什么所有错误都吞掉只回布尔值：加载失败时播放器要继续放手上那部片，不能黑屏。
export async function loadStoryBySlug(slug, 选项 = {}) {
  if (尝试加载浏览器项目(slug, { allowDraft: 选项?.allowDraft === true })) return true;
  try {
    const 响应 = await fetch(`/games/${encodeURIComponent(slug)}/story.json`, {
      cache: 'no-cache',
    });
    if (!响应.ok) return false;
    const 数据 = await 响应.json();
    setActiveStory(数据, slug);
    return true;
  } catch {
    return false;
  }
}

// main.jsx 的硬契约名：入口就按这个名字 import，内部就是 loadStoryBySlug
export async function 按slug加载剧情(slug, 选项) {
  return loadStoryBySlug(slug, 选项);
}

// 输入 slug / allowDraft → 查同一格中的 project / publishedProject → 命中安全版本就激活。
// 旧条目只有 project 时继续作为草稿保留：普通玩家不会被它覆盖，创作台仍可显式试玩。
function 尝试加载浏览器项目(slug, { allowDraft = false } = {}) {
  if (typeof window === 'undefined') return false;
  try {
    const 仓库 = JSON.parse(window.localStorage.getItem(浏览器项目仓库键) ?? '{}');
    if (!仓库 || typeof 仓库 !== 'object' || Array.isArray(仓库)) return false;
    const 条目 = 仓库[slug];
    const 草稿项目 = 条目?.project;
    const 已发布项目 = 条目?.publishedProject;
    const 草稿 = !草稿项目?.slug || 草稿项目.slug === slug ? 草稿项目?.story : null;
    const 已发布 = Number.isFinite(条目?.publishedAt) && 已发布项目?.slug === slug
      ? 已发布项目.story
      : null;
    const 候选们 = allowDraft ? [草稿, 已发布] : [已发布];
    for (const 剧情 of 候选们) {
      if (!剧情) continue;
      try {
        setActiveStory(剧情, slug);
        return true;
      } catch {
        // 坏草稿不能挡住合法已发布快照，坏快照也不能挡住同 slug 静态作品。
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ---- 剧情加载边界规范化 ----

const 默认调色板 = { from: '#10151f', via: '#31404f', to: '#c78356' };

// 输入原始剧情 → 保留作者扩展字段，同时把播放器直接消费的字段补成安全形状。
// 节点 key 是图结构的权威 id；空 key 才回退 node.id / 自动 id，并同步改写 choice.next。
function 规范化剧情(story, slug = 'bundled') {
  const 原节点条目 = Object.entries(story.nodes);
  const id映射 = new Map();
  const 节点id们 = [];
  const 已用id = new Set();

  原节点条目.forEach(([原key, 原节点], 索引) => {
    const 原节点id = 是普通对象(原节点) ? 非空字符串(原节点.id) : '';
    const 候选 = 非空字符串(原key) || 原节点id || `node-${索引 + 1}`;
    const id = 取唯一id(候选, 已用id);
    节点id们.push(id);
    id映射.set(原key, id);
    if (原节点id && !id映射.has(原节点id)) id映射.set(原节点id, id);
  });

  const startNodeId = id映射.get(story.startNodeId) ?? story.startNodeId;
  const nodes = Object.fromEntries(
    原节点条目.map(([, 原节点], 索引) => {
      const id = 节点id们[索引];
      return [id, 规范化节点(原节点, id, startNodeId, id映射, slug)];
    }),
  );
  return {
    ...story,
    id: 非空字符串(story.id) || slug,
    title: 非空字符串(story.title) || '互动影游',
    startNodeId,
    content: 规范化内容(story.content),
    mechanics: 是普通对象(story.mechanics) ? story.mechanics : undefined,
    cast: 规范化角色阵容(story.cast),
    nodes,
  };
}

function 规范化角色阵容(原始值) {
  const 原始 = 是普通对象(原始值) ? 原始值 : {};
  const 原主角 = 是普通对象(原始.protagonist) ? 原始.protagonist : {};
  const 主角头像 = 非空字符串(原主角.portrait);
  const protagonist = {
    ...原主角,
    id: 'you',
    name: 非空字符串(原主角.name) || '你',
    role: 非空字符串(原主角.role),
    pronouns: 非空字符串(原主角.pronouns),
    color: 规范化颜色(原主角.color, '#d7b6c9'),
    accent: 规范化颜色(原主角.accent, '#4b3045'),
    portrait: 主角头像,
    portraits: 规范化表情头像映射(原主角.portraits, 主角头像),
  };
  const 已用id = new Set();
  const characters = (Array.isArray(原始.characters) ? 原始.characters : []).flatMap((原角色) => {
    if (!是普通对象(原角色) || !是合法角色档案id(原角色.id)) return [];
    const id = 原角色.id.trim();
    if (已用id.has(id)) return [];
    已用id.add(id);
    const name = 非空字符串(原角色.name) || 人性化角色id(id);
    const portrait = 非空字符串(原角色.portrait);
    const 原关系 = 是普通对象(原角色.relationship) ? 原角色.relationship : {};
    const 原初值 = 是普通对象(原关系.initial) ? 原关系.initial : {};
    return [{
      ...原角色,
      id,
      name,
      shortName: 非空字符串(原角色.shortName) || name,
      role: 非空字符串(原角色.role),
      theme: 非空字符串(原角色.theme),
      color: 规范化颜色(原角色.color, '#9aa9bd'),
      accent: 规范化颜色(原角色.accent, '#293341'),
      portrait,
      portraits: 规范化表情头像映射(原角色.portraits, portrait),
      voiceId: 非空字符串(原角色.voiceId),
      romanceable: 原角色.romanceable === true,
      relationship: {
        enabled: typeof 原关系.enabled === 'boolean' ? 原关系.enabled : true,
        initial: {
          spark: 钳制关系初值(原初值.spark, 30),
          trust: 钳制关系初值(原初值.trust, 30),
          boundary: 钳制关系初值(原初值.boundary, 50),
        },
      },
    }];
  });
  return { protagonist, characters };
}

function 规范化节点(原始值, id, startNodeId, id映射, slug) {
  const 原始 = 是普通对象(原始值) ? 原始值 : {};
  const lines = Array.isArray(原始.lines)
    ? 原始.lines.filter(是普通对象).map((行) => ({
        ...行,
        speaker: 非空字符串(行.speaker) || 'narrator',
        expression: 规范化表情(行.expression),
        text: typeof 行.text === 'string' ? 行.text : '',
      }))
    : [];
  const choices = 规范化交互列表(原始.choices, `${id}-choice`, (选项, 选项id) => ({
    ...选项,
    id: 选项id,
    label: 非空字符串(选项.label) || '继续',
    intent: 非空字符串(选项.intent),
    next:
      typeof 选项.next === 'string'
        ? (id映射.get(选项.next) ?? 非空字符串(选项.next) ?? startNodeId)
        : startNodeId,
    condition: 规范化旧条件(选项.condition),
    effect: 规范化效果(选项.effect),
  }));
  const hotspots = 规范化交互列表(原始.hotspots, `${id}-hotspot`, (热点, 热点id) => ({
    ...热点,
    id: 热点id,
    label: 非空字符串(热点.label) || '线索',
    description: typeof 热点.description === 'string' ? 热点.description : '',
    yaw: 转有限数(热点.yaw, 0),
    pitch: 转有限数(热点.pitch, 0),
    effect: 规范化效果(热点.effect),
  }));
  const cinematics = Array.isArray(原始.cinematics)
    ? 原始.cinematics.filter(是普通对象).map((过场) => ({
        ...过场,
        src: 非空字符串(过场.src) || 解析项目资产地址(过场.assetPath, slug),
      }))
    : [];
  const 原调色板 = 是普通对象(原始.palette) ? 原始.palette : {};
  return {
    ...原始,
    id,
    title: 非空字符串(原始.title) || id,
    backdrop: 非空字符串(原始.backdrop),
    panorama: typeof 原始.panorama === 'string' ? 原始.panorama.trim() : '',
    palette: {
      ...原调色板,
      from: 非空字符串(原调色板.from) || 默认调色板.from,
      via: 非空字符串(原调色板.via) || 默认调色板.via,
      to: 非空字符串(原调色板.to) || 默认调色板.to,
    },
    lines,
    choices,
    hotspots,
    cinematics,
  };
}

// Level 3 的竖屏轻电影字段是增量契约：旧作品没有这些字段时保持原对象形状；
// 新作品声明后，则在加载边界收紧枚举与可读文案，避免 UI 各自猜测脏数据。
function 规范化内容(原始值) {
  if (!是普通对象(原始值)) return 原始值 === undefined ? undefined : {};
  const 内容 = { ...原始值 };
  if ('playerLayout' in 原始值) 内容.playerLayout = 非空字符串(原始值.playerLayout);
  if ('theme' in 原始值) 内容.theme = 非空字符串(原始值.theme);
  if ('expressionSet' in 原始值) {
    内容.expressionSet = 规范化字符串数组(原始值.expressionSet).filter((表情) => 支持的表情.has(表情));
  }
  if ('investigation' in 原始值) {
    const 调查 = 是普通对象(原始值.investigation) ? 原始值.investigation : {};
    内容.investigation = {
      ...调查,
      mode: 调查.mode === 'on-demand' ? 'on-demand' : 'always',
      label: 非空字符串(调查.label) || '调查现场',
    };
  }
  return 内容;
}

function 规范化表情(值) {
  const 表情 = 非空字符串(值);
  return 支持的表情.has(表情) ? 表情 : undefined;
}

function 规范化表情头像映射(值, 默认头像) {
  const 头像们 = {};
  if (是普通对象(值)) {
    for (const [表情, 地址] of Object.entries(值)) {
      const 安全地址 = 非空字符串(地址);
      if (支持的表情.has(表情) && 安全地址) 头像们[表情] = 安全地址;
    }
  }
  if (默认头像 && !头像们.neutral) 头像们.neutral = 默认头像;
  return 头像们;
}

// 发布包里的 assetPath 使用 assets/videos/<文件名>，本地静态目录则按作品 slug 分组。
// 在加载边界补出播放器可直接请求的 URL；绝对地址、blob/data URL 保持原样。
function 解析项目资产地址(assetPath, slug) {
  const 路径 = 非空字符串(assetPath);
  if (!路径) return '';
  if (/^(?:[a-z]+:|\/\/|\/)/i.test(路径)) return 路径;
  const 视频前缀 = 'assets/videos/';
  if (路径.startsWith(视频前缀)) {
    return `/videos/${encodeURIComponent(slug)}/${路径.slice(视频前缀.length)}`;
  }
  return 路径;
}

function 规范化交互列表(原始列表, id前缀, 变换) {
  if (!Array.isArray(原始列表)) return [];
  const 已用id = new Set();
  return 原始列表.filter(是普通对象).map((条目, 索引) => {
    const id = 取唯一id(非空字符串(条目.id) || `${id前缀}-${索引 + 1}`, 已用id);
    return 变换(条目, id);
  });
}

// 旧创作器把单刻度好感度写成 relationships: { role: number }；播放器的新模型则是
// relationships: { role: { trust/spark/boundary } }。标量会迁到 <role>_affinity 全局键，
// 与作者已经写入的同名 globals 增量相加，避免任何一边的数据被覆盖。
function 规范化效果(原始值) {
  if (!是普通对象(原始值)) return undefined;
  const 原始关系 = 是普通对象(原始值.relationships) ? 原始值.relationships : {};
  const globals = {};
  if (是普通对象(原始值.globals)) {
    for (const [键, 增量] of Object.entries(原始值.globals)) {
      if (是合法键(键) && typeof 增量 === 'number' && Number.isFinite(增量)) globals[键] = 增量;
    }
  }
  const relationships = {};
  let 有现代关系 = false;
  for (const [角色, 增量组] of Object.entries(原始关系)) {
    if (typeof 增量组 === 'number' && Number.isFinite(增量组)) {
      const 键 = 旧关系全局键(角色);
      if (键) globals[键] = (Number.isFinite(globals[键]) ? globals[键] : 0) + 增量组;
    } else if (是合法关系角色(角色) && 是普通对象(增量组)) {
      const 安全增量 = {};
      for (const 维度 of ['spark', 'trust', 'boundary']) {
        if (typeof 增量组[维度] === 'number' && Number.isFinite(增量组[维度])) 安全增量[维度] = 增量组[维度];
      }
      if (Object.keys(安全增量).length > 0) {
        relationships[角色] = 安全增量;
        有现代关系 = true;
      }
    }
  }
  const 有globals = Object.keys(globals).length > 0;
  return {
    ...原始值,
    globals: 有globals ? globals : undefined,
    relationships: 有现代关系 ? relationships : undefined,
    flags: 规范化字符串数组(原始值.flags),
    memories: 规范化字符串数组(原始值.memories),
    route:
      原始值.route === undefined || 原始值.route === null || typeof 原始值.route === 'string'
        ? 原始值.route
        : undefined,
  };
}

// 旧条件 relationships: { role: { min/max } } 与上面的迁移键保持一致。
function 规范化旧条件(原始值) {
  if (!是普通对象(原始值)) return undefined;
  const minGlobal = 规范化全局阈值列表(原始值.minGlobal);
  const maxGlobal = 规范化全局阈值列表(原始值.maxGlobal);
  if (是普通对象(原始值.relationships)) {
    for (const [角色, 阈值] of Object.entries(原始值.relationships)) {
      const 键 = 旧关系全局键(角色);
      if (!键) continue;
      if (typeof 阈值 === 'number' && Number.isFinite(阈值)) minGlobal.push({ key: 键, value: 阈值 });
      if (是普通对象(阈值)) {
        if (Number.isFinite(阈值.min)) minGlobal.push({ key: 键, value: 阈值.min });
        if (Number.isFinite(阈值.max)) maxGlobal.push({ key: 键, value: 阈值.max });
      }
    }
  }
  const { relationships: _旧关系, ...其余 } = 原始值;
  return {
    ...其余,
    flags: 规范化字符串数组(原始值.flags),
    missingFlags: 规范化字符串数组(原始值.missingFlags),
    memories: 规范化字符串数组(原始值.memories),
    missingMemories: 规范化字符串数组(原始值.missingMemories),
    minRelationship: 规范化关系阈值列表(原始值.minRelationship),
    minGlobal,
    maxGlobal,
  };
}

function 规范化字符串数组(值) {
  if (!Array.isArray(值)) return [];
  return [...new Set(值.filter((条目) => typeof 条目 === 'string').map((条目) => 条目.trim()).filter(Boolean))];
}

function 规范化全局阈值列表(值) {
  if (!Array.isArray(值)) return [];
  return 值.flatMap((条目) => {
    if (!是普通对象(条目) || !是合法键(条目.key) || !Number.isFinite(Number(条目.value))) return [];
    return [{ key: 条目.key, value: Number(条目.value) }];
  });
}

function 规范化关系阈值列表(值) {
  if (!Array.isArray(值)) return [];
  return 值.flatMap((条目) => {
    if (
      !是普通对象(条目) ||
      !是合法关系角色(条目.character) ||
      typeof 条目.metric !== 'string' ||
      !条目.metric.trim() ||
      !Number.isFinite(Number(条目.value))
    ) return [];
    return [{ character: 条目.character, metric: 条目.metric.trim(), value: Number(条目.value) }];
  });
}

function 旧关系全局键(角色) {
  if (typeof 角色 !== 'string') return '';
  let 主体 = 角色.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!主体) return '';
  if (!/^[a-z]/.test(主体)) 主体 = `relationship_${主体}`;
  return `${主体}_affinity`;
}

function 是普通对象(值) {
  return !!值 && typeof 值 === 'object' && !Array.isArray(值);
}

function 非空字符串(值) {
  return typeof 值 === 'string' ? 值.trim() : '';
}

function 取唯一id(候选, 已用id) {
  let id = 候选;
  let 序号 = 2;
  while (已用id.has(id)) id = `${候选}-${序号++}`;
  已用id.add(id);
  return id;
}

function 是合法关系角色(值) {
  return (
    typeof 值 === 'string' &&
    /^[a-z][a-z0-9_-]*$/.test(值) &&
    !['narrator', 'system', 'you', 'protagonist'].includes(值) &&
    值 !== '__proto__' &&
    值 !== 'constructor' &&
    值 !== 'prototype'
  );
}

function 是合法角色档案id(值) {
  return 是合法关系角色(值) && !['narrator', 'system', 'you', 'protagonist'].includes(值);
}

function 人性化角色id(值) {
  if (typeof 值 !== 'string' || !值) return '未知角色';
  if (!/^[a-z0-9_-]+$/i.test(值)) return 值;
  return 值
    .split(/[_-]+/)
    .filter(Boolean)
    .map((段) => 段.charAt(0).toUpperCase() + 段.slice(1))
    .join(' ');
}

function 规范化颜色(值, 兜底) {
  const 文本 = 非空字符串(值);
  return /^#[0-9a-f]{6}$/i.test(文本) ? 文本 : 兜底;
}

function 钳制关系初值(值, 兜底) {
  const 数 = typeof 值 === 'number' && Number.isFinite(值) ? 值 : 兜底;
  return Math.max(0, Math.min(100, Math.round(数)));
}

// ---- 分数（scores）定义规范化：三个读取函数 ----

// () → 把当前剧情的 mechanics.scores 清洗成带完整默认值的定义列表 → ScoreDef[]
// 每次调用都重新算（无缓存），这样换片后立刻生效。
export function getScoreDefinitions() {
  return 规范化分数定义列表(storyMechanics?.scores);
}

// (id) → 在定义列表里找这一条 → ScoreDef | undefined
export function getScoreDefinition(id) {
  return getScoreDefinitions().find((定义) => 定义.id === id);
}

// () → 过滤掉 visibility === "hidden" 的定义（public 和 debug 都会返回）→ ScoreDef[]
export function getVisibleScoreDefinitions() {
  return getScoreDefinitions().filter((定义) => 定义.visibility !== 'hidden');
}

// 输入 mechanics.scores 原始数据（可能是 undefined/非数组/脏数据）→
// 逐条清洗补默认值、按 id 去重（后写覆盖先写）；全军覆没就换上兜底三件套；
// 最后把剧情里实际用到但没声明的全局键自动补成 debug 定义 → 吐出 ScoreDef[]。
// 为什么要自动补齐：作者在 effect 里手滑用了没声明的键，结算也得有 min/max 可钳。
function 规范化分数定义列表(原始列表) {
  const 收集 = new Map();
  const 列表 = Array.isArray(原始列表) ? 原始列表 : [];
  for (const 条目 of 列表) {
    if (!条目 || typeof 条目 !== 'object') continue;
    if (是合法键(条目.id))
      收集.set(条目.id, {
        id: 条目.id,
        label: 解析标签(条目.label, 条目.id),
        description: typeof 条目.description === 'string' ? 条目.description : undefined,
        initial: 转有限数(条目.initial, 0),
        min: 转有限数(条目.min, 0),
        max: 转有限数(条目.max, 100),
        visibility: 规范化可见性(条目.visibility),
        tone: 规范化基调(条目.tone),
        warnAt: typeof 条目.warnAt === 'number' ? 条目.warnAt : undefined,
        format:
          条目.format === 'percent' || 条目.format === 'count' ? 条目.format : 'number',
      });
  }
  if (收集.size === 0) for (const 条目 of 兜底分数定义) 收集.set(条目.id, 条目);
  for (const 键 of 收集剧情全局键())
    if (!收集.has(键))
      收集.set(键, {
        id: 键,
        label: 人性化标签(键),
        initial: 0,
        min: 0,
        max: 100,
        // 旧标量 relationships 迁移出的亲密度只是兼容层，不占用玩家状态栏。
        visibility: 键.endsWith('_affinity') ? 'hidden' : 'debug',
        tone: 键.endsWith('_affinity') ? 'affinity' : 'custom',
      });
  return [...收集.values()];
}

// () → 扫一遍全部节点：热点/选项 effect.globals 里出现过的键、
// 选项 condition.minGlobal/maxGlobal 里引用过的键 → 吐出 Set<合法键>
function 收集剧情全局键() {
  const 键集 = new Set();
  for (const 节点 of storyNodeList) {
    for (const 条目 of [...(节点.hotspots ?? []), ...(节点.choices ?? [])])
      for (const 键 of Object.keys(条目.effect?.globals ?? {})) if (是合法键(键)) 键集.add(键);
    for (const 选项 of 节点.choices ?? [])
      for (const 条目 of [
        ...(选项.condition?.minGlobal ?? []),
        ...(选项.condition?.maxGlobal ?? []),
      ])
        if (是合法键(条目.key)) 键集.add(条目.key);
  }
  return 键集;
}

// (作者写的label, id) → label 是非空字符串就 trim 用它，否则按 id 造一个 →
// 最后再被中文字典强制覆盖（字典里有的 id 一律用字典的中文名）
function 解析标签(标签, id) {
  const 候选 = typeof 标签 === 'string' && 标签.trim() ? 标签.trim() : 人性化标签(id);
  return 字典覆盖(id, 候选);
}

// (id) → 字典有中文就用中文；没有就把下划线换空格、每个单词首字母大写 → 可读标签
function 人性化标签(id) {
  return 分数中文字典[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, (字) => 字.toUpperCase());
}

// (id, 备选文案) → 字典命中返回字典中文，否则返回备选
function 字典覆盖(id, 备选) {
  return 分数中文字典[id] ?? 备选;
}

// 可见性只认 public/hidden/debug 三个值，其他一律当 debug
function 规范化可见性(值) {
  return 值 === 'public' || 值 === 'hidden' || 值 === 'debug' ? 值 : 'debug';
}

// 基调只认这七种，其他一律当 custom
function 规范化基调(值) {
  return 值 === 'truth' ||
    值 === 'pressure' ||
    值 === 'affinity' ||
    值 === 'resource' ||
    值 === 'morality' ||
    值 === 'route' ||
    值 === 'custom'
    ? 值
    : 'custom';
}

// (任意值, 默认值) → Number() 一下，是有限数就用，否则用默认值
function 转有限数(值, 默认值) {
  const 数 = Number(值);
  return Number.isFinite(数) ? 数 : 默认值;
}

// 分数 id 必须是小写字母开头的 snake_case（如 truth / seal_fragments），别的全拒收
function 是合法键(值) {
  return typeof 值 === 'string' && /^[a-z][a-z0-9_]*$/.test(值);
}

// slug 清洗：非字母数字下划线连字符全部替换成 "-"，空串兜底 "bundled"
// （这个值会拼进 localStorage 存档键名，必须无害化）
function 清洗slug(slug) {
  return slug.replace(/[^a-zA-Z0-9_-]/g, '-') || 'bundled';
}
