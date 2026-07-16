import React from 'react';

function 品牌标识() {
  return (
    <a className="hx-brand" href="#top" aria-label="衍境·心界，返回页首">
      <span className="hx-brand-mark" aria-hidden="true"><i /></span>
      <span>
        <b>衍境·心界</b>
        <small>会记住选择的互动故事</small>
      </span>
    </a>
  );
}

export function 导航栏({ navRef, playHref }) {
  return (
    <nav className="hx-nav" ref={navRef} aria-label="主导航">
      <div className="hx-wrap hx-nav-inner">
        <品牌标识 />
        <div className="hx-nav-links">
          <a href="#story">故事</a>
          <a href="#memories">记忆</a>
          <a href="#characters">角色</a>
          <a href="#endings">结局</a>
        </div>
        <div className="hx-nav-actions">
          <a className="hx-creator-link" href="/creators">创作者</a>
          <a className="hx-nav-cta" href={playHref}>进入故事</a>
        </div>
      </div>
    </nav>
  );
}

export function 页脚({ playHref }) {
  return (
    <footer className="hx-footer">
      <div className="hx-wrap">
        <div className="hx-footer-main">
          <品牌标识 />
          <div className="hx-footer-links">
            <div>
              <h2>开始故事</h2>
              <a href={playHref}>进入旗舰世界</a>
              <a href="#worlds">更多实验世界</a>
            </div>
            <div>
              <h2>了解心界</h2>
              <a href="#memories">故事记忆</a>
              <a href="#characters">现场人物</a>
              <a href="#endings">阶段结果</a>
            </div>
            <div>
              <h2>创作工具</h2>
              <a href="/creators">创作者能力介绍</a>
              <a href="/creator">进入创作台</a>
            </div>
          </div>
        </div>
        <div className="hx-footer-bottom">
          <span>© 2026 衍境·心界</span>
          <span>当前版本提供作者分支、结构化记忆与受约束关系回应；AI 未接入时明确使用作者预设回应。</span>
        </div>
      </div>
    </footer>
  );
}
