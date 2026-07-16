import React from 'react';
import { Archive, ArrowUpRight } from 'lucide-react';

// 历史作品继续可玩，但旧男性向标题、梗概和人物视觉不直接进入女性向旗舰首页。
// 首页只给一个中性的档案入口，完整清单放在 /worlds 二级页。
export function 精选Demo区({ featured }) {
  if (!Array.isArray(featured) || featured.length === 0) return null;
  return (
    <section className="hx-section hx-worlds" id="worlds">
      <div className="hx-wrap">
        <header className="hx-section-head reveal">
          <span className="hx-eyebrow">互动实验档案</span>
          <h2>还想看看别的故事结构？</h2>
          <p>早期作品继续保留，供你回看不同的题材、分支与命运机制；它们不会覆盖当前旗舰世界。</p>
        </header>
        <a className="hx-world-archive reveal" href="/worlds">
          <span><Archive aria-hidden="true" size={23} strokeWidth={1.5} /></span>
          <div>
            <small>HISTORICAL INTERACTIVE EXPERIMENTS</small>
            <h3>打开历史互动实验档案</h3>
            <p>{featured.length} 部已发布作品仍可直接游玩。</p>
          </div>
          <ArrowUpRight aria-hidden="true" size={20} />
        </a>
      </div>
    </section>
  );
}
