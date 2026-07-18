// 平台级剧情体检（v2·真实引擎穷举）：对 showcase 在架的每部作品做结构健康检查。
// v1 的可达性是乐观近似（互斥分支上的组合门槛会被误判可达）；v2 改为直接驱动
// 播放器剧情引擎做状态空间遍历——状态按「条件相关维度」投影去重，既精确又有界：
//   · 节点/结局可达性、选择是否存在任何可用状态（永久锁死检测）——引擎语义级精确
//   · 每次转移都真实执行 应用效果，顺带验证效果数据在引擎中不抛错
// 静态检查保留：死锁 flag、未注册说话人、黑话回流、恋爱承诺一致性。
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      const 文本 = readFileSync(fileURLToPath(url), 'utf8');
      return { format: 'module', source: `export default ${文本};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const 假存储仓 = new Map();
globalThis.window = {
  localStorage: {
    getItem: (键) => (假存储仓.has(键) ? 假存储仓.get(键) : null),
    setItem: (键, 值) => 假存储仓.set(键, String(值)),
    removeItem: (键) => 假存储仓.delete(键),
    clear: () => 假存储仓.clear(),
  },
};

const 根 = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const 加载 = await import(resolve(根, '源码/播放器/剧情引擎/剧情加载.js'));
const 引擎 = await import(resolve(根, '源码/播放器/剧情引擎/状态与结算.js'));
const 精选 = JSON.parse(await readFile(resolve(根, '公共资源/showcase.json'), 'utf8'));

const 黑话 = ['玩家', '点击', '归档结局', 'Boss', '路线开启', '结局开启', '隐藏Boss', '第一印象已被记录', '多周目总收束', '创作分支'];
const 玩家可见字段 = ['title', 'synopsis', 'consequence', 'lockedHint', 'label', 'description', 'text', 'subtitle'];
const 状态上限 = 200000;

function 收集玩家可见文本(节点) {
  const 池 = [];
  const 推 = (对象) => {
    for (const 键 of 玩家可见字段) {
      if (typeof 对象?.[键] === 'string') 池.push(对象[键]);
    }
  };
  推(节点);
  推(节点.ending);
  for (const 行 of 节点.lines ?? []) 推(行);
  for (const 项 of [...(节点.choices ?? []), ...(节点.hotspots ?? [])]) {
    推(项);
    for (const 记 of 项.effect?.memories ?? []) 池.push(记);
  }
  return 池;
}

function 收集条件维度(节点表) {
  const flags = new Set();
  const memories = new Set();
  const globalsKeys = new Set();
  const 关系维 = new Set();
  let 用到route = false;
  for (const 节点 of Object.values(节点表)) {
    for (const 项 of [...(节点.choices ?? []), ...(节点.hotspots ?? [])]) {
      const c = 项.condition;
      if (!c) continue;
      for (const f of c.flags ?? []) flags.add(f);
      for (const f of c.missingFlags ?? []) flags.add(f);
      for (const m of c.memories ?? []) memories.add(m);
      for (const g of [...(c.minGlobal ?? []), ...(c.maxGlobal ?? [])]) globalsKeys.add(g.key);
      for (const r of c.minRelationship ?? []) 关系维.add(`${r.character}.${r.metric}`);
      if (c.route !== undefined) 用到route = true;
    }
  }
  return { flags, memories, globalsKeys, 关系维, 用到route };
}

function 投影键(nodeId, state, 维度) {
  const f = (state.flags ?? []).filter((x) => 维度.flags.has(x)).sort().join(',');
  const m = [...new Set([...(state.memories ?? []), ...(state.persistentMemories ?? [])])]
    .filter((x) => 维度.memories.has(x)).sort().join(',');
  const g = [...维度.globalsKeys].map((k) => `${k}=${state.globals?.[k] ?? 0}`).join(',');
  const r = [...维度.关系维].map((k) => {
    const [id, metric] = k.split('.');
    return `${k}=${state.relationships?.[id]?.[metric] ?? 0}`;
  }).join(',');
  const rt = 维度.用到route ? `|rt=${state.route ?? ''}` : '';
  return `${nodeId}|${f}|${m}|${g}|${r}${rt}`;
}

function 乐观遍历(节点表) {
  // 降级模式：flags/memories 单调并集 + 数值最优增益上界（可能放过组合锁，但拦得住硬锁）。
  const 旗标 = new Set();
  const 记忆集 = new Set();
  const 全局上界 = {};
  const 关系上界 = {};
  for (const 节点 of Object.values(节点表)) {
    const 最好 = {};
    for (const 项 of [...(节点.choices ?? []), ...(节点.hotspots ?? [])]) {
      for (const [k, v] of Object.entries(项.effect?.globals ?? {})) {
        if (typeof v === 'number' && v > (最好[`g:${k}`] ?? 0)) 最好[`g:${k}`] = v;
      }
      for (const [id, 维] of Object.entries(项.effect?.relationships ?? {})) {
        for (const [m, v] of Object.entries(维 ?? {})) {
          if (typeof v === 'number' && v > (最好[`r:${id}.${m}`] ?? 0)) 最好[`r:${id}.${m}`] = v;
        }
      }
    }
    for (const [k, v] of Object.entries(最好)) {
      if (k.startsWith('g:')) 全局上界[k.slice(2)] = (全局上界[k.slice(2)] ?? 0) + v;
      else 关系上界[k.slice(2)] = (关系上界[k.slice(2)] ?? 0) + v;
    }
  }
  const 起始 = 引擎.创建初始状态();
  for (const [id, 维] of Object.entries(起始.relationships ?? {})) {
    for (const [m, v] of Object.entries(维 ?? {})) {
      关系上界[`${id}.${m}`] = (关系上界[`${id}.${m}`] ?? 0) + (typeof v === 'number' ? v : 0);
    }
  }
  const 满足 = (c) => {
    if (!c) return true;
    for (const f of c.flags ?? []) if (!旗标.has(f)) return false;
    for (const m of c.memories ?? []) if (!记忆集.has(m)) return false;
    for (const g of c.minGlobal ?? []) if ((全局上界[g.key] ?? 0) < g.value) return false;
    for (const r of c.minRelationship ?? []) if ((关系上界[`${r.character}.${r.metric}`] ?? 0) < r.value) return false;
    return true; // missingFlags/route/maxGlobal 乐观放行
  };
  const 到过节点 = new Set([加载.storyStartNodeId ?? Object.keys(节点表)[0]]);
  const 可用过 = new Set();
  let 变化 = true;
  while (变化) {
    变化 = false;
    for (const nid of [...到过节点]) {
      const 节点 = 节点表[nid];
      if (!节点) continue;
      for (const 热点 of 节点.hotspots ?? []) {
        for (const f of 热点.effect?.flags ?? []) if (!旗标.has(f)) { 旗标.add(f); 变化 = true; }
        for (const m of 热点.effect?.memories ?? []) if (!记忆集.has(m)) { 记忆集.add(m); 变化 = true; }
      }
      for (const 选 of 节点.choices ?? []) {
        if (!满足(选.condition)) continue;
        可用过.add(`${nid}/${选.id ?? 选.label}`);
        for (const f of 选.effect?.flags ?? []) if (!旗标.has(f)) { 旗标.add(f); 变化 = true; }
        for (const m of 选.effect?.memories ?? []) if (!记忆集.has(m)) { 记忆集.add(m); 变化 = true; }
        if (选.next && 节点表[选.next] && !到过节点.has(选.next)) { 到过节点.add(选.next); 变化 = true; }
      }
    }
  }
  return { 节点表, 到过节点, 可用过, 状态数: 0, 模式: '乐观近似' };
}

function 引擎穷举(slug) {
  const 节点表 = 加载.storyNodes;
  const 起点 = 加载.storyStartNodeId ?? Object.keys(节点表)[0];
  const 维度 = 收集条件维度(节点表);
  const 起始 = 引擎.创建初始状态();
  const 已见 = new Set();
  const 到过节点 = new Set();
  const 可用过 = new Set();
  const 队列 = [[起点, 起始]];
  已见.add(投影键(起点, 起始, 维度));
  while (队列.length) {
    if (已见.size > 状态上限) throw new Error(`${slug}: 状态空间超过上限，检查投影维度`);
    const [nodeId, state] = 队列.pop();
    到过节点.add(nodeId);
    const 节点 = 节点表[nodeId];
    if (!节点) continue;
    // 热点：作为可选自环转移（用其首个 flag 作“已调查”守卫，避免数值重复膨胀）
    for (const 热点 of 节点.hotspots ?? []) {
      const 守卫 = 热点.effect?.flags?.[0];
      if (守卫 && (state.flags ?? []).includes(守卫)) continue;
      if (热点.condition && !引擎.条件满足(state, 热点.condition)) continue;
      const 新态 = 引擎.应用效果(state, 热点.effect ?? {});
      const 键 = 投影键(nodeId, 新态, 维度);
      if (!已见.has(键)) { 已见.add(键); 队列.push([nodeId, 新态]); }
    }
    for (const 选 of 节点.choices ?? []) {
      if (!引擎.选择可用(state, 选)) continue;
      可用过.add(`${nodeId}/${选.id ?? 选.label}`);
      if (!选.next || !节点表[选.next]) continue;
      const 新态 = 引擎.应用效果(state, 选.effect ?? {});
      const 键 = 投影键(选.next, 新态, 维度);
      if (!已见.has(键)) { 已见.add(键); 队列.push([选.next, 新态]); }
    }
  }
  return { 节点表, 到过节点, 可用过, 状态数: 已见.size, 模式: '引擎精确' };
}

let 总问题 = 0;
for (const 条目 of 精选.featured) {
  const 原始 = JSON.parse(await readFile(resolve(根, `公共资源/games/${条目.slug}/story.json`), 'utf8'));
  加载.setActiveStory(原始, 条目.slug);
  const 问题 = [];
  let 遍历;
  try {
    遍历 = 引擎穷举(条目.slug);
  } catch (错) {
    if (!String(错?.message).includes('状态空间超过上限')) throw 错;
    遍历 = 乐观遍历(加载.storyNodes);
  }
  const { 节点表, 到过节点, 可用过, 状态数, 模式 } = 遍历;

  for (const [nid, 节点] of Object.entries(节点表)) {
    if (!到过节点.has(nid)) 问题.push(`节点不可达: ${nid}`);
    if (节点.ending && !到过节点.has(nid)) 问题.push(`结局不可达: ${nid}`);
    for (const 选 of 节点.choices ?? []) {
      if (到过节点.has(nid) && !可用过.has(`${nid}/${选.id ?? 选.label}`)) {
        问题.push(`选择在任何可达状态下都不可用: ${nid}/${选.id ?? 选.label}`);
      }
      if (选.next && !节点表[选.next]) 问题.push(`跳转悬空: ${nid} → ${选.next}`);
    }
  }

  // 静态检查基于原始 JSON（说话人/黑话/恋爱承诺）
  const 原节点表 = 原始.nodes ?? {};
  if (原始.cast) {
    const 合法 = new Set(['you', 'narrator', 'system', ...(原始.cast.characters ?? []).map((c) => c.id)]);
    for (const [nid, 节点] of Object.entries(原节点表)) {
      for (const 行 of 节点.lines ?? []) {
        if (typeof 行.speaker === 'string' && /^[a-z0-9_-]+$/iu.test(行.speaker) && !合法.has(行.speaker)) {
          问题.push(`未注册说话人: ${nid}/${行.speaker}`);
        }
      }
    }
  }
  for (const [nid, 节点] of Object.entries(原节点表)) {
    for (const 文 of 收集玩家可见文本(节点)) {
      for (const 词 of 黑话) if (文.includes(词)) 问题.push(`黑话「${词}」: ${nid}`);
    }
  }
  for (const 角色 of 原始.cast?.characters ?? []) {
    if (角色.romanceable === false && (角色.relationship?.initial?.spark ?? 0) > 0) {
      问题.push(`非攻略角色带心动初值: ${角色.id}`);
    }
    if (角色.romanceable === false) {
      for (const [nid, 节点] of Object.entries(原节点表)) {
        for (const 选 of 节点.choices ?? []) {
          if ((选.effect?.relationships?.[角色.id]?.spark ?? 0) > 0) {
            问题.push(`非攻略角色获得心动效果: ${角色.id} @ ${nid}`);
          }
        }
      }
    }
  }

  if (问题.length) {
    总问题 += 问题.length;
    console.error(`  ✗ ${条目.slug}《${条目.title}》: ${问题.length} 项（${模式}）`);
    for (const p of 问题) console.error(`     - ${p}`);
  } else {
    console.log(`  ✓ ${条目.slug}《${条目.title}》: 结构健康（${模式}${状态数 ? `·${状态数}态` : ''}）`);
  }
}
assert.equal(总问题, 0, `剧情体检发现 ${总问题} 项结构问题`);
console.log('剧情体检：在架作品全部通过（真实引擎语义）');
