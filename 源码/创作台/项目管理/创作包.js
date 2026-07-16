// 创作包是跨域搬运创作台本机仓的唯一格式：只包含项目、已发布快照、首页精选与当前选中项。
// 整个包始终留在浏览器内；解析/dry-run 是纯函数，确认后才会碰 localStorage。
import {
  深拷贝,
  归一化项目,
  项目存储键,
  精选存储键,
  选中项目键,
} from './本机项目存储.js';
import { 运行校验 } from '../校验发布/校验规则.js';

export const 创作包产品 = 'yanjing-ai-game-creator';
export const 创作包架构版本 = 1;
export const 当前作者架构版本 = 1;

const 空精选 = Object.freeze({ default: '', featured: [], entries: [] });
const 创作包存储键们 = Object.freeze([项目存储键, 精选存储键, 选中项目键]);
const slug规则 = /^[a-z0-9][a-z0-9_-]{0,47}$/;

function 是普通对象(值) {
  return !!值 && typeof 值 === 'object' && !Array.isArray(值);
}

function 有自有字段(对象, 字段) {
  return Object.prototype.hasOwnProperty.call(对象, 字段);
}

function 创作包错误(代码, 文案, 详情) {
  const 错误 = new Error(文案);
  错误.name = 'CreatorPackageError';
  错误.code = 代码;
  if (详情 !== undefined) 错误.details = 详情;
  return 错误;
}

function 检查slug(slug, 路径, { 允许空 = false, 允许null = false } = {}) {
  if (允许null && slug === null) return null;
  if (允许空 && slug === '') return '';
  if (typeof slug !== 'string' || !slug规则.test(slug)) {
    throw 创作包错误(
      'invalid-slug',
      `${路径} 不是合法 slug；只允许 1–48 位小写字母、数字、短横线和下划线，且首位必须是字母或数字。`,
      { path: 路径, value: slug },
    );
  }
  return slug;
}

function 检查毫秒时间(值, 路径) {
  if (!Number.isInteger(值) || 值 < 0 || !Number.isFinite(new Date(值).getTime())) {
    throw 创作包错误('invalid-time', `${路径} 不是合法的毫秒时间戳。`, { path: 路径, value: 值 });
  }
  return 值;
}

function 检查导出时间(值) {
  if (typeof 值 !== 'string') {
    throw 创作包错误('invalid-time', 'exportedAt 必须是标准 UTC ISO 时间。', { path: 'exportedAt', value: 值 });
  }
  const 时间 = new Date(值);
  if (!Number.isFinite(时间.getTime()) || 时间.toISOString() !== 值) {
    throw 创作包错误('invalid-time', 'exportedAt 必须是标准 UTC ISO 时间。', { path: 'exportedAt', value: 值 });
  }
  return 值;
}

function 检查未来作者合同(项目, 路径) {
  const 版本 = 项目?.authoring?.schemaVersion;
  if (Number.isInteger(版本) && 版本 > 当前作者架构版本) {
    throw 创作包错误(
      'future-authoring-version',
      `${路径}.authoring 来自未来版本 v${版本}，当前创作台只支持 v${当前作者架构版本}，已拒绝导入以避免降级破坏。`,
      { path: `${路径}.authoring.schemaVersion`, version: 版本 },
    );
  }
}

function 检查项目骨架(项目, 路径, slug) {
  if (!是普通对象(项目)) {
    throw 创作包错误('invalid-project', `${路径} 必须是项目对象。`, { path: 路径 });
  }
  检查slug(项目.slug, `${路径}.slug`);
  if (项目.slug !== slug) {
    throw 创作包错误(
      'slug-mismatch',
      `${路径}.slug (${项目.slug}) 与项目表键 (${slug}) 不一致。`,
      { path: `${路径}.slug`, expected: slug, actual: 项目.slug },
    );
  }
  if (!是普通对象(项目.story) || !是普通对象(项目.story.nodes)) {
    throw 创作包错误('invalid-project', `${路径}.story.nodes 必须是节点对象。`, { path: `${路径}.story.nodes` });
  }
  检查未来作者合同(项目, 路径);
}

