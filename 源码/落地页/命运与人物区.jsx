// 这个文件是落地页的"展馆两个厅"：命运机制厅摆三张概念卡（像博物馆的三块展板），
// 人物生成厅是一面照片墙 + 一条永远走不完的传送带（角色跑马灯）。
import React from 'react';

// 角色跑马灯数据：照原样抄自线上代码顶部常量，渲染时把数组复制两份首尾相接，滚到一半刚好无缝续上
const 角色列表 = [
  { src: '/landing/char-shen.webp', name: '沈清瑶' },
  { src: '/landing/char-lin.webp', name: '林晚晴' },
  { src: '/landing/char-jiang.webp', name: '江芷柔' },
  { src: '/landing/char-wen.webp', name: '温甜茉' },
  { src: '/landing/char-su.webp', name: '苏浅夏' },
];

// 命运机制区：输入无 → 渲染三张机制卡（长河/因果网/循环轮，各带一枚手绘SVG小图标） → 吐出 section#models
export function 命运机制区() {
  return (
    <section className="band" id="models" style={{ paddingTop: 30 }}>
      <div className="wrap">
        <div className="band-head reveal">
          <span className="eyebrow">命运叙事模型</span>
          <h2 className="title">
            把“选择影响结局”，
            <br />
            拆成三种可创作的机制。
          </h2>
          <p className="lead">
            抽象的命运哲学，变成创作者可以配置、玩家可以体验的游戏语法。
          </p>
        </div>
        <div className="bento">
          <div className="fate f1 reveal">
            <div className="ico">
              {/* 波浪河流图标：一条起伏的曲线加两端的圆点 */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#9a8cd0" strokeWidth="1.5">
                <path d="M3 7c5 0 5 10 9 10s4-10 9-10" />
                <circle cx="3" cy="7" r="1.4" fill="#9a8cd0" />
                <circle cx="21" cy="7" r="1.4" fill="#9a8cd0" />
              </svg>
            </div>
            <h3>命运长河</h3>
            <p>线性分支，每个选择把剧情推向不同的下游，命运如河流般向前奔涌。</p>
            <div className="tag">Linear Branching</div>
          </div>
          <div className="fate f2 reveal">
            <div className="ico">
              {/* 三节点网图标：三个圆点用线连成网 */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#8fb6e0" strokeWidth="1.5">
                <circle cx="6" cy="6" r="2" />
                <circle cx="18" cy="7" r="2" />
                <circle cx="12" cy="17" r="2" />
                <path d="M8 7l8 1M7 8l4 7M17 9l-4 6" />
              </svg>
            </div>
            <h3>因果之网</h3>
            <p>隐藏变量与远期后果，微小的选择在很久之后才显现影响，编织成因果之网。</p>
            <div className="tag">Hidden Causality</div>
          </div>
          <div className="fate f3 reveal">
            <div className="ico">
              {/* 循环箭头图标：一个差一点闭合的圆加箭头 */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#ecc37e" strokeWidth="1.5">
                <path d="M20 12a8 8 0 1 1-3-6.2" />
                <path d="M20 4v4h-4" />
              </svg>
            </div>
            <h3>循环之轮</h3>
            <p>多周目、记忆继承、隐藏真结局。每一轮都带着上一轮的经验，逼近命运的真相。</p>
            <div className="tag">Loop & Inheritance</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 人物生成区：输入无 → 渲染照片墙（一高一宽三普通的五格拼贴）+ 角色跑马灯 → 吐出 section#characters
export function 人物生成区() {
  return (
    <section className="band" id="characters" style={{ paddingTop: 30 }}>
      <div className="wrap">
        <div className="band-head reveal">
          <span className="eyebrow">人物生成 · 视觉资产</span>
          <h2 className="title">
            智能体不止写剧本，
            <br />
            还生成有档案的角色。
          </h2>
          <p className="lead">
            每个角色都有动机、秘密与视觉锚点。一句设定，生成可直接用于 360°
            场景的人物立绘与档案。
          </p>
        </div>
        <div className="gallery reveal">
          <div className="g-item g-tall">
            <img src="/landing/char-shen.webp" alt="沈清瑶" />
            <div className="g-cap">
              <b>沈清瑶</b>
              <small>清冷如月 · 温柔有光</small>
            </div>
          </div>
          <div className="g-item">
            <img src="/landing/char-lin.webp" alt="林晚晴" />
            <div className="g-cap">
              <b>林晚晴</b>
              <small>温柔似水 · 清冷如风</small>
            </div>
          </div>
          <div className="g-item">
            <img src="/landing/char-jiang.webp" alt="江芷柔" />
            <div className="g-cap">
              <b>江芷柔</b>
              <small>清甜如风 · 温软治愈</small>
            </div>
          </div>
          <div className="g-item g-wide">
            <img src="/landing/char-su.webp" alt="苏浅夏" />
            <div className="g-cap">
              <b>苏浅夏 · 叶书瑶</b>
              <small>双生人物档案 · 一次生成</small>
            </div>
          </div>
          <div className="g-item">
            <img src="/landing/char-wen.webp" alt="温甜茉" />
            <div className="g-cap">
              <b>温甜茉</b>
              <small>软甜似糖 · 纯真无瑕</small>
            </div>
          </div>
        </div>
        <div aria-label="角色展示，聚焦可暂停滚动" className="marquee" role="region" tabIndex={0}>
          <div className="marquee-track">
            {/* 数组复制一份接在后面，CSS 动画滚到 -50% 时画面和起点一模一样，看起来永不停歇 */}
            {[...角色列表, ...角色列表].map((角色, 序) => (
              <div aria-hidden={序 >= 角色列表.length || undefined} className="m-card" key={序}>
                <img src={角色.src} alt={序 < 角色列表.length ? 角色.name : ''} />
                <span>{角色.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
