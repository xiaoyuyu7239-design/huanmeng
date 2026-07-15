// 这个文件是落地页的"橱窗前两幕"：主视觉像商场大门口的巨幅海报（三张浮动立绘 + 大标题），
// 核心体验像门口的试吃摊位（一段循环播放的演示视频 + 四步玩法说明）。
import React from 'react';

// 主视觉：输入无 → 渲染 Hero 大屏（星点背景、文案、三张带鼠标视差的立绘） → 吐出 section.hero
// data-par 属性是留给主文件 mousemove 监听用的"视差系数"：数字越大跟着鼠标飘得越远，负数反方向飘。
export function 主视觉() {
  return (
    <section className="hero" id="top">
      <div className="hero-bg">
        <div className="stars" data-par="-12" />
      </div>
      <div className="wrap hero-grid">
        <div>
          <span className="eyebrow">互动影游 · 智能体创作系统</span>
          <h1>
            每一次创作，
            <br />
            都成为<em>下一次创作</em>的经验
          </h1>
          <p className="sub">
            智能体生成剧本、节点、选择与素材需求；系统把它变成可试玩的 360°
            互动影游，并用测试、路线枚举与逻辑地图，反向约束下一次创作。
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/creator">
              开始创作 <span className="arrow">→</span>
            </a>
            <a className="btn btn-ghost" href="/play">观看演示</a>
          </div>
          <div className="hero-meta">
            <div>
              <span>360°</span>
              <small>沉浸式全景叙事</small>
            </div>
            <div>
              <span>3</span>
              <small>命运叙事机制</small>
            </div>
            <div>
              <span>∞</span>
              <small>可沉淀的创作经验</small>
            </div>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="badge-gen" data-par="-6">
            <span className="pulse" />
            AI 生成 · 人物档案
          </span>
          <div className="portrait p-front" data-par="14">
            <img src="/landing/char-wen.webp" alt="" />
          </div>
          <div className="portrait p-main" data-par="8">
            <img src="/landing/char-shen.webp" alt="" />
            <span className="p-label">
              <b>沈清瑶</b> · 九尾狐的轮回
            </span>
          </div>
          <div className="portrait p-back" data-par="20">
            <img src="/landing/char-lin.webp" alt="" />
          </div>
        </div>
      </div>
      <div className="scroll-cue">
        向下滚动<i />
      </div>
    </section>
  );
}

// 四步演示的数据：[序号, 标题, 描述]，照原样抄自线上代码，渲染时 map 成四张小卡
const 四步演示 = [
  ['01', '环视', '拖动视角探索全景场景，发现散落在画面里的线索热点。'],
  ['02', '对白', '角色台词推进剧情，揭示动机、秘密与人物之间的牵连。'],
  ['03', '选择', '关键抉择即时反馈信任、压力与路线，没有无意义的选项。'],
  ['04', '结局', '抵达结局后回看因果链，带着记忆进入下一轮继续探索。'],
];

// 核心体验：输入无 → 渲染视频舞台（带热点光斑、对白卡、二维码）和四步玩法卡 → 吐出 section.band#experience
export function 核心体验() {
  const 视频ref = React.useRef(null);
  const [减少动效, set减少动效] = React.useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  React.useEffect(() => {
    const 媒体查询 = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!媒体查询) return undefined;
    const 同步 = () => set减少动效(媒体查询.matches);
    媒体查询.addEventListener?.('change', 同步);
    return () => 媒体查询.removeEventListener?.('change', 同步);
  }, []);

  React.useEffect(() => {
    const 视频 = 视频ref.current;
    if (!视频) return;
    if (减少动效) 视频.pause();
    else 视频.play().catch(() => {});
  }, [减少动效]);

  return (
    <section className="band" id="experience">
      <div className="wrap">
        <div className="band-head reveal experience-head">
          <div className="experience-copy">
            <span className="eyebrow">核心体验</span>
            <h2 className="title">
              玩家站在 360° 场景之中，
              <br />
              每个选择都改变命运。
            </h2>
            <p className="lead">
              环视场景、发现隐藏线索、阅读对白、做出关键抉择。每一次选择都会改变状态、记忆、flag
              与结局路线。
            </p>
          </div>
          <div className="experience-qr-block">
            <p>平台已经部署，可以体验。扫码进群可以体验在线创作平台。</p>
            <img className="experience-qr" src="/landing/wechat-qr.png" alt="微信二维码" />
          </div>
        </div>
        <div className="exp-stage reveal">
          <div className="scene">
            <video
              aria-label="顶层酒会互动场景演示"
              autoPlay={!减少动效}
              controls
              loop={!减少动效}
              muted
              playsInline
              poster="/landing/char-shen.webp"
              preload="metadata"
              ref={视频ref}
              src="/landing/experience-showcase.mp4"
            />
          </div>
          <div className="exp-hud">
            <span className="chip">
              <b>序章 · 酒会之夜</b> 顶层公寓
            </span>
            <span className="chip">
              <span className="dot" /> 社交线索 2
            </span>
          </div>
          <div className="hotspot h1" />
          <div className="hotspot h2" />
          <div className="dialogue">
            <div className="who">
              <span /> 红裙来客
            </div>
            <p>“这场酒会不是为了庆祝，是为了看谁会先露出破绽。”</p>
          </div>
        </div>
        <div className="loop-row">
          {四步演示.map(([序号, 标题, 描述]) => (
            <div className="loop-step reveal" key={序号}>
              <div className="n">{序号}</div>
              <h4>{标题}</h4>
              <p>{描述}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
