import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

class 本机存储模拟 {
  constructor() {
    this.数据 = new Map();
    this.下次写失败键 = '';
    this.下次读失败键 = '';
    this.下次删失败键 = '';
  }

  getItem(键) {
    if (this.下次读失败键 === 键) {
      this.下次读失败键 = '';
      const 错误 = new Error('mock read failure');
      错误.name = 'SecurityError';
      throw 错误;
    }
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
    if (this.下次删失败键 === 键) {
      this.下次删失败键 = '';
      const 错误 = new Error('mock remove failure');
      错误.name = 'SecurityError';
      throw 错误;
    }
    this.数据.delete(键);
  }

  clear() {
    this.数据.clear();
    this.下次写失败键 = '';
    this.下次读失败键 = '';
    this.下次删失败键 = '';
  }
}

const 存储 = new 本机存储模拟();
globalThis.window = { localStorage: 存储 };

const {
  项目存储键,
  设置存储键,
  精选存储键,
  选中项目键,
  语音已就绪,
  重算摘要,
  归一化项目,
  清洗slug,
  新建本机项目,
  保存本机项目,
  发布本机项目,
  删除本机项目,
  读本机项目,
  读已发布本机项目,
  本机项目列表,
  写精选覆盖,
  读浏览器设置,
  写浏览器设置,
  补正健康状态,
} = await import('./项目管理/本机项目存储.js');
assert.equal(清洗slug('package_work'), 'package_work', '创作台清洗必须保留下划线 canonical slug');
const {
  创作包产品,
  创作包架构版本,
  构建创作包,
  序列化创作包,
  解析创作包,
  读取当前创作包,
  确认导入创作包,
  下载创作包文件,
} = await import('./项目管理/创作包.js');
const { 运行校验, 生成QA报告, 解析QA明细 } = await import('./校验发布/校验规则.js');
const { 新增节点, 拖拽重排 } = await import('./节点编辑/图操作.js');
const { 加载示例项目, 由剧情构造项目 } = await import('./项目管理/示例项目加载.js');
const {
  归一化创作资产,
  构建创作角色列表,
  构建叙事关系图,
  计算创作资产完成度,
  校验创作资产,
  情绪强度文案,
  清理节点创作引用,
} = await import('./女性向资产/创作资产模型.js');

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

// 新项目直接提供可编辑的“开场 + 两项选择 + 两个结局”，同时不伪造视觉覆盖。
const 空项目 = 新建本机项目('空项目', 'empty-project');
assert.equal(空项目.summary.visualSceneCount, 3);
assert.equal(空项目.summary.visualReadyCount, 0);
assert.equal(空项目.story.cast.protagonist.id, 'you');
assert.equal(空项目.story.cast.protagonist.pronouns, '她');
assert.deepEqual(空项目.story.cast.characters, []);
assert.equal(空项目.story.nodes[空项目.story.startNodeId].choices.length, 2);
assert.equal(Object.values(空项目.story.nodes).filter((节点) => !!节点.ending).length, 2);
assert.equal(运行校验(空项目).errors.length, 0, 'Level 7 新模板必须能直接完成最小发布闭环');

// 首页与玩家端只能消费成功发布的冻结快照；后续保存的草稿不得偷换标题或精选卡片。
存储.clear();
const 已发布项目 = 新建本机项目('正式玩家版本', 'published-work');
发布本机项目(已发布项目);
const 后续草稿 = structuredClone(已发布项目);
后续草稿.title = '尚未发布的新标题';
后续草稿.story.title = '尚未发布的新标题';
保存本机项目(后续草稿);
const 未发布项目 = 新建本机项目('仅草稿作品', 'draft-only');
保存本机项目(未发布项目);
assert.equal(读已发布本机项目('published-work').title, '正式玩家版本');
assert.equal(读已发布本机项目('draft-only'), null);
const 发布列表项 = 本机项目列表().find((条) => 条.slug === 'published-work');
assert.deepEqual(
  [发布列表项.hasPublished, 发布列表项.publishedTitle, 发布列表项.publishedNodeCount],
  [true, '正式玩家版本', 3],
);
const 精选结果 = 写精选覆盖({
  default: 'draft-only',
  featured: ['draft-only', 'published-work'],
  entries: [
    { slug: 'draft-only', title: '不应出现的草稿标题', nodeCount: 3, source: 'browser' },
    { slug: 'published-work', title: '候选里的旧标题', nodeCount: 3, source: 'browser' },
  ],
});
assert.deepEqual(精选结果.featured, ['published-work'], '未发布本机草稿不得进入首页精选');
assert.equal(精选结果.default, 'published-work');
assert.equal(精选结果.entries[0].title, '正式玩家版本', '精选卡片必须读取已发布快照而非最新草稿');
const 同名静态回退 = 写精选覆盖({
  default: 'draft-only',
  featured: ['draft-only'],
  entries: [{ slug: 'draft-only', title: '同 slug 正式静态版本', nodeCount: 12, source: 'server' }],
});
assert.equal(同名静态回退.entries[0].title, '同 slug 正式静态版本', '未发布同名草稿不得遮住正式静态作品');

// 写入前读取异常必须 fail closed，不能把“暂时读不到”误判为空仓后覆盖已有玩家版本。
const 读取异常前项目仓 = 存储.getItem(项目存储键);
存储.下次读失败键 = 项目存储键;
assert.throws(
  () => 保存本机项目(新建本机项目('不应写入', 'read-failure-draft')),
  (错) => 错?.name === 'CreatorStorageError' && /读取本机数据/.test(错.message),
);
assert.equal(存储.getItem(项目存储键), 读取异常前项目仓, '读取失败后不得覆盖整仓或已发布快照');

// 未来 authoring 合同可兼容保存草稿，但底层发布 API 也必须保持只读，不依赖 UI 门禁。
const 未来合同 = structuredClone(已发布项目);
未来合同.authoring = { ...未来合同.authoring, schemaVersion: 2, futureField: { keep: true } };
const 未来发布前项目仓 = 存储.getItem(项目存储键);
assert.throws(
  () => 发布本机项目(未来合同),
  (错) => 错?.name === 'CreatorPublishCompatibilityError' && /只能只读保留/.test(错.message),
);
assert.equal(存储.getItem(项目存储键), 未来发布前项目仓, '未来作者合同不得绕过底层边界覆盖玩家版本');

