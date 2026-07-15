// ============================================================================
// 这个文件是播放器的「账房先生 + 裁判」：游戏进行到哪一幕、每个角色对你什么态度、
// 各项数值攒了多少、捡了哪些线索旗标——全记在一本账（GameState）上；
// 玩家每做一个动作（推进对白/点热点/做选择），就照规则记一笔新账（返回新对象，
// 从不涂改旧账，这样 React 才能察觉变化）；选项能不能点，也由这里当裁判。
// 逻辑与线上 App.js 中的状态函数逐条等价（分析文档：播放器状态分析.md §1-§7）。
//
// 【导出清单】（括号内是线上压缩名，便于对照原始代码）
//  常量：
//   角色表(xe) 角色顺序(ve) 关系维度(Zt) 关系初始值(he) 默认设置(et)
//  状态工厂与节点读取：
//   创建初始状态()(ye)  初始全局数值表()(bt)  取节点(id)(ht)  取当前节点(state)(_)
//   已到最后一行(state)(tt)
//  剧情推进（全部返回新 state）：
//   推进对白(state)(en)  跳转节点(state,目标id)(tn)  做出选择(state,choice)(nn)
//   点击热点(state,热点id,effect)(sn)  应用效果(state,effect)(pt)
//   生成决策记录(state,node,choice)(gn)
//  选择解锁裁判：
//   条件满足(state,condition)(ze)  选择可用(state,choice)(on)
//   可用选择列表(state)(rn)  锁定选择列表(state)（App 内联 Q 的纯函数版）
//   找解锁热点(node,choice)(vt)  锁定提示(node,choice)(Hn)
//  结局与因果：
//   结局已达成(state)（App 内联 G）  本周目决策(state)（回忆面板 m）
//   本周目因果回放(state)（结局面板 ae，末尾4条）
//  设置：
//   创建默认设置()($e)  规范化设置(旧,增量)(we)  更新设置(state,增量)(an)
//  展示名与选择反馈（纯数据，不含 DOM）：
//   路线显示名(gt)  说话人显示名(On)  命运类型显示名(se)
//   生成选择反馈(choice)(qn)  效果状态变化(effect)(Gn)  效果因果记录(effect)(Un)
//   格式化数值(值,定义)(En)  是否警示(值,定义)(Vn)
//  小工具（存档系统也要用）：
//   读全局值(globals,key)(nt)  刷新存档时间(state)(T)  去重(数组)(k)
//   钳制关系值(pe)  按定义钳制数值(值,定义)(Fe)  钳制行索引(值,行数)(wn)
//   规范化音量(值,默认)(de)  规范化周目数(值,默认)(jt)
// ============================================================================

import {
  START_NODE_ID,
  ACTIVE_GAME_ID,
  STORY_ID,
  storyNodes,
  getScoreDefinitions,
  getScoreDefinition,
  getRelationshipCharacterIds,
  getStoryProtagonist,
  getStoryCharacter,
} from './剧情加载.js';

// ---- 常量（原样照抄线上，一个字都不能差）----

// 六位角色的档案卡：颜色用于对白角色徽章，theme 是人物主题词
export const 角色表 = {
  lin: {
    id: 'lin',
    name: '罗峥',
    shortName: '罗峥',
    role: '镜厅安保主管',
    theme: '职责与怀疑',
    color: '#8fb6c7',
    accent: '#223643',
  },
  qi: {
    id: 'qi',
    name: '纪辰',
    shortName: '纪辰',
    role: '外部行动指挥',
    theme: '情报与代价',
    color: '#f1b95f',
    accent: '#4d3516',
  },
  su: {
    id: 'su',
    name: '许知微',
    shortName: '知微',
    role: '接头人，前调查记者',
    theme: '信任与牺牲',
    color: '#83c99a',
    accent: '#1e4830',
  },
  xia: {
    id: 'xia',
    name: '周临',
    shortName: '周临',
    role: '镜厅实习运维',
    theme: '胆怯与证词',
    color: '#8fc8ff',
    accent: '#17395a',
  },
  cheng: {
    id: 'cheng',
    name: '韩雁',
    shortName: '韩雁',
    role: '镜厅产品发布负责人',
    theme: '秩序与遮蔽',
    color: '#f08a8a',
    accent: '#5c1f2a',
  },
  ruan: {
    id: 'ruan',
    name: 'ECHO',
    shortName: 'ECHO',
    role: '镜厅异常交互层',
    theme: '预测与控制',
    color: '#b9c7ff',
    accent: '#28315d',
  },
};

