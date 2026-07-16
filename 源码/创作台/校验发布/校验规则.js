// 这个文件是剧本的"质检科"：项目发货(发布)之前，把剧情图从头到尾摸一遍——
// 有没有走不到的房间(不可达节点)、有没有进去出不来的死胡同(死路)、
// 门牌号写错的门(断链选择)、还没挂画的墙(缺全景资产)……
// 每一条规则和英文文案都照抄线上源码，播放器和创作台对报告的解析都依赖这些原文。

// 全景图提示词的硬性基线：校验会检查每条 prompt 必须原样包含这一串(线上常量 vs)
import { 校验创作资产 } from '../女性向资产/创作资产模型.js';

export const 全景基线 =
  '360 degree equirectangular panorama, seamless 2:1, 4096x2048, viewer standing at center, first-person perspective, no text, no logo, no watermark';

function 是普通对象(值) {
  return !!值 && typeof 值 === 'object' && !Array.isArray(值);
}

const 安全角色id = /^[a-z][a-z0-9_-]*$/;
const 保留角色id = new Set(['narrator', 'system', 'you', 'protagonist', '__proto__', 'constructor', 'prototype']);
const 关系维度 = new Set(['spark', 'trust', 'boundary']);
const 系统说话人 = new Set(['narrator', 'system', 'you', 'protagonist']);

// cast 缺失时保持旧作品兼容；作者一旦声明 cast，就按新角色契约严格校验，
// 避免播放器在运行时静默丢角色、改颜色或钳制关系初值。
export function 校验角色阵容(值) {
  if (值 === undefined) {
    return { enabled: false, errors: [], characterIds: new Set(), relationshipEnabled: new Map() };
  }
  const 结果 = { enabled: true, errors: [], characterIds: new Set(), relationshipEnabled: new Map() };
  if (!是普通对象(值)) {
    结果.errors.push('story.cast must be a JSON object.');
    return 结果;
  }
  if (!是普通对象(值.protagonist)) {
    结果.errors.push('story.cast.protagonist must be a JSON object.');
  } else {
    if (值.protagonist.id !== 'you') 结果.errors.push('story.cast.protagonist.id must be "you".');
    if (typeof 值.protagonist.name !== 'string' || !值.protagonist.name.trim()) {
      结果.errors.push('story.cast.protagonist.name must be a non-empty string.');
    }
    校验可选字符串字段(值.protagonist, ['role', 'pronouns', 'portrait'], 'story.cast.protagonist', 结果.errors);
    校验可选颜色字段(值.protagonist, ['color', 'accent'], 'story.cast.protagonist', 结果.errors);
  }
  if (!Array.isArray(值.characters)) {
    结果.errors.push('story.cast.characters must be an array.');
    return 结果;
  }
  值.characters.forEach((角色, 索引) => {
    const 位置 = `story.cast character ${索引 + 1}`;
    if (!是普通对象(角色)) {
      结果.errors.push(`${位置} must be a JSON object.`);
      return;
    }
    const id = typeof 角色.id === 'string' ? 角色.id.trim() : '';
    if (!安全角色id.test(id) || 保留角色id.has(id)) {
      结果.errors.push(`${位置} has invalid id: ${id || 'missing'}`);
      return;
    }
    if (结果.characterIds.has(id)) {
      结果.errors.push(`story.cast has duplicate character id: ${id}`);
      return;
    }
    结果.characterIds.add(id);
    if (typeof 角色.name !== 'string' || !角色.name.trim()) {
      结果.errors.push(`story.cast character ${id} is missing name.`);
    }
    校验可选字符串字段(角色, ['shortName', 'role', 'theme', 'portrait', 'voiceId'], `story.cast character ${id}`, 结果.errors);
    校验可选颜色字段(角色, ['color', 'accent'], `story.cast character ${id}`, 结果.errors);
    if ('romanceable' in 角色 && typeof 角色.romanceable !== 'boolean') {
      结果.errors.push(`story.cast character ${id}.romanceable must be a boolean.`);
    }
    if ('relationship' in 角色 && !是普通对象(角色.relationship)) {
      结果.errors.push(`story.cast character ${id}.relationship must be a JSON object.`);
      return;
    }
    const 关系 = 是普通对象(角色.relationship) ? 角色.relationship : {};
    if ('enabled' in 关系 && typeof 关系.enabled !== 'boolean') {
      结果.errors.push(`story.cast character ${id}.relationship.enabled must be a boolean.`);
    }
    结果.relationshipEnabled.set(id, 关系.enabled !== false);
    if ('initial' in 关系 && !是普通对象(关系.initial)) {
      结果.errors.push(`story.cast character ${id}.relationship.initial must be a JSON object.`);
      return;
    }
    if (是普通对象(关系.initial)) {
      for (const 维度 of Object.keys(关系.initial)) {
        if (!关系维度.has(维度)) {
          结果.errors.push(`story.cast character ${id}.relationship.initial contains unsupported metric: ${维度}`);
        }
      }
      for (const 维度 of 关系维度) {
        if (!(维度 in 关系.initial)) continue;
        const 数值 = 关系.initial[维度];
        if (typeof 数值 !== 'number' || !Number.isFinite(数值) || 数值 < 0 || 数值 > 100) {
          结果.errors.push(`story.cast character ${id}.relationship.initial.${维度} must be a number from 0 to 100.`);
        }
      }
    }
  });
  return 结果;
}

