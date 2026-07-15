// 这个文件是落地页的"货架区"：把创作台里推上首页的作品摆成一排卡片，
// 像书店门口的"店长推荐"书架——点哪本就直接翻开哪本（跳到 /play?game=slug）。
// 货从哪来由主文件决定（fetch showcase.json，localStorage 可以盖过它），这里只管摆。
import React from 'react';

// 精选Demo区：输入 featured(精选条目数组)、defaultSlug(默认作品的slug) → 摆出卡片墙 → 吐出 section#demos
// 没货（数组为空）时整个区块不渲染，和线上行为一致。
export function 精选Demo区({ featured, defaultSlug }) {
  if (featured.length === 0) return null;
  return (
    <section className="band" id="demos" style={{ paddingTop: 30 }}>
      <div className="wrap">
        <div className="band-head reveal">
          <span className="eyebrow">精选 Demo · 立即试玩</span>
          <h2 className="title">
            好作品，一键推送到首页。
            <br />
            点开即玩。
          </h2>
          <p className="lead">
            在创作台里把满意的作品设为精选，它们就会出现在这里。每一张卡片都是一部可直接游玩的互动影游。
          </p>
        </div>
        <div className="demos">
          {featured.map((条目) => (
            <a
              className="demo"
              href={`/play?game=${encodeURIComponent(条目.slug)}`}
              key={条目.slug}
            >
              <div className="demo-cover">
                {条目.cover && <img src={条目.cover} alt={条目.title} loading="lazy" />}
              </div>
              {条目.slug === defaultSlug && (
                <span className="demo-default">默认 Demo</span>
              )}
              <div className="demo-play" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="demo-body">
                {条目.tags && 条目.tags.length > 0 && (
                  <div className="demo-tags">
                    {条目.tags.map((标签) => (
                      <span key={标签}>{标签}</span>
                    ))}
                  </div>
                )}
                <h4>{条目.title}</h4>
                {条目.chapters && <div className="chap">{条目.chapters}</div>}
                <p>{条目.tagline}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