export const 角色顺序 = ['lin', 'qi', 'su', 'xia', 'cheng', 'ruan'];

// 每段关系的三个刻度：牵连(spark)/信任(trust)/边界(boundary)，都在 0-100 之间
export const 关系维度 = ['spark', 'trust', 'boundary'];
export const 关系初始值 = { spark: 30, trust: 30, boundary: 50 };

// 当前故事关系角色只来自当前 story 的 cast 和剧情实际引用；旧六人不再污染每部作品的新存档。
export function 当前关系角色顺序() {
  return getRelationshipCharacterIds();
}

export function 角色关系初始值(角色id) {
  const 初值 = getStoryCharacter(角色id)?.relationship?.initial ?? 关系初始值;
  return {
    spark: 钳制关系值(Number(初值.spark ?? 关系初始值.spark)),
    trust: 钳制关系值(Number(初值.trust ?? 关系初始值.trust)),
    boundary: 钳制关系值(Number(初值.boundary ?? 关系初始值.boundary)),
  };
}

// 只接纳无原型污染风险的拉丁角色 id；连字符兼容旧项目，下划线用于现代项目。
export function 是合法关系角色(值) {
  return (
    typeof 值 === 'string' &&
    /^[a-z][a-z0-9_-]*$/.test(值) &&
    !['narrator', 'system', 'you', 'protagonist'].includes(值) &&
    值 !== '__proto__' &&
    值 !== 'constructor' &&
    值 !== 'prototype'
  );
}

// 出厂设置：新玩家/清档后的默认体验
export const 默认设置 = {
  autoDrift: true, // 自动环视
  reducedMotion: false, // 减少动效
  uiScale: 'comfortable', // 界面缩放："comfortable" | "compact"
  gyroscope: false, // 陀螺仪（线上定义了但 UI 未用，保留以保证存档兼容）
  audio: {
    masterVolume: 0.8,
    uiVolume: 0.72,
    voiceVolume: 1,
    bgmVolume: 0.5,
    sceneAudioDefault: 'voice', // 默认节点声音："voice" | "video" | "mix"
    muted: false, // 全局"声音"总开关
    masterMuted: false, // 总音量静音
    uiMuted: false, // 界面音效静音
    voiceMuted: false, // 对白语音静音
    bgmMuted: false, // 背景音乐静音
  },
};

// ---- 状态工厂与节点读取 ----

// () → 按当前剧情定义生成 { 分数id: 钳制过的初始值 } → 新一局的全局数值表
export function 初始全局数值表() {
  return getScoreDefinitions().reduce((表, 定义) => ((表[定义.id] = 按定义钳制数值(定义.initial, 定义)), 表), {});
}

// () → 造一本崭新的账本（第一周目、站在起始节点、当前故事关系按角色初值建立）→ GameState
// 注意 ACTIVE_GAME_ID / START_NODE_ID 是 live binding：换片后再调用会拿到新片的值。
export function 创建初始状态() {
  return {
    gameId: ACTIVE_GAME_ID,
    storyId: STORY_ID,
    currentNodeId: START_NODE_ID,
    lineIndex: 0,
    relationships: 当前关系角色顺序().reduce(
      (表, 角色) => ((表[角色] = 角色关系初始值(角色)), 表),
      {},
    ),
    globals: 初始全局数值表(),
    flags: [],
    memories: [],
    visitedNodes: [START_NODE_ID],
    seenHotspots: [],
    route: null,
    loopCount: 1,
    unlockedEndings: [],
    persistentMemories: [],
    decisionLog: [],
    settings: 创建默认设置(),
    lastSavedAt: Date.now(),
  };
}

