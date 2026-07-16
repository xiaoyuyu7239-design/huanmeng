// 衍境·心界 Beta 的同源边缘入口。Sites 负责 HTTPS 与静态文件，Worker 只做：
// 1) SPA 精确路由；2) 健康探针；3) 作者备用关系回应；4) 安全头与无正文访问日志。
// 本文件不会读取或调用任何模型密钥，Level 9 的 aiMode 固定为 fallback。

const 产品标识 = 'yanjing-heartscape';
const SPA路由 = new Set(['/', '/play', '/game', '/creator', '/creators', '/worlds']);
const 安全id = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const 安全轮次id = /^[a-zA-Z0-9_-]{12,80}$/u;
const 安全请求id = /^[a-zA-Z0-9._-]{8,80}$/u;
const 允许关系字段 = new Set(['schemaVersion', 'storyId', 'nodeId', 'characterId', 'message', 'turnId']);
const 请求体上限 = 12 * 1024;
const 玩家输入上限 = 240;
const 语义版本格式 = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const 提交格式 = /^[0-9a-f]{40}$/u;
const 摘要格式 = /^[0-9a-f]{64}$/u;
const 必需发布产物 = new Set(['index.html', 'showcase.json', 'games/ninth-seat/story.json', 'server/index.js']);

const 现实危机模式 = /(?:不想活(?:了|下去)?|活不下去|想死|自杀|轻生|寻死|结束(?:自己|我的)?生命|伤害自己|自残|一了百了|割(?:开|破)?(?:手腕|腕)|割腕|跳楼|从.{0,10}(?:楼|高处|天台|桥).{0,10}跳(?:下|下去)|(?:吞|吃|服).{0,12}(?:很多|大量|过量|一整瓶|整瓶|一把).{0,8}(?:安眠药|药片|药物|药)|(?:吞|吃|服).{0,8}[1-9]\d{1,2}\s*(?:片|颗).{0,6}(?:药|安眠药)?|(?:吞|吃|服).{0,8}(?:毒药|农药)|上吊|吊死|勒死自己|烧炭|开煤气|喝农药|服毒|kill\s+myself|end\s+my\s+life|take\s+my\s+own\s+life|suicid(?:e|al)|self[-\s]?harm|cut\s+my\s+wrists?|jump\s+off.{0,20}(?:roof|building|bridge)|overdos(?:e|ed|ing)|(?:took|take|swallow(?:ed)?).{0,20}(?:too\s+many|a\s+lot\s+of|a\s+whole\s+bottle\s+of|a\s+handful\s+of).{0,10}(?:pills?|medication)|(?:took|swallow(?:ed)?)\s+[1-9]\d{1,2}\s+(?:pills?|tablets?)|hang\s+myself|poison\s+myself)/iu;
const 提示注入模式 = /(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|above|system|developer).{0,24}(?:instruction|prompt)|(?:system|developer)\s*(?:prompt|message)|reveal.{0,20}(?:prompt|instruction)|忽略.{0,16}(?:指令|提示|规则)|(?:泄露|显示|复述).{0,12}(?:系统提示|开发者消息)|把(?:好感|信任|边界|路线|结局|flag|状态).{0,12}(?:改成|设为|增加|减少|解锁)/iu;

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

function 是普通对象(值) {
  return !!值 && typeof 值 === 'object' && !Array.isArray(值);
}

function 单行文本(值, 最大长度 = 240) {
  return typeof 值 === 'string'
    ? 值.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 最大长度)
    : '';
}

function 请求id(request) {
  const 传入 = request.headers.get('x-request-id') ?? '';
  return 安全请求id.test(传入) ? 传入 : crypto.randomUUID();
}

function 安全响应头(headers, { html = false } = {}) {
  const 新头 = new Headers(headers);
  新头.set('content-security-policy', CSP);
  新头.set('cross-origin-opener-policy', 'same-origin');
  新头.set('cross-origin-resource-policy', 'same-origin');
  新头.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()');
  新头.set('referrer-policy', 'same-origin');
  新头.set('strict-transport-security', 'max-age=31536000');
  新头.set('x-content-type-options', 'nosniff');
  新头.set('x-frame-options', 'DENY');
  if (html) 新头.set('cache-control', 'no-cache');
  return 新头;
}

