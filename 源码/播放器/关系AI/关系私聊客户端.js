// 关系私聊的浏览器边界：只发送最小字段，聊天记录只留在组件内存，绝不写进剧情 state / 存档。
import { 创建现实危机安全回应, 是现实危机表达 } from '../../公共工具/现实危机保护.js';

export const 关系私聊最大轮数 = 3;
export const 关系私聊输入上限 = 240;
export const 关系私聊状态超时毫秒 = 6000;
export const 关系私聊回应超时毫秒 = 15000;
const 安全id = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const 允许模式 = new Set(['private-debrief', 'peer-alliance']);
const 默认意图 = 'share_feeling';

function 是普通对象(值) {
  return !!值 && typeof 值 === 'object' && !Array.isArray(值);
}

function 文本(值, 最大长度 = 240) {
  return typeof 值 === 'string'
    ? 值.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 最大长度)
    : '';
}

function 推断意图(message) {
  if (/(?:停|暂停|先不说|到这里|不聊)/u.test(message)) return 'pause';
  if (/(?:不要|不能|不愿|边界|界限|拒绝|撤回|停止)/u.test(message)) return 'set_boundary';
  if (/(?:帮|陪|支持|听我|需要你|能不能)/u.test(message)) return 'ask_support';
  if (/(?:为什么|凭什么|质疑|不同意|不认同|责任)/u.test(message)) return 'challenge';
  if (/(?:明白|理解|确认|意思|对齐|说清)/u.test(message)) return 'seek_clarity';
  return 默认意图;
}

export function 取关系私聊配置(storyId, content, node) {
  if (storyId !== 'ninth-seat' || !是普通对象(content?.relationshipAI) || !是普通对象(node)) return null;
  const 原配置 = (Array.isArray(content.relationshipAI.sessions) ? content.relationshipAI.sessions : [])
    .find((条) => 条?.nodeId === node.id);
  if (!是普通对象(原配置)) return null;
  const nodeId = 文本(原配置.nodeId, 64);
  const characterId = 文本(原配置.characterId, 64);
  const mode = 文本(原配置.mode, 32);
  if (!安全id.test(nodeId) || !安全id.test(characterId) || !允许模式.has(mode)) return null;
  if (mode === 'private-debrief' && node.chapter !== '私聊') return null;
  if (mode === 'peer-alliance' && node.chapter !== '关系复盘') return null;
  if (!(node.lines ?? []).some((行) => 行?.speaker === characterId)) return null;

  const intents = new Map(
    (Array.isArray(content.relationshipAI.allowedIntents) ? content.relationshipAI.allowedIntents : [])
      .map((条) => [文本(条?.id, 40), 文本(条?.label, 24)])
      .filter(([id, label]) => 安全id.test(id) && label),
  );
  if (!intents.has(默认意图)) return null;
  const fallbackReplies = {};
  for (const intent of intents.keys()) {
    const reply = 文本(原配置.fallbackReplies?.[intent], 260);
    if (!reply) return null;
    fallbackReplies[intent] = reply;
  }
  fallbackReplies.safe_guard = 文本(原配置.fallbackReplies?.safe_guard, 260);
  if (!fallbackReplies.safe_guard) return null;
  return Object.freeze({
    storyId,
    nodeId,
    characterId,
    mode,
    opening: 文本(原配置.opening, 180),
    suggestions: (Array.isArray(原配置.suggestions) ? 原配置.suggestions : []).map((条) => 文本(条, 120)).filter(Boolean).slice(0, 3),
    notice: 文本(content.relationshipAI.notice, 240),
    intents,
    fallbackReplies: Object.freeze(fallbackReplies),
    maxTurns: 关系私聊最大轮数,
  });
}