// Level 9 创作包：v1 必须完整携带草稿、发布快照、精选和选中项；解析阶段绝不触碰存储。
const 创作包时间 = '2026-07-17T08:00:00.000Z';
const 创作包项目 = 新建本机项目('跨域迁移作品', 'package-work');
const 合法创作包 = 构建创作包({
  projects: {
    'package-work': {
      project: 创作包项目,
      publishedProject: structuredClone(创作包项目),
      updatedAt: 1_752_739_200_000,
      publishedAt: 1_752_739_100_000,
    },
  },
  showcase: {
    default: 'package-work',
    featured: ['package-work'],
    entries: [{ slug: 'package-work', title: '跨域迁移作品', tagline: '完整创作包' }],
  },
  selectedSlug: 'package-work',
  exportedAt: 创作包时间,
});
assert.equal(合法创作包.product, 创作包产品);
assert.equal(合法创作包.schemaVersion, 创作包架构版本);
assert.ok(合法创作包.projects['package-work'].publishedProject, 'v1 包必须包含已发布冻结快照');
assert.deepEqual(合法创作包.showcase.featured, ['package-work']);
assert.equal(合法创作包.selectedSlug, 'package-work');
const 合法预检 = 解析创作包(序列化创作包(合法创作包));
assert.deepEqual(
  [合法预检.摘要.projectCount, 合法预检.摘要.draftCount, 合法预检.摘要.publishedCount, 合法预检.摘要.featuredCount],
  [1, 1, 1, 1],
);
const 下划线创作包 = structuredClone(合法创作包);
const 下划线条目 = 下划线创作包.projects['package-work'];
delete 下划线创作包.projects['package-work'];
下划线条目.project.slug = 'package_work';
下划线条目.publishedProject.slug = 'package_work';
下划线创作包.projects.package_work = 下划线条目;
下划线创作包.showcase.default = 'package_work';
下划线创作包.showcase.featured = ['package_work'];
下划线创作包.showcase.entries[0].slug = 'package_work';
下划线创作包.selectedSlug = 'package_work';
const 下划线预检 = 解析创作包(JSON.stringify(下划线创作包));
assert.equal(下划线预检.创作包.projects.package_work.project.slug, 'package_work', 'canonical slug 必须允许下划线');
存储.下次读失败键 = 项目存储键;
assert.equal(解析创作包(JSON.stringify(合法创作包)).摘要.projectCount, 1, 'dry-run 不得读取 localStorage');
assert.equal(存储.下次读失败键, 项目存储键, '纯解析不能消耗存储读取失败桩');
存储.下次读失败键 = '';

function 断言创作包拒绝(改法, 代码, 文案) {
  const 候选 = structuredClone(合法创作包);
  改法(候选);
  assert.throws(
    () => 解析创作包(JSON.stringify(候选)),
    (错) => 错?.name === 'CreatorPackageError' && 错?.code === 代码,
    文案,
  );
}

assert.throws(
  () => 解析创作包('{broken-json'),
  (错) => 错?.name === 'CreatorPackageError' && 错?.code === 'invalid-json',
  '坏 JSON 必须在 dry-run 阶段拒绝',
);
断言创作包拒绝((包) => { 包.product = 'another-product'; }, 'wrong-product', '其他产品包必须拒绝');
断言创作包拒绝((包) => { 包.schemaVersion = 2; }, 'future-schema-version', '未来包版本必须拒绝');
断言创作包拒绝((包) => { 包.exportedAt = 'not-a-time'; }, 'invalid-time', '非法导出时间必须拒绝');
断言创作包拒绝((包) => {
  const 条目 = 包.projects['package-work'];
  delete 包.projects['package-work'];
  条目.project.slug = 'Bad Slug';
  条目.publishedProject.slug = 'Bad Slug';
  包.projects['Bad Slug'] = 条目;
}, 'invalid-slug', '非法项目表 slug 必须拒绝');
断言创作包拒绝((包) => { 包.projects['package-work'].project.slug = 'another-work'; }, 'slug-mismatch', '草稿 slug 错配必须拒绝');
断言创作包拒绝((包) => { 包.projects['package-work'].publishedProject.slug = 'another-work'; }, 'slug-mismatch', '发布快照 slug 错配必须拒绝');
断言创作包拒绝((包) => { 包.projects['package-work'].updatedAt = '昨天'; }, 'invalid-time', '非法草稿时间必须拒绝');
断言创作包拒绝((包) => { 包.projects['package-work'].publishedAt = -1; }, 'invalid-time', '非法发布时间必须拒绝');
断言创作包拒绝((包) => { 包.projects['package-work'].project.authoring = { schemaVersion: 2, future: true }; }, 'future-authoring-version', '未来草稿作者合同必须拒绝');
断言创作包拒绝((包) => { 包.projects['package-work'].publishedProject.authoring = { schemaVersion: 2, future: true }; }, 'future-authoring-version', '未来发布作者合同必须拒绝');
断言创作包拒绝((包) => { 包.projects['package-work'].publishedProject.story.startNodeId = 'missing-node'; }, 'published-validation-error', '发布快照有 QA error 必须拒绝');
断言创作包拒绝((包) => { 包.selectedSlug = '../bad'; }, 'invalid-slug', '非法选中 slug 必须拒绝');
断言创作包拒绝((包) => { 包.showcase.entries = []; }, 'invalid-showcase', '精选缺失对应卡片必须拒绝');

const 旧仓项目 = 新建本机项目('导入前作品', 'before-import');
const 导入前包 = 构建创作包({
  projects: {
    'before-import': {
      project: 旧仓项目,
      publishedProject: structuredClone(旧仓项目),
      updatedAt: 1_752_739_000_000,
      publishedAt: 1_752_739_000_000,
    },
  },
  showcase: {
    default: 'before-import',
    featured: ['before-import'],
    entries: [{ slug: 'before-import', title: '导入前作品' }],
  },
  selectedSlug: 'before-import',
  exportedAt: '2026-07-17T07:00:00.000Z',
});

