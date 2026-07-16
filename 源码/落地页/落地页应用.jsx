import React from 'react';
import 静态精选清单 from '../../公共资源/showcase.json';
import 旗舰剧情 from '../../公共资源/games/ninth-seat/story.json';
import '../样式/落地页-心界.css';
import '../样式/落地页可访问性.css';
import { 导航栏, 页脚 } from './导航与页脚.jsx';
import { 精选Demo区 } from './精选Demo区.jsx';
import {
  创作者次入口,
  真实选择区,
  玩家主视觉,
  玩家结尾CTA,
  多结局区,
  角色群像区,
  同行方式区,
  故事记忆区,
} from './心界玩家区块.jsx';
import {
  构建玩家首页模型,
  合并首页精选,
  清洗精选数据,
  核对本机精选覆盖,
  读取首页存档,
} from './玩家首页模型.js';

const 本地精选键 = 'creator:browser-showcase:v1';
const 本地项目键 = 'creator:browser-projects:v1';
const 静态精选 = 清洗精选数据(静态精选清单);
const 旗舰slug = 静态精选.default;

function 读取本地精选覆盖() {
  if (typeof window === 'undefined') return null;
  try {
    const 数据 = JSON.parse(window.localStorage.getItem(本地精选键) ?? '{}');
    const 项目仓 = JSON.parse(window.localStorage.getItem(本地项目键) ?? '{}');
    return 核对本机精选覆盖(数据, 项目仓, 静态精选清单);
  } catch {
    return null;
  }
}

export default function 落地页应用() {
  const 根ref = React.useRef(null);
  const 导航ref = React.useRef(null);
  const [精选数据, set精选数据] = React.useState(() => 合并首页精选(静态精选清单));
  const [玩家存档, set玩家存档] = React.useState(null);
  const 首页 = React.useMemo(
    () => 构建玩家首页模型(精选数据, 旗舰剧情, 玩家存档),
    [精选数据, 玩家存档],
  );

  React.useEffect(() => {
    document.body.classList.add('landing-body');
    set玩家存档(读取首页存档(旗舰slug));
    return () => document.body.classList.remove('landing-body');
  }, []);

  // 静态清单负责首屏同步可见；网络与本机覆盖只在后台补齐“更多实验世界”。
  React.useEffect(() => {
    let 还在页面 = true;
    const 本地 = 读取本地精选覆盖();
    if (本地) set精选数据(合并首页精选(静态精选清单, 静态精选清单, 本地));
    fetch('/showcase.json', { cache: 'no-cache' })
      .then((响应) => (响应.ok ? 响应.json() : null))
      .then((远端) => {
        if (!还在页面 || !远端) return;
        set精选数据(合并首页精选(静态精选清单, 远端, 读取本地精选覆盖()));
      })
      .catch(() => {});
    return () => {
      还在页面 = false;
    };
  }, []);

  React.useEffect(() => {
    const 根 = 根ref.current;
    const 滚动处理 = () => 导航ref.current?.classList.toggle('is-scrolled', window.scrollY > 36);
    window.addEventListener('scroll', 滚动处理, { passive: true });
    滚动处理();

    const 减少动效 = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const 元素们 = 根?.querySelectorAll('.reveal') ?? [];
    const 观察者 = !减少动效 && 'IntersectionObserver' in window
      ? new IntersectionObserver(
          (记录们) => {
            for (const 记录 of 记录们) {
              if (!记录.isIntersecting) continue;
              记录.target.classList.add('in');
              观察者.unobserve(记录.target);
            }
          },
          { threshold: 0.1, rootMargin: '0px 0px -40px' },
        )
      : null;

    if (观察者) 根?.classList.add('is-motion-ready');
    元素们.forEach((元素, 索引) => {
      元素.style.setProperty('--reveal-delay', `${(索引 % 3) * 65}ms`);
      if (观察者) 观察者.observe(元素);
      else 元素.classList.add('in');
    });

    return () => {
      window.removeEventListener('scroll', 滚动处理);
      观察者?.disconnect();
      根?.classList.remove('is-motion-ready');
    };
  }, [首页.moreWorlds.length]);

  return (
    <div className="lp lp-heartscape" ref={根ref}>
      <a className="hx-skip-link" href="#main-content">跳到主要内容</a>
      <导航栏 navRef={导航ref} playHref={首页.playHref} />
      <main id="main-content">
        <玩家主视觉 首页={首页} />
        {首页.storyReady && (
          <>
            <真实选择区 首页={首页} />
            <故事记忆区 首页={首页} />
            <角色群像区 首页={首页} />
            <同行方式区 首页={首页} />
            <多结局区 首页={首页} />
          </>
        )}
        <精选Demo区 featured={首页.moreWorlds} />
        <创作者次入口 />
        <玩家结尾CTA 首页={首页} />
      </main>
      <页脚 playHref={首页.playHref} />
      <a className="hx-mobile-cta" href={首页.playHref}>进入《{首页.story?.title ?? 首页.catalogEntry?.title ?? '互动故事'}》</a>
    </div>
  );
}
