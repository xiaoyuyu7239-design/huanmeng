// Level 6 创作资产的纯数据边界。
//
// 人物姓名、身份、头像和三维关系初值始终以 story.cast 为权威来源；
// project.authoring 只存储按角色 / 节点 id 关联的作者注释，避免两套人物档案漂移。

const 支持的创作资产版本 = 1;
const 关系维度 = new Set(['spark', 'trust', 'boundary']);
const 关系类型 = new Set(['potential-romance', 'ally', 'professional', 'rival', 'mentor', 'family', 'antagonistic']);
const 规则严重度 = new Set(['error', 'warning']);
const 规则范围 = new Set(['story', 'character', 'node', 'relationship', 'asset']);
const 规则复核状态 = new Set(['pending', 'passed', 'failed', 'waived']);
const 一致性资产类型 = new Set(['portrait-reference', 'expression-sheet', 'wardrobe-reference', 'voice-reference', 'prop-reference', 'location-reference']);
const 一致性资产状态 = new Set(['reference', 'draft', 'approved', 'retired']);
const 禁止资源协议 = /^(?:data|blob|javascript)\s*:/iu;
const 高确定性好感文案 = /好感度\s*[+＋\-－]\s*\d+(?:\.\d+)?/u;
const 角色圣经基础字段 = new Set([
  'id',
  'name',
  'shortName',
  'role',
  'theme',
  'portrait',
  'portraits',
  'color',
  'accent',
  'voiceId',
  'romanceable',
  'relationship',
]);
const 默认一致性规则 = [
  {
    id: 'player-agency',
    label: '主角主体性',
    scope: 'story',
    targetId: '',
    rule: '关键决定必须由玩家主角执行或明确授权，他人不得代替她作出结论。',
    severity: 'error',
    enabled: true,
    reviewStatus: 'pending',
    reviewNote: '',
    reviewed: false,
  },
  {
    id: 'explicit-consent-boundary',
    label: '明确同意与边界',
    scope: 'story',
    targetId: '',
    rule: '亲密、公开、数据使用与越权行动都必须存在可识别的同意与撤回空间。',
    severity: 'error',
    enabled: true,
    reviewStatus: 'pending',
    reviewNote: '',
    reviewed: false,
  },
  {
    id: 'non-romance-equivalence',
    label: '非恋爱关系等价',
    scope: 'story',
    targetId: '',
    rule: '非恋爱、女性同盟与独立路线不得在有效信息、行动权、职业成果或结局资格上被降级。',
    severity: 'error',
    enabled: true,
    reviewStatus: 'pending',
    reviewNote: '',
    reviewed: false,
  },
  {
    id: 'female-alliance-correction',
    label: '女性同盟保留纠错权',
    scope: 'story',
    targetId: '',
    rule: '女性同盟角色必须拥有独立目标、署名与对主角判断的平等纠错权，不能只做无条件附和者。',
    severity: 'warning',
    enabled: true,
    reviewStatus: 'pending',
    reviewNote: '',
    reviewed: false,
  },
];

function 是普通对象(值) {
  return !!值 && typeof 值 === 'object' && !Array.isArray(值);
}

function 文本(值, 上限 = 4000) {
  return typeof 值 === 'string' ? 值.trim().slice(0, 上限) : '';
}

// 表单逐字编辑时必须保留作者输入的空格与换行；ID、枚举、路径仍使用上面的“文本”清理。
function 自由文本(值, 上限 = 4000) {
  return typeof 值 === 'string' ? 值.slice(0, 上限) : '';
}

function 字符串数组(值) {
  if (!Array.isArray(值)) return [];
  return [...new Set(值.map((项) => 文本(项, 120)).filter(Boolean))];
}

function 有效百分值(值) {
  return typeof 值 === 'number' && Number.isFinite(值) && 值 >= 0 && 值 <= 100;
}

function 有内容(值) {
  return typeof 值 === 'string' && 值.trim().length > 0;
}

function 安全资源引用(值) {
  const 路径 = 文本(值, 600);
  if (!路径 || 禁止资源协议.test(路径) || /[\u0000-\u001f]/u.test(路径)) return '';
  return 路径;
}

function 取角色源(项目) {
  const cast = 是普通对象(项目?.story?.cast) ? 项目.story.cast : {};
  const 角色们 = [];
  const 已用 = new Set();
  if (是普通对象(cast.protagonist)) {
    角色们.push({ id: 'you', protagonist: true, source: cast.protagonist });
    已用.add('you');
  }
  for (const 角色 of Array.isArray(cast.characters) ? cast.characters : []) {
    if (!是普通对象(角色)) continue;
    const id = 文本(角色.id, 80);
    if (!id || 已用.has(id)) continue;
    已用.add(id);
    角色们.push({ id, protagonist: false, source: 角色 });
  }
  return 角色们;
}

function 取节点源(项目) {
  const 节点表 = 是普通对象(项目?.story?.nodes) ? 项目.story.nodes : {};
  const 已用 = new Set();
  const 节点们 = [];
  for (const [键, 原节点] of Object.entries(节点表)) {
    const id = 文本(键, 100) || 文本(原节点?.id, 100);
    if (!id || 已用.has(id)) continue;
    已用.add(id);
    节点们.push({ id, source: 是普通对象(原节点) ? 原节点 : {} });
  }
  return 节点们;
}

function 规范角色圣经(原始值) {
  const 原始 = 是普通对象(原始值) ? 原始值 : {};
  return {
    ...原始,
    characterId: 文本(原始.characterId, 80),
    desire: 自由文本(原始.desire),
    fear: 自由文本(原始.fear),
    boundary: 自由文本(原始.boundary),
    growth: 自由文本(原始.growth),
    voice: 自由文本(原始.voice),
    reviewed: 原始.reviewed === true,
  };
}