// (节点id) → 查节点字典，查不到就回退起始节点（断链保护）→ 节点对象
export function 取节点(节点id) {
  const 节点 = storyNodes[节点id];
  return 节点 || storyNodes[START_NODE_ID];
}

// (state) → 当前所在的节点对象
export function 取当前节点(state) {
  return 取节点(state.currentNodeId);
}

// (state) → 对白是不是已经念到本节点最后一行 → boolean（true 时该显示选择区了）
export function 已到最后一行(state) {
  return state.lineIndex >= 取当前节点(state).lines.length - 1;
}

// ---- 剧情推进（全部是"旧账本进、新账本出"的纯函数）----

// (state) → 没到最后一行就把行号 +1，到了就原样返回 → 新 state
export function 推进对白(state) {
  const 节点 = 取当前节点(state);
  return state.lineIndex >= 节点.lines.length - 1
    ? state
    : 刷新存档时间({ ...state, lineIndex: state.lineIndex + 1 });
}

// (state, 目标id) → 搬到目标节点（不存在则回起始节点）、行号归零、
// 记入已到达列表；目标是结局节点则顺手解锁该结局 → 新 state
export function 跳转节点(state, 目标id) {
  const 落点 = storyNodes[目标id] ? 目标id : START_NODE_ID;
  const 节点 = storyNodes[落点];
  return 刷新存档时间({
    ...state,
    currentNodeId: 落点,
    lineIndex: 0,
    visitedNodes: 去重([...state.visitedNodes, 落点]),
    unlockedEndings: 节点.ending ? 去重([...state.unlockedEndings, 落点]) : state.unlockedEndings,
  });
}

// (state, choice) → 先记一条决策日志（最多留末尾120条），再结算 effect，最后跳去 next → 新 state
export function 做出选择(state, choice) {
  const 节点 = 取当前节点(state);
  const 记完账 = 刷新存档时间({
    ...state,
    decisionLog: [...state.decisionLog, 生成决策记录(state, 节点, choice)].slice(-120),
  });
  const 结完算 = 应用效果(记完账, choice.effect);
  return 跳转节点(结完算, choice.next);
}

// (state, 热点id, effect) → 同一热点只给一次奖励：看过就原样返回；
// 没看过则结算 effect 并把 "节点id:热点id" 记入已看列表 → 新 state
export function 点击热点(state, 热点id, effect) {
  const 记号 = `${state.currentNodeId}:${热点id}`;
  return state.seenHotspots.includes(记号)
    ? state
    : 刷新存档时间({
        ...应用效果(state, effect),
        seenHotspots: 去重([...state.seenHotspots, 记号]),
      });
}

// (state, effect) → 把一份 effect 逐项记到账上 → 新 state。规则：
//   relationships：接纳合法剧情角色 × 三个标准维度，数值增量累加后四舍五入并钳到 0-100
//   globals：增量累加，按分数定义的 min/max 钳制（没定义就 0-100），初值取定义 initial
//   flags / memories：并集合并（去重追加，只增不减）
//   route：effect 里显式给了值（包括 null）才覆盖，没给就保持原样
export function 应用效果(state, effect) {
  if (!effect) return state;
  const 关系 = structuredClone(state.relationships ?? {});
  if (effect.relationships)
    for (const [角色, 增量组] of Object.entries(effect.relationships)) {
      if (!是合法关系角色(角色) || !增量组 || typeof 增量组 !== 'object' || Array.isArray(增量组))
        continue;
      const 当前 = 关系[角色] && typeof 关系[角色] === 'object' ? 关系[角色] : 关系初始值;
      关系[角色] = {
        spark: 钳制关系值(Number(当前.spark ?? 关系初始值.spark)),
        trust: 钳制关系值(Number(当前.trust ?? 关系初始值.trust)),
        boundary: 钳制关系值(Number(当前.boundary ?? 关系初始值.boundary)),
      };
      for (const 维度 of 关系维度) {
        const 增量 = 增量组[维度];
        if (typeof 增量 === 'number' && Number.isFinite(增量))
          关系[角色][维度] = 钳制关系值(关系[角色][维度] + 增量);
      }
    }
  const 全局 = { ...state.globals };
  if (effect.globals) {
    for (const [键, 增量] of Object.entries(effect.globals))
      if (typeof 增量 === 'number') {
        const 定义 = getScoreDefinition(键);
        全局[键] = 按定义钳制数值((全局[键] ?? 定义?.initial ?? 0) + 增量, 定义);
      }
  }
  const 当前旗标 = Array.isArray(state.flags) ? state.flags : [];
  const 当前记忆 = Array.isArray(state.memories) ? state.memories : [];
  const 新旗标 = Array.isArray(effect.flags) ? effect.flags.filter((值) => typeof 值 === 'string') : [];
  const 新记忆 = Array.isArray(effect.memories) ? effect.memories.filter((值) => typeof 值 === 'string') : [];
  return 刷新存档时间({
    ...state,
    relationships: 关系,
    globals: 全局,
    flags: 去重([...当前旗标, ...新旗标]),
    memories: 去重([...当前记忆, ...新记忆]),
    route: effect.route === undefined ? state.route : effect.route,
  });
}