function 校验可选字符串字段(对象, 字段们, 前缀, 错误们) {
  for (const 字段 of 字段们) {
    if (字段 in 对象 && typeof 对象[字段] !== 'string') 错误们.push(`${前缀}.${字段} must be a string.`);
  }
}

function 校验可选颜色字段(对象, 字段们, 前缀, 错误们) {
  for (const 字段 of 字段们) {
    if (字段 in 对象 && (typeof 对象[字段] !== 'string' || !/^#[0-9a-f]{6}$/i.test(对象[字段]))) {
      错误们.push(`${前缀}.${字段} must be a #RRGGBB color.`);
    }
  }
}

function 校验机制引用(值, 类型, 阵容) {
  if (!阵容.enabled || !是普通对象(值)) return [];
  const 错误们 = [];
  if (类型 === 'effect' && 是普通对象(值.relationships)) {
    for (const [角色, 增量组] of Object.entries(值.relationships)) {
      if (!阵容.characterIds.has(角色)) {
        错误们.push(`effect.relationships references undeclared cast character: ${角色}`);
      }
      if (typeof 增量组 === 'number') {
        错误们.push(`effect.relationships.${角色} must use spark, trust, or boundary instead of a scalar value.`);
      }
      if (阵容.relationshipEnabled.get(角色) === false) {
        错误们.push(`effect.relationships references relationship-disabled cast character: ${角色}`);
      }
    }
  }
  if (类型 === 'condition' && Array.isArray(值.minRelationship)) {
    for (const 条目 of 值.minRelationship) {
      if (typeof 条目?.character === 'string' && !阵容.characterIds.has(条目.character)) {
        错误们.push(`condition.minRelationship references undeclared cast character: ${条目.character}`);
      }
      if (阵容.relationshipEnabled.get(条目?.character) === false) {
        错误们.push(`condition.minRelationship references relationship-disabled cast character: ${条目.character}`);
      }
    }
  }
  if ('route' in 值 && typeof 值.route === 'string' && !['team', 'solo'].includes(值.route) && !阵容.characterIds.has(值.route)) {
    错误们.push(`${类型}.route references undeclared cast route: ${值.route}`);
  }
  return 错误们;
}

// Effect/Condition 虽然由 JSON 文本编辑，但“能解析”不等于播放器能安全消费。
// 这里把嵌套字段的形状也列入 QA；同一个检查也供编辑弹窗即时拦截。
export function 校验选择机制结构(值, 类型) {
  if (值 === undefined) return [];
  if (!是普通对象(值)) return [`${类型} must be a JSON object.`];
  const 错误们 = [];
  const 字符串数组字段 =
    类型 === 'effect' ? ['flags', 'memories'] : ['flags', 'missingFlags', 'memories', 'missingMemories'];
  for (const 字段 of 字符串数组字段) {
    if (!(字段 in 值)) continue;
    if (!Array.isArray(值[字段])) {
      错误们.push(`${类型}.${字段} must be an array.`);
    } else if (值[字段].some((条目) => typeof 条目 !== 'string' || !条目.trim())) {
      错误们.push(`${类型}.${字段} must contain only non-empty strings.`);
    }
  }
  if (
    'route' in 值 &&
    值.route !== undefined &&
    值.route !== null &&
    (typeof 值.route !== 'string' || !值.route.trim())
  ) {
    错误们.push(`${类型}.route must be null or a non-empty string.`);
  }

  if (类型 === 'effect') {
    for (const 字段 of ['globals', 'relationships']) {
      if (字段 in 值 && 值[字段] !== undefined && !是普通对象(值[字段])) {
        错误们.push(`effect.${字段} must be a JSON object.`);
      }
    }
    if (是普通对象(值.globals) && Object.values(值.globals).some((增量) => !Number.isFinite(增量))) {
      错误们.push('effect.globals values must be finite numbers.');
    }
    if (
      是普通对象(值.relationships) &&
      Object.values(值.relationships).some(
        (增量组) =>
          !(typeof 增量组 === 'number' && Number.isFinite(增量组)) &&
          (!是普通对象(增量组) || Object.values(增量组).some((增量) => !Number.isFinite(增量)))
      )
    ) {
      错误们.push('effect.relationships values must be finite numbers or objects of finite numbers.');
    }
    if (是普通对象(值.relationships)) {
      for (const [角色, 增量组] of Object.entries(值.relationships)) {
        if (!是普通对象(增量组)) continue;
        for (const 维度 of Object.keys(增量组)) {
          if (!关系维度.has(维度)) {
            错误们.push(`effect.relationships.${角色} contains unsupported metric: ${维度}`);
          }
        }
      }
    }
    return 错误们;
  }

  if (类型 !== 'condition') return [`unknown mechanic type: ${类型}`];
  for (const 字段 of ['minRelationship', 'minGlobal', 'maxGlobal']) {
    if (!(字段 in 值)) continue;
    if (!Array.isArray(值[字段])) {
      错误们.push(`condition.${字段} must be an array.`);
      continue;
    }
    const 条目无效 = 值[字段].some((条目) => {
      if (!是普通对象(条目) || !Number.isFinite(条目.value)) return true;
      if (字段 === 'minRelationship') {
        return !条目.character?.trim?.() || !关系维度.has(条目.metric);
      }
      return !条目.key?.trim?.();
    });
    if (条目无效) 错误们.push(`condition.${字段} contains an invalid threshold entry.`);
  }
  if ('relationships' in 值 && 值.relationships !== undefined && !是普通对象(值.relationships)) {
    错误们.push('condition.relationships must be a JSON object.');
  }
  return 错误们;
}

// 输入(节点表, 起始id) → 从起点沿所有 choice.next 广度优先走一遍 → 吐出能走到的节点 id 集合
export function 可达节点集(节点表, 起始id) {
  const 走到过 = new Set();
  const 队列 = [起始id];
  while (队列.length > 0) {
    const 当前 = 队列.shift();
    if (!当前 || 走到过.has(当前) || !节点表[当前]) continue;
    走到过.add(当前);
    for (const 选择 of 节点表[当前].choices ?? []) {
      if (选择.next && 节点表[选择.next] && !走到过.has(选择.next)) 队列.push(选择.next);
    }
  }
  return 走到过;
}

// 从所有结局沿反向边回溯：集合里的每个节点都至少存在一条路线能走到某个结局。
// 正向自循环/陷阱环不会被回溯到，因此可用它和“从起点可达”集合做交集检查。
export function 可到达结局的节点集(节点表) {
  const 反向边 = new Map(Object.keys(节点表).map((id) => [id, []]));
  for (const [来源id, 节点] of Object.entries(节点表)) {
    for (const 选择 of 节点.choices ?? []) {
      if (选择.next && 反向边.has(选择.next)) 反向边.get(选择.next).push(来源id);
    }
  }
  const 能到结局 = new Set();
  const 队列 = Object.entries(节点表).filter(([, 节点]) => !!节点.ending).map(([id]) => id);
  while (队列.length > 0) {
    const 当前 = 队列.shift();
    if (!当前 || 能到结局.has(当前)) continue;
    能到结局.add(当前);
    for (const 前驱 of 反向边.get(当前) ?? []) if (!能到结局.has(前驱)) 队列.push(前驱);
  }
  return 能到结局;
}

// 输入完整项目对象 → 逐条跑规则 → 吐出 { errors: [...], warnings: [...] }(英文文案原样保留)
export function 运行校验(项目) {
  const 结果 = { errors: [], warnings: [] };
  const 剧情 = 项目.story;
  const 节点表 = 剧情?.nodes ?? {};
  const 节点id们 = Object.keys(节点表);

  // 规则1：story 基本骨架不齐 → 直接判死刑返回
  if (!剧情 || !剧情.nodes || typeof 剧情.startNodeId !== 'string' || !剧情.startNodeId) {
    结果.errors.push('story.json must contain nodes and a non-empty startNodeId.');
    return 结果;
  }
  const 阵容 = 校验角色阵容(剧情.cast);
  结果.errors.push(...阵容.errors);
  // 规则2：起点指向不存在的节点
  if (!节点表[剧情.startNodeId]) {
    结果.errors.push(`startNodeId points to missing node: ${剧情.startNodeId}`);
  }
  // 规则3：从起点走不到的节点，一个一个点名(结局可达性包含在内)
  const 可达 = 可达节点集(节点表, 剧情.startNodeId);
  for (const id of 节点id们) {
    if (!可达.has(id)) 结果.errors.push(`node ${id} is not reachable from startNodeId.`);
  }
  const 结局节点们 = 节点id们.filter((id) => !!节点表[id]?.ending);
  if (结局节点们.length === 0) {
    结果.errors.push('story must contain at least one ending node.');
  }
  const 能到结局 = 可到达结局的节点集(节点表);
  for (const id of 可达) {
    if (!节点表[id]?.ending && !能到结局.has(id)) {
      结果.errors.push(`node ${id} cannot reach any ending (trap cycle or dead route).`);
    }
  }

  // 逐节点体检；顺便统计全剧重复对白(同一句话出现太多次说明剧本在偷懒)
  const 对白出现处 = new Map();
  for (const [键名, 节点] of Object.entries(节点表)) {
    const 前缀 = `node ${键名}`;
    if (节点.id !== 键名) 结果.errors.push(`${前缀} has mismatched id: ${节点.id}`);
    if (!节点.title?.trim()) 结果.errors.push(`${前缀} is missing title.`);
    if (!节点.panorama?.trim()) 结果.warnings.push(`${前缀} has no image or video visual yet.`);
    // 死路：既不是结局又没有任何选择，玩家进来就出不去了
    if (!节点.ending && (节点.choices?.length ?? 0) === 0) {
      结果.errors.push(`${前缀} has no choices and no ending.`);
    }
    if ((节点.choices?.length ?? 0) > 4) {
      结果.warnings.push(`${前缀} has ${节点.choices?.length ?? 0} choices; MVP target is 4 or fewer.`);
    }
    // 对白：说话人和台词都不能空
    for (const [序, 句] of (节点.lines ?? []).entries()) {
      const 台词 = 句.text?.trim() ?? '';
      if (!句.speaker?.trim()) 结果.errors.push(`${前缀} line ${序 + 1} is missing speaker.`);
      if (
        阵容.enabled &&
        句.speaker?.trim() &&
        !系统说话人.has(句.speaker.trim()) &&
        !阵容.characterIds.has(句.speaker.trim())
      ) {
        结果.errors.push(`${前缀} line ${序 + 1} references undeclared cast speaker: ${句.speaker.trim()}`);
      }
      if (!台词) {
        结果.errors.push(`${前缀} line ${序 + 1} is missing text.`);
      } else {
        const 位置们 = 对白出现处.get(台词) ?? [];
        位置们.push(`${键名} line ${序 + 1}`);
        对白出现处.set(台词, 位置们);
      }
    }
    // 逐条选择：id、label、去向、命运机制都要可用。
    // choice id 会进入因果回放日志，同一节点重名会让两次选择无法区分。
    const 选择id集 = new Set();
    for (const [序, 选择] of (节点.choices ?? []).entries()) {
      const 选择前缀 = `${前缀} choice ${选择.id || 序 + 1}`;
      const 选择id = typeof 选择.id === 'string' ? 选择.id.trim() : '';
      if (!选择id) {
        结果.errors.push(`${前缀} choice ${序 + 1} is missing id.`);
      } else if (选择id集.has(选择id)) {
        结果.errors.push(`${前缀} has duplicate choice id: ${选择id}`);
      } else {
        选择id集.add(选择id);
      }
      if (!选择.label?.trim()) 结果.errors.push(`${选择前缀} is missing label.`);
      if (!选择.next?.trim() || !节点表[选择.next]) {
        结果.errors.push(`${选择前缀} points to missing node: ${选择.next || 'missing'}`);
      }
      if (!节点.ending && !选择.fateType) 结果.errors.push(`${选择前缀} is missing fateType.`);
      if (!节点.ending && !选择.consequence?.trim()) 结果.errors.push(`${选择前缀} is missing consequence.`);
      if (!节点.ending && 选择.effect === undefined) 结果.errors.push(`${选择前缀} is missing effect.`);
      for (const 错误 of 校验选择机制结构(选择.effect, 'effect')) 结果.errors.push(`${选择前缀} ${错误}`);
      for (const 错误 of 校验选择机制结构(选择.condition, 'condition')) 结果.errors.push(`${选择前缀} ${错误}`);
      for (const 错误 of 校验机制引用(选择.effect, 'effect', 阵容)) 结果.errors.push(`${选择前缀} ${错误}`);
      for (const 错误 of 校验机制引用(选择.condition, 'condition', 阵容)) 结果.errors.push(`${选择前缀} ${错误}`);
    }
    for (const [序, 热点] of (节点.hotspots ?? []).entries()) {
      for (const 错误 of 校验选择机制结构(热点.effect, 'effect')) {
        结果.errors.push(`${前缀} hotspot ${热点.id || 序 + 1} ${错误}`);
      }
      for (const 错误 of 校验机制引用(热点.effect, 'effect', 阵容)) {
        结果.errors.push(`${前缀} hotspot ${热点.id || 序 + 1} ${错误}`);
      }
    }
  }
  // 全剧重复对白：长句(>10字)出现超过2次算错误
  for (const [台词, 位置们] of 对白出现处.entries()) {
    if (台词.length > 10 && 位置们.length > 2) {
      结果.errors.push(`dialogue text repeats ${位置们.length} times across story: ${台词}`);
    }
  }

  // 提示词清单体检
  const 提示词id集 = new Set((项目.prompts?.prompts ?? []).map((条) => 条.id));
  const 有提示词的节点 = new Set((项目.prompts?.prompts ?? []).map((条) => 条.nodeId));
  for (const id of 节点id们) {
    if (!有提示词的节点.has(id)) 结果.warnings.push(`node ${id} has no panorama prompt entry.`);
  }
  for (const 条 of 项目.prompts?.prompts ?? []) {
    if (!节点表[条.nodeId]) 结果.errors.push(`prompt ${条.id} points to missing node: ${条.nodeId}`);
    if (!条.targetFile?.trim()) 结果.errors.push(`prompt ${条.id} is missing targetFile.`);
    if (!条.prompt?.includes(全景基线)) 结果.errors.push(`prompt ${条.id} is missing required panorama baseline.`);
    if (!条.negativePrompt?.trim()) 结果.warnings.push(`prompt ${条.id} is missing negativePrompt.`);
  }

  // 资产清单体检
  for (const 资产 of 项目.manifest?.assets ?? []) {
    const 资产前缀 = `asset ${资产.id || 'missing-id'}`;
    if (!资产.id?.trim()) 结果.errors.push('An asset entry is missing id.');
    if (资产.type !== 'panorama-image' && 资产.type !== 'panorama-video') {
      结果.errors.push(`${资产前缀} has invalid type: ${资产.type}`);
    }
    if (!资产.targetPath?.startsWith('public/panoramas/')) {
      结果.errors.push(`${资产前缀} targetPath must start with public/panoramas/.`);
    }
    if (!资产.promptId || !提示词id集.has(资产.promptId)) {
      结果.errors.push(`${资产前缀} points to missing prompt: ${资产.promptId || 'missing'}`);
    }
    if (!Array.isArray(资产.usedByNodes) || 资产.usedByNodes.length === 0) {
      结果.errors.push(`${资产前缀} must list usedByNodes.`);
    } else {
      for (const 节点id of 资产.usedByNodes) {
        if (!节点表[节点id]) 结果.errors.push(`${资产前缀} is used by missing node: ${节点id}`);
      }
    }
  }
  const 创作资产报告 = 校验创作资产(项目);
  结果.errors.push(...创作资产报告.errors);
  结果.warnings.push(...创作资产报告.warnings);
  return 结果;
}

// 输入(slug, 校验结果) → 拼一份 Markdown 体检报告 → 吐出字符串(格式与线上逐行一致)
// 底部就绪状态条会用正则从这份文本里反解错误/警告数，所以 "Errors:"/"Warnings:" 字样不能动。
export function 生成QA报告(slug, 结果) {
  const 行们 = [
    '# Interactive Cinema Game QA Report',
    '',
    `Package: browser-local/${slug}`,
    '',
    `Errors: ${结果.errors.length}`,
    `Warnings: ${结果.warnings.length}`,
    '',
  ];
  if (结果.errors.length > 0) 行们.push('## Errors', '', ...结果.errors.map((条) => `- ${条}`), '');
  if (结果.warnings.length > 0) 行们.push('## Warnings', '', ...结果.warnings.map((条) => `- ${条}`), '');
  if (结果.errors.length === 0 && 结果.warnings.length === 0) 行们.push('No issues found.', '');
  return `${行们.join('\n')}\n`;
}

// 输入 QA 报告文本 → 用正则抠出错误/警告数字 → 吐出 { errors, warnings }
// 为什么用正则不用结构化数据：线上 qaReport 就是一个 Markdown 字符串(Agent 也可能写入中文报告)，
// 所以中英文两种写法都要认。
export function 解析QA报告(报告) {
  const 错误匹配 = 报告?.match(/Errors?:\s*(\d+)/i) ?? 报告?.match(/错误[:：]?\s*(\d+)/);
  const 警告匹配 = 报告?.match(/Warnings?:\s*(\d+)/i) ?? 报告?.match(/警告[:：]?\s*(\d+)/);
  return {
    errors: Number(错误匹配?.[1] ?? 0) || 0,
    warnings: Number(警告匹配?.[1] ?? 0) || 0,
    recognized: !!(错误匹配 && 警告匹配),
  };
}

// 计数用于底部状态条，完整明细则供 Level 7 QA 抽屉展示和定位。
// 只解析本模块生成的 Markdown 列表；未知格式仍保留 recognized=false，避免伪造“没有问题”。
export function 解析QA明细(报告) {
  const 计数 = 解析QA报告(报告);
  const 结果 = {
    recognized: 计数.recognized,
    errorCount: 计数.errors,
    warningCount: 计数.warnings,
    errors: [],
    warnings: [],
  };
  if (typeof 报告 !== 'string' || !计数.recognized) return 结果;
  let 分区 = '';
  for (const 原行 of 报告.split(/\r?\n/u)) {
    const 行 = 原行.trim();
    if (/^##\s+Errors\s*$/iu.test(行)) {
      分区 = 'errors';
      continue;
    }
    if (/^##\s+Warnings\s*$/iu.test(行)) {
      分区 = 'warnings';
      continue;
    }
    if (/^##\s+/u.test(行)) {
      分区 = '';
      continue;
    }
    const 条目 = 行.match(/^-\s+(.+)$/u)?.[1]?.trim();
    if (条目 && (分区 === 'errors' || 分区 === 'warnings')) 结果[分区].push(条目);
  }
  return 结果;
}
