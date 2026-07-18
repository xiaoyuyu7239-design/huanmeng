// 平台级剧情体检：对 showcase 在架的每部作品做结构健康检查。
// 覆盖历次人工复审反复出现的病灶——死锁门槛、不可达节点/结局、
// 未注册说话人、黑话回流、恋爱承诺违约（romanceable=false 却带心动数值）。
// 可达性判定采用乐观固定点：flags/memories 单调累积，数值按“逐节点最优增益求和”上界估计；
// 它可能放过极端组合锁，但能拦住所有硬锁——硬锁正是历史上真实出过的问题。
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const 根 = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const 精选 = JSON.parse(await readFile(resolve(根, '公共资源/showcase.json'), 'utf8'));

const 黑话 = ['玩家', '点击', '归档结局', 'Boss', '路线开启', '结局开启', '隐藏Boss', '第一印象已被记录', '多周目总收束', '创作分支'];
const 玩家可见字段 = ['title', 'synopsis', 'consequence', 'lockedHint', 'label', 'description', 'text', 'subtitle'];

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

function 数值上界(节点表, 取增益) {
  const 上界 = {};
  for (const 节点 of Object.values(节点表)) {
    const 最佳 = {};
    for (const 项 of [...(节点.choices ?? []), ...(节点.hotspots ?? [])]) {
      for (const [键, 值] of 取增益(项)) {
        if (typeof 值 === 'number' && 值 > (最佳[键] ?? 0)) 最佳[键] = 值;
      }
    }
    for (const [键, 值] of Object.entries(最佳)) 上界[键] = (上界[键] ?? 0) + 值;
  }
  return 上界;
}

