import assert from 'node:assert/strict';

class 本机存储模拟 {
  constructor() {
    this.数据 = new Map();
    this.下次写失败键 = '';
  }

  getItem(键) {
    return this.数据.has(键) ? this.数据.get(键) : null;
  }

  setItem(键, 值) {
    if (this.下次写失败键 === 键) {
      this.下次写失败键 = '';
      const 错误 = new Error('mock write failure');
      错误.name = 'SecurityError';
      throw 错误;
    }
    this.数据.set(键, String(值));
  }

  removeItem(键) {
    this.数据.delete(键);
  }

  clear() {
    this.数据.clear();
    this.下次写失败键 = '';
  }
}

const 存储 = new 本机存储模拟();
globalThis.window = { localStorage: 存储 };

const {
  项目存储键,
  设置存储键,
  精选存储键,
  语音已就绪,
  重算摘要,
  新建本机项目,
  保存本机项目,
  删除本机项目,
  读本机项目,
  读浏览器设置,
  写浏览器设置,
  补正健康状态,
} = await import('./项目管理/本机项目存储.js');
const { 运行校验 } = await import('./校验发布/校验规则.js');
const { 新增节点, 拖拽重排 } = await import('./节点编辑/图操作.js');

// Level 5 安全迁移：旧浏览器密钥必须自动删除，且任何写入都不能再把 secret/token 存回 localStorage。
存储.setItem(设置存储键, JSON.stringify({
  DEEPSEEK_API_KEY: 'legacy-secret',
  YUNWU_API_KEY: 'legacy-image-secret',
  MINIMAX_API_KEY: 'legacy-voice-secret',
  DEEPSEEK_MODEL: 'safe-display-model',
  UNKNOWN_TOKEN: 'must-remove',
}));
assert.deepEqual(读浏览器设置(), { DEEPSEEK_MODEL: 'safe-display-model' });
assert.deepEqual(JSON.parse(存储.getItem(设置存储键)), { DEEPSEEK_MODEL: 'safe-display-model' });
写浏览器设置({ DEEPSEEK_API_KEY: 'new-secret', IMAGE_MODEL: 'safe-image-label', AUTH_TOKEN: 'bad' });
assert.deepEqual(JSON.parse(存储.getItem(设置存储键)), { IMAGE_MODEL: 'safe-image-label' });
const 未连接健康 = 补正健康状态({
  deepseekConfigured: false,
  imageConfigured: false,
  ttsConfigured: false,
  musicConfigured: false,
  imageModel: '',
});
assert.equal(未连接健康.deepseekConfigured, false, '浏览器偏好不得伪造 Agent 在线');
assert.equal(未连接健康.imageConfigured, false, '浏览器偏好不得伪造图片服务在线');
assert.equal(未连接健康.imageModel, 'safe-image-label', '非敏感显示偏好仍可兼容保留');
存储.clear();

// 语音：明确非 ready 的新状态不能被残留 voiceSrc 误计；无状态旧数据仍兼容。
assert.equal(语音已就绪({ voiceStatus: 'ready' }), true);
assert.equal(语音已就绪({ voiceSrc: '/legacy.mp3' }), true);
for (const 状态 of ['stale', 'failed', 'pending']) {
  assert.equal(语音已就绪({ voiceStatus: 状态, voiceSrc: '/old.mp3' }), false, `${状态} 不应算 ready`);
}

// 图片：按场景视觉覆盖统计；空 panorama + 空 manifest 必须是 0/1，不是“0/0 完整”。
const 空项目 = 新建本机项目('空项目', 'empty-project');
assert.equal(空项目.summary.visualSceneCount, 1);
assert.equal(空项目.summary.visualReadyCount, 0);
assert.equal(空项目.story.cast.protagonist.id, 'you');
assert.equal(空项目.story.cast.protagonist.pronouns, '她');
assert.deepEqual(空项目.story.cast.characters, []);
const 视觉摘要 = 重算摘要({
  story: {
    nodes: {
      direct: { id: 'direct', panorama: '/panoramas/direct.webp', lines: [], choices: [] },
      bound: { id: 'bound', panorama: '', lines: [], choices: [] },
      pending: { id: 'pending', panorama: '', lines: [], choices: [] },
    },
  },
  manifest: {
    assets: [
      { id: 'bound-asset', status: 'generated-image', targetPath: 'public/panoramas/bound.webp', usedByNodes: ['bound'] },
      { id: 'pending-asset', status: 'pending', previewUrl: '/panoramas/old.webp', usedByNodes: ['pending'] },
    ],
  },
});
assert.equal(视觉摘要.visualSceneCount, 3);
assert.equal(视觉摘要.visualReadyCount, 2);