function 规范关系边(原始值) {
  const 原始 = 是普通对象(原始值) ? 原始值 : {};
  return {
    ...原始,
    id: 文本(原始.id, 100),
    from: 文本(原始.from, 80),
    to: 文本(原始.to, 80),
    type: 文本(原始.type, 80),
    label: 自由文本(原始.label, 240),
    dynamic: 自由文本(原始.dynamic),
    boundary: 自由文本(原始.boundary),
    reviewed: 原始.reviewed === true,
  };
}

function 规范情绪点(原始值) {
  const 原始 = 是普通对象(原始值) ? 原始值 : {};
  return {
    ...原始,
    nodeId: 文本(原始.nodeId, 100),
    intensity: 有效百分值(原始.intensity) ? 原始.intensity : null,
    agency: 有效百分值(原始.agency) ? 原始.agency : null,
    intimacy: 有效百分值(原始.intimacy) ? 原始.intimacy : null,
    note: 自由文本(原始.note),
    reviewed: 原始.reviewed === true,
  };
}

function 规范一致性规则(原始值) {
  const 原始 = 是普通对象(原始值) ? 原始值 : {};
  const 显式状态 = 文本(原始.reviewStatus, 40);
  // Level 6 只有 reviewed 布尔值。旧数据明确 reviewed=true 等价于“已通过”；
  // reviewed=false/缺省不能冒充结论，统一进入待复核。
  const reviewStatus = 规则复核状态.has(显式状态)
    ? 显式状态
    : 原始.reviewed === true
      ? 'passed'
      : 'pending';
  return {
    ...原始,
    id: 文本(原始.id, 100),
    label: 自由文本(原始.label, 240),
    scope: 文本(原始.scope, 80),
    targetId: 文本(原始.targetId, 100),
    rule: 自由文本(原始.rule),
    // 缺省值可安全补 warning；显式写错的枚举必须保留给校验器阻断，不能静默降级。
    severity: 原始.severity == null || 原始.severity === '' ? 'warning' : 文本(原始.severity, 80),
    enabled: 原始.enabled == null ? true : 原始.enabled,
    reviewStatus,
    reviewNote: 自由文本(原始.reviewNote, 1000),
    // 暂留兼容镜像，旧消费方仍可判断“是否已经给出人工结论”；新逻辑只读 reviewStatus。
    reviewed: reviewStatus !== 'pending',
  };
}

function 规范一致性资产(原始值) {
  const 原始 = 是普通对象(原始值) ? 原始值 : {};
  return {
    ...原始,
    id: 文本(原始.id, 100),
    kind: 文本(原始.kind, 80),
    title: 自由文本(原始.title, 240),
    status: 文本(原始.status, 80),
    characterIds: 字符串数组(原始.characterIds),
    nodeIds: 字符串数组(原始.nodeIds),
    // 用户输入只作为文本显示，不直接进入 img/audio src；保留危险协议原文给校验器明确阻断。
    sourcePath: 文本(原始.sourcePath, 600),
    notes: 自由文本(原始.notes),
    reviewed: 原始.reviewed === true,
  };
}

function 去重规范数组(原始数组, 规范函数, 取键) {
  const 结果 = [];
  const 已用 = new Set();
  for (const 原始 of Array.isArray(原始数组) ? 原始数组 : []) {
    if (!是普通对象(原始)) continue;
    const 规范 = 规范函数(原始);
    const 键 = 取键(规范);
    if (!键 || 已用.has(键)) continue;
    已用.add(键);
    结果.push(规范);
  }
  return 结果;
}