function JSON响应(status, body, id, extraHeaders = {}) {
  const headers = 安全响应头({
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-request-id': id,
    ...extraHeaders,
  });
  return new Response(JSON.stringify(body), { status, headers });
}

function 文本错误(status, message, id) {
  return new Response(message, {
    status,
    headers: 安全响应头({
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-request-id': id,
    }),
  });
}

function 是同源请求(request) {
  const fetchSite = (request.headers.get('sec-fetch-site') ?? '').toLowerCase();
  if (fetchSite && fetchSite !== 'same-origin') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function 推断意图(message) {
  if (/(?:停|暂停|先不说|到这里|不聊)/u.test(message)) return 'pause';
  if (/(?:不要|不能|不愿|边界|界限|拒绝|撤回|停止)/u.test(message)) return 'set_boundary';
  if (/(?:帮|陪|支持|听我|需要你|能不能)/u.test(message)) return 'ask_support';
  if (/(?:为什么|凭什么|质疑|不同意|不认同|责任)/u.test(message)) return 'challenge';
  if (/(?:明白|理解|确认|意思|对齐|说清)/u.test(message)) return 'seek_clarity';
  return 'share_feeling';
}

function 危机回应() {
  return {
    ok: true,
    source: 'safety',
    serviceStatus: 'guarded',
    intent: 'pause',
    intentLabel: '暂停对话',
    reply: '这听起来可能不只是剧情里的压力。请先暂停游戏并联系身边可信任的人；如果你已经实施伤害、服用了过量药物或正处于紧迫危险中，请立即联系当地急救服务，并尽量不要独处。这里无法替代现实中的危机支持。',
    memoryCandidate: '',
    safety: 'fallback',
    reason: 'real_world_crisis',
    notice: '这段输入不会发送给角色，也不会改变剧情。',
  };
}

async function 读取资产JSON(env, request, 路径) {
  const url = new URL(路径, request.url);
  const response = await env.ASSETS.fetch(new Request(url, { headers: { accept: 'application/json' } }));
  if (!response.ok) throw new Error(`asset unavailable: ${路径}`);
  const data = await response.json();
  if (!是普通对象(data)) throw new Error(`asset invalid: ${路径}`);
  return data;
}

async function 计算SHA256(buffer) {
  const 摘要 = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(摘要)].map((字节) => 字节.toString(16).padStart(2, '0')).join('');
}

async function 读取发布清单(env, request, { 验证产物 = false } = {}) {
  const 清单 = await 读取资产JSON(env, request, '/release.json');
  if (
    清单.schemaVersion !== 1 ||
    清单.product !== 产品标识 ||
    typeof 清单.version !== 'string' || !语义版本格式.test(清单.version) ||
    typeof 清单.commit !== 'string' || !提交格式.test(清单.commit) ||
    清单.betaMode !== 'public-preview' ||
    清单.aiMode !== 'fallback' ||
    typeof 清单.builtAt !== 'string' || !Number.isFinite(Date.parse(清单.builtAt)) ||
    !是普通对象(清单.source) || 清单.source.clean !== true || 清单.source.head !== 清单.commit ||
    !Array.isArray(清单.artifacts)
  ) throw new Error('release manifest invalid');
  const 产物表 = new Map();
  for (const 产物 of 清单.artifacts) {
    if (
      !是普通对象(产物) ||
      typeof 产物.path !== 'string' ||
      !Number.isInteger(产物.bytes) || 产物.bytes <= 0 ||
      typeof 产物.sha256 !== 'string' || !摘要格式.test(产物.sha256) ||
      产物.path.startsWith('/') || 产物.path.split('/').some((段) => !段 || 段 === '.' || 段 === '..') ||
      产物表.has(产物.path)
    ) throw new Error('release artifact invalid');
    产物表.set(产物.path, 产物);
  }
  if ([...必需发布产物].some((路径) => !产物表.has(路径))) throw new Error('release artifact missing');
  if (验证产物) {
    await Promise.all([...产物表.values()].map(async (产物) => {
      const url = new URL(`/${产物.path}`, request.url);
      const response = await env.ASSETS.fetch(new Request(url));
      if (!response.ok) throw new Error('release artifact unavailable');
      const 内容 = await response.arrayBuffer();
      if (内容.byteLength !== 产物.bytes || await 计算SHA256(内容) !== 产物.sha256) {
        throw new Error('release artifact mismatch');
      }
    }));
  }
  return 清单;
}

