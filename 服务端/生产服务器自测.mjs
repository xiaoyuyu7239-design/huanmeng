import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { PassThrough, Readable, Writable } from 'node:stream';
import { 创建生产服务器, 验证发布运行时 } from './生产服务器.js';

const 临时目录 = await mkdtemp(join(tmpdir(), 'yanjing-server-'));
const 缺清单目录 = await mkdtemp(join(tmpdir(), 'yanjing-no-release-'));
const 缺首页目录 = await mkdtemp(join(tmpdir(), 'yanjing-no-index-'));
const 无效清单目录 = await mkdtemp(join(tmpdir(), 'yanjing-invalid-release-'));
const 首页内容 = Buffer.from('<!doctype html><title>衍境测试</title><div id="root"></div>');
const 精选内容 = Buffer.from('{"default":"ninth-seat","featured":[]}');
const 剧情内容 = Buffer.from('{"id":"ninth-seat","startNodeId":"start","nodes":{"start":{"id":"start"}}}');
const Worker内容 = Buffer.from('export default { fetch() { return new Response("ok") } };');
const 提交 = 'abc123456789abc123456789abc123456789abcd';

function 产物(path, 内容) {
  return {
    path,
    bytes: 内容.byteLength,
    sha256: createHash('sha256').update(内容).digest('hex'),
  };
}

const 清单 = {
  schemaVersion: 1,
  product: 'yanjing-heartscape',
  version: '1.0.0-beta.9',
  commit: 提交,
  betaMode: 'public-preview',
  aiMode: 'fallback',
  builtAt: '2026-07-17T00:00:00.000Z',
  source: { clean: true, head: 提交 },
  artifacts: [
    产物('index.html', 首页内容),
    产物('showcase.json', 精选内容),
    产物('games/ninth-seat/story.json', 剧情内容),
    产物('server/index.js', Worker内容),
  ],
  limits: {
    totalBytes: 1000,
    fileCount: 8,
    largestFile: { path: 'index.html', bytes: 首页内容.byteLength },
    maxTotalBytes: 500 * 1024 * 1024,
    maxFileBytes: 20 * 1024 * 1024,
  },
  internalPath: '/private/build/path-must-not-leak',
  guardToken: 'token-must-not-leak',
};

await mkdir(join(临时目录, 'assets'));
await mkdir(join(临时目录, 'games/ninth-seat'), { recursive: true });
await mkdir(join(临时目录, 'server'));
await writeFile(join(临时目录, 'index.html'), 首页内容);
await writeFile(join(临时目录, 'showcase.json'), 精选内容);
await writeFile(join(临时目录, 'games/ninth-seat/story.json'), 剧情内容);
await writeFile(join(临时目录, 'server/index.js'), Worker内容);
await writeFile(join(临时目录, 'release.json'), JSON.stringify(清单));
await writeFile(join(临时目录, 'assets/app.js'), 'console.log("safe bundle")');
await writeFile(join(临时目录, 'sample.mp4'), Buffer.from('0123456789'));
await writeFile(join(临时目录, 'stream-error.bin'), Buffer.from('will fail before reading'));
await writeFile(join(缺清单目录, 'index.html'), '<!doctype html><title>missing release</title>');
await writeFile(join(缺首页目录, 'release.json'), JSON.stringify(清单));
await writeFile(join(无效清单目录, 'index.html'), 首页内容);
await writeFile(join(无效清单目录, 'release.json'), JSON.stringify({
  version: 'not-semver',
  commit: 'not-a-sha',
  betaMode: 'anything',
  aiMode: 'model',
}));

const 运行信息 = 验证发布运行时({ distDir: 临时目录 });
assert.deepEqual(运行信息, {
  version: 清单.version,
  commit: 清单.commit,
  betaMode: 清单.betaMode,
  aiMode: 清单.aiMode,
});
assert.throws(
  () => 创建生产服务器({ env: {}, distDir: 缺清单目录 }),
  (错误) => 错误?.code === 'MISSING_RELEASE',
  '缺少 release.json 时创建服务器就必须失败',
);
assert.throws(
  () => 创建生产服务器({ env: {}, distDir: 缺首页目录 }),
  (错误) => 错误?.code === 'MISSING_INDEX',
  '缺少 index.html 时创建服务器就必须失败',
);
assert.throws(
  () => 创建生产服务器({ env: {}, distDir: 无效清单目录 }),
  (错误) => 错误?.code === 'INVALID_RELEASE_SCHEMA_VERSION',
  '浅层伪清单不得启动生产服务器',
);

