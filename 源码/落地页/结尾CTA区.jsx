// 这个文件是落地页的"收银台前最后一声吆喝"：满幅立绘打底、金色大标题居中，
// 两个按钮把人送去创作台或玩家端——逛完整个商场，出口只留这一个动作。
import React from 'react';

// 结尾CTA区：输入无 → 渲染背景立绘 + 居中标语 + 两个跳转按钮 → 吐出 section.final#cta
export function 结尾CTA区() {
  return (
    <section className="final" id="cta">
      <div className="fbg" aria-hidden="true">
        <img src="/landing/char-lin.webp" alt="" />
      </div>
      <div className="wrap final-in reveal">
        <span className="eyebrow" style={{ justifyContent: 'center' }}>
          开始你的第一部互动影游
        </span>
        <h2>
          每一次生成、校验、修正，
          <br />
          都会变成<em>下一次创作</em>的经验。
        </h2>
        <p>从精选 Demo 开始，体验可持续进化的互动影游创作系统。</p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/creator">
            进入创作台 <span className="arrow">→</span>
          </a>
          <a className="btn btn-ghost" href="/play">先看玩家端演示</a>
        </div>
      </div>
    </section>
  );
}