async function 健康响应(request, env, id, ready) {
  try {
    const 清单 = await 读取发布清单(env, request, { 验证产物: ready });
    return JSON响应(200, {
      ok: true,
      status: ready ? 'ready' : 'live',
      version: 清单.version,
      commit: 清单.commit,
      betaMode: 清单.betaMode,
      aiMode: 清单.aiMode,
    }, id);
  } catch {
    return JSON响应(ready ? 503 : 200, {
      ok: !ready,
      status: ready ? 'not_ready' : 'live',
      betaMode: 'public-preview',
      aiMode: 'fallback',
    }, id);
  }
}

async function 关系状态(request, id) {
  if (!是同源请求(request)) {
    return JSON响应(403, { ok: false, code: 'ORIGIN_NOT_ALLOWED', message: '关系回应只接受同源请求。' }, id);
  }
  return JSON响应(200, {
    ok: true,
    configured: false,
    mode: 'fallback',
    notice: 'Beta 当前使用作者预写备用回应；不会伪装成实时生成，也不会把本轮文字发送给模型供应商。',
    limits: { messageCharacters: 玩家输入上限, maxTurnsPerNode: 3, hourlyRequests: null },
  }, id);
}

async function 关系回应(request, env, id) {
  if (!是同源请求(request)) {
    return JSON响应(403, { ok: false, code: 'ORIGIN_NOT_ALLOWED', message: '关系回应只接受同源请求。' }, id);
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return JSON响应(415, { ok: false, code: 'JSON_REQUIRED', message: '只接受 JSON 请求。' }, id);
  }
  const 声明长度 = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (声明长度 > 请求体上限) {
    return JSON响应(413, { ok: false, code: 'BODY_TOO_LARGE', message: '请求体过大。' }, id);
  }
  const 原文 = await request.text();
  if (new TextEncoder().encode(原文).byteLength > 请求体上限) {
    return JSON响应(413, { ok: false, code: 'BODY_TOO_LARGE', message: '请求体过大。' }, id);
  }
  let body;
  try {
    body = JSON.parse(原文);
  } catch {
    return JSON响应(400, { ok: false, code: 'INVALID_JSON', message: '请求不是有效 JSON。' }, id);
  }
  if (!是普通对象(body) || body.schemaVersion !== 1 || Object.keys(body).some((键) => !允许关系字段.has(键))) {
    return JSON响应(400, { ok: false, code: 'REQUEST_CONTRACT_VIOLATION', message: '请求包含不受支持的字段。' }, id);
  }
  const storyId = 单行文本(body.storyId, 64);
  const nodeId = 单行文本(body.nodeId, 64);
  const characterId = 单行文本(body.characterId, 64);
  const turnId = 单行文本(body.turnId, 80);
  if (![storyId, nodeId, characterId].every((值) => 安全id.test(值)) || !安全轮次id.test(turnId)) {
    return JSON响应(400, { ok: false, code: 'INVALID_REQUEST_ID', message: '作品、场景、角色或轮次标识无效。' }, id);
  }
  const message = 单行文本(body.message, 玩家输入上限 + 1);
  if (!message) return JSON响应(400, { ok: false, code: 'EMPTY_MESSAGE', message: '请先写下想说的话。' }, id);
  if (message.length > 玩家输入上限) {
    return JSON响应(413, { ok: false, code: 'MESSAGE_TOO_LONG', message: `最多输入 ${玩家输入上限} 个字符。` }, id);
  }
  if (现实危机模式.test(message)) return JSON响应(200, 危机回应(), id);

  let story;
  try {
    story = await 读取资产JSON(env, request, '/games/ninth-seat/story.json');
  } catch {
    return JSON响应(503, { ok: false, code: 'STORY_CONTRACT_UNAVAILABLE', message: '作者回应合同暂时不可用。' }, id);
  }
  const 关系配置 = story?.content?.relationshipAI;
  const 会话 = Array.isArray(关系配置?.sessions)
    ? 关系配置.sessions.find((条) => 条?.nodeId === nodeId && 条?.characterId === characterId)
    : null;
  if (storyId !== story.id || !会话) {
    return JSON响应(403, { ok: false, code: 'SESSION_NOT_ALLOWED', message: '当前作品、章节或角色不在关系场景白名单中。' }, id);
  }
  const 意图表 = new Map(
    (Array.isArray(关系配置.allowedIntents) ? 关系配置.allowedIntents : [])
      .map((条) => [单行文本(条?.id, 40), 单行文本(条?.label, 30)])
      .filter(([意图, 标签]) => 安全id.test(意图) && 标签),
  );
  const intent = 意图表.has(推断意图(message)) ? 推断意图(message) : 'share_feeling';
  const guarded = 提示注入模式.test(message);
  const reply = 单行文本(guarded ? 会话.fallbackReplies?.safe_guard : 会话.fallbackReplies?.[intent], 260);
  if (!reply || !意图表.has(intent)) {
    return JSON响应(503, { ok: false, code: 'AUTHOR_CONTRACT_INVALID', message: '作者回应合同暂时不可用。' }, id);
  }
  const intentLabel = 意图表.get(intent);
  return JSON响应(200, {
    ok: true,
    source: 'fallback',
    serviceStatus: guarded ? 'guarded' : 'unconfigured',
    intent,
    intentLabel,
    reply,
    memoryCandidate: `本轮${会话.mode === 'peer-alliance' ? '同盟对表' : '章节私聊'}的表达标签：${intentLabel}。不写入剧情状态。`,
    safety: 'fallback',
    reason: guarded ? 'unsafe_input' : 'beta_fallback_only',
    notice: 单行文本(关系配置.notice, 220),
  }, id);
}

