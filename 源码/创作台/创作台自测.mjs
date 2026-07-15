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
  精选存储键,
  语音已就绪,
  重算摘要,
  新建本机项目,
  保存本机项目,
  删除本机项目,
  读本机项目,
} = await import('./项目管理/本机项目存储.js');
const { 运行校验 } = await import('./校验发布/校验规则.js');
const { 新增节点, 拖拽重排 } = await import('./节点编辑/图操作.js');

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
            effect: { flags: {} },
            condition: { minGlobal: {} },
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

function 校验故事(nodes, startNodeId = 'start') {
  return 运行校验({
    slug: 'validation-test',
    story: { startNodeId, nodes },
    prompts: { prompts: [] },
    manifest: { assets: [] },
  });
}

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
