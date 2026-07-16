import { useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { 构建试玩返回地址, 是规范作品slug } from './试玩来源.js';
import '../样式/入口-作品加载失败.css';

// 显式作品请求失败时的独立终点。这个组件不 import 播放器、剧情状态或存档系统，
// 因此显示失败页本身不可能创建/覆盖《第九席》存档。
export default function 作品加载失败({ 来源, 原因 = 'load-failed' }) {
  const 标题ref = useRef(null);
  const 作品 = 是规范作品slug(来源?.gameId) ? 来源.gameId : '';
  const 是创作草稿 = 来源?.kind === 'creator-draft' && Boolean(作品);
  const 返回地址 = 构建试玩返回地址(来源, 作品);
  const 是无效地址 = 原因 === 'invalid-slug';

  useEffect(() => {
    标题ref.current?.focus();
  }, []);

  const 说明 = 是无效地址
    ? '链接中的作品编号不符合规则，请从玩家首页重新选择作品。'
    : 是创作草稿
      ? '没有找到可试玩的有效本机草稿。请返回创作台，检查开场节点与故事结构。'
      : '该作品不存在、暂时无法读取，或剧情数据已损坏。我们没有用其他故事代替它。';

  return (
    <main className="player-load-error" data-reason={原因}>
      <div className="player-load-error-glow" aria-hidden="true" />
      <section aria-labelledby="player-load-error-title" className="player-load-error-card" role="alert">
        <p className="player-load-error-kicker">STORY UNAVAILABLE</p>
        <h1 id="player-load-error-title" ref={标题ref} tabIndex="-1">
          {是无效地址 ? '这个作品地址无效' : '这段故事暂时无法打开'}
        </h1>
        {作品 && <code>{作品}</code>}
        <p className="player-load-error-copy">{说明}</p>
        <div className="player-load-error-actions">
          <a className="player-load-error-primary" href={返回地址}>
            <ArrowLeft aria-hidden="true" size={17} />
            {是创作草稿 ? '返回创作项目' : '返回玩家首页'}
          </a>
          {!是无效地址 && (
            <button onClick={() => window.location.reload()} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              重新尝试
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
