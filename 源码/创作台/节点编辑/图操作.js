// 这个文件是剧情图的"施工队"：新增节点像在小区里盖新楼，插入节点像在两站地铁之间
// 加一站(要把原来的轨道接到新站再接回去)，拖拽排序像重新排一列火车车厢(挂钩要跟着重接)。
// 全部是纯函数：进来一份 story，出去一份改好的 story，不碰 React 也不碰 localStorage。
// 每个默认文案("未命名节点"、"新增节点入口。"等)都照抄线上，重连逻辑靠这些暗号识别系统生成的选择。

// ---- 内部小工具 ----

// 输入节点表 → 找一个不撞车的新节点 id → 吐出形如 "s07-new-node"
// 规则：数一数有多少 s 开头带数字的节点，序号+1，撞了就继续+1。
function 生成新节点id(节点表) {
  let 序号 = Object.keys(节点表).filter((id) => /^s\d+/.test(id)).length + 1;
  let 候选 = '';
  do {
    候选 = `s${String(序号).padStart(2, '0')}-new-node`;
    序号 += 1;
  } while (节点表[候选]);
  return 候选;
}

// 输入(节点表, 排除id) → 挑一个连接目标：优先别人家的结局节点，其次任何别的节点 → 吐出 id 或 ""
function 挑连接目标(节点表, 排除id) {
  const 列表 = Object.values(节点表);
  return (
    列表.find((节点) => 节点.id !== 排除id && !!节点.ending)?.id ??
    列表.find((节点) => 节点.id !== 排除id)?.id ??
    ''
  );
}

// 输入(新id, {chapter, targetNode}) → 造一个新节点(文案照抄线上模板) → 吐出节点对象
function 造新节点(新id, { chapter, targetNode }) {
  return {
    id: 新id,
    chapter: chapter || '新节点',
    title: '未命名节点',
    location: '未命名场景',
    synopsis: '玩家在这里面对新的选择。',
    // 新节点还没有真实资产。保持空值，让就绪统计和发布校验如实提示缺图；
    // 不能预填一个并不存在的 URL，否则播放器虽会回退占位图，创作台却会误报“图片完整”。
    panorama: '',
    lines: [{ speaker: 'narrator', text: '新的场景等待补写。' }],
    choices: targetNode ? [造原路线出口(targetNode)] : [],
  };
}

// 输入目标节点 → 造一条"continue-"型出口选择(插入节点后走回原路线用) → 吐出选择对象
function 造原路线出口(目标节点) {
  return {
    id: `continue-${目标节点.id}`,
    label: `继续前往「${目标节点.title || 目标节点.id}」`,
    caption: '插入节点后的原路线出口。',
    next: 目标节点.id,
    fateType: 'river',
    consequence: `你从新增场景回到「${目标节点.title || 目标节点.id}」路线。`,
    effect: { globals: { integrity: 1 } },
  };
}

// 输入(宿主节点, 新节点) → 造一条"route-"型入口选择(让老节点能走进新节点) → 吐出选择对象
function 造入口选择(宿主节点, 新节点) {
  return {
    id: 不撞车的选择id(宿主节点, `route-${新节点.id}`),
    label: `前往「${新节点.title || 新节点.id}」`,
    caption: '新增节点入口。',
    next: 新节点.id,
    fateType: 'river',
    consequence: `你把路线推进到「${新节点.title || 新节点.id}」。`,
    effect: { globals: { integrity: 1 } },
  };
}

// 输入(节点, 想要的id) → 撞车就在后面加 -2、-3…实在不行拿时间戳 → 吐出可用 id
function 不撞车的选择id(节点, 想要的id) {
  const 已有 = new Set((节点.choices ?? []).map((选择) => 选择.id));
  if (!已有.has(想要的id)) return 想要的id;
  for (let n = 2; n < 100; n += 1) {
    const 候选 = `${想要的id}-${n}`;
    if (!已有.has(候选)) return 候选;
  }
  return `${想要的id}-${Date.now().toString(36)}`;
}

// 是不是系统生成的"入口选择"(id 以 route- 开头，或 caption 是那句暗号)
function 是入口选择(选择) {
  return (typeof 选择?.id === 'string' && 选择.id.startsWith('route-')) || 选择?.caption === '新增节点入口。';
}

// 是不是系统生成的"原路线出口"(id 以 continue- 开头，或 caption 是那句暗号)
function 是原路线出口(选择) {
  return (typeof 选择?.id === 'string' && 选择.id.startsWith('continue-')) || 选择?.caption === '插入节点后的原路线出口。';
}

// 选择数还没到 4 条上限？(线上 MVP 约定每节点最多 4 条选择)
function 还能加选择(节点) {
  return (节点.choices?.length ?? 0) < 4;
}

// 输入(旧节点表, 新的键顺序, 替换表) → 按新顺序重排一份节点表 → 吐出新表
// 为什么绕：JS 对象的键序就是插入序，创作台的"节点顺序"就存在键序里，所以重排=按序重建对象。
function 按顺序重建(旧表, 键顺序, 替换表 = {}) {
  const 新表 = {};
  for (const 键 of 键顺序) {
    const 节点 = 替换表[键] ?? 旧表[键];
    if (节点) 新表[键] = 节点;
  }
  return 新表;
}