const 日志 = [];
const logger = {
  info: (行) => 日志.push(行),
  error: (行) => 日志.push(行),
};
function 测试文件流(路径, 选项) {
  if (basename(路径) !== 'stream-error.bin') return createReadStream(路径, 选项);
  const 流 = new PassThrough();
  queueMicrotask(() => {
    const 错误 = new Error('injected file read failure with private path');
    错误.code = 'EIO_TEST';
    流.emit('error', 错误);
  });
  return 流;
}

const env = {
  RELATIONSHIP_AI_TRUSTED_PROXY_IPS: '10.0.0.2',
  RELATIONSHIP_AI_TRUST_PROXY_HOPS: '1',
  SERVER_HEADERS_TIMEOUT_MS: '12000',
  SERVER_REQUEST_TIMEOUT_MS: '16000',
  SERVER_KEEP_ALIVE_TIMEOUT_MS: '4000',
  SERVER_SOCKET_TIMEOUT_MS: '30000',
};
const server = 创建生产服务器({
  env,
  distDir: 临时目录,
  logger,
  createReadStreamImpl: 测试文件流,
});
assert.equal(server.headersTimeout, 12000);
assert.equal(server.requestTimeout, 16000);
assert.equal(server.keepAliveTimeout, 4000);
assert.equal(server.timeout, 30000);
assert.equal(server.maxHeadersCount, 100);
assert.equal(server.maxRequestsPerSocket, 1000);
const 处理请求 = server.listeners('request')[0];

async function 执行请求({ method = 'GET', url = '/', headers = {}, body = '', socketIP = '127.0.0.1' } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.socket = { remoteAddress: socketIP, encrypted: false };
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
  const 原写 = res.write.bind(res);
  const 原结束 = res.end.bind(res);
  res.write = (块, ...参数) => {
    res.headersSent = true;
    return 原写(块, ...参数);
  };
  res.end = (块, ...参数) => {
    res.headersSent = true;
    return 原结束(块, ...参数);
  };
  const 完成 = new Promise((resolvePromise, rejectPromise) => {
    res.once('finish', resolvePromise);
    res.once('error', rejectPromise);
  });
  处理请求(req, res);
  await 完成;
  const buffer = Buffer.concat(响应块);
  return {
    status: res.statusCode,
    headers: 响应头,
    text: () => buffer.toString('utf8'),
    json: () => JSON.parse(buffer.toString('utf8')),
  };
}

