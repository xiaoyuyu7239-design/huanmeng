// 这个文件是“仓库盘点员”：顺着剧情 JSON 和源码里的本地资源地址逐件点货，
// 只要有一件不存在或是空文件，就让 npm test 失败，避免页面上线后才冒出 404。
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const 当前目录 = dirname(fileURLToPath(import.meta.url));
const 项目根 = resolve(当前目录, '../..');
const 资源根 = join(项目根, '公共资源');
const 本地资源前缀 = /^\/(?:landing|audio|panoramas|videos|music|voices)\//;
const 资源路径们 = new Set(['/showcase.json']);

// 输入目录 → 递归吐出其中所有文件路径。
async function 列文件(目录) {
  const 结果 = [];
  for (const 条目 of await readdir(目录, { withFileTypes: true })) {
    const 路径 = join(目录, 条目.name);
    if (条目.isDirectory()) 结果.push(...(await 列文件(路径)));
    else 结果.push(路径);
  }
  return 结果;
}

// 输入任意 JSON 值 → 找出所有以本地媒体目录开头的字符串。
function 收集JSON资源(值) {
  if (typeof 值 === 'string') {
    if (本地资源前缀.test(值) && !/[${}]/.test(值)) 资源路径们.add(值.split(/[?#]/, 1)[0]);
    return;
  }
  if (Array.isArray(值)) {
    值.forEach(收集JSON资源);
    return;
  }
  if (值 && typeof 值 === 'object') Object.values(值).forEach(收集JSON资源);
}

const 精选路径 = join(资源根, 'showcase.json');
const 精选数据 = JSON.parse(await readFile(精选路径, 'utf8'));
const 名录slug们 = [
  typeof 精选数据.default === 'string' ? 精选数据.default : '',
  ...(Array.isArray(精选数据.featured) ? 精选数据.featured.map((条) => 条?.slug) : []),
].filter((slug) => typeof slug === 'string' && slug);
for (const slug of new Set(名录slug们)) 资源路径们.add(`/games/${slug}/story.json`);

const 已有剧情文件们 = (await 列文件(join(资源根, 'games'))).filter((路径) => 路径.endsWith('/story.json'));
const 名录剧情文件们 = [...new Set(名录slug们)].map((slug) => join(资源根, 'games', slug, 'story.json'));
const 剧情文件们 = [...new Set([...已有剧情文件们, ...名录剧情文件们])];
for (const 路径 of [...剧情文件们, 精选路径]) {
  收集JSON资源(JSON.parse(await readFile(路径, 'utf8')));
}

// 源码里还有剧情 JSON 看不到的落地页图片和播放器界面音效，也一并点货。
for (const 路径 of await 列文件(join(项目根, '源码'))) {
  // mjs 是自测/爬取脚本，里面会故意放不存在的假路径做夹具，不能当成产品资源。
  if (!/\.(?:js|jsx|css)$/.test(路径)) continue;
  const 文本 = await readFile(路径, 'utf8');
  for (const 匹配 of 文本.matchAll(/["'`](\/(?:landing|audio|panoramas|videos|music|voices)\/[^"'`()\s]+)["'`)]/g)) {
    const 资源路径 = 匹配[1].split(/[?#]/, 1)[0];
    if (!/[${}]/.test(资源路径)) 资源路径们.add(资源路径);
  }
}

const 缺失 = [];
for (const 资源路径 of [...资源路径们].sort()) {
  const 本地路径 = join(资源根, 资源路径.replace(/^\//, ''));
  try {
    const 信息 = await stat(本地路径);
    if (!信息.isFile() || 信息.size === 0) 缺失.push(`${资源路径}（空文件或不是文件）`);
  } catch {
    缺失.push(`${资源路径}（不存在）`);
  }
}

if (缺失.length) {
  throw new Error(`资源自测失败：\n- ${缺失.join('\n- ')}`);
}

console.log(`资源自测：${剧情文件们.length} 部作品，${资源路径们.size} 个本地资源引用全部存在且非空`);
console.log(`资源目录：${relative(项目根, 资源根)}`);
