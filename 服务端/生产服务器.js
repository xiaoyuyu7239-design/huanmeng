// 构建产物的最小 Node 运行时：同一进程提供 SPA 静态文件与关系 AI 代理。
// 这样生产密钥只存在服务进程环境变量；纯静态托管仍可运行剧情，但关系回应会明确降级。
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 创建关系AI中间件 } from './关系AI代理.js';

const 当前目录 = fileURLToPath(new URL('.', import.meta.url));
const 默认构建目录 = resolve(当前目录, '../dist');
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

function 设置静态安全头(res, 路径) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('cross-origin-resource-policy', 'same-origin');
  res.setHeader('cache-control', 路径.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
}

async function 发送文件(req, res, 路径) {
  const 信息 = await stat(路径);
  if (!信息.isFile()) return false;
  设置静态安全头(res, 路径);
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('content-type', 类型表[extname(路径).toLowerCase()] ?? 'application/octet-stream');
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/u);
  if (range && 信息.size > 0) {
    const 开始 = range[1] ? Number(range[1]) : 0;
    const 结束 = range[2] ? Math.min(Number(range[2]), 信息.size - 1) : 信息.size - 1;
    if (!Number.isInteger(开始) || !Number.isInteger(结束) || 开始 < 0 || 结束 < 开始 || 开始 >= 信息.size) {
      res.statusCode = 416;
      res.setHeader('content-range', `bytes */${信息.size}`);
      res.end();
      return true;
    }
    res.statusCode = 206;
    res.setHeader('content-range', `bytes ${开始}-${结束}/${信息.size}`);
    res.setHeader('content-length', 结束 - 开始 + 1);
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    createReadStream(路径, { start: 开始, end: 结束 }).pipe(res);
    return true;
  }
  res.statusCode = 200;
  res.setHeader('content-length', 信息.size);
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(路径).pipe(res);
  return true;
}

export function 创建生产服务器({ env = process.env, distDir = 默认构建目录 } = {}) {
  const 构建目录 = resolve(distDir);
  const 关系中间件 = 创建关系AI中间件({ env });
  return createServer((req, res) => {
    关系中间件(req, res, async () => {
      if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
        res.statusCode = 405;
        res.setHeader('allow', 'GET, HEAD');
        res.end('Method Not Allowed');
        return;
      }
      try {
        const url = new URL(req.url ?? '/', 'http://local');
        const 解码路径 = decodeURIComponent(url.pathname);
        const 相对路径 = 解码路径.replace(/^\/+/, '');
        const 候选 = resolve(构建目录, 相对路径 || 'index.html');
        if (候选 !== 构建目录 && !候选.startsWith(`${构建目录}${sep}`)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        try {
          if (await 发送文件(req, res, 候选)) return;
        } catch {}
        if (!extname(解码路径) && 取接收类型(req).includes('text/html')) {
          await 发送文件(req, res, resolve(构建目录, 'index.html'));
          return;
        }
        res.statusCode = 404;
        res.end('Not Found');
      } catch {
        res.statusCode = 400;
        res.end('Bad Request');
      }
    });
  });
}

function 取接收类型(req) {
  return String(req.headers.accept ?? '');
}

const 是直接运行 = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (是直接运行) {
  const port = Number.parseInt(process.env.PORT ?? '4173', 10);
  const host = process.env.HOST || '0.0.0.0';
  // npm start 是生产运行时：默认启用 Secure 会话 Cookie。仅本地模型联调时可显式关闭。
  const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' };
  const server = 创建生产服务器({ env });
  server.listen(port, host, () => {
    const 展示地址 = host === '0.0.0.0' ? '127.0.0.1' : host;
    console.log(`衍境生产预览已启动：http://${展示地址}:${port}`);
    console.log('关系 AI 密钥仅从服务端 RELATIONSHIP_AI_* 环境变量读取。');
  });
}
