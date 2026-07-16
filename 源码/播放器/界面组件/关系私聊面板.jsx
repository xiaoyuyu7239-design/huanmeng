import { MessageCircle, Send, ShieldCheck, Trash2, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  关系私聊输入上限,
  创建私聊轮次id,
  查询关系AI状态,
  发送关系私聊,
  生成本地备用回应,
} from '../关系AI/关系私聊客户端.js';

export function 关系回应标签(条目) {
  if (条目.source === 'model-assisted' && 条目.serviceStatus === 'connected') return 'AI 理解 · 作者定稿回应';
  if (条目.source === 'safety') return '安全支持信息';
  return {
    unconfigured: '作者预设回应 · AI 未接入',
    offline: '作者预设回应 · 服务不可用',
    guarded: '安全备用回应 · 未发送模型',
    rate_limited: '作者预设回应 · 频次保护',
    budget_limited: '作者预设回应 · 额度保护',
    degraded: '作者预设回应 · 连接异常',
  }[条目.serviceStatus] ?? '作者预设回应';
}

function 状态文案(capability) {
  if (capability.state === 'checking') return { className: 'is-checking', text: '正在确认服务状态' };
  if (capability.state === 'connected') return { className: 'is-connected', text: 'AI 意图理解已配置' };
  if (capability.state === 'unconfigured') return { className: 'is-fallback', text: 'AI 未接入 · 使用预设回应' };
  return { className: 'is-offline', text: '服务不可用 · 使用预设回应' };
}