// 新增节点没有真实资产时必须保留空画面，并继续被摘要与校验识别为缺图。
const 新增结果 = 新增节点(
  {
    startNodeId: 'end',
    nodes: {
      end: { id: 'end', title: '已有结局', panorama: '/panoramas/end.webp', lines: [], choices: [], ending: { title: '结局' } },
    },
  },
  'end'
);
const 新节点 = 新增结果.story.nodes[新增结果.nodeId];
assert.equal(新节点.panorama, '');
assert.equal(
  重算摘要({ story: 新增结果.story, manifest: { assets: [] } }).visualReadyCount,
  1,
  '新增空画面节点不得抬高视觉就绪数'
);
assert.ok(
  运行校验({ story: 新增结果.story, prompts: { prompts: [] }, manifest: { assets: [] } }).warnings.some(
    (条) => 条 === `node ${新增结果.nodeId} has no image or video visual yet.`
  )
);

// 排序只是创作台视图操作，不得暗改剧情起点或任何选择连线。
const 排序前剧情 = {
  startNodeId: 'start',
  nodes: {
    start: { id: 'start', choices: [{ id: 'to-branch', next: 'branch' }] },
    branch: { id: 'branch', choices: [{ id: 'to-end', next: 'end' }] },
    end: { id: 'end', choices: [], ending: { title: '完成' } },
  },
};
const 排序后剧情 = 拖拽重排(排序前剧情, 'end', 0);
assert.deepEqual(Object.keys(排序后剧情.nodes), ['end', 'start', 'branch']);
assert.equal(排序后剧情.startNodeId, 'start');
assert.equal(排序后剧情.nodes.start.choices[0].next, 'branch');
assert.equal(排序后剧情.nodes.branch.choices[0].next, 'end');

// 能通过 JSON.parse 的对象也可能有错误嵌套类型；QA 必须在发布前明确拦住。
const 畸形机制报告 = 运行校验({
  story: {
    startNodeId: 'start',
    nodes: {
      start: {
        id: 'start',
        title: '入口',
        panorama: '/panoramas/start.webp',
        lines: [],
        choices: [
          {
            id: 'bad-shape',
            label: '继续',
            next: 'end',
            fateType: 'river',
            consequence: '继续',
            effect: { flags: {}, route: 42 },
            condition: { minGlobal: {}, route: [] },
          },
        ],
      },
      end: {
        id: 'end',
        title: '结局',
        panorama: '/panoramas/end.webp',
        lines: [],
        choices: [],
        ending: { title: '完成' },
      },
    },
  },
  prompts: { prompts: [] },
  manifest: { assets: [] },
});
assert.ok(畸形机制报告.errors.some((条) => 条.includes('effect.flags must be an array')));
assert.ok(畸形机制报告.errors.some((条) => 条.includes('condition.minGlobal must be an array')));
assert.ok(畸形机制报告.errors.some((条) => 条.includes('effect.route must be null or a non-empty string')));
assert.ok(畸形机制报告.errors.some((条) => 条.includes('condition.route must be null or a non-empty string')));