// (state, node, choice) → 一条决策日志（谁在哪个节点选了什么、后果文案、原 effect）
export function 生成决策记录(state, node, choice) {
  return {
    id: `${state.loopCount}-${node.id}-${choice.id}-${Date.now()}`,
    loop: state.loopCount,
    nodeId: node.id,
    nodeTitle: node.title,
    choiceId: choice.id,
    label: choice.label,
    next: choice.next,
    fateType: choice.fateType,
    consequence: choice.consequence,
    effect: choice.effect,
    createdAt: Date.now(),
  };
}

// ---- 选择解锁裁判 ----

// (state, condition) → 八类条件全部过关才算满足 → boolean。
// condition 缺省恒为 true；任意一条不满足即锁定：
//   route 必须相等 / flags 必须全有 / missingFlags 必须全无 /
//   memories 必须全有 / missingMemories 必须全无 /
//   minRelationship 每条 relationships[character][metric] >= value /
//   minGlobal 每条全局值 >= value / maxGlobal 每条全局值 <= value
export function 条件满足(state, condition) {
  const 条件列表 = (值) => (Array.isArray(值) ? 值 : []);
  const flags = Array.isArray(state.flags) ? state.flags : [];
  const memories = Array.isArray(state.memories) ? state.memories : [];
  return condition
    ? !(
        (condition.route !== undefined && condition.route !== state.route) ||
        条件列表(condition.flags).some((旗标) => !flags.includes(旗标)) ||
        条件列表(condition.missingFlags).some((旗标) => flags.includes(旗标)) ||
        条件列表(condition.memories).some((记忆) => !memories.includes(记忆)) ||
        条件列表(condition.missingMemories).some((记忆) => memories.includes(记忆)) ||
        条件列表(condition.minRelationship).some(
          (条目) =>
            !条目 ||
            typeof 条目 !== 'object' ||
            !Number.isFinite(Number(条目.value)) ||
            读关系值(state.relationships, 条目.character, 条目.metric) < Number(条目.value),
        ) ||
        条件列表(condition.minGlobal).some(
          (条目) =>
            !条目 ||
            typeof 条目 !== 'object' ||
            !Number.isFinite(Number(条目.value)) ||
            读全局值(state.globals, 条目.key) < Number(条目.value),
        ) ||
        条件列表(condition.maxGlobal).some(
          (条目) =>
            !条目 ||
            typeof 条目 !== 'object' ||
            !Number.isFinite(Number(条目.value)) ||
            读全局值(state.globals, 条目.key) > Number(条目.value),
        )
      )
    : true;
}

// (state, choice) → 该选项当前能不能点 → boolean
export function 选择可用(state, choice) {
  return 条件满足(state, choice.condition);
}

// (state) → 当前节点里所有能点的选项 → Choice[]
export function 可用选择列表(state) {
  return 取当前节点(state).choices.filter((choice) => 选择可用(state, choice));
}

