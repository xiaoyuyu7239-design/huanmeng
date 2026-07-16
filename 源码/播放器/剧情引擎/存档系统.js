// ============================================================================
// 这个文件是播放器的「保险柜管理员」：账房先生（状态与结算.js）每记完一笔账，
// 这里就把整本账塞进浏览器的保险柜（localStorage，一部作品一个柜格）；
// 玩家还能把账本"压缩打包"成一串存档码带走（导出），或把别人给的码拆包验货
// （导入——每一页都要消毒，防止烂数据混进来把游戏搞崩）；
// 另外管两件大事：清空重开（只留设置）、进入下一轮周目（保留结局与跨周目记忆）。
// 与线上 App.js 的存档函数逐条等价（分析文档：播放器状态分析.md §3）。
//
// 【导出清单】（括号内是线上压缩名）
//   存档键()            (Pe)  → `interactive-cinema-save:${ACTIVE_GAME_ID}:v2`
//   保存存档(state)     (un)  全量写入 localStorage（写入前盖新时间戳、强制 gameId）
//   读取存档()          (dn)  读取+解析+消毒；任何异常返回 null（调用方回退初始状态）
//   删除存档()          (mn)  只删当前作品这一格
//   导出存档码(state)   (fn)  JSON → UTF-8 转义 → base64 字符串
//   导入存档码(码)      (hn)  base64 → UTF-8 还原 → JSON → 消毒；坏码返回 null
//   消毒存档(原始对象)  (xt)  逐字段校验回填（详见函数注释）
//   清空重开(旧settings)(ln)  全新初始状态，只保留（规范化后的）设置
//   进入下一轮(state)   (cn)  周目+1，保留 unlockedEndings/persistentMemories/settings，
//                             并把本周目记忆与结局标题并入跨周目记忆
// ============================================================================

import {
  ACTIVE_GAME_ID,
  STORY_ID,
  START_NODE_ID,
  storyNodes,
  getScoreDefinition,
  getStoryCharacterIds,
} from './剧情加载.js';
import {
  创建初始状态,
  创建默认设置,
  规范化设置,
  规范化对白日志,
  刷新存档时间,
  取节点,
  取当前节点,
  初始全局数值表,
  当前关系角色顺序,
  角色关系初始值,
  是合法关系角色,
  钳制关系值,
  按定义钳制数值,
  钳制行索引,
  规范化周目数,
  去重,
} from './状态与结算.js';

// 保险柜键名前缀（线上常量 Qt），全产品只有这一个存档键
const 存档键前缀 = 'interactive-cinema-save';

// () → 当前作品的保险柜格子名。ACTIVE_GAME_ID 是 live binding，换片后自动指向新格子。
export function 存档键() {
  return `${存档键前缀}:${ACTIVE_GAME_ID}:v2`;
}

// (state) → 全量写入 localStorage → 成功与否。隐私模式/容量耗尽时不能让播放器崩溃。
// 写入前强制盖当前 gameId 并刷新时间戳（与线上一致，设置项也随整本账一起存）。
export function 保存存档(state) {
  try {
    localStorage.setItem(
      存档键(),
      JSON.stringify(刷新存档时间({ ...state, gameId: ACTIVE_GAME_ID, storyId: STORY_ID })),
    );
    return true;
  } catch {
    return false;
  }
}

// () → 从保险柜取出账本：没有 → null；解析或消毒路上出任何岔子 → null。
// 为什么吞错误：读档失败就当没存过，回初始状态重新玩，绝不能让播放器崩掉。
export function 读取存档() {
  try {
    const 文本 = localStorage.getItem(存档键());
    if (!文本) return null;
    const 原始 = JSON.parse(文本);
    return 消毒存档(原始);
  } catch {
    return null;
  }
}

// () → 删掉当前作品的存档（别的作品的格子不动）
export function 删除存档() {
  try {
    localStorage.removeItem(存档键());
    return true;
  } catch {
    return false;
  }
}

// (state) → 一串可以复制走的存档码。
// 编码链：JSON.stringify → encodeURIComponent（汉字变 %E5%… ）→ unescape（还原成
// 单字节串）→ btoa（base64）。为什么这么绕：btoa 只吃 Latin-1，中文直接喂会炸，
// 先过 URI 转义把每个 UTF-8 字节拆成 btoa 咽得下的单字节。
export function 导出存档码(state) {
  const 安全归属状态 = 刷新存档时间({ ...state, gameId: ACTIVE_GAME_ID, storyId: STORY_ID });
  return btoa(unescape(encodeURIComponent(JSON.stringify(安全归属状态))));
}