export default function 关系私聊面板({ character, config, entries, setEntries, usedTurns = 0, setUsedTurns = () => {} }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [capability, setCapability] = useState({ state: 'checking', notice: '' });
  const 请求ref = useRef(null);

  useEffect(() => {
    const 控制器 = new AbortController();
    查询关系AI状态({ signal: 控制器.signal })
      .then((结果) => setCapability({
        state: 结果.configured ? 'connected' : 'unconfigured',
        notice: 结果.notice,
      }))
      .catch((异常) => {
        if (异常?.name !== 'AbortError') setCapability({
          state: 'offline',
          notice: '无法连接同源关系服务，当前只展示作者预设回应。',
        });
      });
    return () => {
      控制器.abort();
      请求ref.current?.abort();
    };
  }, [config.nodeId]);

  const 已用轮数 = Math.min(config.maxTurns, Math.max(0, Number.parseInt(usedTurns, 10) || 0));
  const 已达上限 = 已用轮数 >= config.maxTurns;
  const 状态 = 状态文案(capability);
  const 角色名 = character?.name ?? '对话角色';
  const 场景称呼 = config.mode === 'peer-alliance' ? '同盟对表' : '章节私聊';
  const 头像 = character?.portraits?.warm || character?.portrait || '';
  const 剩余字数 = 关系私聊输入上限 - draft.length;
  const 建议 = useMemo(() => config.suggestions.filter((条) => !entries.some((消息) => 消息.text === 条)), [config.suggestions, entries]);

  const 发送 = async () => {
    const message = draft.trim();
    if (!message || sending || 已达上限) return;
    setError('');
    const turnId = 创建私聊轮次id();
    setUsedTurns((旧) => Math.min(config.maxTurns, (Number.parseInt(旧, 10) || 0) + 1));
    setEntries((旧) => [...旧, { id: `${turnId}-player`, role: 'player', text: message }]);
    setDraft('');
    setSending(true);
    const 控制器 = new AbortController();
    请求ref.current = 控制器;
    try {
      const 结果 = await 发送关系私聊({
        config,
        message,
        turnId,
        signal: 控制器.signal,
      });
      setEntries((旧) => [...旧, {
        id: `${turnId}-character`,
        role: 'character',
        text: 结果.reply,
        ...结果,
      }]);
      if (!结果.ok) setError('本次即时请求触发了保护限制，已切换到作者预设回应。');
    } catch (异常) {
      if (异常?.name === 'AbortError') return;
      const 备用 = 生成本地备用回应(config, message, 'offline');
      setEntries((旧) => [...旧, {
        id: `${turnId}-fallback`,
        role: 'character',
        text: 备用.reply,
        ...备用,
      }]);
      setError(异常?.message || '即时回应暂时不可用，已切换到作者预设回应。');
      setCapability({ state: 'offline', notice: '同源关系服务暂时不可用；作者剧情仍可正常继续。' });
    } finally {
      if (请求ref.current === 控制器) 请求ref.current = null;
      setSending(false);
    }
  };

  const 清空 = () => {
    请求ref.current?.abort();
    请求ref.current = null;
    setSending(false);
    setEntries([]);
    setDraft('');
    setError('');
  };

  return (
    <div className="relationship-chat-panel">
      <section className="relationship-chat-identity">
        <div className="relationship-chat-avatar" style={{ '--chat-accent': character?.color }}>
          {头像 ? <img alt="" src={头像} /> : 角色名.slice(0, 1)}
        </div>
        <div>
          <span>{config.mode === 'peer-alliance' ? '平级同盟对表' : '章节后私聊'}</span>
          <strong>{角色名}</strong>
          <small>{character?.role}</small>
        </div>
      </section>

      <div aria-live="polite" className={`relationship-chat-service ${状态.className}`} role="status">
        {capability.state === 'offline' ? <WifiOff size={15} /> : <ShieldCheck size={15} />}
        <div><strong>{状态.text}</strong><span>{capability.notice || config.notice}</span></div>
      </div>

      <p className="relationship-chat-opening">{config.opening}</p>
      <div className="relationship-chat-boundary">
        <ShieldCheck aria-hidden="true" size={15} />
        <span>回应只补充当前场景，不会执行选择，也不会改变心动、信任、边界、路线或结局。</span>
      </div>

      <section aria-label={`与${角色名}的临时${场景称呼}`} className={entries.length ? 'relationship-chat-log' : 'relationship-chat-log is-empty'}>
        {entries.length ? entries.map((条目) => (
          <article className={`relationship-chat-message is-${条目.role}`} key={条目.id}>
            <span>{条目.role === 'player' ? '许澄 · 你' : 关系回应标签(条目)}</span>
            <p>{条目.text}</p>
            {条目.role === 'character' && 条目.memoryCandidate && (
              <small>{条目.memoryCandidate}</small>
            )}
          </article>
        )) : (
          <div>
            <MessageCircle aria-hidden="true" size={24} />
            <strong>这段对话还没有开始</strong>
            <span>可以选一句作为起点，也可以直接写下自己的话。</span>
          </div>
        )}
        {sending && (
          <article aria-live="polite" className="relationship-chat-message is-character is-typing">
            <span>{角色名}正在回应</span><i /><i /><i />
          </article>
        )}
      </section>

      {!entries.length && 建议.length > 0 && (
        <div aria-label="建议表达" className="relationship-chat-suggestions">
          {建议.map((条) => <button key={条} onClick={() => setDraft(条)} type="button">{条}</button>)}
        </div>
      )}

      {error && <p aria-live="polite" className="relationship-chat-error" role="alert">{error}</p>}

      <div className="relationship-chat-composer">
        <textarea
          aria-label="写下想对角色说的话"
          disabled={sending || 已达上限}
          maxLength={关系私聊输入上限}
          onChange={(事件) => setDraft(事件.target.value)}
          onKeyDown={(事件) => {
            if ((事件.ctrlKey || 事件.metaKey) && 事件.key === 'Enter') {
              事件.preventDefault();
              发送();
            }
          }}
          placeholder={已达上限 ? `本次${场景称呼}已结束，请继续作者剧情。` : '写下疑问、感受、边界或需要的支持……'}
          rows={4}
          value={draft}
        />
        <div>
          <span className={剩余字数 < 30 ? 'is-near-limit' : ''}>{draft.length} / {关系私聊输入上限}</span>
          <button disabled={!draft.trim() || sending || 已达上限} onClick={发送} type="button">
            <Send aria-hidden="true" size={15} />{sending ? '回应中' : '发送'}
          </button>
        </div>
      </div>

      <footer className="relationship-chat-footer">
        <span>{已用轮数} / {config.maxTurns} 轮 · 关闭后本节点内暂存，离开场景即清除</span>
        {entries.length > 0 && <button disabled={sending} onClick={清空} type="button"><Trash2 size={14} />清除本次{场景称呼}</button>}
      </footer>
    </div>
  );
}