// (state) → 当前节点里"有条件且没满足"的选项（灰卡展示用）→ Choice[]
// 注意：界面层只在已到最后一行时才调用/展示，这里保持纯函数不做该判断。
export function 锁定选择列表(state) {
  return 取当前节点(state).choices.filter(
    (choice) => choice.condition && !条件满足(state, choice.condition),
  );
}

// (node, choice) → 在本节点热点里找"能补齐该选项所缺旗标"的那一个 → hotspot | null
// 判定：热点 effect.flags 与选项 condition.flags 有交集就算。
export function 找解锁热点(node, choice) {
  const 所缺旗标 = Array.isArray(choice.condition?.flags) ? choice.condition.flags : [];
  return 所缺旗标.length === 0
    ? null
    : ((Array.isArray(node.hotspots) ? node.hotspots : []).find((热点) => {
        const 热点旗标 = Array.isArray(热点.effect?.flags) ? 热点.effect.flags : [];
        return 所缺旗标.some((旗标) => 热点旗标.includes(旗标));
      }) ?? null);
}

// (node, choice) → 锁定选项下面的小字提示 → string
export function 锁定提示(node, choice) {
  const 热点 = 找解锁热点(node, choice);
  return 热点
    ? `先点击「${热点.label}」：${热点.description}`
    : (choice.lockedHint ?? '先调查场景中的线索，再做选择。');
}

// ---- 结局与因果 ----

// (state) → 站在结局节点且对白念完 = 结局达成 → boolean
export function 结局已达成(state) {
  return !!(取当前节点(state).ending && 已到最后一行(state));
}

// (state) → 本周目产生的全部决策日志（回忆面板"本周目关键选择"用）
export function 本周目决策(state) {
  return state.decisionLog.filter((条目) => 条目.loop === state.loopCount);
}

// (state) → 本周目最后 4 条决策（结局面板"因果回放"用）
export function 本周目因果回放(state) {
  return 本周目决策(state).slice(-4);
}

// ---- 设置 ----

// () → 一份全新的默认设置（audio 子对象也要拷贝，避免共享引用被改坏）
export function 创建默认设置() {
  return { ...默认设置, audio: { ...默认设置.audio } };
}

// (旧设置, 增量) → 以默认设置为底、旧值盖上、增量再盖上，音频子对象单独深合并；
// 音量全部钳到 0-1，布尔值强制成真布尔 → 一份保证形状正确的设置。
// 为什么这么绕：存档可能来自旧版本或被手改过，任何字段都不能信，得逐项验。
export function 规范化设置(旧设置, 增量) {
  const 默认 = 创建默认设置();
  const 合并 = { ...默认, ...(旧设置 ?? {}), ...(增量 ?? {}) };
  const 音频 = {
    ...默认.audio,
    ...(旧设置?.audio ?? {}),
    ...(增量?.audio ?? {}),
  };
  return {
    ...合并,
    audio: {
      masterVolume: 规范化音量(音频.masterVolume, 默认.audio.masterVolume),
      uiVolume: 规范化音量(音频.uiVolume, 默认.audio.uiVolume),
      voiceVolume: 规范化音量(音频.voiceVolume, 默认.audio.voiceVolume),
      bgmVolume: 规范化音量(音频.bgmVolume, 默认.audio.bgmVolume),
      // 旧存档字段名叫 sceneAudioPriority，这里做兼容读取
      sceneAudioDefault: 规范化场景声音默认(
        音频.sceneAudioDefault ?? 音频.sceneAudioPriority,
        默认.audio.sceneAudioDefault,
      ),
      muted: !!音频.muted,
      masterMuted: !!音频.masterMuted,
      uiMuted: !!音频.uiMuted,
      voiceMuted: !!音频.voiceMuted,
      bgmMuted: !!音频.bgmMuted,
    },
  };
}

// 场景声音默认值只认 video/voice/mix，其他一律用兜底值
function 规范化场景声音默认(值, 兜底) {
  return 值 === 'video' || 值 === 'voice' || 值 === 'mix' ? 值 : 兜底;
}