function 体检(slug, 剧情) {
  const 问题 = [];
  const 节点表 = 剧情.nodes ?? {};
  const 起点 = 剧情.startNodeId;
  assert.ok(节点表[起点], `${slug}: startNodeId 不存在`);

  // ---- 数值与关系上界 ----
  const 全局上界 = 数值上界(节点表, (项) => Object.entries(项.effect?.globals ?? {}));
  const 初值 = {};
  for (const 角色 of 剧情.cast?.characters ?? []) {
    if (角色.relationship?.enabled) 初值[角色.id] = { ...(角色.relationship.initial ?? {}) };
  }
  const 关系上界 = {};
  for (const [id, 维] of Object.entries(初值)) 关系上界[id] = { ...维 };
  for (const 节点 of Object.values(节点表)) {
    const 最佳 = {};
    for (const 选 of 节点.choices ?? []) {
      for (const [id, 维] of Object.entries(选.effect?.relationships ?? {})) {
        for (const [m, v] of Object.entries(维)) {
          if (typeof v === 'number' && v > (最佳[`${id}.${m}`] ?? 0)) 最佳[`${id}.${m}`] = v;
        }
      }
    }
    for (const [键, 值] of Object.entries(最佳)) {
      const [id, m] = 键.split('.');
      if (关系上界[id]) 关系上界[id][m] = (关系上界[id][m] ?? 0) + 值;
    }
  }

  // ---- 乐观固定点可达性 ----
  const 可达 = new Set();
  const 旗标 = new Set();
  const 记忆 = new Set();
  const 满足 = (条件) => {
    if (!条件) return true;
    for (const f of 条件.flags ?? []) if (!旗标.has(f)) return false;
    for (const f of 条件.missingFlags ?? []) void f; // 乐观放行
    for (const m of 条件.memories ?? []) if (!记忆.has(m)) return false;
    for (const g of 条件.minGlobal ?? []) if ((全局上界[g.key] ?? 0) < g.value) return false;
    for (const r of 条件.minRelationship ?? []) {
      if ((关系上界[r.character]?.[r.metric] ?? 0) < r.value) return false;
    }
    return true;
  };
  let 变化 = true;
  可达.add(起点);
  while (变化) {
    变化 = false;
    for (const nid of [...可达]) {
      const 节点 = 节点表[nid];
      for (const 热点 of 节点.hotspots ?? []) {
        for (const f of 热点.effect?.flags ?? []) if (!旗标.has(f)) { 旗标.add(f); 变化 = true; }
        for (const m of 热点.effect?.memories ?? []) if (!记忆.has(m)) { 记忆.add(m); 变化 = true; }
      }
      for (const 选 of 节点.choices ?? []) {
        if (!满足(选.condition)) continue;
        for (const f of 选.effect?.flags ?? []) if (!旗标.has(f)) { 旗标.add(f); 变化 = true; }
        for (const m of 选.effect?.memories ?? []) if (!记忆.has(m)) { 记忆.add(m); 变化 = true; }
        if (选.next && 节点表[选.next] && !可达.has(选.next)) { 可达.add(选.next); 变化 = true; }
      }
    }
  }
  for (const nid of Object.keys(节点表)) {
    if (!可达.has(nid)) 问题.push(`节点不可达: ${nid}`);
  }
  for (const [nid, 节点] of Object.entries(节点表)) {
    if (节点.ending && !可达.has(nid)) 问题.push(`结局不可达: ${nid}`);
    for (const 选 of 节点.choices ?? []) {
      if (可达.has(nid) && !满足(选.condition)) 问题.push(`选择永久锁死: ${nid}/${选.id ?? 选.label}`);
      if (选.next && !节点表[选.next]) 问题.push(`跳转悬空: ${nid} → ${选.next}`);
    }
  }

  // ---- 死锁 flag（引用但无人发放）----
  const 引用 = new Set();
  for (const 节点 of Object.values(节点表)) {
    for (const 选 of 节点.choices ?? []) for (const f of 选.condition?.flags ?? []) 引用.add(f);
  }
  for (const f of 引用) if (!旗标.has(f)) 问题.push(`死锁 flag: ${f}`);

  // ---- 说话人注册 ----
  if (剧情.cast) {
    const 合法 = new Set(['you', 'narrator', 'system', ...(剧情.cast.characters ?? []).map((c) => c.id)]);
    for (const [nid, 节点] of Object.entries(节点表)) {
      for (const 行 of 节点.lines ?? []) {
        if (typeof 行.speaker === 'string' && /^[a-z0-9_-]+$/iu.test(行.speaker) && !合法.has(行.speaker)) {
          问题.push(`未注册说话人: ${nid}/${行.speaker}`);
        }
      }
    }
  }

  // ---- 黑话回流 ----
  for (const [nid, 节点] of Object.entries(节点表)) {
    for (const 文 of 收集玩家可见文本(节点)) {
      for (const 词 of 黑话) if (文.includes(词)) 问题.push(`黑话「${词}」: ${nid}`);
    }
  }

  // ---- 恋爱承诺一致性 ----
  for (const 角色 of 剧情.cast?.characters ?? []) {
    if (角色.romanceable === false && (角色.relationship?.initial?.spark ?? 0) > 0) {
      问题.push(`非攻略角色带心动初值: ${角色.id}`);
    }
    if (角色.romanceable === false) {
      for (const [nid, 节点] of Object.entries(节点表)) {
        for (const 选 of 节点.choices ?? []) {
          if ((选.effect?.relationships?.[角色.id]?.spark ?? 0) > 0) {
            问题.push(`非攻略角色获得心动效果: ${角色.id} @ ${nid}`);
          }
        }
      }
    }
  }
  return 问题;
}

let 总问题 = 0;
for (const 条目 of 精选.featured) {
  const 剧情 = JSON.parse(
    await readFile(resolve(根, `公共资源/games/${条目.slug}/story.json`), 'utf8'),
  );
  const 问题 = 体检(条目.slug, 剧情);
  if (问题.length) {
    总问题 += 问题.length;
    console.error(`  ✗ ${条目.slug}《${条目.title}》: ${问题.length} 项`);
    for (const p of 问题) console.error(`     - ${p}`);
  } else {
    console.log(`  ✓ ${条目.slug}《${条目.title}》: 结构健康`);
  }
}
assert.equal(总问题, 0, `剧情体检发现 ${总问题} 项结构问题`);
console.log('剧情体检：在架作品全部通过');