// 删除：精选清理失败时项目表必须补偿回滚；成功时两个键一起移除目标 slug。
存储.clear();
保存本机项目(新建本机项目('项目 A', 'project-a'));
保存本机项目(新建本机项目('项目 B', 'project-b'));
存储.setItem(
  精选存储键,
  JSON.stringify({
    default: 'project-a',
    featured: ['project-a', 'project-b'],
    entries: [
      { slug: 'project-a', title: '项目 A' },
      { slug: 'project-b', title: '项目 B' },
    ],
  })
);
const 删除前项目文本 = 存储.getItem(项目存储键);
const 删除前精选文本 = 存储.getItem(精选存储键);
存储.下次写失败键 = 精选存储键;
assert.throws(() => 删除本机项目('project-a'), /清理已删除项目的精选卡片失败/);
assert.equal(存储.getItem(项目存储键), 删除前项目文本, '精选失败后应恢复项目表');
assert.equal(存储.getItem(精选存储键), 删除前精选文本, '失败写不得改变精选');
删除本机项目('project-a');
assert.equal(读本机项目('project-a'), null);
assert.ok(读本机项目('project-b'));
const 删除后精选 = JSON.parse(存储.getItem(精选存储键));
assert.deepEqual(删除后精选.featured, ['project-b']);
assert.deepEqual(删除后精选.entries.map((项) => 项.slug), ['project-b']);
assert.equal(删除后精选.default, 'project-b');

function 校验故事(nodes, startNodeId = 'start', storyExtra = {}) {
  return 运行校验({
    slug: 'validation-test',
    story: { ...storyExtra, startNodeId, nodes },
    prompts: { prompts: [] },
    manifest: { assets: [] },
  });
}

// 角色阵容：旧项目不声明 cast 时继续兼容；一旦声明，就严格检查角色与机制引用。
const 最小可结束节点 = {
  start: {
    id: 'start',
    title: '起点',
    panorama: '/panoramas/start.webp',
    lines: [
      { speaker: 'you', text: '我会自己查清真相。' },
      { speaker: 'hua_rongli', text: '那就一起走。' },
    ],
    choices: [
      {
        id: 'finish',
        label: '并肩前行',
        next: 'end',
        fateType: 'river',
        consequence: '你们建立了新的信任。',
        effect: { relationships: { hua_rongli: { trust: 8 } }, route: 'hua_rongli' },
        condition: {
          route: 'hua_rongli',
          minRelationship: [{ character: 'hua_rongli', metric: 'trust', value: 30 }],
        },
      },
    ],
  },
  end: {
    id: 'end',
    title: '结局',
    panorama: '/panoramas/end.webp',
    lines: [],
    choices: [],
    ending: { title: '完成' },
  },
};
const 合法阵容 = {
  protagonist: { id: 'you', name: '沈知意', color: '#d7b6c9' },
  characters: [
    {
      id: 'hua_rongli',
      name: '花容离',
      romanceable: true,
      relationship: { enabled: true, initial: { spark: 25, trust: 30, boundary: 55 } },
    },
  ],
};
const 合法阵容报告 = 校验故事(最小可结束节点, 'start', { cast: 合法阵容 });
assert.equal(
  合法阵容报告.errors.some((条) => /story\.cast|undeclared cast|unsupported metric|relationship-disabled/.test(条)),
  false,
);

const 旧故事报告 = 校验故事(
  {
    ...最小可结束节点,
    start: {
      ...最小可结束节点.start,
      lines: [{ speaker: '旧作品自定义说话人', text: '旧项目不应被 cast 门禁拦住。' }],
      choices: [{ ...最小可结束节点.start.choices[0], effect: { route: 'legacy-route' }, condition: undefined }],
    },
  },
);
assert.equal(旧故事报告.errors.some((条) => 条.includes('undeclared cast')), false);

