import React from 'react';
import { ArrowLeft, ArrowRight, Archive, Layers3 } from 'lucide-react';
import 静态精选清单 from '../../公共资源/showcase.json';
import '../样式/落地页-心界.css';
import '../样式/落地页可访问性.css';
import { 合并首页精选, 清洗精选条目, 清洗精选数据 } from './玩家首页模型.js';

const 本地精选键 = 'creator:browser-showcase:v1';
const 静态精选 = 清洗精选数据(静态精选清单);

function 读取本地归档覆盖() {
  if (typeof window === 'undefined') return null;
  try {
    const 数据 = JSON.parse(window.localStorage.getItem(本地精选键) ?? '{}');
    if (!数据 || typeof 数据 !== 'object' || Array.isArray(数据)) return null;
    const entries = Array.isArray(数据.entries)
      ? 数据.entries.map(清洗精选条目).filter(Boolean)
      : [];
    const featured = Array.isArray(数据.featured)
      ? 数据.featured.filter((slug) => typeof slug === 'string')
      : entries.map((条目) => 条目.slug);
    return entries.length || featured.length ? { entries, featured } : null;
  } catch {
    return null;
  }
}

function 归档条目(远端 = 静态精选清单, 本地 = null) {
  const 合并后 = 合并首页精选(静态精选清单, 远端, 本地);
  return 合并后.featured.filter((条目) => 条目.slug !== 静态精选.default);
}

export default function 世界归档应用() {
  const [作品们, set作品们] = React.useState(() => 归档条目());

  React.useEffect(() => {
    document.body.classList.add('landing-body');
    const 原标题 = document.title;
    document.title = '互动实验档案｜衍境·心界';
    const 本地 = 读取本地归档覆盖();
    if (本地) set作品们(归档条目(静态精选清单, 本地));
    let 还在页面 = true;
    fetch('/showcase.json', { cache: 'no-cache' })
      .then((响应) => (响应.ok ? 响应.json() : null))
      .then((远端) => {
        if (还在页面 && 远端) set作品们(归档条目(远端, 读取本地归档覆盖()));
      })
      .catch(() => {});
    return () => {
      还在页面 = false;
      document.body.classList.remove('landing-body');
      document.title = 原标题;
    };
  }, []);

  return (
    <div className="lp lp-heartscape hx-archive-page">
      <a className="hx-skip-link" href="#archive-main">跳到主要内容</a>
      <nav className="hx-creator-nav" aria-label="实验档案导航">
        <div className="hx-wrap hx-creator-nav-inner">
          <a className="hx-brand" href="/" aria-label="返回衍境·心界玩家首页">
            <span className="hx-brand-mark" aria-hidden="true"><i /></span>
            <span><b>互动实验档案</b><small>衍境·心界</small></span>
          </a>
          <div>
            <a href="/"><ArrowLeft aria-hidden="true" size={15} /> 玩家首页</a>
            <a className="hx-nav-cta" href={`/play?game=${encodeURIComponent(静态精选.default)}`}>进入旗舰故事</a>
          </div>
        </div>
      </nav>
      <main id="archive-main">
        <section className="hx-archive-hero">
          <div className="hx-wrap">
            <Archive aria-hidden="true" size={25} strokeWidth={1.4} />
            <span className="hx-eyebrow">Historical worlds</span>
            <h1>互动实验档案</h1>
            <p>这些作品记录了早期题材与分支机制探索，继续保留直接试玩入口，不代表当前旗舰产品定位。</p>
          </div>
        </section>
        <section className="hx-archive-list-section" aria-labelledby="archive-list-title">
          <div className="hx-wrap">
            <h2 id="archive-list-title">已发布作品 · {作品们.length}</h2>
            <div className="hx-archive-list">
              {作品们.map((条目, 索引) => (
                <a href={`/play?game=${encodeURIComponent(条目.slug)}`} key={条目.slug}>
                  <span className="hx-world-index">{String(索引 + 1).padStart(2, '0')}</span>
                  <Layers3 aria-hidden="true" size={19} strokeWidth={1.5} />
                  <div>
                    <h3>{条目.title}</h3>
                    <p>{条目.tagline || '一部可直接进入的互动叙事实验。'}</p>
                    <small>{条目.chapters || 条目.tags.join(' · ') || '互动故事'}</small>
                  </div>
                  <ArrowRight aria-hidden="true" size={18} />
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
