// 已读对白历史。条目由播放器应用根据 visitedNodes + 当前 lineIndex 解析后传入，
// 本组件只负责安全呈现，不读取/改写进度，因此不会意外泄露尚未看到的台词。
//
// 条目最小形态：{ id, speaker, text }
// 可选：speakerName/name、portrait/portraits、expression/emotion、chapter、nodeTitle、location。

import { useEffect, useId, useMemo, useState } from 'react';
import { History, X } from 'lucide-react';
import { 解析说话人呈现 } from './角色呈现.js';

export default function 对白历史面板({
  条目们 = [],
  标题 = '对白记录',
  说明 = '只收录你已经读过的内容',
  当前条目id = '',
  关闭,
}) {
  const 安全条目们 = useMemo(() => 规范化条目列表(条目们), [条目们]);
  const 标题id = `dialogue-history-${useId().replace(/:/g, '')}`;

  return (
    <section className="dialogue-history-panel" aria-labelledby={标题id}>
      <header className="dialogue-history-head">
        <span className="dialogue-history-mark" aria-hidden="true">
          <History size={18} />
        </span>
        <div>
          <h2 id={标题id}>{标题}</h2>
          {说明 && <p>{说明}</p>}
        </div>
        {typeof 关闭 === 'function' && (
          <button aria-label="关闭对白记录" onClick={关闭} title="关闭" type="button">
            <X aria-hidden="true" size={18} />
          </button>
        )}
      </header>

      {安全条目们.length === 0 ? (
        <div className="dialogue-history-empty" role="status">
          <span aria-hidden="true">“</span>
          <strong>对白会从这里留下痕迹</strong>
          <p>继续故事后，你已经读过的台词会按发生顺序出现在这里。</p>
        </div>
      ) : (
        <ol className="dialogue-history-list" aria-label="已读对白">
          {安全条目们.map((条目, 索引) => (
            <对白历史条目
              key={条目.id || `${条目.speaker}-${索引}`}
              条目={条目}
              当前={Boolean(当前条目id && 当前条目id === 条目.id)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function 对白历史条目({ 条目, 当前 }) {
  const 呈现 = useMemo(() => 解析说话人呈现(条目), [条目]);
  const [头像失败, set头像失败] = useState(false);
  const 元信息 = [条目.chapter, 条目.nodeTitle, 条目.location].filter(取非空字符串).join(' · ');
  useEffect(() => set头像失败(false), [呈现.立绘]);

  return (
    <li aria-current={当前 ? 'true' : undefined} className={当前 ? 'is-current' : undefined}>
      <article style={{ '--character-color': 呈现.color }}>
        <div className={`dialogue-history-avatar${呈现.无立绘 ? ' is-narration' : ''}`} aria-hidden="true">
          {呈现.立绘 && !头像失败 ? (
            <img src={呈现.立绘} alt="" onError={() => set头像失败(true)} />
          ) : (
            <span>{呈现.无立绘 ? '“' : 取首字(呈现.名字)}</span>
          )}
        </div>
        <div className="dialogue-history-copy">
          <header>
            <strong>{呈现.名字}</strong>
            {!呈现.无立绘 && <em>{呈现.表情名}</em>}
          </header>
          {元信息 && <small>{元信息}</small>}
          <p>{条目.text}</p>
        </div>
      </article>
    </li>
  );
}

function 规范化条目列表(条目们) {
  return (Array.isArray(条目们) ? 条目们 : []).flatMap((条目, 索引) => {
    if (!条目 || typeof 条目 !== 'object' || typeof 条目.text !== 'string') return [];
    const text = 条目.text.trim();
    if (!text) return [];
    return [{
      ...条目,
      id: 取非空字符串(条目.id) || `history-${索引}`,
      speaker: 取非空字符串(条目.speaker) || 'narrator',
      text,
    }];
  });
}

function 取首字(名字) {
  return Array.from(取非空字符串(名字) || '角')[0];
}

function 取非空字符串(值) {
  return typeof 值 === 'string' ? 值.trim() : '';
}