// 输入完整项目，返回严格的 project.authoring 形状。函数不修改项目。
export function 归一化创作资产(项目) {
  const 原始 = 是普通对象(项目?.authoring) ? 项目.authoring : {};
  const 是未来版本 = Number.isInteger(原始.schemaVersion) && 原始.schemaVersion > 支持的创作资产版本;
  const 角色源 = 取角色源(项目);
  const 节点源 = 取节点源(项目);

  const 已有圣经 = 去重规范数组(原始.characterBibles, 规范角色圣经, (项) => 项.characterId);
  const 圣经表 = new Map(已有圣经.map((项) => [项.characterId, 项]));
  const 声明角色 = new Set(角色源.map((角色) => 角色.id));
  const characterBibles = [
    ...角色源.map((角色) => 圣经表.get(角色.id) ?? 规范角色圣经({ characterId: 角色.id })),
    ...已有圣经.filter((项) => !声明角色.has(项.characterId)),
  ];

  const 已有情绪点 = 去重规范数组(原始.emotionPoints, 规范情绪点, (项) => 项.nodeId);
  const 情绪表 = new Map(已有情绪点.map((项) => [项.nodeId, 项]));
  const 声明节点 = new Set(节点源.map((节点) => 节点.id));
  const emotionPoints = [
    ...节点源.map((节点) => 情绪表.get(节点.id) ?? 规范情绪点({ nodeId: 节点.id })),
    ...已有情绪点.filter((项) => !声明节点.has(项.nodeId)),
  ];

  const relationshipEdges = 去重规范数组(原始.relationshipEdges, 规范关系边, (项) => 项.id);
  const 已有关系id = new Set(relationshipEdges.map((边) => 边.id));
  for (const 角色 of 角色源.filter((条) => !条.protagonist)) {
    const id = `you--${角色.id}`;
    const 已有角色对 = relationshipEdges.some(
      (边) => (边.from === 'you' && 边.to === 角色.id) || (边.to === 'you' && 边.from === 角色.id),
    );
    if (已有关系id.has(id) || 已有角色对) continue;
    const 关系提示 = `${文本(角色.source.theme, 240)} ${文本(角色.source.role, 240)}`;
    const 非恋爱类型 = /(?:同盟|姐妹|朋友|伙伴)/u.test(关系提示) ? 'ally' : 'professional';
    relationshipEdges.push(规范关系边({
      id,
      from: 'you',
      to: 角色.id,
      type: 角色.source.romanceable === true ? 'potential-romance' : 非恋爱类型,
      label: 文本(角色.source.theme, 240) || 文本(角色.source.role, 240) || 文本(角色.source.name, 240),
      dynamic: '',
      boundary: '',
      reviewed: false,
    }));
    已有关系id.add(id);
  }

  const consistencyRules = 去重规范数组(原始.consistencyRules, 规范一致性规则, (项) => 项.id);
  const 已有规则id = new Set(consistencyRules.map((规则) => 规则.id));
  for (const 默认规则 of 默认一致性规则) {
    if (已有规则id.has(默认规则.id)) continue;
    consistencyRules.push(规范一致性规则(默认规则));
    已有规则id.add(默认规则.id);
  }
  const consistencyAssets = 去重规范数组(原始.consistencyAssets, 规范一致性资产, (项) => 项.id);
  const 已有资产id = new Set(consistencyAssets.map((资产) => 资产.id));

  for (const 角色 of 角色源) {
    const portrait = 安全资源引用(角色.source.portrait);
    if (!portrait) continue;
    const 推导id = `portrait-${角色.id}`;
    const 已有同源引用 = consistencyAssets.some(
      (资产) => 资产.sourcePath === portrait && 资产.characterIds.includes(角色.id),
    );
    if (已有资产id.has(推导id) || 已有同源引用) continue;
    consistencyAssets.push(规范一致性资产({
      id: 推导id,
      kind: 'portrait-reference',
      title: `${文本(角色.source.name, 100) || 角色.id}角色立绘`,
      status: 'reference',
      characterIds: [角色.id],
      nodeIds: [],
      sourcePath: portrait,
      notes: '由 story.cast 角色立绘推导，仅作人物一致性参考。',
      reviewed: false,
    }));
    已有资产id.add(推导id);
  }

  const { mode: _误写模式, ...扩展字段 } = 原始;
  return {
    ...(是未来版本 ? 原始 : 扩展字段),
    schemaVersion: 是未来版本 ? 原始.schemaVersion : 支持的创作资产版本,
    characterBibles,
    relationshipEdges,
    emotionPoints,
    consistencyRules,
    consistencyAssets,
  };
}

// 基础展示信息每次从 cast 读取；bible 只是 id 关联的扩展注释。
export function 构建创作角色列表(项目) {
  const 资产 = 归一化创作资产(项目);
  const 圣经表 = new Map(资产.characterBibles.map((项) => [项.characterId, 项]));
  return 取角色源(项目).map((角色) => {
    const 关系 = 是普通对象(角色.source.relationship) ? 角色.source.relationship : {};
    return {
      id: 角色.id,
      name: 文本(角色.source.name, 120) || (角色.protagonist ? '你' : 角色.id),
      shortName: 文本(角色.source.shortName, 120),
      role: 文本(角色.source.role, 240),
      theme: 文本(角色.source.theme, 240),
      portrait: 安全资源引用(角色.source.portrait),
      color: 文本(角色.source.color, 40),
      protagonist: 角色.protagonist,
      romanceable: !角色.protagonist && 角色.source.romanceable === true,
      relationshipEnabled: !角色.protagonist && 关系.enabled !== false,
      relationshipInitial: 是普通对象(关系.initial) ? { ...关系.initial } : {},
      bible: 圣经表.get(角色.id) ?? 规范角色圣经({ characterId: 角色.id }),
    };
  });
}

export function 构建叙事关系图(项目) {
  const 角色们 = 构建创作角色列表(项目);
  const 角色id = new Set(角色们.map((角色) => 角色.id));
  const 资产 = 归一化创作资产(项目);
  return {
    nodes: 角色们.map((角色) => ({
      id: 角色.id,
      name: 角色.name,
      label: 角色.name,
      role: 角色.role,
      theme: 角色.theme,
      portrait: 角色.portrait,
      color: 角色.color,
      protagonist: 角色.protagonist,
      romanceable: 角色.romanceable,
      relationshipEnabled: 角色.relationshipEnabled,
      reviewed: 角色.bible.reviewed,
    })),
    edges: 资产.relationshipEdges.map((边) => ({
      ...边,
      valid: 角色id.has(边.from) && 角色id.has(边.to) && 边.from !== 边.to,
    })),
  };
}

// 删除剧情节点时同步移除作者态引用，避免留下界面不可见但会阻断发布的孤儿数据。
export function 清理节点创作引用(authoring, nodeId) {
  if (!是普通对象(authoring) || !有内容(nodeId)) return authoring;
  return {
    ...authoring,
    emotionPoints: (Array.isArray(authoring.emotionPoints) ? authoring.emotionPoints : []).filter((点) => 点?.nodeId !== nodeId),
    consistencyRules: (Array.isArray(authoring.consistencyRules) ? authoring.consistencyRules : []).filter(
      (规则) => !(规则?.scope === 'node' && 规则?.targetId === nodeId),
    ),
    consistencyAssets: (Array.isArray(authoring.consistencyAssets) ? authoring.consistencyAssets : []).map((资产) => ({
      ...资产,
      nodeIds: (Array.isArray(资产?.nodeIds) ? 资产.nodeIds : []).filter((id) => id !== nodeId),
      reviewed: 资产?.sourcePath?.includes?.(nodeId) ? false : 资产?.reviewed === true,
    })),
  };
}