function 检查已发布快照(项目, 路径, slug) {
  检查项目骨架(项目, 路径, slug);
  let 报告;
  try {
    报告 = 运行校验(归一化项目(深拷贝(项目)));
  } catch (错) {
    throw 创作包错误(
      'published-validation-error',
      `${路径} 无法完成发布校验，已拒绝导入。`,
      { path: 路径, validationCause: 错 instanceof Error ? 错.message : String(错) },
    );
  }
  if (报告.errors.length > 0) {
    throw 创作包错误(
      'published-validation-error',
      `${路径} 含 ${报告.errors.length} 个发布错误，已拒绝导入。`,
      { path: 路径, errors: [...报告.errors], warnings: [...报告.warnings] },
    );
  }
}

function 检查项目表(项目表) {
  if (!是普通对象(项目表)) {
    throw 创作包错误('invalid-project-store', 'projects 必须是项目表对象。', { path: 'projects' });
  }
  const 定稿条目们 = [];
  for (const [slug, 条目] of Object.entries(项目表)) {
    检查slug(slug, `projects.${slug}`);
    if (!是普通对象(条目)) {
      throw 创作包错误('invalid-project-entry', `projects.${slug} 必须是项目条目对象。`, { path: `projects.${slug}` });
    }
    检查项目骨架(条目.project, `projects.${slug}.project`, slug);
    检查毫秒时间(条目.updatedAt, `projects.${slug}.updatedAt`);

    const 有发布项目 = 有自有字段(条目, 'publishedProject') && 条目.publishedProject != null;
    const 有发布时间 = 有自有字段(条目, 'publishedAt') && 条目.publishedAt != null;
    if (有发布项目 !== 有发布时间) {
      throw 创作包错误(
        'invalid-published-pair',
        `projects.${slug} 的 publishedProject 与 publishedAt 必须同时存在或同时缺省。`,
        { path: `projects.${slug}` },
      );
    }
    if (有发布项目) {
      检查已发布快照(条目.publishedProject, `projects.${slug}.publishedProject`, slug);
      检查毫秒时间(条目.publishedAt, `projects.${slug}.publishedAt`);
    }
    定稿条目们.push([slug, 深拷贝(条目)]);
  }
  return Object.fromEntries(定稿条目们);
}

function 检查精选(精选) {
  if (!是普通对象(精选)) {
    throw 创作包错误('invalid-showcase', 'showcase 必须是精选配置对象。', { path: 'showcase' });
  }
  const 默认slug = 精选.default ?? '';
  检查slug(默认slug, 'showcase.default', { 允许空: true });
  if (!Array.isArray(精选.featured)) {
    throw 创作包错误('invalid-showcase', 'showcase.featured 必须是 slug 数组。', { path: 'showcase.featured' });
  }
  if (!Array.isArray(精选.entries)) {
    throw 创作包错误('invalid-showcase', 'showcase.entries 必须是卡片数组。', { path: 'showcase.entries' });
  }

  const featured = 精选.featured.map((slug, 下标) => 检查slug(slug, `showcase.featured[${下标}]`));
  if (new Set(featured).size !== featured.length) {
    throw 创作包错误('invalid-showcase', 'showcase.featured 不能包含重复 slug。', { path: 'showcase.featured' });
  }
  if (默认slug && !featured.includes(默认slug)) {
    throw 创作包错误('invalid-showcase', 'showcase.default 必须属于 showcase.featured。', { path: 'showcase.default' });
  }

  const entries = 精选.entries.map((条目, 下标) => {
    const 路径 = `showcase.entries[${下标}]`;
    if (!是普通对象(条目)) {
      throw 创作包错误('invalid-showcase', `${路径} 必须是卡片对象。`, { path: 路径 });
    }
    检查slug(条目.slug, `${路径}.slug`);
    if (typeof 条目.title !== 'string' || !条目.title.trim()) {
      throw 创作包错误('invalid-showcase', `${路径}.title 必须是非空字符串。`, { path: `${路径}.title` });
    }
    return 深拷贝(条目);
  });
  const 卡片slug们 = entries.map((条目) => 条目.slug);
  if (new Set(卡片slug们).size !== 卡片slug们.length) {
    throw 创作包错误('invalid-showcase', 'showcase.entries 不能包含重复 slug。', { path: 'showcase.entries' });
  }
  const 卡片slug集 = new Set(卡片slug们);
  const 缺卡片slug = featured.find((slug) => !卡片slug集.has(slug));
  if (缺卡片slug) {
    throw 创作包错误(
      'invalid-showcase',
      `showcase.featured 中的 ${缺卡片slug} 缺少对应卡片。`,
      { path: 'showcase.entries', slug: 缺卡片slug },
    );
  }
  return { ...深拷贝(精选), default: 默认slug, featured, entries };
}

