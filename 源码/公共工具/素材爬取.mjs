// 这个文件是"搬运工"：把线上站点 https://wbmnbwl.vercel.app 上属于我们自己的
// 剧情数据、全景图、视频、语音、音乐，一件不落地搬回本地，并顺手把线上打包好的
// 网页文件(JS/CSS)也拷一份到「参考资料/线上镜像」，当作产品演示的保底方案。
//
// 用法：node 素材爬取.mjs
// 跑完后会输出一份下载报告，并写两个账本：
//   衍境项目/开发日志/素材下载日志.md   —— 这次搬了什么、成功几个、失败几个
//   衍境项目/素材台账/台账.md          —— 每个文件的来源和协议登记

import { mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const 线上地址 = 'https://wbmnbwl.vercel.app';
const 脚本目录 = dirname(fileURLToPath(import.meta.url));
const 项目根 = join(脚本目录, '..', '..');            // 衍境项目/
const 资源根 = join(项目根, '公共资源');               // 媒体素材都放这里(路径和线上一致)
const 镜像根 = join(项目根, '..', '参考资料', '线上镜像'); // 线上打包文件放这里
const 日志目录 = join(项目根, '开发日志');
const 台账目录 = join(项目根, '素材台账');

const 五部作品 = [
  'project-20260620-002835', // 云巅仙阁·命运抉择
  'project-20260620-185116', // 九尾狐仙下凡
  'project-20260620-201739', // 七仙女下凡
  'project-20260620-231058', // 第十五封愿望(默认作品)
  'excuse',                  // Excuse
];

// ---------- 底层小工具 ----------

// 下载一个网址，最多重试 3 次。已存在且大小一致的文件直接跳过，省流量。
async function 下载(路径, 本地文件) {
  const 网址 = 线上地址 + encodeURI(路径);
  for (let 次数 = 1; 次数 <= 3; 次数++) {
    try {
      // 先问服务器文件多大(HEAD)，如果本地已有同样大小的文件就不重复下载
      const 探测 = await fetch(网址, { method: 'HEAD' });
      if (!探测.ok) return { 路径, 状态: `HTTP ${探测.status}`, 成功: false };
      const 应有大小 = Number(探测.headers.get('content-length') || 0);
      try {
        const 已有 = await stat(本地文件);
        if (应有大小 > 0 && 已有.size === 应有大小) return { 路径, 状态: '已存在,跳过', 成功: true, 大小: 应有大小 };
      } catch { /* 本地还没有这个文件，正常，继续下载 */ }

      const 响应 = await fetch(网址);
      if (!响应.ok) return { 路径, 状态: `HTTP ${响应.status}`, 成功: false };
      const 内容 = Buffer.from(await 响应.arrayBuffer());
      if (应有大小 > 0 && 内容.length !== 应有大小) throw new Error(`大小不对: 期望${应有大小} 实得${内容.length}`);
      await mkdir(dirname(本地文件), { recursive: true });
      await writeFile(本地文件, 内容);
      return { 路径, 状态: '下载成功', 成功: true, 大小: 内容.length };
    } catch (错) {
      if (次数 === 3) return { 路径, 状态: `失败: ${错.message}`, 成功: false };
      await new Promise(r => setTimeout(r, 1000 * 次数)); // 等一会儿再试
    }
  }
}

// 一次同时下载 8 个，既快又不会把网络挤爆
async function 批量下载(任务列表) {
  const 结果 = [];
  let 指针 = 0;
  async function 工人() {
    while (指针 < 任务列表.length) {
      const 我的活 = 任务列表[指针++];
      const r = await 下载(我的活.路径, 我的活.本地文件);
      结果.push({ ...r, 用途: 我的活.用途 });
      if (结果.length % 20 === 0) console.log(`  进度 ${结果.length}/${任务列表.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, 工人));
  return 结果;
}

// 在一段文本(JS/CSS/JSON)里找出所有指向素材的路径
function 提取素材路径(文本) {
  const 找到 = new Set();
  // 形如 /panoramas/xxx.png、/landing/xxx.webp、/audio/ui/xxx.mp3 的媒体路径。
  // 打包代码里还会出现 `/panoramas/${变量}.svg`；那是运行时模板，不是真实文件，不能拿去下载。
  for (const m of 文本.matchAll(/["'`(](\/(?:panoramas|videos|music|voices|images|covers|portraits|landing|audio)\/[^"'`()\s]+)["'`)]/g)) {
    if (!/[${}]/.test(m[1])) 找到.add(m[1]);
  }
  // 形如 assets/Xxx-hash.js / .css / 图片字体等打包产物
  for (const m of 文本.matchAll(/["'`(]\/?(assets\/[A-Za-z0-9._-]+\.(?:js|css|png|jpg|jpeg|webp|svg|gif|mp4|mp3|woff2?|ttf))["'`)]/g)) 找到.add('/' + m[1]);
  return [...找到];
}

// ---------- 主流程 ----------

const 台账行 = [];
const 全部结果 = [];

console.log('== 第一步：下载 5 部作品的剧情数据 ==');
const 剧情任务 = 五部作品.map(slug => ({
  路径: `/games/${slug}/story.json`,
  本地文件: join(资源根, 'games', slug, 'story.json'),
  用途: '剧情数据',
}));
剧情任务.push({ 路径: '/showcase.json', 本地文件: join(资源根, 'showcase.json'), 用途: '精选列表' });
全部结果.push(...await 批量下载(剧情任务));

console.log('== 第二步：从剧情数据里收集所有媒体素材路径 ==');
const 媒体路径 = new Set();
for (const slug of 五部作品) {
  const 文本 = await readFile(join(资源根, 'games', slug, 'story.json'), 'utf8');
  for (const p of 提取素材路径(文本)) if (!p.startsWith('/assets/')) 媒体路径.add(p);
}
const 精选文本 = await readFile(join(资源根, 'showcase.json'), 'utf8');
for (const p of 提取素材路径(精选文本)) 媒体路径.add(p);
console.log(`  共发现媒体素材 ${媒体路径.size} 个`);

console.log('== 第三步：下载线上打包文件(镜像保底方案) ==');
// 首页 HTML 里写着入口 JS 和 CSS；入口 JS 里又写着其余模块的文件名；模块里还可能引用图片字体。
// 所以像剥洋葱一样：下载→扫描→发现新文件→再下载，直到没有新东西。
const 首页 = await (await fetch(线上地址 + '/')).text();
await mkdir(镜像根, { recursive: true });
await writeFile(join(镜像根, 'index.html'), 首页);
台账行.push(`| /index.html | ${线上地址}/ | 自有产品 | 镜像页面 |`);

let 待扫描 = 提取素材路径(首页).filter(p => p.startsWith('/assets/'));
const 已处理 = new Set();
while (待扫描.length) {
  const 本批 = 待扫描.filter(p => !已处理.has(p));
  本批.forEach(p => 已处理.add(p));
  if (!本批.length) break;
  const 批结果 = await 批量下载(本批.map(p => ({ 路径: p, 本地文件: join(镜像根, p), 用途: '线上镜像' })));
  全部结果.push(...批结果);
  待扫描 = [];
  for (const r of 批结果) {
    if (!r.成功 || !/\.(js|css)$/.test(r.路径)) continue;
    const 文本 = await readFile(join(镜像根, r.路径), 'utf8');
    for (const p of 提取素材路径(文本)) {
      if (p.startsWith('/assets/')) { if (!已处理.has(p)) 待扫描.push(p); }
      else 媒体路径.add(p); // JS 里也可能引用媒体(比如落地页的演示素材)
    }
  }
}

console.log(`== 第四步：下载全部媒体素材(共 ${媒体路径.size} 个，约几百 MB，请耐心) ==`);
const 媒体结果 = await 批量下载([...媒体路径].sort().map(p => ({
  路径: p, 本地文件: join(资源根, p), 用途: '媒体素材',
})));
全部结果.push(...媒体结果);

// ---------- 写账本 ----------
const 成功 = 全部结果.filter(r => r.成功);
const 失败 = 全部结果.filter(r => !r.成功);
const 总大小 = 成功.reduce((s, r) => s + (r.大小 || 0), 0);

for (const r of 成功) 台账行.push(`| ${r.路径} | ${线上地址}${r.路径} | 自有产品(衍境线上站) | ${r.用途} |`);

await mkdir(台账目录, { recursive: true });
await writeFile(join(台账目录, '台账.md'), [
  '# 素材台账', '',
  `> 由 素材爬取.mjs 自动生成。全部素材来源于我们自己的线上产品 ${线上地址}，版权归属产品作者本人。`,
  `> 若后续从开源平台(Poly Haven/Unsplash 等)补充素材，请在下表追加登记，注明协议。`, '',
  '| 文件路径 | 来源 | 协议/归属 | 用途 |', '|---|---|---|---|',
  ...台账行, '',
].join('\n'));

await mkdir(日志目录, { recursive: true });
await writeFile(join(日志目录, '素材下载日志.md'), [
  '# 素材下载日志', '',
  `- 下载目标：${线上地址}`,
  `- 任务总数：${全部结果.length}`,
  `- 成功：${成功.length}（合计 ${(总大小 / 1024 / 1024).toFixed(1)} MB）`,
  `- 失败：${失败.length}`, '',
  失败.length ? '## 失败清单(需人工处理或找开源替代)' : '## 全部成功，无缺失 ✅',
  ...失败.map(r => `- ${r.路径} —— ${r.状态}`), '',
].join('\n'));

console.log(`\n== 下载完成 ==`);
console.log(`成功 ${成功.length} / ${全部结果.length}，合计 ${(总大小 / 1024 / 1024).toFixed(1)} MB，失败 ${失败.length}`);
if (失败.length) { console.log('失败清单:'); 失败.forEach(r => console.log('  ', r.路径, r.状态)); process.exitCode = 1; }
