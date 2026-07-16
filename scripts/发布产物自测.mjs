import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 创建生产服务器 } from '../服务端/生产服务器.js';

const 当前目录 = dirname(fileURLToPath(import.meta.url));
const 项目目录 = resolve(当前目录, '..');
const 构建目录 = join(项目目录, 'dist');
const 发布清单 = JSON.parse(await readFile(join(构建目录, 'release.json'), 'utf8'));
const 包信息 = JSON.parse(await readFile(join(项目目录, 'package.json'), 'utf8'));
const 当前提交 = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: 项目目录, encoding: 'utf8' }).trim();
const 当前源码状态 = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: 项目目录, encoding: 'utf8' }).trim();

assert.equal(当前源码状态, '', '发布烟测只接受无修改、无未跟踪文件的清洁 HEAD');
assert.equal(发布清单.schemaVersion, 1);
assert.equal(发布清单.product, 'yanjing-heartscape');
assert.equal(发布清单.version, 包信息.version);
assert.equal(发布清单.commit, 当前提交, '发布清单必须对应当前 HEAD；提交后请重新构建');
assert.equal(发布清单.betaMode, 'public-preview');
assert.equal(发布清单.aiMode, 'fallback');
assert.deepEqual(发布清单.source, { clean: true, head: 当前提交 }, '发布清单必须来自无未提交修改的当前 HEAD');
assert.ok(Array.isArray(发布清单.artifacts) && 发布清单.artifacts.length >= 4);
for (const 产物 of 发布清单.artifacts) {
  assert.equal(typeof 产物.path, 'string');
  const 内容 = await readFile(join(构建目录, 产物.path));
  assert.equal(内容.byteLength, 产物.bytes, `发布产物体积摘要不一致：${产物.path}`);
  assert.equal(createHash('sha256').update(内容).digest('hex'), 产物.sha256, `发布产物哈希不一致：${产物.path}`);
}

async function 遍历文件(目录, 根目录 = 目录) {
  const 文件们 = [];
  for (const 条目 of await readdir(目录, { withFileTypes: true })) {
    const 路径 = join(目录, 条目.name);
    if (条目.isDirectory()) 文件们.push(...await 遍历文件(路径, 根目录));
    else if (条目.isFile()) 文件们.push({ path: 路径.slice(根目录.length + 1).replaceAll('\\', '/'), fullPath: 路径, info: await stat(路径) });
  }
  return 文件们;
}

const 文件们 = await 遍历文件(构建目录);
const 总字节 = 文件们.reduce((和, 文件) => 和 + 文件.info.size, 0);
const 最大文件 = Math.max(...文件们.map((文件) => 文件.info.size));
assert.ok(总字节 <= 发布清单.limits.maxTotalBytes, '发布产物超过总大小门禁');
assert.ok(最大文件 <= 发布清单.limits.maxFileBytes, '发布产物存在超大单文件');

const 文本扩展名 = new Set([
  '.cjs', '.css', '.env', '.html', '.js', '.json', '.jsx', '.key', '.map', '.md', '.mjs',
  '.pem', '.text', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);
const 固定密钥特征 = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bsk-[a-zA-Z0-9_-]{20,}\b/u,
];
const 秘密赋值 = /\b(RELATIONSHIP_AI_(?:API_KEY|GUARD_TOKEN|SESSION_SECRET))[ \t]*(?::|=(?!=))[ \t]*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s,;#}\r\n]+))/gu;

function 是文本候选(路径) {
  const 文件名 = basename(路径).toLowerCase();
  return 文本扩展名.has(extname(文件名)) || 文件名 === '.env' || 文件名.startsWith('.env.');
}

