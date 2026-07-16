// 构建产物的 Node 运行时：同一进程提供 SPA 静态文件与关系 AI 代理。
// 发布清单、健康探针、日志和错误响应只暴露最小运行信息，绝不打印本机路径或服务端秘密。
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 创建关系AI中间件 } from './关系AI代理.js';

const 当前目录 = fileURLToPath(new URL('.', import.meta.url));
const 默认构建目录 = resolve(当前目录, '../dist');
const 发布清单最大字节 = 64 * 1024;
const 服务器状态 = Symbol('yanjing-production-state');
const SPA路由 = new Set(['/', '/play', '/game', '/creator', '/creators', '/worlds']);
const 请求ID格式 = /^[a-zA-Z0-9._-]{8,80}$/u;
const 发布文本格式 = /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,119}$/u;
const 语义版本格式 = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const 提交格式 = /^[0-9a-f]{40}$/u;
const 摘要格式 = /^[0-9a-f]{64}$/u;
const 必需发布产物 = new Set([
  'index.html',
  'showcase.json',
  'games/ninth-seat/story.json',
  'server/index.js',
]);
const 类型表 = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  // React 运行时仍使用受控 style 属性；字体已随系统/同源资源提供。
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

function 是普通对象(值) {
  return !!值 && typeof 值 === 'object' && !Array.isArray(值);
}

function 读取发布文本(值, 字段) {
  if (typeof 值 !== 'string' || !发布文本格式.test(值.trim())) {
    throw 发布错误(`INVALID_RELEASE_${字段.toUpperCase()}`);
  }
  return 值.trim();
}

function 发布错误(code) {
  const 错误 = new Error('生产发布产物不完整或发布清单无效。');
  错误.code = code;
  return 错误;
}

// 启动与创建服务器都必须先经过这里；错误只带稳定代码，不拼接绝对路径。
export function 验证发布运行时({ distDir = 默认构建目录 } = {}) {
  const 构建目录 = resolve(distDir);
  let 首页信息;
  let 清单信息;
  try {
    首页信息 = statSync(resolve(构建目录, 'index.html'));
  } catch {
    throw 发布错误('MISSING_INDEX');
  }
  if (!首页信息.isFile() || 首页信息.size <= 0) throw 发布错误('INVALID_INDEX');
  try {
    清单信息 = statSync(resolve(构建目录, 'release.json'));
  } catch {
    throw 发布错误('MISSING_RELEASE');
  }
  if (!清单信息.isFile() || 清单信息.size <= 0 || 清单信息.size > 发布清单最大字节) {
    throw 发布错误('INVALID_RELEASE_FILE');
  }
  let 原始;
  try {
    原始 = JSON.parse(readFileSync(resolve(构建目录, 'release.json'), 'utf8'));
  } catch {
    throw 发布错误('INVALID_RELEASE_JSON');
  }
  if (!是普通对象(原始)) throw 发布错误('INVALID_RELEASE_SHAPE');
  if (原始.schemaVersion !== 1) throw 发布错误('INVALID_RELEASE_SCHEMA_VERSION');
  if (原始.product !== 'yanjing-heartscape') throw 发布错误('INVALID_RELEASE_PRODUCT');
  const version = 读取发布文本(原始.version, 'version');
  const commit = 读取发布文本(原始.commit, 'commit');
  if (!语义版本格式.test(version)) throw 发布错误('INVALID_RELEASE_VERSION');
  if (!提交格式.test(commit)) throw 发布错误('INVALID_RELEASE_COMMIT');
  if (原始.betaMode !== 'public-preview') throw 发布错误('INVALID_RELEASE_BETA_MODE');
  if (原始.aiMode !== 'fallback') throw 发布错误('INVALID_RELEASE_AI_MODE');
  if (typeof 原始.builtAt !== 'string' || !Number.isFinite(Date.parse(原始.builtAt))) {
    throw 发布错误('INVALID_RELEASE_BUILT_AT');
  }
  if (!是普通对象(原始.source) || 原始.source.clean !== true || 原始.source.head !== commit) {
    throw 发布错误('INVALID_RELEASE_SOURCE');
  }
  if (!Array.isArray(原始.artifacts)) throw 发布错误('INVALID_RELEASE_ARTIFACTS');
  const 已验证路径 = new Set();
  for (const 产物 of 原始.artifacts) {
    if (
      !是普通对象(产物) ||
      typeof 产物.path !== 'string' ||
      !Number.isInteger(产物.bytes) ||
      产物.bytes <= 0 ||
      typeof 产物.sha256 !== 'string' ||
      !摘要格式.test(产物.sha256)
    ) {
      throw 发布错误('INVALID_RELEASE_ARTIFACT_ENTRY');
    }
    const 路径 = 产物.path.replaceAll('\\', '/');
    if (
      路径 !== 产物.path ||
      路径.startsWith('/') ||
      路径.split('/').some((段) => !段 || 段 === '.' || 段 === '..') ||
      已验证路径.has(路径)
    ) {
      throw 发布错误('INVALID_RELEASE_ARTIFACT_PATH');
    }
    已验证路径.add(路径);
    const 完整路径 = resolve(构建目录, 路径);
    if (!完整路径.startsWith(`${构建目录}${sep}`)) throw 发布错误('INVALID_RELEASE_ARTIFACT_PATH');
    let 内容;
    try {
      内容 = readFileSync(完整路径);
    } catch {
      throw 发布错误('MISSING_RELEASE_ARTIFACT');
    }
    if (
      内容.byteLength !== 产物.bytes ||
      createHash('sha256').update(内容).digest('hex') !== 产物.sha256
    ) {
      throw 发布错误('RELEASE_ARTIFACT_MISMATCH');
    }
  }
  for (const 路径 of 必需发布产物) {
    if (!已验证路径.has(路径)) throw 发布错误('MISSING_RELEASE_ARTIFACT_ENTRY');
  }
  if (
    !是普通对象(原始.limits) ||
    !Number.isInteger(原始.limits.totalBytes) ||
    原始.limits.totalBytes <= 0 ||
    !Number.isInteger(原始.limits.fileCount) ||
    原始.limits.fileCount < 必需发布产物.size ||
    !Number.isInteger(原始.limits.maxTotalBytes) ||
    原始.limits.totalBytes > 原始.limits.maxTotalBytes ||
    !Number.isInteger(原始.limits.maxFileBytes) ||
    原始.limits.maxFileBytes <= 0
  ) {
    throw 发布错误('INVALID_RELEASE_LIMITS');
  }
  return Object.freeze({
    version,
    commit,
    betaMode: 原始.betaMode,
    aiMode: 原始.aiMode,
  });
}