// (存档码) → 按导出的逆序拆包（atob → escape → decodeURIComponent → JSON.parse），
// 再整本消毒 → 干净的 GameState；任何一步失败 → null。
export function 导入存档码(存档码) {
  try {
    const 文本 = decodeURIComponent(escape(atob(存档码.trim())));
    const 原始 = JSON.parse(文本);
    if (!存档归属当前作品(原始)) return null;
    return 消毒存档(原始);
  } catch {
    return null;
  }
}

// (来路不明的对象) → 逐字段消毒后的 GameState。规则在原线上 xt 基础上扩展了 cast/storyId：
//   currentNodeId 必须真实存在，否则回起始节点；lineIndex 钳到该节点台词范围内；
//   relationships 当前剧情及合法扩展角色三维度逐项回填并钳 0-100；globals 先生成默认表再用合法数字覆盖；
//   flags/memories/seenHotspots/persistentMemories 只留字符串并去重；
//   visitedNodes 还要求节点真实存在；route 只认 null/team/solo/当前剧情角色；
//   loopCount 非法回 1；unlockedEndings 过滤不存在的节点；decisionLog 逐条修补且
//   最多留 120 条；dialogueLog 只保留当前剧情真实台词且最多 240 条；
//   settings 深合并回默认形状；gameId/storyId 强制改成当前作品。
// 为什么先铺 ...初始 再铺 ...原始：未知的多余字段随存档保留（线上就是这么做的）。
export function 消毒存档(原始) {
  if (!原始 || typeof 原始 !== 'object' || Array.isArray(原始)) 原始 = {};
  const 初始 = 创建初始状态();
  const 落点 =
    typeof 原始.currentNodeId === 'string' && storyNodes[原始.currentNodeId]
      ? 原始.currentNodeId
      : 初始.currentNodeId;
  return {
    ...初始,
    ...原始,
    currentNodeId: 落点,
    lineIndex: 钳制行索引(Number(原始.lineIndex ?? 0), 取节点(落点).lines.length),
    relationships: 消毒关系表(原始.relationships),
    globals: 消毒全局表(原始.globals),
    flags: 去重((原始.flags ?? []).filter((条) => typeof 条 === 'string')),
    memories: 去重((原始.memories ?? []).filter((条) => typeof 条 === 'string')),
    visitedNodes: 去重(
      (原始.visitedNodes ?? [落点]).filter((条) => typeof 条 === 'string' && !!storyNodes[条]),
    ),
    seenHotspots: 去重((原始.seenHotspots ?? []).filter((条) => typeof 条 === 'string')),
    route: 消毒路线(原始.route),
    loopCount: 规范化周目数(原始.loopCount, 1),
    unlockedEndings: 消毒结局列表(原始.unlockedEndings),
    persistentMemories: 去重(
      (原始.persistentMemories ?? []).filter((条) => typeof 条 === 'string'),
    ),
    decisionLog: 消毒决策日志(原始.decisionLog),
    dialogueLog: 规范化对白日志(原始.dialogueLog),
    settings: 规范化设置(原始.settings),
    gameId: ACTIVE_GAME_ID,
    storyId: STORY_ID,
    lastSavedAt: Number(原始.lastSavedAt ?? Date.now()),
  };
}

// 新存档码使用稳定 storyId；旧码只有 gameId 时仅接受当前正式 slug。
// 没有 storyId 的 "bundled" 码在更换内置默认后无法判断原属哪部作品，必须拒绝，
// 避免把《第十五封愿望》等旧默认的记忆与决策错误消毒进《第九席》。
function 存档归属当前作品(原始) {
  if (!原始 || typeof 原始 !== 'object') return true;
  if (typeof 原始.storyId === 'string') return 原始.storyId === STORY_ID;
  if (typeof 原始.gameId !== 'string') return true;
  return (
    原始.gameId === ACTIVE_GAME_ID ||
    原始.gameId === STORY_ID
  );
}

// (旧settings或undefined) → 全新一局：只带设置，其余全部归零 → 新 GameState
export function 清空重开(旧设置) {
  return {
    ...创建初始状态(),
    settings: 旧设置 ? 规范化设置(旧设置) : 创建默认设置(),
    lastSavedAt: Date.now(),
  };
}