const 坏阵容报告 = 校验故事(最小可结束节点, 'start', {
  cast: {
    protagonist: { id: 'wrong', name: '' },
    characters: [
      { id: 'Bad ID', name: '非法' },
      { id: 'system', name: '保留角色' },
      {
        id: 'hua_rongli',
        name: '',
        color: 'lavender',
        romanceable: 'true',
        relationship: { initial: { spark: 101, affection: 20 } },
      },
      { id: 'hua_rongli', name: '重复角色' },
    ],
  },
});
for (const 片段 of [
  'protagonist.id must be "you"',
  'protagonist.name must be a non-empty string',
  'has invalid id: Bad ID',
  'has invalid id: system',
  'character hua_rongli is missing name',
  'character hua_rongli.color must be a #RRGGBB color',
  'character hua_rongli.romanceable must be a boolean',
  'relationship.initial.spark must be a number from 0 to 100',
  'relationship.initial contains unsupported metric: affection',
  'duplicate character id: hua_rongli',
]) {
  assert.ok(坏阵容报告.errors.some((条) => 条.includes(片段)), `缺少 cast 错误：${片段}`);
}

const 跨引用节点 = structuredClone(最小可结束节点);
跨引用节点.start.lines.push({ speaker: 'unknown_role', text: '未声明角色。' });
跨引用节点.start.choices[0].effect = {
  relationships: {
    unknown_role: { trust: 1 },
    hua_rongli: { affection: 1 },
  },
  route: 'unknown_route',
};
跨引用节点.start.choices[0].condition = {
  route: 'unknown_route',
  minRelationship: [{ character: 'unknown_role', metric: 'trust', value: 1 }],
};
跨引用节点.start.hotspots = [
  {
    id: 'bad-hotspot',
    effect: { relationships: { unknown_role: { trust: 1 } }, route: 'unknown_route' },
  },
];
const 跨引用报告 = 校验故事(跨引用节点, 'start', { cast: 合法阵容 });
for (const 片段 of [
  'references undeclared cast speaker: unknown_role',
  'effect.relationships references undeclared cast character: unknown_role',
  'effect.relationships.hua_rongli contains unsupported metric: affection',
  'condition.minRelationship references undeclared cast character: unknown_role',
  'effect.route references undeclared cast route: unknown_route',
  'condition.route references undeclared cast route: unknown_route',
]) {
  assert.ok(跨引用报告.errors.some((条) => 条.includes(片段)), `缺少 cast 引用错误：${片段}`);
}

const 禁用阵容 = structuredClone(合法阵容);
禁用阵容.characters[0].relationship.enabled = false;
const 禁用关系报告 = 校验故事(最小可结束节点, 'start', { cast: 禁用阵容 });
assert.ok(禁用关系报告.errors.some((条) => 条.includes('relationship-disabled cast character: hua_rongli')));

// 结局：零结局自循环必须同时报缺结局和陷阱环；带出口的循环可以到达结局。
const 零结局 = 校验故事({
  start: {
    id: 'start',
    title: '循环',
    panorama: '/panoramas/start.webp',
    lines: [],
    choices: [{ id: 'again', label: '继续', next: 'start', fateType: 'river', consequence: '循环', effect: {} }],
  },
});
assert.ok(零结局.errors.includes('story must contain at least one ending node.'));
assert.ok(零结局.errors.some((条) => 条.includes('node start cannot reach any ending')));

const 有出口循环 = 校验故事({
  start: {
    id: 'start',
    title: '起点',
    panorama: '/panoramas/start.webp',
    lines: [],
    choices: [{ id: 'next', label: '前进', next: 'loop', fateType: 'river', consequence: '前进', effect: {} }],
  },
  loop: {
    id: 'loop',
    title: '可退出循环',
    panorama: '/panoramas/loop.webp',
    lines: [],
    choices: [
      { id: 'again', label: '再来', next: 'loop', fateType: 'river', consequence: '循环', effect: {} },
      { id: 'finish', label: '结束', next: 'end', fateType: 'river', consequence: '结束', effect: {} },
    ],
  },
  end: {
    id: 'end',
    title: '结局',
    panorama: '/panoramas/end.webp',
    lines: [],
    choices: [],
    ending: { title: '结局', subtitle: '完成', type: 'growth' },
  },
});
assert.equal(有出口循环.errors.some((条) => 条.includes('cannot reach any ending')), false);
assert.equal(有出口循环.errors.includes('story must contain at least one ending node.'), false);

console.log('创作台定向自测通过：语音、场景覆盖、机制结构、删除回滚、结局与陷阱环。');