// (state, 设置增量) → 合并规范化后写回账本 → 新 state
export function 更新设置(state, 设置增量) {
  return 刷新存档时间({ ...state, settings: 规范化设置(state.settings, 设置增量) });
}

// ---- 展示名与选择反馈（纯数据加工，给界面层直接用）----

// 路线 id → 中文显示名；没锁定路线显示"未锁定"
export function 路线显示名(route) {
  if (!route) return '未锁定';
  const 剧情角色 = getStoryCharacter(route);
  if (剧情角色) return 剧情角色.shortName || 剧情角色.name;
  switch (route) {
    case 'lin':
      return '罗峥';
    case 'qi':
      return '纪辰';
    case 'su':
      return '许知微';
    case 'xia':
      return '周临';
    case 'cheng':
      return '韩雁';
    case 'ruan':
      return 'ECHO';
    case 'team':
      return '群像';
    case 'solo':
      return '独立';
    default:
      return '未锁定';
  }
}

// 说话人 id → 显示名兜底。已发布作品里的自定义主角显式映射；普通拉丁 id
// 则把 snake_case / kebab-case 转成标题格式，避免直接把机器 id 展示给玩家。
export function 说话人显示名(speaker) {
  if (speaker === 'you' || speaker === 'protagonist') return getStoryProtagonist().name;
  const 剧情角色 = getStoryCharacter(speaker);
  if (剧情角色) return 剧情角色.name;
  switch (speaker) {
    case 'narrator':
      return '旁白';
    case 'system':
      return '系统';
    case 'wen_tianmo':
      return '温甜茉';
    case 'lin_wanqing':
      return '林晚晴';
    case 'hua_rongli':
      return '花容离';
    default:
      return 人性化角色id(speaker);
  }
}

// 对白徽章和关系手账共用的档案查询：当前 story 优先，旧角色表只做兼容兜底。
export function 取角色档案(角色id) {
  if (角色id === 'you' || 角色id === 'protagonist') return getStoryProtagonist();
  return getStoryCharacter(角色id) ?? 角色表[角色id] ?? null;
}

// fateType → 中文徽标文案，缺省按"因果之网"处理
export function 命运类型显示名(fateType) {
  switch (fateType) {
    case 'river':
      return '命运长河';
    case 'web':
      return '因果之网';
    case 'wheel':
      return '循环之轮';
    default:
      return '因果之网';
  }
}

// (choice) → 做选择瞬间弹出的反馈面板数据（直接从 choice 本身生成，不做状态 diff）
export function 生成选择反馈(choice) {
  return {
    label: choice.label,
    fateType: choice.fateType,
    consequence: choice.consequence ?? choice.caption,
    changes: 效果状态变化(choice.effect), // "状态变化"列，空数组时界面显示"没有直接数值变化"
    unlocks: 效果因果记录(choice.effect), // "因果记录"列，空数组时界面显示"没有新增记忆或标记"
  };
}

// (effect) → ["真相 +8", "知微 信任 +10", "路线锁定：许知微"] 这样的文案列表
export function 效果状态变化(effect) {
  if (!effect) return [];
  const 列表 = [];
  for (const [键, 增量] of Object.entries(effect.globals ?? {}))
    if (typeof 增量 === 'number') 列表.push(`${全局数值标签(键)} ${带符号(增量)}`);
  for (const [角色, 增量组] of Object.entries(effect.relationships ?? {}))
    for (const [维度, 增量] of Object.entries(增量组 ?? {}))
      if (typeof 增量 === 'number') 列表.push(`${角色短名(角色)} ${维度显示名(维度)} ${带符号(增量)}`);
  if (effect.route !== undefined) 列表.push(`路线锁定：${路线显示名(effect.route)}`);
  return 列表;
}

// (effect) → ["记忆：……", "因果标记：……"] 文案列表
export function 效果因果记录(effect) {
  return effect
    ? [
        ...(effect.memories ?? []).map((条) => `记忆：${条}`),
        ...(effect.flags ?? []).map((条) => `因果标记：${条}`),
      ]
    : [];
}

// 正数加 + 前缀（+8），负数自带符号（-3）
function 带符号(数) {
  return 数 > 0 ? `+${数}` : String(数);
}