export function 情绪强度文案(值) {
  if (!有效百分值(值)) return '待标注';
  if (值 <= 20) return '平静';
  if (值 <= 40) return '克制';
  if (值 <= 60) return '起伏';
  if (值 <= 80) return '高张力';
  return '峰值';
}

function 分区完成度(项们, 是完成) {
  const completed = 项们.filter(是完成).length;
  const reviewed = 项们.filter((项) => 项.reviewed === true).length;
  return {
    total: 项们.length,
    completed,
    reviewed,
    percentage: 项们.length ? Math.round((completed / 项们.length) * 100) : 0,
  };
}

export function 计算创作资产完成度(项目) {
  const 资产 = 归一化创作资产(项目);
  const sections = {
    characterBibles: 分区完成度(资产.characterBibles, (项) =>
      项.reviewed && [项.desire, 项.fear, 项.boundary, 项.growth, 项.voice].every(有内容)),
    relationshipEdges: 分区完成度(资产.relationshipEdges, (项) =>
      项.reviewed && [项.id, 项.from, 项.to, 项.type, 项.label, 项.dynamic, 项.boundary].every(有内容) && 关系类型.has(项.type)),
    emotionPoints: 分区完成度(资产.emotionPoints, (项) =>
      项.reviewed && 有效百分值(项.intensity) && 有效百分值(项.agency) &&
      有效百分值(项.intimacy) && 有内容(项.note)),
    consistencyRules: 分区完成度(资产.consistencyRules.filter((项) => 项.enabled !== false), (项) =>
      ['passed', 'waived'].includes(项.reviewStatus) && (项.reviewStatus !== 'waived' || 有内容(项.reviewNote)) &&
      typeof 项.enabled === 'boolean' && [项.id, 项.label, 项.scope, 项.rule].every(有内容) &&
      规则范围.has(项.scope) && 规则严重度.has(项.severity) &&
      (项.scope === 'story' || 有内容(项.targetId))),
    consistencyAssets: 分区完成度(资产.consistencyAssets, (项) =>
      项.reviewed && [项.id, 项.kind, 项.title, 项.status, 项.sourcePath].every(有内容) &&
      一致性资产类型.has(项.kind) && 一致性资产状态.has(项.status) &&
      !禁止资源协议.test(项.sourcePath)),
  };
  const 分区们 = Object.values(sections);
  const total = 分区们.reduce((和, 分区) => 和 + 分区.total, 0);
  const completed = 分区们.reduce((和, 分区) => 和 + 分区.completed, 0);
  const reviewed = 分区们.reduce((和, 分区) => 和 + 分区.reviewed, 0);
  return {
    total,
    completed,
    reviewed,
    percentage: total ? Math.round((completed / total) * 100) : 0,
    sections,
  };
}

function 取原始数组(原始, 字段) {
  return Array.isArray(原始?.[字段]) ? 原始[字段] : [];
}

function 规则目标存在(规则, 角色id, 节点id, 关系id, 资产id) {
  if (规则.scope === 'story') return true;
  if (!规则.targetId) return false;
  if (规则.scope === 'character') return 角色id.has(规则.targetId);
  if (规则.scope === 'node') return 节点id.has(规则.targetId);
  if (规则.scope === 'relationship') return 关系id.has(规则.targetId);
  if (规则.scope === 'asset') return 资产id.has(规则.targetId);
  return false;
}

// 只扫描作者可见的剧情文本，不把 QA 报告中的示例误当正片内容。
function 剧情文本位置(项目, 资产) {
  const 结果 = [];
  for (const 节点 of 取节点源(项目)) {
    for (const [字段, 值] of Object.entries({ title: 节点.source.title, synopsis: 节点.source.synopsis })) {
      if (typeof 值 === 'string') 结果.push({ path: `story.nodes.${节点.id}.${字段}`, text: 值 });
    }
    for (const [索引, 台词] of (Array.isArray(节点.source.lines) ? 节点.source.lines : []).entries()) {
      if (typeof 台词?.text === 'string') 结果.push({ path: `story.nodes.${节点.id}.lines.${索引}.text`, text: 台词.text });
    }
    for (const [类型, 列表] of [['choices', 节点.source.choices], ['hotspots', 节点.source.hotspots]]) {
      for (const [索引, 条目] of (Array.isArray(列表) ? 列表 : []).entries()) {
        for (const 字段 of ['label', 'intent', 'caption', 'consequence', 'description']) {
          if (typeof 条目?.[字段] === 'string') {
            结果.push({ path: `story.nodes.${节点.id}.${类型}.${索引}.${字段}`, text: 条目[字段] });
          }
        }
      }
    }
  }
  return 结果;
}

