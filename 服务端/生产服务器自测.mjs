import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { 创建生产服务器 } from './生产服务器.js';

const 临时目录 = await mkdtemp(join(tmpdir(), 'yanjing-server-'));
await mkdir(join(临时目录, 'assets'));
await writeFile(join(临时目录, 'index.html'), '<!doctype html><title>衍境测试</title><div id="root"></div>');
await writeFile(join(临时目录, 'assets/app.js'), 'console.log("safe bundle")');
await writeFile(join(临时目录, 'sample.mp4'), Buffer.from('0123456789'));

const server = 创建生产服务器({ env: {}, distDir: 临时目录 });
const 处理请求 = server.listeners('request')[0];

async function 执行请求({ method = 'GET', url = '/', headers = {}, body = '' } = {}) {
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
  res.setHeader = (键, 值) => 响应头.set(String(键).toLowerCase(), String(值));
  res.getHeader = (键) => 响应头.get(String(键).toLowerCase());
  const 完成 = new Promise((resolve, reject) => {
    res.once('finish', resolve);
    res.once('error', reject);
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
  const 首页 = await 执行请求();
  assert.equal(首页.status, 200);
  assert.match(首页.text(), /衍境测试/u);
  assert.equal(首页.headers.get('x-content-type-options'), 'nosniff');

  const 子路由 = await 执行请求({ url: '/play?game=ninth-seat', headers: { accept: 'text/html' } });
  assert.equal(子路由.status, 200, 'SPA 子路由必须回写 index.html');
  assert.match(子路由.text(), /id="root"/u);

  const 资产 = await 执行请求({ url: '/assets/app.js' });
  assert.equal(资产.status, 200);
  assert.match(资产.headers.get('cache-control') ?? '', /immutable/u);
  assert.equal(资产.text(), 'console.log("safe bundle")');

  const 范围 = await 执行请求({ url: '/sample.mp4', headers: { range: 'bytes=2-5' } });
  assert.equal(范围.status, 206);
  assert.equal(范围.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(范围.text(), '2345');

  const 状态 = await 执行请求({ url: '/api/relationship-chat/status' });
  assert.equal(状态.status, 200);
  const 状态JSON = 状态.json();
  assert.equal(状态JSON.configured, false);
  assert.match(状态JSON.notice, /AI 服务未接入/u);

  const 备用 = await 执行请求({
    url: '/api/relationship-chat',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: 1,
      storyId: 'ninth-seat',
      nodeId: 's16-lin-alliance',
      characterId: 'lin_miao',
      message: '我需要平级复核，不是无条件站队。',
      turnId: 'server_test_turn_123456',
    }),
  });
  assert.equal(备用.status, 200);
  const 备用JSON = 备用.json();
  assert.equal(备用JSON.source, 'fallback');
  assert.equal(备用JSON.serviceStatus, 'unconfigured');

  assert.equal((await 执行请求({ url: '/missing.js' })).status, 404, '缺失静态资产不能被 SPA 回写掩盖');
  console.log('生产服务器自测通过：SPA、静态缓存、媒体 Range、同源关系代理与未接入降级均正常。');
} finally {
  await rm(临时目录, { recursive: true, force: true });
}