function 检查创作包对象(原始包) {
  if (!是普通对象(原始包)) {
    throw 创作包错误('invalid-root', '创作包根节点必须是 JSON 对象。');
  }
  if (原始包.product !== 创作包产品) {
    throw 创作包错误(
      'wrong-product',
      `这不是「衍境」创作包（product 应为 ${创作包产品}）。`,
      { expected: 创作包产品, actual: 原始包.product },
    );
  }
  if (!Number.isInteger(原始包.schemaVersion) || 原始包.schemaVersion < 1) {
    throw 创作包错误('invalid-schema-version', 'schemaVersion 必须是正整数。', { actual: 原始包.schemaVersion });
  }
  if (原始包.schemaVersion > 创作包架构版本) {
    throw 创作包错误(
      'future-schema-version',
      `创作包来自未来版本 v${原始包.schemaVersion}，当前只支持 v${创作包架构版本}。`,
      { supported: 创作包架构版本, actual: 原始包.schemaVersion },
    );
  }
  if (原始包.schemaVersion !== 创作包架构版本) {
    throw 创作包错误(
      'unsupported-schema-version',
      `当前不支持创作包 v${原始包.schemaVersion}。`,
      { supported: 创作包架构版本, actual: 原始包.schemaVersion },
    );
  }

  const exportedAt = 检查导出时间(原始包.exportedAt);
  const projects = 检查项目表(原始包.projects);
  const showcase = 检查精选(原始包.showcase);
  const selectedSlug = 原始包.selectedSlug == null
    ? null
    : 检查slug(原始包.selectedSlug, 'selectedSlug');
  return {
    product: 创作包产品,
    schemaVersion: 创作包架构版本,
    exportedAt,
    projects,
    showcase,
    selectedSlug,
  };
}

export function 生成创作包摘要(创作包) {
  const 条目们 = 是普通对象(创作包?.projects) ? Object.values(创作包.projects) : [];
  const featured = Array.isArray(创作包?.showcase?.featured) ? 创作包.showcase.featured : [];
  return {
    projectCount: 条目们.length,
    draftCount: 条目们.filter((条目) => 是普通对象(条目) && !!条目.project).length,
    publishedCount: 条目们.filter((条目) => 是普通对象(条目) && !!条目.publishedProject).length,
    featuredCount: featured.length,
    selectedSlug: typeof 创作包?.selectedSlug === 'string' ? 创作包.selectedSlug : null,
    exportedAt: 创作包?.exportedAt ?? '',
  };
}

// 纯函数：任意 JSON 文本 → 完整校验后的 v1 包与 dry-run 摘要；不读取也不写入浏览器。
export function 解析创作包(文本) {
  if (typeof 文本 !== 'string') {
    throw 创作包错误('invalid-json', '创作包必须以 JSON 文本导入。');
  }
  let 原始包;
  try {
    原始包 = JSON.parse(文本);
  } catch (错) {
    throw 创作包错误(
      'invalid-json',
      '无法解析创作包：文件不是合法 JSON。',
      { cause: 错 instanceof Error ? 错.message : String(错) },
    );
  }
  const 创作包 = 检查创作包对象(原始包);
  return { 创作包, 摘要: 生成创作包摘要(创作包) };
}