try {
  const 首页 = await 执行请求({ headers: { 'x-request-id': 'request_home_123456' } });
  assert.equal(首页.status, 200);
  assert.match(首页.text(), /衍境测试/u);
  assert.equal(首页.headers.get('x-request-id'), 'request_home_123456');
  assert.equal(首页.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(首页.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(首页.headers.get('x-frame-options'), 'DENY');
  assert.match(首页.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/u);
  assert.doesNotMatch(首页.headers.get('content-security-policy') ?? '', /googleapis|gstatic/u);
  assert.match(首页.headers.get('permissions-policy') ?? '', /camera=\(\)/u);
  assert.equal(首页.headers.has('strict-transport-security'), false, '直连 HTTP 不得误发 HSTS');
  assert.ok(首页.headers.get('etag'));
  assert.ok(首页.headers.get('last-modified'));

  const 可信HTTPS = await 执行请求({
    url: '/livez',
    headers: { 'x-forwarded-proto': 'https' },
    socketIP: '10.0.0.2',
  });
  assert.equal(可信HTTPS.headers.get('strict-transport-security'), 'max-age=31536000');
  const 伪造HTTPS = await 执行请求({
    url: '/livez',
    headers: { 'x-forwarded-proto': 'https' },
    socketIP: '10.0.0.9',
  });
  assert.equal(伪造HTTPS.headers.has('strict-transport-security'), false, '非可信直连方伪造 forwarded proto 必须无效');

  const live = 可信HTTPS.json();
  assert.deepEqual(live, {
    ok: true,
    status: 'live',
    version: 清单.version,
    commit: 清单.commit,
    betaMode: 清单.betaMode,
    aiMode: 清单.aiMode,
  });
  assert.doesNotMatch(JSON.stringify(live), /private|token|artifact|builtAt/iu, '健康接口不得泄露路径、token 或清单明细');
  const ready = await 执行请求({ url: '/readyz' });
  assert.equal(ready.status, 200);
  assert.equal(ready.json().status, 'ready');

  const 子路由 = await 执行请求({ url: '/play?game=ninth-seat', headers: { accept: 'text/html' } });
  assert.equal(子路由.status, 200, 'allowlist 内 SPA 子路由必须回写 index.html');
  assert.match(子路由.text(), /id="root"/u);
  const 尾斜杠 = await 执行请求({ url: '/creator/', headers: { accept: 'text/html' } });
  assert.equal(尾斜杠.status, 200);
  const 未知HTML = await 执行请求({ url: '/private-admin', headers: { accept: 'text/html' } });
  assert.equal(未知HTML.status, 404, '未知 HTML 路由不能 soft-404 到首页');
  assert.equal(未知HTML.json().code, 'NOT_FOUND');

  const API404 = await 执行请求({ url: '/api/unknown', headers: { accept: 'text/html' } });
  assert.equal(API404.status, 404);
  assert.equal(API404.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(API404.headers.get('cache-control'), 'no-store');
  assert.equal(API404.json().code, 'API_NOT_FOUND');
  assert.equal((await 执行请求({ url: '/api' })).json().code, 'API_NOT_FOUND');

  const 资产 = await 执行请求({ url: '/assets/app.js' });
  assert.equal(资产.status, 200);
  assert.match(资产.headers.get('cache-control') ?? '', /immutable/u);
  assert.equal(资产.text(), 'console.log("safe bundle")');
  const etag = 资产.headers.get('etag');
  const 条件ETag = await 执行请求({ url: '/assets/app.js', headers: { 'if-none-match': etag } });
  assert.equal(条件ETag.status, 304);
  assert.equal(条件ETag.text(), '');
  const 完整媒体 = await 执行请求({ url: '/sample.mp4' });
  const 条件日期 = await 执行请求({
    url: '/sample.mp4',
    headers: { 'if-modified-since': 完整媒体.headers.get('last-modified') },
  });
  assert.equal(条件日期.status, 304);

  const 范围 = await 执行请求({ url: '/sample.mp4', headers: { range: 'bytes=2-5' } });
  assert.equal(范围.status, 206);
  assert.equal(范围.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(范围.text(), '2345');
  const 开放范围 = await 执行请求({ url: '/sample.mp4', headers: { range: 'bytes=7-' } });
  assert.equal(开放范围.status, 206);
  assert.equal(开放范围.headers.get('content-range'), 'bytes 7-9/10');
  assert.equal(开放范围.text(), '789');
  const 后缀范围 = await 执行请求({ url: '/sample.mp4', headers: { range: 'bytes=-4' } });
  assert.equal(后缀范围.status, 206);
  assert.equal(后缀范围.headers.get('content-range'), 'bytes 6-9/10');
  assert.equal(后缀范围.text(), '6789');
  const 越界范围 = await 执行请求({ url: '/sample.mp4', headers: { range: 'bytes=20-' } });
  assert.equal(越界范围.status, 416);
  assert.equal(越界范围.headers.get('content-range'), 'bytes */10');

  const 流错误 = await 执行请求({ url: '/stream-error.bin' });
  assert.equal(流错误.status, 500, '打开后的文件流错误必须受控返回 500，不能击穿进程');
  assert.equal(流错误.json().code, 'INTERNAL_ERROR');
  assert.ok(日志.some((行) => 行.includes('EIO_TEST')), '静态 I/O 错误应留下无路径错误代码');

  const 状态 = await 执行请求({ url: '/api/relationship-chat/status' });
  assert.equal(状态.status, 200);
  const 状态JSON = 状态.json();
  assert.equal(状态JSON.configured, false);
  assert.match(状态JSON.notice, /AI 服务未接入/u);

  const 私密正文 = '我需要平级复核，不是无条件站队。正文不能进入日志。';
  const 备用 = await 执行请求({
    url: '/api/relationship-chat',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'relationship_ai_session=cookie-must-not-leak',
      authorization: 'Bearer token-must-not-leak',
      'x-request-id': 'relationship_turn_123456',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      storyId: 'ninth-seat',
      nodeId: 's16-lin-alliance',
      characterId: 'lin_miao',
      message: 私密正文,
      turnId: 'server_test_turn_123456',
    }),
  });
  assert.equal(备用.status, 200);
  assert.equal(备用.json().serviceStatus, 'unconfigured');

  const 全部日志 = 日志.join('\n');
  assert.doesNotMatch(全部日志, /正文不能进入日志|cookie-must-not-leak|token-must-not-leak|private\/build/u);
  for (const 行 of 日志) {
    const 记录 = JSON.parse(行);
    assert.ok(['http_request', 'runtime_error'].includes(记录.event));
  }
  const 访问记录 = 日志.map((行) => JSON.parse(行)).find((记录) => 记录.requestId === 'relationship_turn_123456' && 记录.event === 'http_request');
  assert.equal(访问记录.route, '/api/relationship-chat');
  assert.equal(访问记录.status, 200);
  assert.equal(访问记录.serviceStatus, 'unconfigured');
  assert.equal(访问记录.degradedReason, 'service_unconfigured');
  assert.ok(Number.isInteger(访问记录.bytes) && 访问记录.bytes > 0);

  assert.equal((await 执行请求({ url: '/missing.js' })).status, 404, '缺失静态资产不能被 SPA 回写掩盖');

  // readiness 会重新核对发布产物；文件被替换或丢失时 live 保持，ready 失败。
  await rm(join(临时目录, 'release.json'));
  const 清单丢失就绪 = await 执行请求({ url: '/readyz' });
  assert.equal(清单丢失就绪.status, 503);
  assert.equal(清单丢失就绪.json().status, 'not_ready');
  assert.equal((await 执行请求({ url: '/livez' })).status, 200);
  await writeFile(join(临时目录, 'release.json'), JSON.stringify(清单));
  assert.equal((await 执行请求({ url: '/readyz' })).status, 200);

  await writeFile(join(临时目录, 'index.html'), '<!doctype html><title>被替换但仍非空</title>');
  const 首页被篡改就绪 = await 执行请求({ url: '/readyz' });
  assert.equal(首页被篡改就绪.status, 503, '关键产物被替换后 readyz 必须失败');
  assert.equal(首页被篡改就绪.json().status, 'not_ready');
  await writeFile(join(临时目录, 'index.html'), 首页内容);
  assert.equal((await 执行请求({ url: '/readyz' })).status, 200);

  server.开始排空();
  const 排空就绪 = await 执行请求({ url: '/readyz' });
  assert.equal(排空就绪.status, 503);
  assert.equal(排空就绪.json().status, 'draining');
  const 排空存活 = await 执行请求({ url: '/livez' });
  assert.equal(排空存活.status, 200);
  assert.equal(排空存活.json().status, 'draining');
  const 排空拒绝 = await 执行请求({ url: '/assets/app.js' });
  assert.equal(排空拒绝.status, 503);
  assert.equal(排空拒绝.json().code, 'SERVER_DRAINING');

  console.log('生产服务器自测通过：发布门禁、健康排空、统一日志/安全头、SPA/API 路由、条件缓存、Range 与受控流错误均正常。');
} finally {
  await Promise.all([
    rm(临时目录, { recursive: true, force: true }),
    rm(缺清单目录, { recursive: true, force: true }),
    rm(缺首页目录, { recursive: true, force: true }),
    rm(无效清单目录, { recursive: true, force: true }),
  ]);
}