function 取请求头(req, 名称) {
  const 值 = req.headers?.[名称.toLowerCase()] ?? req.headers?.[名称];
  return Array.isArray(值) ? 值[0] ?? '' : String(值 ?? '');
}

function 规范IP(值) {
  const 原值 = String(值 ?? '').trim();
  const 去映射 = 原值.startsWith('::ffff:') && isIP(原值.slice(7)) === 4 ? 原值.slice(7) : 原值;
  return isIP(去映射) ? 去映射 : '';
}

function 取代理跳数(env) {
  const 数字 = Number.parseInt(env.RELATIONSHIP_AI_TRUST_PROXY_HOPS ?? '0', 10);
  return Number.isInteger(数字) && 数字 >= 1 && 数字 <= 5 ? 数字 : 0;
}

function 是HTTPS请求(req, env) {
  if (req.socket?.encrypted === true) return true;
  const 跳数 = 取代理跳数(env);
  if (!跳数) return false;
  const 直连IP = 规范IP(req.socket?.remoteAddress);
  const 可信代理 = new Set(
    String(env.RELATIONSHIP_AI_TRUSTED_PROXY_IPS ?? '').split(',').map(规范IP).filter(Boolean),
  );
  if (!直连IP || !可信代理.has(直连IP)) return false;
  const 协议链 = 取请求头(req, 'x-forwarded-proto')
    .split(',')
    .map((值) => 值.trim().toLowerCase())
    .filter(Boolean);
  return 协议链.length >= 跳数 && 协议链[协议链.length - 跳数] === 'https';
}

function 规范SPA路径(路径) {
  return 路径 === '/' ? '/' : 路径.replace(/\/+$/, '');
}