export function 构建创作包({
  projects = {},
  showcase = 空精选,
  selectedSlug = null,
  exportedAt = new Date().toISOString(),
} = {}) {
  return 检查创作包对象({
    product: 创作包产品,
    schemaVersion: 创作包架构版本,
    exportedAt,
    projects,
    showcase,
    selectedSlug,
  });
}

export function 序列化创作包(创作包, 空格 = 2) {
  const 定稿 = 检查创作包对象(创作包);
  return `${JSON.stringify(定稿, null, 空格)}\n`;
}

function 取默认存储() {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw 创作包错误('storage-unavailable', '当前环境没有可用的浏览器本机存储。');
  }
  return window.localStorage;
}

function 读取原始仓快照(存储) {
  const 快照 = {};
  try {
    for (const 键 of 创作包存储键们) 快照[键] = 存储.getItem(键);
  } catch (错) {
    const 异常 = 创作包错误(
      'storage-read-failed',
      '读取当前创作仓失败，未执行任何导入写入。请检查浏览器站点存储权限。',
    );
    异常.name = 'CreatorPackageStorageError';
    异常.cause = 错;
    throw 异常;
  }
  return 快照;
}

function 解析仓JSON(文本, 空值, 名称) {
  if (文本 == null) return 深拷贝(空值);
  try {
    return JSON.parse(文本);
  } catch (错) {
    const 异常 = 创作包错误(
      'current-store-invalid',
      `当前浏览器的${名称}已损坏；为确保能先生成可恢复备份，本次操作已停止。`,
    );
    异常.name = 'CreatorPackageStorageDataError';
    异常.cause = 错;
    throw 异常;
  }
}

function 由仓快照构建创作包(快照, exportedAt) {
  const projects = 解析仓JSON(快照[项目存储键], {}, '项目仓');
  const showcase = 解析仓JSON(快照[精选存储键], 空精选, '精选仓');
  if (!是普通对象(projects) || !是普通对象(showcase)) {
    const 异常 = 创作包错误(
      'current-store-invalid',
      '当前浏览器的项目仓或精选仓不是对象；为避免丢失无法还原的原数据，本次操作已停止。',
    );
    异常.name = 'CreatorPackageStorageDataError';
    throw 异常;
  }
  // 当前仓可能含旧规则下发布的快照、尚未修复的草稿或未来作者合同。
  // 备份/导出必须逐字带走这些 JSON 数据，不能先用当前导入规则把它们过滤掉；
  // 真正作为“待导入包”使用时，解析创作包() 仍会严格拒绝不兼容内容。
  return {
    product: 创作包产品,
    schemaVersion: 创作包架构版本,
    exportedAt: 检查导出时间(exportedAt),
    projects,
    showcase,
    selectedSlug: 快照[选中项目键] || null,
  };
}

function 序列化当前仓创作包(创作包) {
  try {
    return `${JSON.stringify(创作包, null, 2)}\n`;
  } catch (错) {
    const 异常 = 创作包错误('current-store-invalid', '当前浏览器创作仓无法序列化为 JSON 备份。');
    异常.name = 'CreatorPackageStorageDataError';
    异常.cause = 错;
    throw 异常;
  }
}

// 只读：从三个 localStorage 键完整取样后生成当前仓创作包。任一读取失败都会 fail closed。
export function 读取当前创作包({ 存储 = 取默认存储(), exportedAt = new Date().toISOString() } = {}) {
  const 快照 = 读取原始仓快照(存储);
  const 创作包 = 由仓快照构建创作包(快照, exportedAt);
  return {
    创作包,
    摘要: 生成创作包摘要(创作包),
    文本: 序列化当前仓创作包(创作包),
  };
}

function 恢复原始仓快照(存储, 快照) {
  const 错误们 = [];
  for (const 键 of 创作包存储键们) {
    try {
      if (快照[键] == null) 存储.removeItem(键);
      else 存储.setItem(键, 快照[键]);
    } catch (错) {
      错误们.push({ key: 键, error: 错 });
    }
  }
  return 错误们;
}