// ---- 对外的四个施工动作 ----

// 输入(story, 当前节点id) → 在小区尽头盖新楼，并从当前节点修一条进楼的路 → 吐出 {story, nodeId}
export function 新增节点(story, 当前节点id) {
  const 新id = 生成新节点id(story.nodes);
  const 当前节点 = 当前节点id ? story.nodes[当前节点id] : null;
  const 目标id = 挑连接目标(story.nodes, 当前节点id);
  const 新节点 = 造新节点(新id, {
    chapter: 当前节点?.chapter,
    targetNode: 目标id ? story.nodes[目标id] : null,
  });
  const 替换表 = {};
  // 当前节点不是结局、选择还没满 4 条时，给它加一条通往新节点的入口
  if (当前节点 && !当前节点.ending && 还能加选择(当前节点)) {
    替换表[当前节点.id] = {
      ...当前节点,
      choices: [...(当前节点.choices ?? []), 造入口选择(当前节点, 新节点)],
    };
  }
  const 新表 = 按顺序重建(story.nodes, [...Object.keys(story.nodes), 新id], { ...替换表, [新id]: 新节点 });
  return {
    story: { ...story, startNodeId: story.startNodeId || 新id, nodes: 新表 },
    nodeId: 新id,
  };
}

// 输入(story, 当前节点id) → 在当前节点和它的下一站之间加一站 → 吐出 {story, nodeId}
// 当前节点是结局(没有"下一站")时退化成普通新增。
export function 插入节点(story, 当前节点id) {
  const 当前节点 = story.nodes[当前节点id];
  if (!当前节点 || 当前节点.ending) return 新增节点(story, 当前节点id);
  const 新id = 生成新节点id(story.nodes);
  const 第一条选择 = 当前节点.choices?.[0] ?? null;
  // 原来的下一站：第一条选择的去向；没有就挑一个兜底目标
  const 下一站id =
    第一条选择?.next && story.nodes[第一条选择.next] ? 第一条选择.next : 挑连接目标(story.nodes, 当前节点id);
  const 新节点 = 造新节点(新id, {
    chapter: 当前节点.chapter,
    targetNode: 下一站id ? story.nodes[下一站id] : null,
  });
  // 当前节点的第一条选择改道去新站；一条选择都没有就补一条入口
  const 改道后选择 =
    第一条选择 && 当前节点.choices
      ? 当前节点.choices.map((选择, 序) => (序 === 0 ? { ...选择, next: 新id } : 选择))
      : [...(当前节点.choices ?? []), 造入口选择(当前节点, 新节点)];
  const 键顺序 = Object.keys(story.nodes);
  const 当前位置 = 键顺序.indexOf(当前节点id);
  const 新顺序 = [...键顺序.slice(0, 当前位置 + 1), 新id, ...键顺序.slice(当前位置 + 1)];
  const 新表 = 按顺序重建(story.nodes, 新顺序, {
    [当前节点id]: { ...当前节点, choices: 改道后选择 },
    [新id]: 新节点,
  });
  return { story: { ...story, nodes: 新表 }, nodeId: 新id };
}

// 输入(story, 节点id, "up"|"down") → 上移/下移一格(等价拖到相邻位置) → 吐出新 story
export function 移动节点(story, 节点id, 方向) {
  const 当前位置 = Object.keys(story.nodes).indexOf(节点id);
  const 目标位置 = 方向 === 'up' ? 当前位置 - 1 : 当前位置 + 1;
  return 拖拽重排(story, 节点id, 目标位置);
}

// 输入(story, 被拖节点id, 目标下标) → 只调整创作台显示顺序 → 吐出新 story。
// 剧情起点和选择连线是作者数据，整理列表不能静默改写实际玩法。
export function 拖拽重排(story, 节点id, 目标下标) {
  const 键顺序 = Object.keys(story.nodes);
  const 当前位置 = 键顺序.indexOf(节点id);
  if (当前位置 < 0 || 目标下标 < 0 || 目标下标 >= 键顺序.length) return story;
  const 新顺序 = [...键顺序];
  const [被拖的] = 新顺序.splice(当前位置, 1);
  新顺序.splice(目标下标, 0, 被拖的);
  return { ...story, nodes: 按顺序重建(story.nodes, 新顺序) };
}

// 输入节点列表 → 按插入顺序聚成 [{chapter, nodes}]（没写章节的归"未分章"） → 吐出章节数组
export function 按章节分组(节点列表) {
  const 分组 = new Map();
  for (const 节点 of 节点列表) {
    const 章名 = 节点.chapter || '未分章';
    分组.set(章名, [...(分组.get(章名) ?? []), 节点]);
  }
  return [...分组.entries()].map(([章名, 组内节点]) => ({ chapter: 章名, nodes: 组内节点 }));
}
