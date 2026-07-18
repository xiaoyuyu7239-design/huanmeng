import React from 'react';
import { Play } from 'lucide-react';

// 可玩世界网格：多部作品直接在首页陈列（游戏平台形态，参考原版 Demo 区）。
// 内容口径保持诚实——旧作品正在逐部翻新为女性向版本，当前仍可完整游玩。
export function 精选Demo区({ worlds, defaultSlug }) {
  if (!Array.isArray(worlds) || worlds.length === 0) return null;
  return (
    <section className="hx-section hx-worlds" id="worlds">
      <div className="hx-wrap">
        <header className="hx-section-head reveal">
          <span className="hx-eyebrow">可玩世界</span>
          <h2>每个世界，都在等你留下选择。</h2>
          <p>
            旗舰《第九席》之外的早期世界正在逐部翻新为女性向版本；翻新前它们保持原貌、仍可完整游玩，
            你的存档始终按作品独立保存。
          </p>
        </header>
        <div className="hx-demos">
          {worlds.map((世界) => (
            <a
              className="hx-demo reveal"
              href={`/play?game=${encodeURIComponent(世界.slug)}`}
              key={世界.slug}
            >
              <div className="hx-demo-cover">
                {世界.cover ? (
                  <img alt="" height="768" loading="lazy" src={世界.cover} width="1536" />
                ) : (
                  <div className="hx-image-placeholder" aria-hidden="true" />
                )}
                <span className="hx-demo-play" aria-hidden="true">
                  <Play size={15} strokeWidth={2} />
                </span>
                {世界.slug === defaultSlug && <span className="hx-demo-default">旗舰</span>}
              </div>
              <div className="hx-demo-body">
                {世界.tags.length > 0 && (
                  <div className="hx-demo-tags">
                    {世界.tags.slice(0, 2).map((标签) => (
                      <span key={标签}>{标签}</span>
                    ))}
                  </div>
                )}
                <h3>{世界.title}</h3>
                {世界.chapters && <small>{世界.chapters}</small>}
                {世界.tagline && <p>{世界.tagline}</p>}
              </div>
            </a>
          ))}
        </div>
        <p className="hx-demo-foot reveal">
          <a href="/worlds">查看完整档案与历史版本 →</a>
        </p>
      </div>
    </section>
  );
}