// (通常处在结局节点的 state) → 下一周目的开局账本：
//   1. 若当前结局有标题，把标题也当作一条记忆
//   2. 跨周目记忆 = 去重(老跨周目记忆 + 本周目记忆 + 结局标题)，同时注入新周目 memories
//   3. 站在结局节点时顺手把它并入已解锁结局
//   4. 周目 +1，设置保留（规范化），其余全部重置
export function 进入下一轮(state) {
  const 节点 = 取当前节点(state);
  const 结局标题 = 节点.ending?.title ? [节点.ending.title] : [];
  const 合并记忆 = 去重([...state.persistentMemories, ...state.memories, ...结局标题]);
  return {
    ...创建初始状态(),
    memories: 合并记忆,
    persistentMemories: 合并记忆,
    unlockedEndings: 节点.ending
      ? 去重([...state.unlockedEndings, state.currentNodeId])
      : state.unlockedEndings,
    loopCount: state.loopCount + 1,
    settings: 规范化设置(state.settings),
    lastSavedAt: Date.now(),
  };
}

// ---- 私有消毒小工具 ----

// 决策日志：非数组 → []；逐条修补缺失字段（缺 id 就拼 nodeId-choiceId，标题缺省
// "Unknown Scene"、label 缺省 "Unknown choice"，fateType 只认三种），最多留末尾 120 条
function 消毒决策日志(原始) {
  return Array.isArray(原始)
    ? 原始
        .filter((条) => !!条 && typeof 条 === 'object')
        .map((条) => ({
          id: typeof 条.id === 'string' ? 条.id : `${条.nodeId ?? 'node'}-${条.choiceId ?? 'choice'}`,
          loop: 规范化周目数(条.loop, 1),
          nodeId: typeof 条.nodeId === 'string' ? 条.nodeId : START_NODE_ID,
          nodeTitle: typeof 条.nodeTitle === 'string' ? 条.nodeTitle : 'Unknown Scene',
          choiceId: typeof 条.choiceId === 'string' ? 条.choiceId : 'choice',
          label: typeof 条.label === 'string' ? 条.label : 'Unknown choice',
          next: typeof 条.next === 'string' ? 条.next : START_NODE_ID,
          fateType:
            条.fateType === 'river' || 条.fateType === 'web' || 条.fateType === 'wheel'
              ? 条.fateType
              : undefined,
          consequence: typeof 条.consequence === 'string' ? 条.consequence : undefined,
          effect: 条.effect && typeof 条.effect === 'object' ? 条.effect : undefined,
          createdAt: Number(条.createdAt ?? Date.now()),
        }))
        .slice(-120)
    : [];
}

// 已解锁结局：只留"确实存在于当前剧情"的节点 id 并去重
function 消毒结局列表(原始) {
  return Array.isArray(原始)
    ? 去重(原始.filter((条) => typeof 条 === 'string' && !!storyNodes[条]))
    : [];
}

// 关系表：内置角色、当前剧情角色，以及存档里合法的扩展角色都保留；
// 三个标准维度逐项回填并钳 0-100，旧存档因此能平滑补出新剧情人物。
function 消毒关系表(原始) {
  const 存档角色 =
    原始 && typeof 原始 === 'object' && !Array.isArray(原始)
      ? Object.keys(原始).filter(是合法关系角色)
      : [];
  return 去重([...当前关系角色顺序(), ...存档角色]).reduce((表, 角色) => {
    const 初值 = 角色关系初始值(角色);
    表[角色] = {
      spark: 钳制关系值(Number(原始?.[角色]?.spark ?? 初值.spark)),
      trust: 钳制关系值(Number(原始?.[角色]?.trust ?? 初值.trust)),
      boundary: 钳制关系值(Number(原始?.[角色]?.boundary ?? 初值.boundary)),
    };
    return 表;
  }, {});
}

// 全局数值表：先按当前剧情定义生成默认表，再用存档里"确实是有限数字"的值按定义钳制后覆盖
function 消毒全局表(原始) {
  const 表 = 初始全局数值表();
  for (const [键, 值] of Object.entries(原始 ?? {})) {
    const 数 = Number(值);
    if (Number.isFinite(数)) 表[键] = 按定义钳制数值(数, getScoreDefinition(键));
  }
  return 表;
}

// 路线：只认 null / team / solo / 当前 story 声明或实际使用的关系角色 id。
function 消毒路线(原始) {
  const 当前路线角色 = new Set([...getStoryCharacterIds(), ...当前关系角色顺序()]);
  return 原始 === null || 原始 === 'team' || 原始 === 'solo' || 当前路线角色.has(原始)
    ? 原始
    : null;
}