function 写入包到模拟仓(创作包) {
  存储.setItem(项目存储键, JSON.stringify(创作包.projects));
  存储.setItem(精选存储键, JSON.stringify(创作包.showcase));
  if (创作包.selectedSlug == null) 存储.removeItem(选中项目键);
  else 存储.setItem(选中项目键, 创作包.selectedSlug);
}

function 读取三键原文() {
  return {
    [项目存储键]: 存储.getItem(项目存储键),
    [精选存储键]: 存储.getItem(精选存储键),
    [选中项目键]: 存储.getItem(选中项目键),
  };
}

// 导出/覆盖前备份必须先逐字带走当前仓，即使其中有只读保留的未来作者合同；
// 这份文件再次导入当前旧版本时仍应被严格 dry-run 拒绝。
存储.clear();
const 未来当前仓 = structuredClone(导入前包);
未来当前仓.projects['before-import'].project.authoring = { schemaVersion: 2, futureField: { keep: true } };
写入包到模拟仓(未来当前仓);
const 未来仓导出 = 读取当前创作包({ 存储, exportedAt: '2026-07-17T08:30:00.000Z' });
assert.equal(未来仓导出.创作包.projects['before-import'].project.authoring.futureField.keep, true);
assert.throws(
  () => 解析创作包(未来仓导出.文本),
  (错) => 错?.code === 'future-authoring-version',
  '备份可保留未来合同，但当前版本仍不得把它当作可写入包',
);

存储.clear();
写入包到模拟仓(导入前包);
const 成功导入前原文 = 读取三键原文();
let 备份回调次数 = 0;
const 成功导入 = 确认导入创作包(合法创作包, {
  存储,
  备份时间: '2026-07-17T09:00:00.000Z',
  on备份: (备份) => {
    备份回调次数 += 1;
    assert.deepEqual(读取三键原文(), 成功导入前原文, '备份回调必须发生在第一笔写入之前');
    assert.equal(备份.创作包.projects['before-import'].publishedProject.slug, 'before-import');
    assert.match(备份.文本, /"product": "yanjing-ai-game-creator"/);
  },
});
assert.equal(备份回调次数, 1);
assert.equal(成功导入.摘要.publishedCount, 1);
assert.deepEqual(JSON.parse(存储.getItem(项目存储键)), 合法创作包.projects);
assert.deepEqual(JSON.parse(存储.getItem(精选存储键)), 合法创作包.showcase);
assert.equal(存储.getItem(选中项目键), 'package-work');
const 当前仓导出 = 读取当前创作包({ 存储, exportedAt: '2026-07-17T10:00:00.000Z' });
assert.equal(当前仓导出.创作包.product, 创作包产品);
assert.equal(当前仓导出.摘要.projectCount, 1);
assert.equal(当前仓导出.创作包.projects['package-work'].publishedProject.slug, 'package-work');
const 下划线导入 = 确认导入创作包(下划线预检.创作包, { 存储 });
assert.equal(下划线导入.摘要.projectCount, 1);
assert.equal(JSON.parse(存储.getItem(项目存储键)).package_work.project.slug, 'package_work');
assert.equal(存储.getItem(选中项目键), 'package_work', '含下划线的 canonical slug 必须能完成事务导入');