// 确认阶段：再次校验待导入包 → 读取全部原值并生成备份 → 通知 UI 下载备份 → 三键写入。
// 任一写入失败都会把三个键恢复到逐字相同的原值；补偿也失败时会给出不可忽略的事务错误。
export function 确认导入创作包(
  待导入包,
  {
    存储 = 取默认存储(),
    on备份 = null,
    备份时间 = new Date().toISOString(),
  } = {},
) {
  const 创作包 = 检查创作包对象(深拷贝(待导入包));
  const 原始快照 = 读取原始仓快照(存储);
  const 备份包 = 由仓快照构建创作包(原始快照, 备份时间);
  const 备份 = {
    创作包: 备份包,
    摘要: 生成创作包摘要(备份包),
    文本: 序列化当前仓创作包(备份包),
  };

  // 备份下载是提交前置条件。下载回调若失败，下面的任何 setItem/removeItem 都不会运行。
  if (typeof on备份 === 'function') on备份(备份);

  const 新值 = {
    [项目存储键]: JSON.stringify(创作包.projects),
    [精选存储键]: JSON.stringify(创作包.showcase),
    [选中项目键]: 创作包.selectedSlug,
  };
  try {
    存储.setItem(项目存储键, 新值[项目存储键]);
    存储.setItem(精选存储键, 新值[精选存储键]);
    if (新值[选中项目键] == null) 存储.removeItem(选中项目键);
    else 存储.setItem(选中项目键, 新值[选中项目键]);
  } catch (写入错) {
    const 回滚错误们 = 恢复原始仓快照(存储, 原始快照);
    const 回滚成功 = 回滚错误们.length === 0;
    const 异常 = new Error(
      回滚成功
        ? '导入写入失败，已自动恢复导入前的完整创作仓。'
        : '导入写入失败，且浏览器阻止了完整自动恢复。请停止继续编辑，并使用刚下载的导入前备份恢复。',
    );
    异常.name = 'CreatorPackageTransactionError';
    异常.code = 回滚成功 ? 'import-write-failed-rolled-back' : 'import-rollback-failed';
    异常.cause = { writeError: 写入错, rollbackErrors: 回滚错误们 };
    throw 异常;
  }

  return { 创作包, 摘要: 生成创作包摘要(创作包), 备份 };
}

function 文件时间段(时间 = new Date()) {
  if (!(时间 instanceof Date) || !Number.isFinite(时间.getTime())) 时间 = new Date();
  return 时间.toISOString().replace(/[:.]/g, '-');
}

export function 创作包文件名({ 备份 = false, 时间 = new Date() } = {}) {
  return `衍境创作包-${备份 ? '导入前备份-' : ''}${文件时间段(时间)}.json`;
}

// 浏览器本地下载：Blob → Object URL → 临时链接；不调用 fetch，也不会上传文件内容。
export function 下载创作包文件(
  文本,
  文件名,
  {
    文档 = typeof document === 'undefined' ? null : document,
    URL接口 = typeof URL === 'undefined' ? null : URL,
    Blob构造器 = typeof Blob === 'undefined' ? null : Blob,
  } = {},
) {
  if (!文档?.createElement || !文档.body || !URL接口?.createObjectURL || !URL接口?.revokeObjectURL || !Blob构造器) {
    throw 创作包错误('download-unavailable', '当前浏览器无法创建本地下载文件。');
  }
  const 文件 = new Blob构造器([文本], { type: 'application/json;charset=utf-8' });
  const 地址 = URL接口.createObjectURL(文件);
  const 链接 = 文档.createElement('a');
  链接.href = 地址;
  链接.download = 文件名;
  链接.hidden = true;
  文档.body.appendChild(链接);
  try {
    链接.click();
  } finally {
    if (typeof 链接.remove === 'function') 链接.remove();
    else 文档.body.removeChild(链接);
    URL接口.revokeObjectURL(地址);
  }
}