export function 校验创作资产(项目) {
  const items = [];
  const 已有问题 = new Set();
  const 加问题 = (severity, code, scope, path, message, targetId = '') => {
    const 唯一键 = `${severity}|${code}|${path}|${message}`;
    if (已有问题.has(唯一键)) return;
    已有问题.add(唯一键);
    items.push({ id: `${code}:${path}`, code, severity, scope, targetId, path, message });
  };

  const 有authoring = Object.prototype.hasOwnProperty.call(项目 ?? {}, 'authoring') && 项目?.authoring !== undefined;
  const 原始 = 是普通对象(项目?.authoring) ? 项目.authoring : {};
  if (!有authoring) {
    加问题('warning', 'authoring-missing', 'authoring', 'authoring', '旧项目尚未建立女性向创作资产，已以待补充状态兼容打开。');
  } else if (!是普通对象(项目.authoring)) {
    加问题('error', 'authoring-shape', 'authoring', 'authoring', 'project.authoring 必须是 JSON 对象。');
  } else {
    if (Number.isInteger(原始.schemaVersion) && 原始.schemaVersion > 支持的创作资产版本) {
      加问题('warning', 'authoring-version-future', 'authoring', 'authoring.schemaVersion', `创作资产来自更新版本 v${原始.schemaVersion}；当前版本只读保留未知字段，不会降级覆盖。`);
    } else if (原始.schemaVersion !== 支持的创作资产版本) {
      加问题('error', 'authoring-version', 'authoring', 'authoring.schemaVersion', 'project.authoring.schemaVersion 必须为 1。');
    }
    if (原始.schemaVersion === 支持的创作资产版本 && 'mode' in 原始) {
      加问题('error', 'authoring-mode-forbidden', 'authoring', 'authoring.mode', '快速 / 专业模式是界面偏好，不得写入 project.authoring。');
    }
    for (const 字段 of ['characterBibles', 'relationshipEdges', 'emotionPoints', 'consistencyRules', 'consistencyAssets']) {
      if (字段 in 原始 && !Array.isArray(原始[字段])) {
        加问题('error', 'authoring-array-shape', 'authoring', `authoring.${字段}`, `authoring.${字段} 必须是数组。`);
      }
    }
  }

  const 资产 = 归一化创作资产(项目);
  const 角色id = new Set(取角色源(项目).map((角色) => 角色.id));
  const 节点id = new Set(取节点源(项目).map((节点) => 节点.id));
  const 关系id = new Set(资产.relationshipEdges.map((边) => 边.id));
  const 资产id = new Set(资产.consistencyAssets.map((条) => 条.id));

  const 查重 = (字段, 取id, code) => {
    const 看过 = new Set();
    取原始数组(原始, 字段).forEach((条目, 索引) => {
      if (!是普通对象(条目)) {
        加问题('error', 'authoring-item-shape', 字段, `authoring.${字段}.${索引}`, `${字段} 第 ${索引 + 1} 项必须是 JSON 对象。`);
        return;
      }
      const id = 文本(取id(条目), 100);
      if (!id) {
        加问题('error', `${code}-missing`, 字段, `authoring.${字段}.${索引}`, `${字段} 第 ${索引 + 1} 项缺少稳定 id。`);
      } else if (看过.has(id)) {
        加问题('error', `${code}-duplicate`, 字段, `authoring.${字段}.${索引}`, `${字段} 存在重复 id：${id}`, id);
      }
      看过.add(id);
    });
  };
  查重('characterBibles', (项) => 项.characterId, 'character-bible-id');
  查重('relationshipEdges', (项) => 项.id, 'relationship-edge-id');
  查重('emotionPoints', (项) => 项.nodeId, 'emotion-node-id');
  查重('consistencyRules', (项) => 项.id, 'consistency-rule-id');
  查重('consistencyAssets', (项) => 项.id, 'consistency-asset-id');

  // 对原始嵌套字段先做形状检查；否则安全视图会把数字文本、错误数组或非法元素静默清空。
  const 校验字符串字段 = (分区, 字段们) => {
    取原始数组(原始, 分区).forEach((条目, 索引) => {
      if (!是普通对象(条目)) return;
      for (const [字段, 上限] of 字段们) {
        if (!(字段 in 条目) || 条目[字段] == null) continue;
        if (typeof 条目[字段] !== 'string') {
          加问题('error', 'authoring-field-shape', 分区, `authoring.${分区}.${索引}.${字段}`, `${分区} 第 ${索引 + 1} 项的 ${字段} 必须是字符串。`);
        } else if (条目[字段].length > 上限) {
          加问题('error', 'authoring-field-too-long', 分区, `authoring.${分区}.${索引}.${字段}`, `${分区} 第 ${索引 + 1} 项的 ${字段} 超过 ${上限} 字符，已阻止静默截断。`);
        }
      }
    });
  };
  const 校验布尔字段 = (分区, 字段们) => {
    取原始数组(原始, 分区).forEach((条目, 索引) => {
      if (!是普通对象(条目)) return;
      for (const 字段 of 字段们) {
        if (字段 in 条目 && typeof 条目[字段] !== 'boolean') {
          加问题('error', 'authoring-field-shape', 分区, `authoring.${分区}.${索引}.${字段}`, `${分区} 第 ${索引 + 1} 项的 ${字段} 必须是布尔值。`);
        }
      }
    });
  };
  校验字符串字段('characterBibles', [['characterId', 80], ['desire', 4000], ['fear', 4000], ['boundary', 4000], ['growth', 4000], ['voice', 4000]]);
  校验字符串字段('relationshipEdges', [['id', 100], ['from', 80], ['to', 80], ['type', 80], ['label', 240], ['dynamic', 4000], ['boundary', 4000]]);
  校验字符串字段('emotionPoints', [['nodeId', 100], ['note', 4000]]);
  校验字符串字段('consistencyRules', [['id', 100], ['label', 240], ['scope', 80], ['targetId', 100], ['rule', 4000], ['severity', 80], ['reviewStatus', 40], ['reviewNote', 1000]]);
  校验字符串字段('consistencyAssets', [['id', 100], ['kind', 80], ['title', 240], ['status', 80], ['sourcePath', 600], ['notes', 4000]]);
  校验布尔字段('characterBibles', ['reviewed']);
  校验布尔字段('relationshipEdges', ['reviewed']);
  校验布尔字段('emotionPoints', ['reviewed']);
  校验布尔字段('consistencyRules', ['enabled', 'reviewed']);
  校验布尔字段('consistencyAssets', ['reviewed']);

  取原始数组(原始, 'consistencyAssets').forEach((条目, 索引) => {
    if (!是普通对象(条目)) return;
    for (const 字段 of ['characterIds', 'nodeIds']) {
      if (!(字段 in 条目)) continue;
      if (!Array.isArray(条目[字段])) {
        加问题('error', 'consistency-asset-reference-array-shape', 'consistencyAssets', `authoring.consistencyAssets.${索引}.${字段}`, `一致性资产第 ${索引 + 1} 项的 ${字段} 必须是字符串数组。`);
        continue;
      }
      const 看过 = new Set();
      条目[字段].forEach((值, 值索引) => {
        if (typeof 值 !== 'string' || !值.trim()) {
          加问题('error', 'consistency-asset-reference-item-shape', 'consistencyAssets', `authoring.consistencyAssets.${索引}.${字段}.${值索引}`, `一致性资产第 ${索引 + 1} 项的 ${字段}[${值索引}] 必须是非空字符串。`);
        } else if (看过.has(值.trim())) {
          加问题('error', 'consistency-asset-reference-item-duplicate', 'consistencyAssets', `authoring.consistencyAssets.${索引}.${字段}.${值索引}`, `一致性资产第 ${索引 + 1} 项的 ${字段} 存在重复引用：${值.trim()}。`);
        }
        if (typeof 值 === 'string' && 值.trim()) 看过.add(值.trim());
      });
    }
  });

  取原始数组(原始, 'characterBibles').forEach((条目, 索引) => {
    if (!是普通对象(条目)) return;
    for (const 字段 of 角色圣经基础字段) {
      if (字段 in 条目) {
        加问题('error', 'character-bible-duplicates-cast', 'characterBibles', `authoring.characterBibles.${索引}.${字段}`, `角色圣经不得复制 story.cast.${字段} 基础字段。`, 文本(条目.characterId, 80));
      }
    }
  });

  for (const 圣经 of 资产.characterBibles) {
    const path = `authoring.characterBibles.${圣经.characterId}`;
    if (!角色id.has(圣经.characterId)) {
      加问题('error', 'character-bible-orphan', 'characterBibles', path, `角色圣经引用了未声明角色：${圣经.characterId}`, 圣经.characterId);
      continue;
    }
    const 缺失 = ['desire', 'fear', 'boundary', 'growth', 'voice'].filter((字段) => !有内容(圣经[字段]));
    if (缺失.length) 加问题('warning', 'character-bible-incomplete', 'characterBibles', path, `角色 ${圣经.characterId} 圣经待补：${缺失.join(', ')}`, 圣经.characterId);
    if (!圣经.reviewed) 加问题('warning', 'character-bible-unreviewed', 'characterBibles', path, `角色 ${圣经.characterId} 圣经尚未人工审阅。`, 圣经.characterId);
  }

  for (const 边 of 资产.relationshipEdges) {
    const path = `authoring.relationshipEdges.${边.id}`;
    if (!角色id.has(边.from)) 加问题('error', 'relationship-from-orphan', 'relationshipEdges', `${path}.from`, `关系边 ${边.id} 的 from 未声明：${边.from || 'missing'}`, 边.id);
    if (!角色id.has(边.to)) 加问题('error', 'relationship-to-orphan', 'relationshipEdges', `${path}.to`, `关系边 ${边.id} 的 to 未声明：${边.to || 'missing'}`, 边.id);
    if (边.from && 边.from === 边.to) 加问题('error', 'relationship-self-edge', 'relationshipEdges', path, `关系边 ${边.id} 不能指向同一角色。`, 边.id);
    if (!关系类型.has(边.type)) 加问题('error', 'relationship-type-invalid', 'relationshipEdges', `${path}.type`, `关系边 ${边.id} 使用了不支持的类型：${边.type || 'missing'}`, 边.id);
    const 缺失 = ['type', 'label', 'dynamic', 'boundary'].filter((字段) => !有内容(边[字段]));
    if (缺失.length) 加问题('warning', 'relationship-edge-incomplete', 'relationshipEdges', path, `关系边 ${边.id} 待补：${缺失.join(', ')}`, 边.id);
    if (!边.reviewed) 加问题('warning', 'relationship-edge-unreviewed', 'relationshipEdges', path, `关系边 ${边.id} 尚未人工审阅。`, 边.id);
  }

  const 原情绪表 = new Map(
    取原始数组(原始, 'emotionPoints')
      .filter(是普通对象)
      .map((项) => [文本(项.nodeId, 100), 项]),
  );
  for (const 情绪 of 资产.emotionPoints) {
    const path = `authoring.emotionPoints.${情绪.nodeId}`;
    const 原情绪 = 原情绪表.get(情绪.nodeId);
    for (const 字段 of ['intensity', 'agency', 'intimacy']) {
      // 归一化会用 null 明确表示“作者尚未标注”；它只能是提醒，不能阻断旧项目发布。
      // 只有作者实际写入了非 null 的非法值（字符串、Infinity、越界数字）才是结构错误。
      if (原情绪 && 原情绪[字段] != null && !有效百分值(原情绪[字段])) {
        加问题('error', 'emotion-value-invalid', 'emotionPoints', `${path}.${字段}`, `情绪点 ${情绪.nodeId}.${字段} 必须是 0–100 的有限数字。`, 情绪.nodeId);
      } else if (!有效百分值(情绪[字段])) {
        加问题('warning', 'emotion-value-missing', 'emotionPoints', `${path}.${字段}`, `节点 ${情绪.nodeId} 尚未标注 ${字段}。`, 情绪.nodeId);
      }
    }
    if (!节点id.has(情绪.nodeId)) {
      加问题('error', 'emotion-node-orphan', 'emotionPoints', path, `情绪点引用了不存在的节点：${情绪.nodeId}`, 情绪.nodeId);
      continue;
    }
    if (!有内容(情绪.note)) 加问题('warning', 'emotion-note-missing', 'emotionPoints', `${path}.note`, `节点 ${情绪.nodeId} 缺少情绪曲线说明。`, 情绪.nodeId);
    if (!情绪.reviewed) 加问题('warning', 'emotion-unreviewed', 'emotionPoints', path, `节点 ${情绪.nodeId} 情绪点尚未人工审阅。`, 情绪.nodeId);
  }

  for (const 规则 of 资产.consistencyRules) {
    const path = `authoring.consistencyRules.${规则.id}`;
    const 原规则 = 取原始数组(原始, 'consistencyRules').find((项) => 是普通对象(项) && 文本(项.id, 100) === 规则.id);
    if (原规则 && 'reviewStatus' in 原规则 && !规则复核状态.has(文本(原规则.reviewStatus, 40))) {
      加问题('error', 'consistency-rule-review-status-invalid', 'consistencyRules', `${path}.reviewStatus`, `一致性规则 ${规则.id} 使用了不支持的复核状态：${文本(原规则.reviewStatus, 40) || 'missing'}`, 规则.id);
    }
    if (typeof 规则.enabled !== 'boolean') {
      加问题('error', 'consistency-rule-enabled-invalid', 'consistencyRules', `${path}.enabled`, `一致性规则 ${规则.id}.enabled 必须是布尔值。`, 规则.id);
    }
    if (规则.enabled === false) continue;
    if (!规则范围.has(规则.scope)) {
      加问题('error', 'consistency-rule-scope-invalid', 'consistencyRules', `${path}.scope`, `一致性规则 ${规则.id} 使用了不支持的范围：${规则.scope || 'missing'}`, 规则.id);
    }
    if (!规则严重度.has(规则.severity)) {
      加问题('error', 'consistency-rule-severity-invalid', 'consistencyRules', `${path}.severity`, `一致性规则 ${规则.id} 使用了不支持的严重度：${规则.severity || 'missing'}`, 规则.id);
    }
    if (!有内容(规则.label) || !有内容(规则.scope) || !有内容(规则.rule)) {
      加问题('warning', 'consistency-rule-incomplete', 'consistencyRules', path, `一致性规则 ${规则.id} 缺少标题、范围或规则文本。`, 规则.id);
    }
    if (!规则目标存在(规则, 角色id, 节点id, 关系id, 资产id)) {
      加问题('error', 'consistency-rule-orphan', 'consistencyRules', `${path}.targetId`, `一致性规则 ${规则.id} 引用了无效目标：${规则.targetId || 'missing'}`, 规则.id);
    }
    if (规则.severity === 'error') {
      if (规则.reviewStatus === 'pending') {
        加问题('error', 'consistency-rule-review-pending', 'consistencyRules', `${path}.reviewStatus`, `阻塞规则 ${规则.id} 尚未给出人工复核结论。`, 规则.id);
      } else if (规则.reviewStatus === 'failed') {
        加问题('error', 'consistency-rule-review-failed', 'consistencyRules', `${path}.reviewStatus`, `阻塞规则 ${规则.id} 已判定未通过，请先修复内容。`, 规则.id);
      } else if (规则.reviewStatus === 'waived' && !有内容(规则.reviewNote)) {
        加问题('error', 'consistency-rule-waiver-note-missing', 'consistencyRules', `${path}.reviewNote`, `阻塞规则 ${规则.id} 标记为豁免时必须填写理由。`, 规则.id);
      }
    } else if (规则.reviewStatus === 'pending') {
      加问题('warning', 'consistency-rule-review-pending', 'consistencyRules', `${path}.reviewStatus`, `提醒规则 ${规则.id} 尚未给出人工复核结论。`, 规则.id);
    } else if (规则.reviewStatus === 'failed') {
      加问题('warning', 'consistency-rule-review-failed', 'consistencyRules', `${path}.reviewStatus`, `提醒规则 ${规则.id} 已判定未通过。`, 规则.id);
    } else if (规则.reviewStatus === 'waived' && !有内容(规则.reviewNote)) {
      加问题('warning', 'consistency-rule-waiver-note-missing', 'consistencyRules', `${path}.reviewNote`, `提醒规则 ${规则.id} 标记为豁免时应填写理由。`, 规则.id);
    }
  }

  const 原资产表 = new Map(
    取原始数组(原始, 'consistencyAssets')
      .filter(是普通对象)
      .map((项) => [文本(项.id, 100), 项]),
  );
  for (const 条目 of 资产.consistencyAssets) {
    const path = `authoring.consistencyAssets.${条目.id}`;
    const 原条目 = 原资产表.get(条目.id);
    if (原条目 && 禁止资源协议.test(文本(原条目.sourcePath, 600))) {
      加问题('error', 'consistency-asset-dangerous-url', 'consistencyAssets', `${path}.sourcePath`, `一致性资产 ${条目.id} 不得使用 data/blob/javascript URL。`, 条目.id);
    }
    if (!一致性资产类型.has(条目.kind)) 加问题('error', 'consistency-asset-kind-invalid', 'consistencyAssets', `${path}.kind`, `一致性资产 ${条目.id} 使用了不支持的类型：${条目.kind || 'missing'}`, 条目.id);
    if (!一致性资产状态.has(条目.status)) 加问题('error', 'consistency-asset-status-invalid', 'consistencyAssets', `${path}.status`, `一致性资产 ${条目.id} 使用了不支持的状态：${条目.status || 'missing'}`, 条目.id);
    if (![条目.kind, 条目.title, 条目.status, 条目.sourcePath].every(有内容)) {
      加问题('warning', 'consistency-asset-incomplete', 'consistencyAssets', path, `一致性资产 ${条目.id} 缺少类型、标题、状态或引用路径。`, 条目.id);
    }
    for (const characterId of 条目.characterIds) {
      if (!角色id.has(characterId)) 加问题('error', 'consistency-asset-character-orphan', 'consistencyAssets', `${path}.characterIds`, `一致性资产 ${条目.id} 引用了未声明角色：${characterId}`, 条目.id);
    }
    for (const nodeId of 条目.nodeIds) {
      if (!节点id.has(nodeId)) 加问题('error', 'consistency-asset-node-orphan', 'consistencyAssets', `${path}.nodeIds`, `一致性资产 ${条目.id} 引用了不存在的节点：${nodeId}`, 条目.id);
    }
    if (!条目.reviewed) 加问题('warning', 'consistency-asset-unreviewed', 'consistencyAssets', path, `一致性资产 ${条目.id} 尚未人工审阅。`, 条目.id);
  }

  // story.cast 初值和节点 effect 都不能暗中退回单值好感系统。
  for (const 角色 of 取角色源(项目)) {
    const 初值 = 角色.source.relationship?.initial;
    if (!是普通对象(初值)) continue;
    for (const [维度, 值] of Object.entries(初值)) {
      const path = `story.cast.${角色.id}.relationship.initial.${维度}`;
      if (!关系维度.has(维度)) 加问题('error', 'relationship-metric-unsupported', 'story', path, `角色 ${角色.id} 使用了非法关系维度：${维度}`, 角色.id);
      if (!有效百分值(值)) 加问题('error', 'relationship-initial-invalid', 'story', path, `角色 ${角色.id}.${维度} 初值必须是 0–100 的有限数字。`, 角色.id);
    }
  }
  const 使用结构化关系合同 = 是普通对象(项目?.story?.cast);
  for (const 节点 of 取节点源(项目)) {
    for (const [类型, 列表] of [['choices', 节点.source.choices], ['hotspots', 节点.source.hotspots]]) {
      for (const [索引, 条目] of (Array.isArray(列表) ? 列表 : []).entries()) {
        const 关系增量 = 条目?.effect?.relationships;
        if (是普通对象(关系增量)) {
          for (const [characterId, 增量组] of Object.entries(关系增量)) {
            const path = `story.nodes.${节点.id}.${类型}.${索引}.effect.relationships.${characterId}`;
            if (typeof 增量组 === 'number') {
              if (使用结构化关系合同) {
                加问题('error', 'relationship-scalar-affection', 'story', path, `角色 ${characterId} 使用了非法单值好感，必须改用 spark/trust/boundary。`, characterId);
              } else {
                加问题('warning', 'legacy-relationship-scalar', 'story', path, `旧作品角色 ${characterId} 的单值关系由播放器兼容迁移；建立 cast 后请改用 spark/trust/boundary。`, characterId);
              }
              continue;
            }
            if (!是普通对象(增量组)) continue;
            for (const [维度, 增量] of Object.entries(增量组)) {
              if (!关系维度.has(维度)) 加问题('error', 'relationship-metric-unsupported', 'story', `${path}.${维度}`, `角色 ${characterId} 使用了非法关系维度：${维度}`, characterId);
              if (typeof 增量 !== 'number' || !Number.isFinite(增量)) 加问题('error', 'relationship-delta-invalid', 'story', `${path}.${维度}`, `关系增量 ${characterId}.${维度} 必须是有限数字。`, characterId);
            }
          }
        }
        for (const [条件序, 条件] of (Array.isArray(条目?.condition?.minRelationship) ? 条目.condition.minRelationship : []).entries()) {
          if (!关系维度.has(条件?.metric)) {
            加问题('error', 'relationship-metric-unsupported', 'story', `story.nodes.${节点.id}.${类型}.${索引}.condition.minRelationship.${条件序}.metric`, `关系门槛使用了非法维度：${条件?.metric || 'missing'}`, 文本(条件?.character, 80));
          }
        }
      }
    }
  }

  for (const 条目 of 剧情文本位置(项目, 资产)) {
    if (高确定性好感文案.test(条目.text)) {
      加问题(
        使用结构化关系合同 ? 'error' : 'warning',
        使用结构化关系合同 ? 'affection-copy-forbidden' : 'legacy-affection-copy',
        'content',
        条目.path,
        使用结构化关系合同
          ? `发现禁用的单值好感文案：${条目.text.match(高确定性好感文案)?.[0] ?? '好感度变化'}`
          : `旧作品仍显示单值好感文案：${条目.text.match(高确定性好感文案)?.[0] ?? '好感度变化'}；建立 cast 后请改用三维关系反馈。`,
      );
    }
  }

  const 排序后 = items.sort((甲, 乙) => {
    if (甲.severity !== 乙.severity) return 甲.severity === 'error' ? -1 : 1;
    return 甲.path.localeCompare(乙.path, 'zh-CN') || 甲.code.localeCompare(乙.code, 'en');
  });
  return {
    errors: 排序后.filter((项) => 项.severity === 'error').map((项) => 项.message),
    warnings: 排序后.filter((项) => 项.severity === 'warning').map((项) => 项.message),
    items: 排序后,
  };
}