// 下载必须走 Blob/Object URL 临时链接，且创建后立即撤销 URL。
let 下载Blob = null;
let 下载地址 = '';
let 下载文件名 = '';
let 下载已点击 = false;
let 下载链接已移除 = false;
let 下载地址已撤销 = false;
class Blob模拟 {
  constructor(片段, 选项) {
    this.片段 = 片段;
    this.type = 选项.type;
  }
}
const 下载链接 = {
  hidden: false,
  click() { 下载已点击 = true; },
  remove() { 下载链接已移除 = true; },
};
下载创作包文件('{"ok":true}', 'package.json', {
  Blob构造器: Blob模拟,
  URL接口: {
    createObjectURL(Blob值) { 下载Blob = Blob值; 下载地址 = 'blob:creator-package'; return 下载地址; },
    revokeObjectURL(地址) { 下载地址已撤销 = 地址 === 下载地址; },
  },
  文档: {
    createElement(标签) { assert.equal(标签, 'a'); return 下载链接; },
    body: { appendChild(链接) { 下载文件名 = 链接.download; } },
  },
});
assert.deepEqual(下载Blob.片段, ['{"ok":true}']);
assert.equal(下载Blob.type, 'application/json;charset=utf-8');
assert.equal(下载文件名, 'package.json');
assert.equal(下载链接.href, 'blob:creator-package');
assert.equal(下载已点击 && 下载链接已移除 && 下载地址已撤销, true);
const [创作包模块源码, 创作台应用源码, 导入弹窗源码] = await Promise.all([
  readFile(new URL('./项目管理/创作包.js', import.meta.url), 'utf8'),
  readFile(new URL('./创作台应用.jsx', import.meta.url), 'utf8'),
  readFile(new URL('./项目管理/创作包导入弹窗.jsx', import.meta.url), 'utf8'),
]);
assert.match(创作包模块源码, /createObjectURL/);
assert.match(创作包模块源码, /revokeObjectURL/);
assert.doesNotMatch(创作包模块源码, /\bfetch\s*\(/, '创作包实现不得上传或请求网络');
assert.match(创作台应用源码, /accept="application\/json,\.json"/, '创作台必须提供 JSON 文件选择');
assert.match(创作台应用源码, /完整创作包已下载/);
assert.match(导入弹窗源码, /整体覆盖当前浏览器中的项目、草稿、玩家版本、精选与选中项/);
assert.match(导入弹窗源码, /先自动下载一份「导入前备份」/);
assert.match(导入弹窗源码, /不会上传到服务器/);

// 任一仓读取失败都必须在写入前终止；任一键写入失败都必须恢复三个键的逐字原值。
for (const 失败键 of [项目存储键, 精选存储键, 选中项目键]) {
  存储.clear();
  写入包到模拟仓(导入前包);
  const 导入前原文 = 读取三键原文();
  存储.下次读失败键 = 失败键;
  assert.throws(
    () => 确认导入创作包(合法创作包, { 存储 }),
    (错) => 错?.name === 'CreatorPackageStorageError' && 错?.code === 'storage-read-failed',
    `${失败键} 读取失败必须 fail closed`,
  );
  assert.deepEqual(读取三键原文(), 导入前原文, `${失败键} 读取失败后不得改变仓`);
}

for (const 失败键 of [项目存储键, 精选存储键, 选中项目键]) {
  存储.clear();
  写入包到模拟仓(导入前包);
  const 导入前原文 = 读取三键原文();
  存储.下次写失败键 = 失败键;
  assert.throws(
    () => 确认导入创作包(合法创作包, { 存储 }),
    (错) => 错?.name === 'CreatorPackageTransactionError' && 错?.code === 'import-write-failed-rolled-back',
    `${失败键} 写入失败必须执行补偿回滚`,
  );
  assert.deepEqual(读取三键原文(), 导入前原文, `${失败键} 写入失败后必须逐字恢复三键`);
}

存储.clear();
写入包到模拟仓(导入前包);
const 删除选中前原文 = 读取三键原文();
const 无选中创作包 = structuredClone(合法创作包);
无选中创作包.selectedSlug = null;
存储.下次删失败键 = 选中项目键;
assert.throws(
  () => 确认导入创作包(无选中创作包, { 存储 }),
  (错) => 错?.name === 'CreatorPackageTransactionError' && 错?.code === 'import-write-failed-rolled-back',
  '删除选中项失败也必须补偿回滚',
);
assert.deepEqual(读取三键原文(), 删除选中前原文);

存储.clear();
写入包到模拟仓(导入前包);
const 备份失败前原文 = 读取三键原文();
assert.throws(
  () => 确认导入创作包(合法创作包, {
    存储,
    on备份: () => { throw new Error('mock backup download failure'); },
  }),
  /mock backup download failure/,
  '备份下载失败时不得开始导入',
);
assert.deepEqual(读取三键原文(), 备份失败前原文, '备份前置步骤失败不得产生任何写入');

存储.clear();
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

// Level 6 女性向创作资产：cast 仍是人物基础信息的唯一权威源，authoring 只存 id 关联的作者注释。
const 女性向资产项目 = {
  slug: 'authoring-contract',
  story: {
    cast: {
      protagonist: {
        id: 'you',
        name: '许澄',
        role: 'AI 直播总导演',
        portrait: '/portraits/xu-cheng.png',
      },
      characters: [
        {
          id: 'lu_chenzhou',
          name: '陆沉舟',
          role: '实时系统架构师',
          romanceable: true,
          relationship: { enabled: true, initial: { spark: 18, trust: 32, boundary: 68 } },
        },
        {
          id: 'lin_miao',
          name: '林渺',
          role: '数据审计师·副导演',
          theme: '证据与姐妹同盟',
          portrait: '/portraits/lin-miao.png',
          romanceable: false,
          relationship: { enabled: false, initial: { spark: 0, trust: 48, boundary: 78 } },
        },
        {
          id: 'qiao_wen',
          name: '乔雯',
          role: '项目出品人',
          romanceable: false,
          relationship: { enabled: false, initial: { spark: 0, trust: 34, boundary: 82 } },
        },
      ],
    },
    startNodeId: 'start',
    nodes: {
      start: {
        id: 'start',
        title: '事故现场',
        lines: [{ speaker: 'lin_miao', text: '我支持你，但结论必须可复核。' }],
        choices: [
          {
            id: 'to-end',
            label: '共同签字',
            next: 'end',
            effect: { relationships: { lu_chenzhou: { trust: 2, boundary: 1 } } },
          },
        ],
      },
      end: { id: 'end', title: '阶段结果', lines: [], choices: [], ending: { title: '完成' } },
    },
  },
  authoring: {
    schemaVersion: 1,
    characterBibles: [
      {
        characterId: 'you',
        desire: '建立可追溯的决策程序',
        fear: '把人简化为指标',
        boundary: '任何人不得代替她同意',
        growth: '从独自承担走向共同负责',
        voice: '句子短，优先使用动词与可验证对象',
        reviewed: true,
      },
      {
        characterId: 'lin_miao',
        desire: '让审计结论可复核',
        fear: '工作再次被当作技术备注',
        boundary: '不为恋爱路线让位',
        growth: '要求审计署名与常设机制',
        voice: '精确、节制，允许干燥幽默',
        reviewed: true,
      },
    ],
    relationshipEdges: [
      {
        id: 'you-lin-alliance',
        from: 'you',
        to: 'lin_miao',
        type: 'ally',
        label: '平级调查同盟',
        dynamic: '支持彼此，也保留纠错权',
        boundary: '证据优先，不要求无条件站队',
        reviewed: true,
      },
    ],
    emotionPoints: [
      { nodeId: 'start', intensity: 72, agency: 88, intimacy: 18, note: '事故压力下由玩家首先冻结外发。', reviewed: true },
    ],
    consistencyRules: [
      {
        id: 'player-agency',
        label: '玩家主导权',
        scope: 'story',
        targetId: '',
        rule: '关键决定必须由玩家执行或明确授权。',
        severity: 'error',
        enabled: true,
        reviewed: true,
      },
    ],
    consistencyAssets: [
      {
        id: 'portrait-you',
        kind: 'portrait-reference',
        title: '许澄角色立绘',
        status: 'approved',
        characterIds: ['you'],
        nodeIds: [],
        sourcePath: '/portraits/xu-cheng.png',
        notes: '以职业操作与目光表现权力位置。',
        reviewed: true,
      },
    ],
  },
  manifest: { assets: [{ id: 'panorama-only', type: 'panorama-image' }] },
};

const 归一化前快照 = structuredClone(女性向资产项目);
const 归一化资产 = 归一化创作资产(女性向资产项目);
assert.deepEqual(女性向资产项目, 归一化前快照, '归一化不得修改输入项目');
assert.deepEqual(Object.keys(归一化资产), [
  'schemaVersion',
  'characterBibles',
  'relationshipEdges',
  'emotionPoints',
  'consistencyRules',
  'consistencyAssets',
]);
assert.equal(归一化资产.schemaVersion, 1);
assert.deepEqual(归一化资产.characterBibles.map((项) => 项.characterId), ['you', 'lu_chenzhou', 'lin_miao', 'qiao_wen']);
assert.equal(归一化资产.characterBibles.find((项) => 项.characterId === 'qiao_wen').reviewed, false);
assert.equal('name' in 归一化资产.characterBibles[0], false, 'authoring 不得复制 cast 姓名');
assert.deepEqual(归一化资产.emotionPoints.map((项) => 项.nodeId), ['start', 'end']);
assert.equal(归一化资产.emotionPoints.find((项) => 项.nodeId === 'end').reviewed, false);
assert.equal(归一化资产.emotionPoints.find((项) => 项.nodeId === 'end').intensity, null);
assert.deepEqual(
  归一化资产.relationshipEdges.filter((项) => 项.id.startsWith('you--')).map((项) => 项.id),
  ['you--lu_chenzhou', 'you--qiao_wen'],
);
assert.equal(归一化资产.relationshipEdges.find((项) => 项.id === 'you--lu_chenzhou').type, 'potential-romance');
assert.equal(归一化资产.relationshipEdges.find((项) => 项.id === 'you-lin-alliance').type, 'ally');
assert.equal(归一化资产.relationshipEdges.find((项) => 项.id === 'you--qiao_wen').type, 'professional');
assert.equal(归一化资产.relationshipEdges.find((项) => 项.id === 'you--qiao_wen').reviewed, false);
assert.equal(归一化资产.relationshipEdges.filter((项) => new Set([项.from, 项.to]).has('lin_miao')).length, 1, '已有角色对不得再生成重复默认边');
assert.deepEqual(归一化资产.consistencyRules.map((项) => 项.id), [
  'player-agency',
  'explicit-consent-boundary',
  'non-romance-equivalence',
  'female-alliance-correction',
]);
assert.equal(归一化资产.consistencyRules.find((项) => 项.id === 'player-agency').reviewed, true, '已有默认规则应保留作者审阅结果');
assert.equal(归一化资产.consistencyRules.find((项) => 项.id === 'player-agency').reviewStatus, 'passed', 'Level 6 reviewed=true 必须兼容迁移为 passed');
assert.equal(归一化资产.consistencyRules.find((项) => 项.id === 'female-alliance-correction').reviewed, false);
assert.equal(归一化资产.consistencyRules.find((项) => 项.id === 'female-alliance-correction').reviewStatus, 'pending');
assert.ok(归一化资产.consistencyAssets.some((项) => 项.id === 'portrait-you' && 项.reviewed));
assert.ok(归一化资产.consistencyAssets.some((项) => 项.id === 'portrait-lin_miao' && !项.reviewed));
assert.deepEqual(女性向资产项目.manifest, 归一化前快照.manifest, '人物一致性引用不得塞进 manifest');

// Level 7 人工规则结论：阻塞规则 pending/failed/无说明 waived 必须阻断；warning 规则只提醒。
const 规则结论项目 = structuredClone(女性向资产项目);
规则结论项目.authoring.consistencyRules = 归一化创作资产(规则结论项目).consistencyRules.map((规则) => ({
  ...规则,
  reviewStatus: 'passed',
  reviewNote: '已逐项核对。',
  reviewed: true,
}));
const 主体性规则 = 规则结论项目.authoring.consistencyRules.find((规则) => 规则.id === 'player-agency');
主体性规则.reviewStatus = 'pending';
主体性规则.reviewed = false;
assert.ok(校验创作资产(规则结论项目).items.some((项) => 项.code === 'consistency-rule-review-pending' && 项.severity === 'error' && 项.targetId === 'player-agency'));
主体性规则.reviewStatus = 'failed';
assert.ok(校验创作资产(规则结论项目).items.some((项) => 项.code === 'consistency-rule-review-failed' && 项.severity === 'error' && 项.targetId === 'player-agency'));
主体性规则.reviewStatus = 'waived';
主体性规则.reviewNote = '';
assert.ok(校验创作资产(规则结论项目).items.some((项) => 项.code === 'consistency-rule-waiver-note-missing' && 项.severity === 'error' && 项.targetId === 'player-agency'));
主体性规则.reviewNote = '当前最小模板不包含该类内容，记录豁免后再发布。';
assert.equal(校验创作资产(规则结论项目).items.some((项) => 项.code === 'consistency-rule-waiver-note-missing' && 项.targetId === 'player-agency'), false);
const 提醒规则 = 规则结论项目.authoring.consistencyRules.find((规则) => 规则.id === 'female-alliance-correction');
提醒规则.reviewStatus = 'failed';
提醒规则.reviewed = true;
assert.ok(校验创作资产(规则结论项目).items.some((项) => 项.code === 'consistency-rule-review-failed' && 项.severity === 'warning' && 项.targetId === 'female-alliance-correction'));

const 非法复核状态项目 = structuredClone(规则结论项目);
非法复核状态项目.authoring.consistencyRules[0].reviewStatus = 'approved-silently';
assert.ok(校验创作资产(非法复核状态项目).items.some((项) => 项.code === 'consistency-rule-review-status-invalid'));

const QA往返结果 = { errors: ['node start has no choices and no ending.'], warnings: ['node start has no image or video visual yet.'] };
const QA明细 = 解析QA明细(生成QA报告('qa-detail', QA往返结果));
assert.deepEqual(QA明细, {
  recognized: true,
  errorCount: 1,
  warningCount: 1,
  errors: QA往返结果.errors,
  warnings: QA往返结果.warnings,
}, 'QA Markdown 必须可恢复为完整错误与警告明细');

const 已审核默认边项目 = structuredClone(女性向资产项目);
已审核默认边项目.authoring.relationshipEdges.push({
  id: 'you--qiao_wen',
  from: 'you',
  to: 'qiao_wen',
  type: 'rival',
  label: '职业权力镜像',
  dynamic: '彼此都要项目活下去，但对责任窗口判断不同。',
  boundary: '不将野心与错误简化为性别刻板印象。',
  reviewed: true,
});
const 保留默认边 = 归一化创作资产(已审核默认边项目).relationshipEdges.filter((项) => 项.id === 'you--qiao_wen');
assert.equal(保留默认边.length, 1);
assert.equal(保留默认边[0].type, 'rival');
assert.equal(保留默认边[0].reviewed, true, '作者已编辑的默认边不得被推导值覆盖');

// 界面模式是独立偏好：即使旧数据误写进 authoring，规范结果也必须丢弃它并报错。
const 误写模式项目 = structuredClone(女性向资产项目);
误写模式项目.authoring.mode = 'professional';
assert.equal('mode' in 归一化创作资产(误写模式项目), false);
assert.ok(校验创作资产(误写模式项目).items.some((项) => 项.code === 'authoring-mode-forbidden'));

const 未来版本项目 = structuredClone(女性向资产项目);
未来版本项目.authoring = {
  ...未来版本项目.authoring,
  schemaVersion: 2,
  futureField: { valuable: true },
  characterBibles: [{ ...未来版本项目.authoring.characterBibles[0], futureNote: '必须保留' }],
};
const 未来作者原文 = structuredClone(未来版本项目.authoring);
const 未来版本规整 = 归一化项目(未来版本项目);
assert.deepEqual(未来版本规整.authoring, 未来作者原文, '未来版本已知数组与未知字段必须逐字保留，不得补默认项或去重');
assert.equal(未来版本规整.authoring.schemaVersion, 2);
assert.deepEqual(未来版本规整.authoring.futureField, { valuable: true });
assert.equal(未来版本规整.authoring.characterBibles[0].futureNote, '必须保留');
assert.ok(校验创作资产(未来版本规整).items.some((项) => 项.code === 'authoring-version-future'));
assert.equal(校验创作资产(未来版本规整).items.some((项) => 项.code === 'authoring-version'), false);
存储.clear();
保存本机项目(未来版本规整);
assert.deepEqual(
  JSON.parse(存储.getItem(项目存储键))[未来版本规整.slug].project.authoring,
  未来作者原文,
  '即使经过本机存储边界，未来作者合同也不得被 v1 逻辑改写',
);
存储.clear();

// 旧项目与畸形 authoring 可安全打开；节点仅生成未审阅、未伪造数值的空情绪点。
const 旧项目 = {
  story: {
    startNodeId: 'legacy-start',
    nodes: { 'legacy-start': { id: 'legacy-start', title: '旧式开场', lines: [], choices: [] } },
  },
};
const 旧资产 = 归一化创作资产(旧项目);
assert.deepEqual(旧资产.characterBibles, []);
assert.deepEqual(旧资产.emotionPoints, [
  { nodeId: 'legacy-start', intensity: null, agency: null, intimacy: null, note: '', reviewed: false },
]);
assert.equal(校验创作资产(旧项目).errors.filter((条) => 条.includes('阻塞规则')).length, 3, '旧作品进入新创作台重发前必须复核三条阻塞规则');
assert.ok(校验创作资产(旧项目).warnings.some((条) => 条.includes('兼容打开')));
assert.doesNotThrow(() => 归一化创作资产({ ...旧项目, authoring: '损坏的旧数据' }));
const 真实旧项目链 = 归一化项目({ ...旧项目, prompts: { prompts: [] }, manifest: { assets: [] } });
assert.equal(
  运行校验(真实旧项目链).errors.some((条) => 条.includes('情绪点')),
  false,
  '归一化生成的 null 情绪草稿不得在真实发布链中变成阻塞错误',
);
const 带旧报告项目 = 归一化项目({ ...旧项目, qaReport: '# QA PASSED · old contract' });
assert.equal(带旧报告项目.qaReport, '', '自动注入 authoring 后必须让旧 QA 报告失效');

// 关系图节点来自全量 cast，relationship.disabled 只禁止数值关系，不得让女性角色消失。
const 创作角色 = 构建创作角色列表(女性向资产项目);
assert.deepEqual(创作角色.map((角色) => 角色.id), ['you', 'lu_chenzhou', 'lin_miao', 'qiao_wen']);
assert.equal(创作角色.find((角色) => 角色.id === 'lin_miao').relationshipEnabled, false);
assert.equal(创作角色.find((角色) => 角色.id === 'qiao_wen').relationshipEnabled, false);
const 叙事关系图 = 构建叙事关系图(女性向资产项目);
assert.deepEqual(叙事关系图.nodes.map((节点) => 节点.id), ['you', 'lu_chenzhou', 'lin_miao', 'qiao_wen']);
assert.equal(叙事关系图.edges[0].valid, true);

const 资产完成度 = 计算创作资产完成度(女性向资产项目);
assert.equal(资产完成度.sections.characterBibles.total, 4);
assert.equal(资产完成度.sections.characterBibles.completed, 2);
assert.equal(资产完成度.sections.emotionPoints.total, 2);
assert.equal(资产完成度.sections.emotionPoints.completed, 1);
assert.ok(资产完成度.percentage > 0 && 资产完成度.percentage < 100);
assert.deepEqual([null, 0, 21, 41, 61, 81].map(情绪强度文案), ['待标注', '平静', '克制', '起伏', '高张力', '峰值']);

// 删除节点必须原子清理所有作者态引用；资源路径若绑定该节点，需要重新人工确认。
const 待清理资产 = structuredClone(女性向资产项目.authoring);
待清理资产.consistencyRules.push({
  id: 'start-only',
  label: '开场专用规则',
  scope: 'node',
  targetId: 'start',
  rule: '开场必须保留玩家冻结外发的动作。',
  severity: 'error',
  enabled: true,
  reviewed: true,
});
待清理资产.consistencyAssets.push({
  id: 'start-board',
  kind: 'location-reference',
  title: '开场分镜',
  status: 'approved',
  characterIds: ['you'],
  nodeIds: ['start', 'end'],
  sourcePath: '/references/start-board.webp',
  notes: '',
  reviewed: true,
});
const 清理后资产 = 清理节点创作引用(待清理资产, 'start');
assert.deepEqual(待清理资产.emotionPoints.map((项) => 项.nodeId), ['start'], '清理函数不得修改输入数据');
assert.equal(清理后资产.emotionPoints.some((项) => 项.nodeId === 'start'), false);
assert.equal(清理后资产.consistencyRules.some((项) => 项.id === 'start-only'), false);
assert.deepEqual(清理后资产.consistencyAssets.find((项) => 项.id === 'start-board').nodeIds, ['end']);
assert.equal(清理后资产.consistencyAssets.find((项) => 项.id === 'start-board').reviewed, false);

// 高确定性一致性问题：孤儿引用、非法数值、affection / 单值好感与危险 URL 都必须可定位。
const 坏创作项目 = structuredClone(女性向资产项目);
坏创作项目.story.cast.characters[0].relationship.initial.affection = 30;
坏创作项目.story.nodes.start.lines.push({ speaker: 'you', text: '系统显示：好感度 +8。' });
坏创作项目.story.nodes.start.choices[0].effect.relationships = {
  lu_chenzhou: 5,
  lin_miao: { affection: 2 },
};
坏创作项目.authoring.characterBibles.push({
  characterId: 'ghost',
  desire: '未知',
  fear: '未知',
  boundary: '未知',
  growth: '未知',
  voice: '未知',
  name: '不得复制的姓名',
  reviewed: true,
});
坏创作项目.authoring.relationshipEdges.push({
  id: 'ghost-edge',
  from: 'ghost',
  to: 'lin_miao',
  type: 'unknown',
  label: '孤儿边',
  dynamic: '无',
  boundary: '无',
  reviewed: true,
});
坏创作项目.authoring.emotionPoints[0] = {
  nodeId: 'missing-node',
  intensity: 101,
  agency: '很高',
  intimacy: -1,
  note: '非法节点',
  reviewed: true,
};
坏创作项目.authoring.consistencyRules.push({
  id: 'ghost-rule',
  label: '孤儿规则',
  scope: 'character',
  targetId: 'ghost',
  rule: '不得代替角色同意。',
  severity: 'error',
  enabled: true,
  reviewed: true,
});
坏创作项目.authoring.consistencyRules.push({
  id: 'invalid-rule-contract',
  label: '非法规则合同',
  scope: 'node',
  targetId: '',
  rule: '非 story 范围必须指定目标。',
  severity: 'critical',
  enabled: 'yes',
  reviewed: true,
});
坏创作项目.authoring.consistencyAssets.push(
  {
    id: 'danger-data',
    kind: 'reference',
    title: '危险 data',
    status: 'reference',
    characterIds: ['ghost'],
    nodeIds: ['missing-node'],
    sourcePath: 'data:text/html,<script>alert(1)</script>',
    notes: '',
    reviewed: true,
  },
  {
    id: 'danger-blob',
    kind: 'reference',
    title: '危险 blob',
    status: 'reference',
    characterIds: [],
    nodeIds: [],
    sourcePath: 'blob:https://example.invalid/id',
    notes: '',
    reviewed: true,
  },
  {
    id: 'danger-js',
    kind: 'reference',
    title: '危险 javascript',
    status: 'reference',
    characterIds: [],
    nodeIds: [],
    sourcePath: ' javascript:alert(1)',
    notes: '',
    reviewed: true,
  },
);
const 坏项目快照 = structuredClone(坏创作项目);
const 坏项目报告 = 校验创作资产(坏创作项目);
assert.deepEqual(坏创作项目, 坏项目快照, '一致性校验不得修改输入项目');
for (const code of [
  'character-bible-orphan',
  'character-bible-duplicates-cast',
  'relationship-from-orphan',
  'relationship-type-invalid',
  'emotion-node-orphan',
  'emotion-value-invalid',
  'consistency-rule-orphan',
  'consistency-rule-severity-invalid',
  'consistency-rule-enabled-invalid',
  'consistency-asset-dangerous-url',
  'consistency-asset-kind-invalid',
  'consistency-asset-character-orphan',
  'consistency-asset-node-orphan',
  'relationship-metric-unsupported',
  'relationship-scalar-affection',
  'affection-copy-forbidden',
]) {
  assert.ok(坏项目报告.items.some((项) => 项.code === code), `缺少 Level 6 一致性问题：${code}`);
}
assert.equal(坏项目报告.items.filter((项) => 项.code === 'consistency-asset-dangerous-url').length, 3);
const 安全化坏资产 = 归一化创作资产(坏创作项目);
for (const id of ['danger-data', 'danger-blob', 'danger-js']) {
  assert.match(安全化坏资产.consistencyAssets.find((项) => 项.id === id).sourcePath, /^(?:data|blob|javascript)/iu);
}
const 真实坏项目报告 = 运行校验(归一化项目({ ...坏创作项目, prompts: { prompts: [] }, manifest: { assets: [] } }));
assert.ok(真实坏项目报告.errors.some((条) => 条.includes('不得使用 data/blob/javascript URL')), '真实发布链不得吞掉危险资源协议');

// 真实链的项目归一化不得吞掉重复项、非对象项或非法值；原 authoring 保留后仍可定位全部错误。
const 畸形作者合同项目 = structuredClone(女性向资产项目);
畸形作者合同项目.authoring.characterBibles.push(structuredClone(畸形作者合同项目.authoring.characterBibles[0]), 'not-an-object');
畸形作者合同项目.authoring.emotionPoints[0] = {
  nodeId: 'start', intensity: 999, agency: '高', intimacy: -3, note: '非法值必须保留', reviewed: true,
};
畸形作者合同项目.authoring.consistencyAssets[0].characterIds = 'you';
畸形作者合同项目.authoring.consistencyAssets[0].nodeIds = [42, null];
const 畸形作者原文 = structuredClone(畸形作者合同项目.authoring);
const 畸形规整项目 = 归一化项目(畸形作者合同项目);
assert.deepEqual(畸形规整项目.authoring, 畸形作者原文, '归一化项目不得用安全视图覆盖畸形作者原文');
const 畸形规整报告 = 校验创作资产(畸形规整项目);
for (const code of [
  'character-bible-id-duplicate',
  'authoring-item-shape',
  'emotion-value-invalid',
  'consistency-asset-reference-array-shape',
  'consistency-asset-reference-item-shape',
]) {
  assert.ok(畸形规整报告.items.some((项) => 项.code === code), `真实归一化链吞掉了 ${code}`);
}
assert.ok(运行校验(畸形规整项目).errors.some((条) => 条.includes('重复 id')), '发布链必须继续阻断重复作者条目');

// 默认旗舰必须带一套可实际展示的作者资产，不能让最终链接只剩 0% 空壳。
const 第九席剧情 = JSON.parse(await readFile(new URL('../../公共资源/games/ninth-seat/story.json', import.meta.url), 'utf8'));
const 第九席创作资料 = JSON.parse(await readFile(new URL('../../公共资源/games/ninth-seat/creator.json', import.meta.url), 'utf8'));
assert.equal(第九席创作资料.storyId, 'ninth-seat');
assert.deepEqual(
  [
    第九席创作资料.authoring.characterBibles.length,
    第九席创作资料.authoring.relationshipEdges.length,
    第九席创作资料.authoring.emotionPoints.length,
    第九席创作资料.authoring.consistencyRules.length,
    第九席创作资料.authoring.consistencyAssets.length,
  ],
  [7, 6, 25, 4, 7],
);
const 第九席作者项目 = { story: 第九席剧情, authoring: 第九席创作资料.authoring };
assert.equal(校验创作资产(第九席作者项目).errors.length, 0);
assert.equal(计算创作资产完成度(第九席作者项目).percentage, 100);

// 第九席已完成 Level 7 人工复核；五部旧静态作品仍可加载，但进入新创作台重发前必须补规则结论。
const 正式名录 = JSON.parse(await readFile(new URL('../../公共资源/showcase.json', import.meta.url), 'utf8'));
for (const 条目 of 正式名录.featured) {
  const 剧情 = JSON.parse(await readFile(new URL(`../../公共资源/games/${条目.slug}/story.json`, import.meta.url), 'utf8'));
  const companion = 条目.slug === 'ninth-seat' ? 第九席创作资料 : null;
  const 项目 = 由剧情构造项目(条目.slug, 剧情, companion);
  const 报告 = 运行校验(项目);
  assert.ok(项目.story?.nodes?.[项目.story.startNodeId], `正式示例 ${条目.slug} 必须继续可加载`);
  if (条目.slug === 'ninth-seat') {
    assert.deepEqual(报告.errors, [], '第九席四条规则均已 passed，不得被 Level 7 合同阻断');
  } else {
    assert.equal(
      报告.errors.filter((错误) => 错误.includes('阻塞规则') && 错误.includes('尚未给出人工复核结论')).length,
      3,
      `旧静态作品 ${条目.slug} 重发前必须明确复核三条 error 规则`,
    );
  }
  if (条目.slug === 'project-20260620-201739') {
    assert.ok(
      !校验创作资产(项目).items.some((项) => 项.code === 'legacy-relationship-scalar'),
      '翻新后的《第七织女》不得再包含旧标量关系',
    );
  }
}

// 旧标量关系的创作台警告能力改用合成样例继续覆盖（正式作品已全部翻新为三维关系）。
const 旧标量样例项目 = 由剧情构造项目('legacy-scalar-sample', {
  title: '旧标量样例',
  startNodeId: 'a',
  nodes: {
    a: {
      id: 'a',
      choices: [{ id: 'k', label: '结识', next: 'a', effect: { relationships: { 'dong-yong': 15 } } }],
    },
  },
}, null);
assert.ok(
  校验创作资产(旧标量样例项目).items.some((项) => 项.code === 'legacy-relationship-scalar' && 项.severity === 'warning'),
  '旧标量关系必须继续触发创作台警告',
);

// 真实示例加载链必须读取同 slug companion；错绑资料则回退未审核骨架，不能串到另一部作品。
const 原fetch = globalThis.fetch;
const 请求路径们 = [];
let companion绑定正确 = true;
let companion未来版本 = false;
globalThis.fetch = async (路径) => {
  请求路径们.push(String(路径));
  if (String(路径).endsWith('/story.json')) {
    return { ok: true, status: 200, json: async () => structuredClone(第九席剧情) };
  }
  if (String(路径).endsWith('/creator.json')) {
    return {
      ok: true,
      status: 200,
      json: async () => structuredClone(
        companion绑定正确
          ? companion未来版本
            ? { ...第九席创作资料, authoring: { ...第九席创作资料.authoring, schemaVersion: 2, futureField: 'keep-me' } }
            : 第九席创作资料
          : { ...第九席创作资料, storyId: 'wrong-story' },
      ),
    };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};
try {
  const 加载后旗舰 = await 加载示例项目('ninth-seat');
  assert.deepEqual(请求路径们.slice(0, 2), ['/games/ninth-seat/story.json', '/games/ninth-seat/creator.json']);
  assert.equal(加载后旗舰.storyBible, 第九席创作资料.storyBible);
  assert.equal(计算创作资产完成度(加载后旗舰).percentage, 100);

  companion未来版本 = true;
  const 加载后未来资料 = await 加载示例项目('ninth-seat');
  assert.equal(加载后未来资料.authoring.schemaVersion, 2);
  assert.equal(加载后未来资料.authoring.futureField, 'keep-me');
  assert.equal(加载后未来资料.authoring.characterBibles.length, 7, '未来 companion 不得被静默回退为空白 v1 骨架');

  companion未来版本 = false;
  companion绑定正确 = false;
  const 错绑回退项目 = await 加载示例项目('ninth-seat');
  assert.equal(错绑回退项目.storyBible, '');
  assert.equal(计算创作资产完成度(错绑回退项目).percentage, 0);
  assert.equal(错绑回退项目.authoring.characterBibles.every((项) => !项.reviewed), true);
} finally {
  if (原fetch === undefined) delete globalThis.fetch;
  else globalThis.fetch = 原fetch;
}

console.log('创作台定向自测通过：创作包 dry-run/备份/事务回滚、语音、场景覆盖、机制结构、结局与女性向创作资产。');
