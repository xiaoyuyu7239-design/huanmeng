// 《第九席》Level 2 内容契约：不只检查 JSON 形状，还用真实剧情引擎跑通
// 私人关系、女性同盟、独立复盘与隐藏真结局，避免“看起来有分支、实际不可达”。
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      const 文本 = readFileSync(fileURLToPath(url), 'utf8');
      return { format: 'module', source: `export default ${文本};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// 引擎模块会探测浏览器存储；内容自测只需要一个隔离、无历史草稿的空仓库。
const 存储 = new Map();
globalThis.localStorage = {
  getItem: (键) => 存储.get(键) ?? null,
  setItem: (键, 值) => 存储.set(键, String(值)),
  removeItem: (键) => 存储.delete(键),
  clear: () => 存储.clear(),
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  addEventListener() {},
  removeEventListener() {},
};

const 当前目录 = dirname(fileURLToPath(import.meta.url));
const 项目根 = resolve(当前目录, '../../..');
const 资源根 = join(项目根, '公共资源');
const 剧情路径 = join(资源根, 'games/ninth-seat/story.json');
const 创作资料路径 = join(资源根, 'games/ninth-seat/creator.json');
const 剧情 = JSON.parse(await readFile(剧情路径, 'utf8'));
const 创作资料 = JSON.parse(await readFile(创作资料路径, 'utf8'));

const 加载 = await import('./剧情加载.js');
const 引擎 = await import('./状态与结算.js');
const { 运行校验 } = await import('../../创作台/校验发布/校验规则.js');

const 标准关系维度 = new Set(['spark', 'trust', 'boundary']);
const 可发展男性id = ['lu_chenzhou', 'zhou_yan', 'he_qingye', 'shen_que'];
const 女性同盟id = ['lin_miao', 'qiao_wen'];
const 表情枚举 = ['neutral', 'focused', 'concerned', 'guarded', 'vulnerable', 'resolute', 'warm', 'warning'];
const 表情集合 = new Set(表情枚举);
const 头像路径 = {
  you: '/portraits/ninth-seat/xu-cheng.webp',
  lu_chenzhou: '/portraits/ninth-seat/lu-chenzhou.webp',
  zhou_yan: '/portraits/ninth-seat/zhou-yan.webp',
  he_qingye: '/portraits/ninth-seat/he-qingye.webp',
  shen_que: '/portraits/ninth-seat/shen-que.webp',
  lin_miao: '/portraits/ninth-seat/lin-miao.webp',
  qiao_wen: '/portraits/ninth-seat/qiao-wen.webp',
};
function 是同角色头像(路径, 角色id) {
  const 基础 = 头像路径[角色id];
  if (typeof 路径 !== 'string' || !基础) return false;
  const 前缀 = 基础.replace(/\.webp$/, '');
  return 路径 === 基础 || (路径.startsWith(`${前缀}-`) && 路径.endsWith('.webp'));
}
const 预期结局id = [
  'e01-open-ledger',
  'e02-earned-silence',
  'e03-shared-authorship',
  'e04-returned-ninth-seat',
];

// ---- 一、作品、主角与阵容 ----
assert.equal(剧情.id, 'ninth-seat');
assert.equal(剧情.title, '第九席');
assert.equal(剧情.contentVersion, 3, 'Level 5 关系 AI 契约必须使用内容版本 3');
assert.equal(剧情.content?.estimatedMinutes, '20-30', '第一章时长声明必须稳定为 20–30 分钟');
assert.equal(剧情.content?.playerLayout, 'portrait-cinema', 'Level 3 必须默认使用竖屏轻电影布局');
assert.equal(剧情.content?.theme, 'twilight', 'Level 3 必须使用暮色书页主题');
assert.deepEqual(
  剧情.content?.investigation,
  { mode: 'on-demand', label: '调查现场' },
  '360 调查必须是有明确入口文案的按需模式',
);
assert.equal(剧情.content?.visualStatus, 'level-3-cinematic-assets-investigation-beta', '视觉状态必须明确指向 Level 3 正式资产与调查测试阶段');
assert.deepEqual(剧情.content?.expressionSet, 表情枚举, '对白表情枚举必须稳定，供立绘映射与回归测试使用');
assert.equal(剧情.cast?.protagonist?.id, 'you');
assert.equal(剧情.cast?.protagonist?.name, '许澄');
assert.equal(剧情.cast?.protagonist?.pronouns, '她');
assert.match(剧情.cast?.protagonist?.role ?? '', /AI.*总导演|总导演.*AI/, '许澄必须保有明确的 AI 内容职业身份');
assert.equal(剧情.cast?.protagonist?.portrait, 头像路径.you, '许澄必须使用《第九席》正式头像');

const 配角们 = 剧情.cast?.characters ?? [];
assert.equal(配角们.length, 6, 'Level 2 应有六名配角');
assert.deepEqual(
  配角们.filter((角色) => 角色.romanceable && 角色.relationship?.enabled !== false).map((角色) => 角色.id),
  可发展男性id,
  '四名可发展男性角色的顺序与身份必须稳定',
);
assert.deepEqual(
  配角们.filter((角色) => !角色.romanceable && 角色.relationship?.enabled === false).map((角色) => 角色.id),
  女性同盟id,
  '林渺与乔雯是职业/女性同盟角色，不进入恋爱关系数值',
);
const 首页路线 = 剧情.content?.homepage?.routes ?? [];
assert.deepEqual(首页路线.map((路线) => 路线.id), ['private', 'alliance', 'solo'], 'Level 4 首页必须声明三种等价同行方式');
assert.deepEqual(首页路线[0]?.characterIds, 可发展男性id, '首页私人复盘名单必须与实际四条角色路线一致');
assert.deepEqual(首页路线[1]?.characterIds, ['lin_miao'], '首页同盟复盘必须指向林渺');
assert.deepEqual(首页路线[2]?.characterIds, [], '独立复盘不得伪造关系角色');
for (const 路线 of 首页路线) {
  assert.ok(路线.title?.trim() && 路线.description?.trim() && 路线.note?.trim(), `${路线.id} 缺少首页路线文案`);
}

const 关系AI = 剧情.content?.relationshipAI;
const 关系AI意图id = ['share_feeling', 'seek_clarity', 'set_boundary', 'ask_support', 'challenge', 'pause'];
const 关系AI会话预期 = new Map([
  ['s12-lu-private', ['lu_chenzhou', 'private-debrief']],
  ['s13-zhou-private', ['zhou_yan', 'private-debrief']],
  ['s14-he-private', ['he_qingye', 'private-debrief']],
  ['s15-shen-private', ['shen_que', 'private-debrief']],
  ['s16-lin-alliance', ['lin_miao', 'peer-alliance']],
]);
assert.equal(关系AI?.version, 1, '关系 AI 公共契约版本必须固定');
assert.equal(关系AI?.maxTurns, 3, '单节点最多三轮，避免无限陪伴与失控费用');
assert.deepEqual(关系AI?.allowedIntents?.map((条) => 条.id), 关系AI意图id, '关系 AI 意图白名单发生漂移');
assert.deepEqual(关系AI?.sessions?.map((条) => 条.nodeId), [...关系AI会话预期.keys()], '关系 AI 只能开放四个私聊与林渺同盟复盘');
assert.match(关系AI?.notice ?? '', /不会.*改变.*(?:关系数值|路线|结局)/u, '关系 AI 缺少不改剧情状态的玩家说明');
for (const 会话 of 关系AI?.sessions ?? []) {
  const [角色id, mode] = 关系AI会话预期.get(会话.nodeId) ?? [];
  assert.equal(会话.characterId, 角色id, `${会话.nodeId} 的可信角色白名单错误`);
  assert.equal(会话.mode, mode, `${会话.nodeId} 的关系模式错误`);
  assert.ok(配角们.some((角色) => 角色.id === 会话.characterId), `${会话.nodeId} 引用了阵容外角色`);
  assert.ok(剧情.nodes[会话.nodeId]?.lines?.some((行) => 行.speaker === 会话.characterId), `${会话.nodeId} 的角色没有出现在当前场景`);
  assert.equal(会话.suggestions?.length, 3, `${会话.nodeId} 必须提供三条可编辑建议表达`);
  assert.ok(会话.opening?.trim() && 会话.voice?.style?.trim(), `${会话.nodeId} 缺少入口或角色口吻`);
  assert.ok((会话.voice?.anchors ?? []).length >= 3, `${会话.nodeId} 缺少角色一致性锚点`);
  assert.ok((会话.voice?.forbiddenPhrases ?? []).length >= 3, `${会话.nodeId} 缺少角色越界短语`);
  for (const intent of [...关系AI意图id, 'safe_guard']) {
    assert.ok(会话.fallbackReplies?.[intent]?.trim(), `${会话.nodeId} 缺少 ${intent} 作者备用回复`);
  }
  assert.ok(!/(?:effect|next|route|globals|relationships|flags)/u.test(Object.keys(会话).join('|')), `${会话.nodeId} 的生成配置不得携带剧情状态字段`);
}
assert.ok(!(关系AI?.sessions ?? []).some((条) => ['qiao_wen', 'you'].includes(条.characterId)), '乔雯与玩家内心没有正式一对一 AI 场景，不得越权开放');

for (const 角色 of 配角们) {
  const 初值维度 = Object.keys(角色.relationship?.initial ?? {});
  assert.ok(初值维度.length > 0, `${角色.id} 缺少关系初值`);
  assert.ok(初值维度.every((维度) => 标准关系维度.has(维度)), `${角色.id} 使用了非标准关系维度`);
  assert.equal(角色.portrait, 头像路径[角色.id], `${角色.id} 必须使用《第九席》正式头像`);
  assert.ok(Object.keys(角色.portraits ?? {}).length > 0, `${角色.id} 缺少表情头像映射`);
  for (const [表情, 路径] of Object.entries(角色.portraits ?? {})) {
    assert.ok(表情集合.has(表情), `${角色.id} 使用了非法头像表情 ${表情}`);
    assert.ok(是同角色头像(路径, 角色.id), `${角色.id}/${表情} 不得引用其他角色或外链头像`);
  }
}
for (const [表情, 路径] of Object.entries(剧情.cast?.protagonist?.portraits ?? {})) {
  assert.ok(表情集合.has(表情), `许澄使用了非法头像表情 ${表情}`);
  assert.ok(是同角色头像(路径, 'you'), `许澄/${表情} 不得引用其他角色或外链头像`);
}

// ---- 二、图结构、创作台校验与机制引用 ----
const 节点条目 = Object.entries(剧情.nodes ?? {});
const 结局id们 = 节点条目.filter(([, 节点]) => !!节点.ending).map(([id]) => id);
assert.ok(节点条目.length >= 25, `第一章至少需要 25 个节点，当前 ${节点条目.length} 个`);
assert.deepEqual(结局id们, 预期结局id, '四个阶段结局 id 必须稳定，供存档与回归测试使用');
for (const id of ['s16-lin-alliance', 's17-solo-review', 's18-responsibility-signature', 's19-broadcast-countdown', 's20-live-crossroad']) {
  assert.ok(剧情.nodes[id], `缺少收束节点 ${id}`);
}

const 可写关系id = new Set(可发展男性id);
const 场景分组 = {
  'control-room': ['s00-blue-salon', 's09-blackout', 's11-partner-select', 's17-solo-review'],
  'stage-replay': ['s01-ghost-frame', 's19-broadcast-countdown', 's20-live-crossroad', ...预期结局id],
  'audit-vault': ['s02-signal-room', 's06-evidence-table', 's07-data-vault', 's12-lu-private', 's16-lin-alliance', 's18-responsibility-signature'],
  'media-gallery': ['s03-media-booth', 's10-debrief-mode', 's13-zhou-private'],
  'dressing-room': ['s04-dressing-corridor', 's14-he-private'],
  'legal-office': ['s05-legal-room', 's08-producer-office', 's15-shen-private'],
};
const 预期场景 = new Map(
  Object.entries(场景分组).flatMap(([场景, 节点们]) =>
    节点们.map((节点id) => [节点id, `/scenes/ninth-seat/${场景}.png`]),
  ),
);
for (const [节点id, 节点] of 节点条目) {
  assert.equal(节点.backdrop, 预期场景.get(节点id), `${节点id} 的轻电影背景映射不正确`);
  assert.match(节点.backdrop, /^\/scenes\/ninth-seat\/[a-z-]+\.png$/, `${节点id} 的背景必须是本地《第九席》场景资源`);
  for (const [行号, 台词] of (节点.lines ?? []).entries()) {
    if (台词.speaker === 'narrator') continue;
    assert.ok(表情集合.has(台词.expression), `${节点id} line ${行号 + 1} 缺少合法 expression`);
  }
  for (const [类型, 条目] of [
    ...(节点.hotspots ?? []).map((热点) => ['hotspot', 热点]),
    ...(节点.choices ?? []).map((选择) => ['choice', 选择]),
  ]) {
    if (类型 === 'choice') {
      assert.equal(typeof 条目.intent, 'string', `${节点id}/${条目.id} 缺少玩家意图文案`);
      assert.ok(条目.intent.trim(), `${节点id}/${条目.id} 的玩家意图文案不能为空`);
      assert.ok(条目.intent.length <= 24, `${节点id}/${条目.id} 的玩家意图文案过长`);
      assert.ok(!/^(?:https?:)?\/\//i.test(条目.intent), `${节点id}/${条目.id} 的玩家意图不得是外链`);
    }
    for (const [角色id, 增量组] of Object.entries(条目.effect?.relationships ?? {})) {
      assert.ok(可写关系id.has(角色id), `${节点id}/${类型}/${条目.id} 不得改写禁用关系角色 ${角色id}`);
      assert.equal(typeof 增量组, 'object', `${节点id}/${条目.id} 必须使用三维关系对象，不能使用标量`);
      assert.ok(
        Object.keys(增量组).every((维度) => 标准关系维度.has(维度)),
        `${节点id}/${条目.id} 出现 spark/trust/boundary 之外的关系维度`,
      );
    }
    for (const 门槛 of 条目.condition?.minRelationship ?? []) {
      assert.ok(可写关系id.has(门槛.character), `${节点id}/${条目.id} 不得读取禁用关系角色 ${门槛.character}`);
      assert.ok(标准关系维度.has(门槛.metric), `${节点id}/${条目.id} 使用了非标准关系门槛`);
    }
  }
}

const 创作台报告 = 运行校验({
  slug: 'ninth-seat',
  story: 剧情,
  authoring: 创作资料.authoring,
  prompts: { prompts: [] },
  manifest: { assets: [] },
});
assert.deepEqual(创作台报告.errors, [], `真实创作台校验失败：\n- ${创作台报告.errors.join('\n- ')}`);

// ---- 三、剧情声明的本地资源必须真的存在 ----
const 本地媒体 = new Set();
function 收集本地媒体(值) {
  if (typeof 值 === 'string') {
    if (/^\/(?:landing|audio|panoramas|portraits|scenes|videos|music|voices)\//.test(值)) {
      本地媒体.add(值.split(/[?#]/, 1)[0]);
    }
    return;
  }
  if (Array.isArray(值)) {
    值.forEach(收集本地媒体);
    return;
  }
  if (值 && typeof 值 === 'object') Object.values(值).forEach(收集本地媒体);
}
收集本地媒体(剧情);
assert.ok(本地媒体.size > 0, '《第九席》必须声明至少一项本地视觉或音频资源');
for (const 资源路径 of 本地媒体) {
  const 信息 = await stat(join(资源根, 资源路径.replace(/^\//, '')));
  assert.ok(信息.isFile() && 信息.size > 0, `资源不存在或为空：${资源路径}`);
}

// ---- 四、用真实引擎跑四条结局路径 ----
加载.setActiveStory(剧情, 'ninth-seat');
assert.equal(加载.storyContent?.playerLayout, 'portrait-cinema', '加载边界丢失了轻电影布局');
assert.deepEqual(
  加载.storyContent?.investigation,
  { mode: 'on-demand', label: '调查现场' },
  '加载边界丢失或改坏了按需调查契约',
);
assert.equal(加载.storyContent?.relationshipAI?.sessions?.length, 5, '加载边界丢失了关系 AI 会话契约');
assert.equal(加载.storyNodes['s00-blue-salon'].backdrop, '/scenes/ninth-seat/control-room.png');
assert.equal(加载.storyNodes['s00-blue-salon'].choices[0].intent, '冻结外发信号，保留全部本地记录');
assert.ok(表情集合.has(加载.storyNodes['s00-blue-salon'].lines[1].expression));
assert.equal(加载.getStoryProtagonist().portraits.resolute, 头像路径.you);

function 当前节点(state) {
  return 加载.storyNodes[state.currentNodeId];
}

function 点完本幕热点(state) {
  let 新状态 = state;
  for (const 热点 of 当前节点(新状态).hotspots ?? []) {
    新状态 = 引擎.点击热点(新状态, 热点.id, 热点.effect);
  }
  return 新状态;
}

function 选择(state, { id, next, preferFlag } = {}) {
  const 节点 = 当前节点(state);
  let 候选 = 节点.choices ?? [];
  if (id) 候选 = 候选.filter((条) => 条.id === id);
  if (next) 候选 = 候选.filter((条) => 条.next === next);
  const 可用 = 候选.filter((条) => 引擎.选择可用(state, 条));
  const 命中偏好 = preferFlag
    ? 可用.find((条) => (条.effect?.flags ?? []).includes(preferFlag))
    : null;
  const 选择项 = 命中偏好 ?? 可用[0];
  assert.ok(
    选择项,
    `${节点.id} 找不到可用选择${id ? ` id=${id}` : ''}${next ? ` -> ${next}` : ''}`,
  );
  return 引擎.做出选择(state, 选择项);
}

function 走到复盘分流() {
  加载.setActiveStory(剧情, 'ninth-seat');
  let state = 引擎.创建初始状态();
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'freeze-external-feed' });
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'trace-signal-origin' });
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'mirror-raw-stream' });
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'preserve-complete-chain' });
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'preserve-with-access-ledger' });
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'demand-independent-audit' });
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'restore-human-veto' });
  assert.equal(state.currentNodeId, 's10-debrief-mode');
  return state;
}

function 走私人关系线() {
  let state = 走到复盘分流();
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'choose-private-partner' });
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'debrief-with-lu' });
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'co-sign-control-log' });
  assert.equal(state.currentNodeId, 's18-responsibility-signature');
  return state;
}

function 走女性同盟线() {
  let state = 走到复盘分流();
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'choose-women-alliance' });
  state = 点完本幕热点(state);
  state = 选择(state, { next: 's18-responsibility-signature' });
  assert.equal(state.currentNodeId, 's18-responsibility-signature');
  return state;
}

function 走独立复盘线() {
  let state = 走到复盘分流();
  state = 点完本幕热点(state);
  state = 选择(state, { id: 'choose-solo-review' });
  state = 点完本幕热点(state);
  state = 选择(state, { next: 's18-responsibility-signature' });
  assert.equal(state.currentNodeId, 's18-responsibility-signature');
  return state;
}

function 走向结局(state, 结局id, { 需要共享证据 = false } = {}) {
  for (const 下一幕 of ['s19-broadcast-countdown', 's20-live-crossroad']) {
    state = 点完本幕热点(state);
    state = 选择(state, {
      next: 下一幕,
      preferFlag: 需要共享证据 && !state.flags.includes('shared_evidence') ? 'shared_evidence' : undefined,
    });
  }
  state = 点完本幕热点(state);
  state = 选择(state, { next: 结局id });
  assert.equal(state.currentNodeId, 结局id);
  assert.ok(state.unlockedEndings.includes(结局id), `${结局id} 未被写入已解锁结局`);
  return state;
}

const 陆初值 = 剧情.cast.characters.find((角色) => 角色.id === 'lu_chenzhou').relationship.initial;
const 公开账本状态 = 走向结局(走私人关系线(), 'e01-open-ledger');
assert.equal(公开账本状态.route, 'lu_chenzhou');
const 完整路径对白行数 = 公开账本状态.visitedNodes.reduce(
  (总数, 节点id) => 总数 + (剧情.nodes[节点id]?.lines?.length ?? 0),
  0,
);
assert.ok(公开账本状态.visitedNodes.length >= 12, `完整通关路径至少应经过 12 个节点，实际 ${公开账本状态.visitedNodes.length} 个`);
assert.ok(完整路径对白行数 >= 70, `完整通关路径至少应有 70 行对白，实际 ${完整路径对白行数} 行`);
for (const 维度 of 标准关系维度) {
  assert.notEqual(公开账本状态.relationships.lu_chenzhou[维度], 陆初值[维度], `陆沉舟的 ${维度} 没有随选择变化`);
}

走向结局(走独立复盘线(), 'e02-earned-silence');
const 共署状态 = 走向结局(走女性同盟线(), 'e03-shared-authorship', { 需要共享证据: true });
assert.ok(共署状态.flags.includes('chose_women_alliance'), '共署结局必须能经女性同盟路线达成');

const 真结局选择 = 剧情.nodes['s20-live-crossroad'].choices.find((条) => 条.next === 'e04-returned-ninth-seat');
assert.ok(真结局选择?.condition, '隐藏真结局必须有明确的内容条件');
assert.ok(!('route' in 真结局选择.condition), '隐藏真结局不得要求恋爱或指定路线');
assert.equal((真结局选择.condition.minRelationship ?? []).length, 0, '隐藏真结局不得要求关系数值');
const 真结局状态 = 走向结局(走独立复盘线(), 'e04-returned-ninth-seat');
assert.equal(真结局状态.route, null, '独立复盘不应被暗写成某位角色路线');

console.log(
  `第九席内容自测：${节点条目.length} 节点、${结局id们.length} 结局、完整路径 ${公开账本状态.visitedNodes.length} 节点/${完整路径对白行数} 行对白、${本地媒体.size} 项资源，私人/同盟/独立/隐藏路线全部通过`,
);
