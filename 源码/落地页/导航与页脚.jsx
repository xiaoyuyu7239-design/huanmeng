// 这个文件是落地页的"门面和门牌"：导航栏像商场门口的指示牌，页脚像出口处的服务台，
// 两头都挂着同一块"衍境"招牌（品牌标识），所以放在同一个文件里共用。
import React from 'react';

// 品牌标识：输入无 → 拼出 logo 方块 + "衍境"双行字 → 吐出一个跳回页顶的链接（导航和页脚各用一次）
function 品牌标识() {
  return (
    <a className="brand" href="#top">
      <span className="mark" />
      <span>
        <b>衍境</b>
        <br />
        <span className="en">Interactive Cinema Engine</span>
      </span>
    </a>
  );
}

// 导航栏：输入 navRef(让父组件在滚动时给 nav 加 .scrolled 类) → 渲染固定顶栏 → 吐出 <nav>
export function 导航栏({ navRef }) {
  return (
    <nav ref={navRef}>
      <div className="wrap nav-inner">
        <品牌标识 />
        <div className="nav-links">
          <a href="#experience">核心体验</a>
          <a href="#models">命运模型</a>
          <a href="#characters">人物生成</a>
          <a href="#studio">创作台</a>
          <a href="#evolve">自进化</a>
        </div>
        <a className="nav-cta" href="/creator">进入创作台</a>
      </div>
    </nav>
  );
}

// 页脚：输入无 → 渲染三列链接和版权小字 → 吐出 <footer>
export function 页脚() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <品牌标识 />
          <div className="cols">
            <div>
              <h6>产品</h6>
              <a href="#experience">核心体验</a>
              <a href="#models">命运模型</a>
              <a href="#studio">创作台</a>
            </div>
            <div>
              <h6>系统</h6>
              <a href="#evolve">自进化工作流</a>
              <a href="#capability">机制闭环</a>
              <a href="#audience">为谁而造</a>
            </div>
            <div>
              <h6>资源</h6>
              <a href="/play">玩家端演示</a>
              <a href="/creator">互动电影创作台</a>
              <a href="#characters">人物生成</a>
            </div>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 衍境 Interactive Cinema Engine · 互动影游智能体创作系统</span>
          <span>当前演示 · 精选互动影游</span>
        </div>
      </div>
    </footer>
  );
}