function 日志路由(路径) {
  const SPA落点 = 规范SPA路径(路径);
  if (SPA路由.has(SPA落点)) return SPA落点;
  if (路径 === '/livez' || 路径 === '/readyz') return 路径;
  if (路径 === '/api/relationship-chat' || 路径 === '/api/relationship-chat/status') return 路径;
  if (路径 === '/api' || 路径.startsWith('/api/')) return '/api/*';
  if (extname(路径)) return `/static/*${extname(路径).toLowerCase().slice(0, 16)}`;
  return '/unknown';
}

function 输出JSON日志(logger, 记录) {
  const 文本 = JSON.stringify(记录);
  if (typeof logger === 'function') logger(文本);
  else if (typeof logger?.info === 'function') logger.info(文本);
  else console.log(文本);
}

function 输出错误日志(logger, 记录) {
  const 文本 = JSON.stringify(记录);
  if (typeof logger?.error === 'function') logger.error(文本);
  else if (typeof logger === 'function') logger(文本);
  else console.error(文本);
}

function 安装访问日志(req, res, { logger, requestId, route, now }) {
  const 开始 = now();
  let 字节 = 0;
  let 已记录 = false;
  const 安全结果 = {};
  const 原写 = res.write;
  const 原结束 = res.end;
  res.write = function 写入并计数(chunk, ...参数) {
    if (chunk != null) 字节 += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
    return 原写.call(this, chunk, ...参数);
  };
  res.end = function 结束并计数(chunk, ...参数) {
    if (chunk != null) 字节 += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
    if (route.startsWith('/api/') && chunk != null && Buffer.byteLength(chunk) <= 64 * 1024) {
      try {
        const body = JSON.parse(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
        for (const [来源键, 日志键] of [
          ['serviceStatus', 'serviceStatus'],
          ['reason', 'degradedReason'],
          ['code', 'responseCode'],
        ]) {
          const 值 = body?.[来源键];
          if (typeof 值 === 'string' && /^[a-zA-Z0-9_]{1,60}$/u.test(值)) 安全结果[日志键] = 值;
        }
      } catch {}
    }
    return 原结束.call(this, chunk, ...参数);
  };
  const 记录 = (outcome) => {
    if (已记录) return;
    已记录 = true;
    输出JSON日志(logger, {
      event: 'http_request',
      requestId,
      method: String(req.method ?? 'GET').slice(0, 12),
      route,
      status: Number(res.statusCode || 0),
      durationMs: Math.max(0, now() - 开始),
      bytes: 字节,
      outcome,
      ...安全结果,
    });
  };
  res.once('finish', () => 记录('finished'));
  res.once('close', () => 记录(res.writableEnded ? 'finished' : 'aborted'));
}

function 设置通用安全头(req, res, env, requestId) {
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('cross-origin-resource-policy', 'same-origin');
  res.setHeader('cross-origin-opener-policy', 'same-origin');
  res.setHeader('content-security-policy', CSP);
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader(
    'permissions-policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  );
  if (是HTTPS请求(req, env)) {
    res.setHeader('strict-transport-security', 'max-age=31536000');
  }
}

function 发送JSON(res, status, body, extraHeaders = {}) {
  if (res.writableEnded || res.destroyed) return;
  const 文本 = JSON.stringify(body);
  for (const 头 of ['accept-ranges', 'content-range', 'etag', 'last-modified']) res.removeHeader?.(头);
  res.statusCode = status;
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(文本));
  for (const [键, 值] of Object.entries(extraHeaders)) res.setHeader(键, 值);
  res.end(文本);
}

function 发送错误(res, status, code, message, extraHeaders = {}) {
  发送JSON(res, status, { ok: false, code, message }, extraHeaders);
}

function 文件ETag(信息) {
  return `W/\"${信息.size.toString(16)}-${Math.trunc(信息.mtimeMs).toString(16)}\"`;
}

function ETag匹配(请求值, etag) {
  const 值们 = String(请求值 ?? '').split(',').map((值) => 值.trim());
  return 值们.includes('*') || 值们.includes(etag);
}

function 自日期后未修改(请求值, 信息) {
  const 时间 = Date.parse(String(请求值 ?? ''));
  if (!Number.isFinite(时间)) return false;
  return Math.floor(信息.mtimeMs / 1000) * 1000 <= 时间;
}

function 解析Range(请求值, 文件大小) {
  if (!请求值 || 文件大小 <= 0) return null;
  const 匹配 = String(请求值).match(/^bytes=(\d*)-(\d*)$/u);
  if (!匹配 || (!匹配[1] && !匹配[2])) return { invalid: true };
  if (!匹配[1]) {
    const 后缀长度 = Number(匹配[2]);
    if (!Number.isInteger(后缀长度) || 后缀长度 <= 0) return { invalid: true };
    return { start: Math.max(文件大小 - 后缀长度, 0), end: 文件大小 - 1 };
  }
  const start = Number(匹配[1]);
  const 请求结束 = 匹配[2] ? Number(匹配[2]) : 文件大小 - 1;
  const end = Math.min(请求结束, 文件大小 - 1);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(请求结束) ||
    start < 0 ||
    请求结束 < start ||
    start >= 文件大小
  ) return { invalid: true };
  return { start, end };
}