function 新随机id(前缀) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${前缀}_${uuid}`;
  const 随机 = Math.random().toString(36).slice(2);
  return `${前缀}_${Date.now().toString(36)}_${随机.padEnd(12, '0')}`;
}

export function 创建私聊轮次id() {
  return 新随机id('turn').slice(0, 80);
}

async function 带超时JSON请求(fetchImpl, url, options, 超时毫秒) {
  const 控制器 = new AbortController();
  const 外部信号 = options.signal;
  let 中止拒绝 = () => {};
  const 中止Promise = new Promise((_resolve, reject) => { 中止拒绝 = reject; });
  const 外部中止 = () => {
    控制器.abort(外部信号?.reason);
    const 错误 = new Error('请求已取消。');
    错误.name = 'AbortError';
    中止拒绝(错误);
  };
  if (外部信号?.aborted) 外部中止();
  else 外部信号?.addEventListener?.('abort', 外部中止, { once: true });
  const 计时器 = setTimeout(() => {
    控制器.abort();
    中止拒绝(new Error('关系服务响应超时，已切换到作者预设回应。'));
  }, 超时毫秒);
  const 请求Promise = (async () => {
    const 响应 = await fetchImpl(url, { ...options, signal: 控制器.signal });
    const 类型 = String(响应.headers?.get?.('content-type') ?? '').toLowerCase();
    if (!类型.includes('application/json')) throw new Error('关系服务返回了无效格式。');
    const 原文 = await 响应.text();
    if (原文.length > 16 * 1024) throw new Error('关系服务响应过大。');
    let 数据 = null;
    try {
      数据 = JSON.parse(原文);
    } catch {
      throw new Error('关系服务返回了无效 JSON。');
    }
    return { 响应, 数据 };
  })();
  try {
    return await Promise.race([请求Promise, 中止Promise]);
  } finally {
    clearTimeout(计时器);
    外部信号?.removeEventListener?.('abort', 外部中止);
  }
}

export async function 查询关系AI状态({ signal, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('关系私聊服务不可用。');
  const { 响应, 数据 } = await 带超时JSON请求(fetchImpl, '/api/relationship-chat/status', {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal,
  }, 关系私聊状态超时毫秒);
  if (!响应.ok || !是普通对象(数据)) throw new Error(文本(数据?.message, 120) || '无法确认关系私聊服务状态。');
  return {
    configured: 数据.configured === true,
    mode: 数据.mode === 'model' ? 'model' : 'fallback',
    notice: 文本(数据.notice, 180),
  };
}

export async function 发送关系私聊({
  config,
  message,
  turnId,
  signal,
  fetchImpl = globalThis.fetch,
  timeoutMs = 关系私聊回应超时毫秒,
}) {
  if (typeof fetchImpl !== 'function') throw new Error('关系私聊服务不可用。');
  const 玩家文字 = 文本(message, 关系私聊输入上限 + 1);
  if (!玩家文字) throw new Error('请先写下想说的话。');
  if (玩家文字.length > 关系私聊输入上限) throw new Error(`最多输入 ${关系私聊输入上限} 个字符。`);
  if (是现实危机表达(玩家文字)) return 创建现实危机安全回应();
  const { 响应, 数据 } = await 带超时JSON请求(fetchImpl, '/api/relationship-chat', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: 1,
      storyId: config.storyId,
      nodeId: config.nodeId,
      characterId: config.characterId,
      message: 玩家文字,
      turnId,
    }),
    cache: 'no-store',
    signal,
  }, timeoutMs);
  const reply = 文本(数据?.reply, 260);
  if ((!响应.ok && !reply) || !是普通对象(数据))
    throw new Error(文本(数据?.message, 120) || '角色回应暂时不可用。');
  const intent = config.intents.has(数据.intent) ? 数据.intent : 推断意图(玩家文字);
  const intentLabel = 文本(数据.intentLabel, 30) || config.intents.get(intent) || '本次表达';
  return {
    ok: 响应.ok && 数据.ok !== false,
    source: ['model-assisted', 'fallback', 'safety'].includes(数据.source) ? 数据.source : 'fallback',
    serviceStatus: 文本(数据.serviceStatus, 40) || (响应.ok ? 'degraded' : 'offline'),
    intent,
    intentLabel,
    reply: reply || config.fallbackReplies[intent],
    // 展示标签由客户端按正式意图表再次确定生成，不信任远端自由摘要。
    memoryCandidate: `本轮${config.mode === 'peer-alliance' ? '同盟对表' : '章节私聊'}的表达标签：${intentLabel}。不写入剧情状态。`,
    reason: 文本(数据.reason ?? 数据.code, 60),
  };
}

export function 生成本地备用回应(config, message, serviceStatus = 'offline') {
  if (是现实危机表达(message)) return 创建现实危机安全回应();
  const intent = config.intents.has(推断意图(message)) ? 推断意图(message) : 默认意图;
  const intentLabel = config.intents.get(intent) ?? '本次表达';
  return {
    ok: true,
    source: 'fallback',
    serviceStatus,
    intent,
    intentLabel,
    reply: config.fallbackReplies[intent],
    memoryCandidate: `本轮${config.mode === 'peer-alliance' ? '同盟对表' : '章节私聊'}的表达标签：${intentLabel}。不写入剧情状态。`,
    reason: 'client_fallback',
  };
}