// 全局数值键 → 显示标签：优先用分数定义的 label，无定义时查旧三键映射，再兜底原键名
function 全局数值标签(键) {
  const 定义 = getScoreDefinition(键);
  return 定义 ? 定义.label : ({ career: '身份', integrity: '真相', stress: '压力' }[键] ?? 键);
}

// 关系维度 → 中文名
function 维度显示名(维度) {
  return { spark: '牵连', trust: '信任', boundary: '边界' }[维度] ?? 维度;
}

// 角色 id → 短名（角色表里查不到就走自定义角色/拉丁 id 人性化显示）
function 角色短名(角色) {
  return 取角色档案(角色)?.shortName ?? 说话人显示名(角色);
}

function 人性化角色id(值) {
  if (typeof 值 !== 'string' || !值.trim()) return '未知角色';
  const id = 值.trim();
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(id)
    ? id
        .replace(/[_-]+/g, ' ')
        .replace(/\b[a-z]/g, (字) => 字.toUpperCase())
    : id;
}

// (数值, 分数定义) → 状态栏显示文本：format 为 percent 时带 %，否则原数值
export function 格式化数值(值, 定义) {
  return 定义.format === 'percent' ? `${值}%` : 值;
}

// (数值, 分数定义) → 状态栏是否亮警示色：有 warnAt 就比 warnAt，
// 否则 pressure 基调的数值 >= 70 视为告警
export function 是否警示(值, 定义) {
  return typeof 定义.warnAt === 'number' ? 值 >= 定义.warnAt : 定义.tone === 'pressure' && 值 >= 70;
}

// ---- 小工具（存档系统也依赖这些，保持导出）----

// (globals表, 键) → 当前值；账上没有就用定义 initial，再没有就 0
export function 读全局值(globals表, 键) {
  const 定义 = getScoreDefinition(键);
  return globals表?.[键] ?? 定义?.initial ?? 0;
}

// (关系表, 角色, 维度) → 安全读取；未知角色/非法维度都按 0，条件判断因此只会锁定而不会崩。
export function 读关系值(relationships, 角色, 维度) {
  const 值 = relationships?.[角色]?.[维度];
  return typeof 值 === 'number' && Number.isFinite(值) ? 值 : 0;
}

// (state) → 盖一个"最后保存时间"的新戳 → 新 state（所有状态变换的出口都盖这个戳）
export function 刷新存档时间(state) {
  return { ...state, lastSavedAt: Date.now() };
}

// 关系值专用：NaN 归 0，四舍五入并钳到 0-100
export function 钳制关系值(值) {
  return Number.isNaN(值) ? 0 : Math.max(0, Math.min(100, Math.round(值)));
}

// (值, 分数定义) → 非有限数归 0；按定义 min/max 钳制（缺省 0/100），四舍五入
export function 按定义钳制数值(值, 定义) {
  if (!Number.isFinite(值)) return 0;
  const 下限 = Number.isFinite(定义?.min) ? Number(定义?.min) : 0;
  const 上限 = Number.isFinite(定义?.max) ? Number(定义?.max) : 100;
  return Math.max(下限, Math.min(上限, Math.round(值)));
}

// (值, 台词行数) → 行索引钳到 [0, 行数-1]；非数一律归 0
export function 钳制行索引(值, 行数) {
  return Number.isFinite(值) ? Math.max(0, Math.min(Math.max(行数 - 1, 0), Math.round(值))) : 0;
}

// (值, 默认) → 音量钳到 0-1；非数用默认
export function 规范化音量(值, 默认) {
  const 数 = Number(值);
  return Number.isFinite(数) ? Math.max(0, Math.min(1, 数)) : 默认;
}

// (值, 默认) → 周目数：非数或 <1 用默认，其余四舍五入取整
export function 规范化周目数(值, 默认) {
  const 数 = Number(值);
  return !Number.isFinite(数) || 数 < 1 ? 默认 : Math.round(数);
}

// 数组去重（保持首次出现的顺序）
export function 去重(数组) {
  return [...new Set(数组)];
}