function 设置静态响应头(res, 路径, 信息) {
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('content-type', 类型表[extname(路径).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('etag', 文件ETag(信息));
  res.setHeader('last-modified', 信息.mtime.toUTCString());
  res.setHeader(
    'cache-control',
    路径.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  );
}

async function 输送文件流(流, res) {
  await new Promise((resolvePromise, rejectPromise) => {
    let 已结束 = false;
    const 清理 = () => {
      流.off('error', 失败);
      res.off('finish', 完成);
      res.off('close', 关闭);
    };
    const 完成 = () => {
      if (已结束) return;
      已结束 = true;
      清理();
      resolvePromise();
    };
    const 关闭 = () => {
      if (已结束 || res.writableEnded) return;
      已结束 = true;
      清理();
      流.destroy();
      const 错误 = new Error('Response closed while streaming.');
      错误.code = 'RESPONSE_CLOSED';
      rejectPromise(错误);
    };
    const 失败 = (错误) => {
      if (已结束) return;
      已结束 = true;
      清理();
      流.unpipe(res);
      流.destroy();
      rejectPromise(错误);
    };
    流.once('error', 失败);
    res.once('finish', 完成);
    res.once('close', 关闭);
    流.pipe(res);
  });
}

async function 发送文件(req, res, 路径, { createReadStreamImpl = createReadStream } = {}) {
  let 信息;
  try {
    信息 = await stat(路径);
  } catch (错误) {
    if (错误?.code === 'ENOENT' || 错误?.code === 'ENOTDIR') return false;
    throw 错误;
  }
  if (!信息.isFile()) return false;
  设置静态响应头(res, 路径, 信息);
  const etag = 文件ETag(信息);
  const ifNoneMatch = 取请求头(req, 'if-none-match');
  const ifModifiedSince = 取请求头(req, 'if-modified-since');
  if (
    (ifNoneMatch && ETag匹配(ifNoneMatch, etag)) ||
    (!ifNoneMatch && ifModifiedSince && 自日期后未修改(ifModifiedSince, 信息))
  ) {
    res.statusCode = 304;
    res.end();
    return true;
  }

  const rangeHeader = 取请求头(req, 'range');
  const range = rangeHeader ? 解析Range(rangeHeader, 信息.size) : null;
  if (range?.invalid) {
    res.statusCode = 416;
    res.setHeader('content-range', `bytes */${信息.size}`);
    res.setHeader('content-length', '0');
    res.end();
    return true;
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? Math.max(信息.size - 1, 0);
  if (range) {
    res.statusCode = 206;
    res.setHeader('content-range', `bytes ${start}-${end}/${信息.size}`);
    res.setHeader('content-length', end - start + 1);
  } else {
    res.statusCode = 200;
    res.setHeader('content-length', 信息.size);
  }
  if (req.method === 'HEAD' || 信息.size === 0) {
    res.end();
    return true;
  }
  const 流选项 = range ? { start, end } : undefined;
  await 输送文件流(createReadStreamImpl(路径, 流选项), res);
  return true;
}

function 发布信息相同(左, 右) {
  return ['version', 'commit', 'betaMode', 'aiMode'].every((键) => 左[键] === 右[键]);
}

function 健康正文(状态, status) {
  return {
    ok: status !== 'draining' && status !== 'not_ready',
    status,
    version: 状态.release.version,
    commit: 状态.release.commit,
    betaMode: 状态.release.betaMode,
    aiMode: 状态.release.aiMode,
  };
}

function 设置服务器超时(server, env) {
  const 取超时 = (名称, 兜底, 最小, 最大) => {
    const 数字 = Number.parseInt(env[名称] ?? '', 10);
    return Number.isInteger(数字) ? Math.min(最大, Math.max(最小, 数字)) : 兜底;
  };
  server.headersTimeout = 取超时('SERVER_HEADERS_TIMEOUT_MS', 15_000, 5_000, 60_000);
  server.requestTimeout = 取超时('SERVER_REQUEST_TIMEOUT_MS', 20_000, 5_000, 120_000);
  server.keepAliveTimeout = 取超时('SERVER_KEEP_ALIVE_TIMEOUT_MS', 5_000, 1_000, 30_000);
  server.timeout = 取超时('SERVER_SOCKET_TIMEOUT_MS', 45_000, 10_000, 180_000);
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 1_000;
}

export function 创建生产服务器({
  env = process.env,
  distDir = 默认构建目录,
  logger = console,
  now = () => Date.now(),
  createReadStreamImpl = createReadStream,
} = {}) {
  const 构建目录 = resolve(distDir);
  const release = 验证发布运行时({ distDir: 构建目录 });
  const 状态 = { draining: false, release };
  const 关系中间件 = 创建关系AI中间件({ env });

  const server = createServer((req, res) => {
    const requestId头 = 取请求头(req, 'x-request-id');
    const requestId = 请求ID格式.test(requestId头) ? requestId头 : randomUUID();
    let url;
    try {
      url = new URL(req.url ?? '/', 'http://local');
    } catch {
      url = null;
    }
    const 编码路径 = url?.pathname ?? '';
    let 解码路径 = '';
    try {
      解码路径 = decodeURIComponent(编码路径);
    } catch {}
    const route = 日志路由(解码路径 || '/unknown');
    安装访问日志(req, res, { logger, requestId, route, now });
    设置通用安全头(req, res, env, requestId);

    const 处理 = async () => {
      if (!url || !解码路径) {
        发送错误(res, 400, 'BAD_REQUEST', '请求地址无效。');
        return;
      }
      const method = req.method ?? 'GET';
      if (解码路径 === '/livez') {
        if (!['GET', 'HEAD'].includes(method)) {
          发送错误(res, 405, 'METHOD_NOT_ALLOWED', '健康接口只接受 GET 或 HEAD。', { allow: 'GET, HEAD' });
          return;
        }
        发送JSON(res, 200, 健康正文(状态, 状态.draining ? 'draining' : 'live'));
        return;
      }
      if (解码路径 === '/readyz') {
        if (!['GET', 'HEAD'].includes(method)) {
          发送错误(res, 405, 'METHOD_NOT_ALLOWED', '健康接口只接受 GET 或 HEAD。', { allow: 'GET, HEAD' });
          return;
        }
        let 产物仍有效 = false;
        if (!状态.draining) {
          try {
            产物仍有效 = 发布信息相同(状态.release, 验证发布运行时({ distDir: 构建目录 }));
          } catch {}
        }
        const readyStatus = 状态.draining ? 'draining' : 产物仍有效 ? 'ready' : 'not_ready';
        发送JSON(res, readyStatus === 'ready' ? 200 : 503, 健康正文(状态, readyStatus));
        return;
      }
      if (状态.draining) {
        发送错误(res, 503, 'SERVER_DRAINING', '服务正在完成已有请求，请稍后重试。', { 'retry-after': '5' });
        return;
      }

      await 关系中间件(req, res, async () => {
        if (解码路径 === '/api' || 解码路径.startsWith('/api/')) {
          发送错误(res, 404, 'API_NOT_FOUND', '接口不存在。');
          return;
        }
        if (!['GET', 'HEAD'].includes(method)) {
          发送错误(res, 405, 'METHOD_NOT_ALLOWED', '静态运行时只接受 GET 或 HEAD。', { allow: 'GET, HEAD' });
          return;
        }
        const 相对路径 = 解码路径.replace(/^\/+/, '');
        const 候选 = resolve(构建目录, 相对路径 || 'index.html');
        if (候选 !== 构建目录 && !候选.startsWith(`${构建目录}${sep}`)) {
          发送错误(res, 403, 'FORBIDDEN', '请求路径不允许访问。');
          return;
        }
        if (await 发送文件(req, res, 候选, { createReadStreamImpl })) return;
        const SPA落点 = 规范SPA路径(解码路径);
        if (SPA路由.has(SPA落点) && !extname(解码路径) && 取请求头(req, 'accept').includes('text/html')) {
          await 发送文件(req, res, resolve(构建目录, 'index.html'), { createReadStreamImpl });
          return;
        }
        发送错误(res, 404, 'NOT_FOUND', '请求的页面或资源不存在。');
      });
    };

    处理().catch((错误) => {
      输出错误日志(logger, {
        event: 'runtime_error',
        requestId,
        route,
        code: String(错误?.code ?? 'INTERNAL_ERROR').slice(0, 80),
      });
      if (!res.headersSent && !res.writableEnded && !res.destroyed) {
        发送错误(res, 500, 'INTERNAL_ERROR', '服务暂时无法完成请求。');
      } else if (!res.writableEnded) {
        res.destroy(错误);
      }
    });
  });

  server[服务器状态] = 状态;
  Object.defineProperty(server, '开始排空', {
    enumerable: false,
    value: () => { 状态.draining = true; },
  });
  设置服务器超时(server, env);
  return server;
}

export function 开始优雅关闭(server, {
  logger = console,
  timeoutMs = 10_000,
  signal = 'SIGTERM',
  onComplete = () => {},
} = {}) {
  const 状态 = server?.[服务器状态];
  if (!状态 || 状态.draining) return false;
  状态.draining = true;
  let 已完成 = false;
  const 完成 = (code) => {
    if (已完成) return;
    已完成 = true;
    onComplete(code);
  };
  输出JSON日志(logger, { event: 'server_draining', signal });
  const 强制计时器 = setTimeout(() => {
    server.closeAllConnections?.();
    输出错误日志(logger, { event: 'server_drain_timeout', signal });
    完成(1);
  }, Math.max(1_000, timeoutMs));
  强制计时器.unref?.();
  server.close((错误) => {
    clearTimeout(强制计时器);
    if (已完成) return;
    if (错误) {
      输出错误日志(logger, { event: 'server_close_failed', signal, code: String(错误.code ?? 'CLOSE_FAILED') });
      完成(1);
      return;
    }
    输出JSON日志(logger, { event: 'server_closed', signal });
    完成(0);
  });
  server.closeIdleConnections?.();
  return true;
}

function 解析监听端口(值) {
  const 文本 = String(值 ?? '4173');
  if (!/^\d{1,5}$/u.test(文本)) throw 发布错误('INVALID_PORT');
  const port = Number(文本);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw 发布错误('INVALID_PORT');
  return port;
}

const 是直接运行 = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (是直接运行) {
  try {
    const port = 解析监听端口(process.env.PORT);
    const host = process.env.HOST || '0.0.0.0';
    // npm start 是生产运行时：默认启用 Secure 会话 Cookie。仅本地模型联调时可显式关闭。
    const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' };
    const server = 创建生产服务器({ env });
    server.on('error', (错误) => {
      输出错误日志(console, { event: 'server_error', code: String(错误?.code ?? 'SERVER_ERROR') });
      process.exitCode = 1;
    });
    server.listen(port, host, () => {
      const release = server[服务器状态].release;
      输出JSON日志(console, {
        event: 'server_started',
        host,
        port,
        version: release.version,
        commit: release.commit,
        betaMode: release.betaMode,
        aiMode: release.aiMode,
      });
    });
    const 退出 = (signal) => {
      开始优雅关闭(server, {
        signal,
        onComplete: (code) => { process.exitCode = code; },
      });
    };
    process.once('SIGTERM', () => 退出('SIGTERM'));
    process.once('SIGINT', () => 退出('SIGINT'));
  } catch (错误) {
    输出错误日志(console, { event: 'startup_failed', code: String(错误?.code ?? 'STARTUP_FAILED') });
    process.exitCode = 1;
  }
}