function 资产缓存策略(pathname, contentType) {
  if (pathname === '/index.html' || contentType.includes('text/html')) return 'no-cache';
  if (pathname === '/release.json' || pathname === '/showcase.json' || pathname.startsWith('/games/')) return 'no-cache';
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (/^\/(?:videos|panoramas|portraits|voices|music|landing)\//u.test(pathname)) {
    return 'public, max-age=86400, stale-while-revalidate=604800';
  }
  return 'public, max-age=3600';
}

async function 静态响应(request, env, id) {
  if (!['GET', 'HEAD'].includes(request.method)) return 文本错误(405, 'Method Not Allowed', id);
  const url = new URL(request.url);
  let response = await env.ASSETS.fetch(request);
  if (response.status === 404 && SPA路由.has(url.pathname.replace(/\/+$/u, '') || '/') && (request.headers.get('accept') ?? '').includes('text/html')) {
    response = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), {
      method: request.method,
      headers: request.headers,
    }));
  }
  if (response.status === 404) return 文本错误(404, 'Not Found', id);
  const contentType = response.headers.get('content-type') ?? '';
  const headers = 安全响应头(response.headers, { html: contentType.includes('text/html') });
  headers.set('cache-control', 资产缓存策略(url.pathname, contentType));
  headers.set('x-request-id', id);
  if (request.method !== 'HEAD' && contentType.includes('text/html')) {
    const html = (await response.text()).replaceAll('__YANJING_PUBLIC_ORIGIN__', url.origin);
    headers.delete('content-length');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function 处理请求(request, env, ctx) {
  const id = 请求id(request);
  const 开始 = Date.now();
  const url = new URL(request.url);
  let response;
  try {
    if (url.pathname === '/livez' && request.method === 'GET') response = await 健康响应(request, env, id, false);
    else if (url.pathname === '/readyz' && request.method === 'GET') response = await 健康响应(request, env, id, true);
    else if (url.pathname === '/api/relationship-chat/status' && request.method === 'GET') response = await 关系状态(request, id);
    else if (url.pathname === '/api/relationship-chat' && request.method === 'POST') response = await 关系回应(request, env, id);
    else if (url.pathname.startsWith('/api/')) response = JSON响应(404, { ok: false, code: 'NOT_FOUND', message: '接口不存在。' }, id);
    else response = await 静态响应(request, env, id);
  } catch {
    response = JSON响应(500, { ok: false, code: 'INTERNAL_ERROR', message: '服务暂时不可用。' }, id);
  }
  const 日志 = JSON.stringify({
    event: 'http_request',
    requestId: id,
    method: request.method,
    route: url.pathname.startsWith('/api/') ? url.pathname : (SPA路由.has(url.pathname) ? url.pathname : 'static'),
    status: response.status,
    latencyMs: Date.now() - 开始,
    aiMode: 'fallback',
  });
  if (ctx?.waitUntil) ctx.waitUntil(Promise.resolve().then(() => console.log(日志)));
  else console.log(日志);
  return response;
}

export default { fetch: 处理请求 };
export { 处理请求 };