function 是允许的示例值(值, 路径) {
  const 清理 = 值.trim();
  if (!清理 || /^(?:replace|example|your|changeme|dummy|placeholder)(?:[-_<]|$)/iu.test(清理)) return true;
  if (/^(?:<|\$\{|process\.env\b|env\.|typeof\b)/u.test(清理)) return true;
  return /(?:自测|test|spec)\./iu.test(路径) && /test/iu.test(清理);
}

const 已跟踪相对路径 = execFileSync('git', ['ls-files', '-z'], { cwd: 项目目录 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const 扫描文件 = [
  ...文件们.map((文件) => ({ ...文件, scope: 'dist' })),
  ...await Promise.all(已跟踪相对路径.map(async (path) => {
    const fullPath = join(项目目录, path);
    try {
      return { path, fullPath, info: await stat(fullPath), scope: 'source' };
    } catch {
      return null;
    }
  })),
].filter((文件) => 文件?.info?.isFile() && 是文本候选(文件.path));

for (const 文件 of 扫描文件) {
  const 内容 = await readFile(文件.fullPath, 'utf8');
  assert.ok(!固定密钥特征.some((模式) => 模式.test(内容)), `${文件.scope} 疑似包含固定格式密钥：${文件.path}`);
  秘密赋值.lastIndex = 0;
  for (const 匹配 of 内容.matchAll(秘密赋值)) {
    const 值 = 匹配[2] ?? 匹配[3] ?? 匹配[4] ?? '';
    assert.ok(是允许的示例值(值, 文件.path), `${文件.scope} 疑似包含 ${匹配[1]}：${文件.path}`);
  }
}

function 生产处理器() {
  const server = 创建生产服务器({ env: {}, distDir: 构建目录 });
  return { server, handler: server.listeners('request')[0] };
}

async function 直接请求(handler, { method = 'GET', url = '/', headers = {}, body = '' } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.socket = { remoteAddress: '127.0.0.1' };
  const 响应块 = [];
  const 响应头 = new Map();
  const res = new Writable({
    write(chunk, _encoding, callback) {
      响应块.push(Buffer.from(chunk));
      callback();
    },
  });
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = (键, 值) => 响应头.set(String(键).toLowerCase(), String(值));
  res.getHeader = (键) => 响应头.get(String(键).toLowerCase());
  res.removeHeader = (键) => 响应头.delete(String(键).toLowerCase());
  const 原write = res.write.bind(res);
  res.write = (...参数) => { res.headersSent = true; return 原write(...参数); };
  const 原end = res.end.bind(res);
  res.end = (...参数) => { res.headersSent = true; return 原end(...参数); };
  const 完成 = new Promise((resolve, reject) => {
    res.once('finish', resolve);
    res.once('error', reject);
  });
  handler(req, res);
  await 完成;
  const buffer = Buffer.concat(响应块);
  return {
    status: res.statusCode,
    headers: 响应头,
    text: buffer.toString('utf8'),
    json: () => JSON.parse(buffer.toString('utf8')),
  };
}

const { server, handler } = 生产处理器();
const 首页 = await 直接请求(handler, { headers: { accept: 'text/html' } });
assert.equal(首页.status, 200);
assert.match(首页.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/u);

const 播放器 = await 直接请求(handler, { url: '/play?game=ninth-seat', headers: { accept: 'text/html' } });
assert.equal(播放器.status, 200);
assert.match(播放器.text, /id="root"/u);

const 未知页面 = await 直接请求(handler, { url: '/wrong-page', headers: { accept: 'text/html' } });
assert.equal(未知页面.status, 404);
const 未知接口 = await 直接请求(handler, { url: '/api/unknown', headers: { accept: 'text/html' } });
assert.equal(未知接口.status, 404);
assert.match(未知接口.headers.get('content-type') ?? '', /application\/json/u);

const live = await 直接请求(handler, { url: '/livez', headers: { accept: 'application/json' } });
const ready = await 直接请求(handler, { url: '/readyz', headers: { accept: 'application/json' } });
assert.equal(live.status, 200);
assert.equal(ready.status, 200);
assert.equal(ready.json().aiMode, 'fallback');

const 关系状态 = await 直接请求(handler, { url: '/api/relationship-chat/status' });
assert.equal(关系状态.status, 200);
assert.equal(关系状态.json().configured, false);

const 清单第一次 = await 直接请求(handler, { url: '/release.json' });
assert.equal(清单第一次.status, 200);
const etag = 清单第一次.headers.get('etag');
assert.ok(etag, 'release.json 必须有 ETag');
const 条件请求 = await 直接请求(handler, { url: '/release.json', headers: { 'if-none-match': etag } });
assert.equal(条件请求.status, 304);

const 清单原文 = await readFile(join(构建目录, 'release.json'));
const 后四字节 = await 直接请求(handler, { url: '/release.json', headers: { range: 'bytes=-4' } });
assert.equal(后四字节.status, 206);
assert.deepEqual(Buffer.from(后四字节.text), 清单原文.subarray(-4));

if (process.env.RELEASE_SMOKE_NETWORK === '1') {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const 地址 = server.address();
    const response = await fetch(`http://127.0.0.1:${地址.port}/readyz`, { headers: { accept: 'application/json' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ready');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const assets = {
  async fetch(request) {
    const url = new URL(request.url);
    const 解码 = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const 路径 = resolve(构建目录, 解码);
    if (路径 !== 构建目录 && !路径.startsWith(`${构建目录}${sep}`)) return new Response('Forbidden', { status: 403 });
    try {
      const info = await stat(路径);
      if (!info.isFile()) return new Response('Not Found', { status: 404 });
      const headers = { 'content-type': MIME[extname(路径)] ?? 'application/octet-stream' };
      return new Response(request.method === 'HEAD' ? null : await readFile(路径), { status: 200, headers });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  },
};
const workerModule = await import(`${pathToFileURL(join(构建目录, 'server/index.js')).href}?release=${Date.now()}`);
const worker = workerModule.default;
const ctx = { waitUntil() {} };
const worker首页 = await worker.fetch(new Request('https://beta.example/play?game=ninth-seat', { headers: { accept: 'text/html' } }), { ASSETS: assets }, ctx);
assert.equal(worker首页.status, 200);
assert.match(worker首页.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/u);
const worker首页HTML = await worker首页.text();
assert.match(worker首页HTML, /https:\/\/beta\.example\/og\.png/u, '边缘 HTML 必须生成绝对分享图地址');
assert.doesNotMatch(worker首页HTML, /__YANJING_PUBLIC_ORIGIN__/u, '发布页不能残留分享地址占位符');
const workerReady = await worker.fetch(new Request('https://beta.example/readyz'), { ASSETS: assets }, ctx);
assert.equal(workerReady.status, 200);
assert.equal((await workerReady.json()).aiMode, 'fallback');
const worker状态 = await worker.fetch(new Request('https://beta.example/api/relationship-chat/status'), { ASSETS: assets }, ctx);
assert.equal(worker状态.status, 200);
assert.equal((await worker状态.json()).mode, 'fallback');
const worker关系 = await worker.fetch(new Request('https://beta.example/api/relationship-chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://beta.example' },
  body: JSON.stringify({
    schemaVersion: 1,
    storyId: 'ninth-seat',
    nodeId: 's16-lin-alliance',
    characterId: 'lin_miao',
    message: '我需要平级复核，不是无条件站队。',
    turnId: 'release_test_turn_123456',
  }),
}), { ASSETS: assets }, ctx);
assert.equal(worker关系.status, 200);
const worker关系JSON = await worker关系.json();
assert.equal(worker关系JSON.source, 'fallback');
assert.equal(worker关系JSON.reason, 'beta_fallback_only');

console.log(`发布产物自测通过：${文件们.length} 个文件、${Math.ceil(总字节 / 1024 / 1024)} MiB；Node 与 Sites Worker 的首页、SPA、健康、缓存、Range、错误和 fallback 关系服务均正常。`);
