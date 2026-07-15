// 这个文件是落地页的"总导演"：13 个区块像 13 个摄影棚，它负责按顺序把它们搭起来，
// 再干三件幕后活——1) 给 body 挂上 landing-body 类（换舞台地板）；
// 2) 去仓库拿"精选 Demo"的货（fetch showcase.json，本地 localStorage 的货优先）；
// 3) 布置全场灯光机关（滚动显现、导航变毛玻璃、鼠标视差）。
import React from 'react';
import '../样式/落地页.css';
import '../样式/落地页可访问性.css';
import { 导航栏, 页脚 } from './导航与页脚.jsx';
import { 主视觉, 核心体验 } from './主视觉与核心体验.jsx';
import { 精选Demo区 } from './精选Demo区.jsx';
import { 命运机制区, 人物生成区 } from './命运与人物区.jsx';
import { 创作台演示区, 风格跑马灯区 } from './创作台与风格区.jsx';
import { 自进化区, 机制闭环区, 为谁而造区 } from './自进化与能力区.jsx';
import { 结尾CTA区 } from './结尾CTA区.jsx';

// localStorage 键名：创作台把"浏览器本地精选"存在这里，落地页读它来盖过远端数据（与线上一字不差）
const 本地精选键 = 'creator:browser-showcase:v1';

// 精选可能来自旧版 localStorage 或被手工修改，只把渲染层真正能安全消费的字段留下。
function 清洗精选条目(条) {
  if (!条 || typeof 条 !== 'object' || Array.isArray(条)) return null;
  const slug = typeof 条.slug === 'string' ? 条.slug.trim() : '';
  const title = typeof 条.title === 'string' ? 条.title.trim() : '';
  if (!slug || !title) return null;
  return {
    slug,
    title,
    cover: typeof 条.cover === 'string' ? 条.cover : '',
    tagline: typeof 条.tagline === 'string' ? 条.tagline : '',
    chapters: typeof 条.chapters === 'string' ? 条.chapters : '',
    tags: Array.isArray(条.tags) ? 条.tags.filter((标签) => typeof 标签 === 'string') : [],
  };
}

function 清洗精选列表(列表) {
  return Array.isArray(列表) ? 列表.map(清洗精选条目).filter(Boolean) : [];
}

// 读取本地精选：输入无（自己去翻 localStorage）→ 层层验货 → 吐出 { default, featured } 或 null
// 为什么这么绕：localStorage 里可能是任何脏东西（坏 JSON、数组、缺字段的条目），
// 所以先 try/catch 防爆炸，再逐条只留"有 slug 有 title 的对象"，一条好货都没有就当没这回事。
function 读取本地精选() {
  try {
    const 数据 = JSON.parse(window.localStorage.getItem(本地精选键) ?? '{}');
    if (!数据 || typeof 数据 !== 'object' || Array.isArray(数据)) return null;
    const 条目们 = 清洗精选列表(数据.entries);
    const slug顺序 = Array.isArray(数据.featured)
      ? [...new Set(数据.featured.filter((slug) => typeof slug === 'string' && slug.trim()).map((slug) => slug.trim()))]
      : 条目们.map((条) => 条.slug);
    if (条目们.length === 0 && slug顺序.length === 0) return null;
    return {
      default:
        typeof 数据.default === 'string' && 数据.default.trim()
          ? 数据.default.trim()
          : (slug顺序[0] ?? 条目们[0]?.slug ?? ''),
      entries: 条目们,
      featured: slug顺序,
    };
  } catch {
    return null;
  }
}

// 落地页应用：输入无 → 搭好 13 个区块并布置动效 → 吐出整页 div.lp
export default function 落地页应用() {
  const 导航ref = React.useRef(null);
  const [精选列表, set精选列表] = React.useState([]);
  const [默认slug, set默认slug] = React.useState('');

  // 幕后活 1：进场给 body 挂 landing-body 类，散场摘掉（全局样式靠它区分"现在是落地页"）
  React.useEffect(() => {
    document.body.classList.add('landing-body');
    return () => {
      document.body.classList.remove('landing-body');
    };
  }, []);

  // 幕后活 2：拿精选 Demo 的货。先看本地仓库（localStorage），再问远端（showcase.json）；
  // 为什么这么绕：本地精选永远盖过远端——所以 fetch 回来后还要再查一次本地，本地有货就无视远端。
  // 活着标记(还在场上) 防的是"组件都卸载了 fetch 才回来"这种迟到快递。
  React.useEffect(() => {
    let 还在场上 = true;
    const 本地 = 读取本地精选();
    if (本地) {
      if (本地.entries.length > 0) set精选列表(本地.entries);
      set默认slug(本地.default);
    }
    fetch('/showcase.json', { cache: 'no-cache' })
      .then((响应) => (响应.ok ? 响应.json() : null))
      .then((远端) => {
        if (!还在场上 || !远端) return;
        const 本地再查 = 读取本地精选();
        const 远端条目 = 清洗精选列表(远端.featured);
        if (本地再查) {
          // 本机卡片元数据优先；服务器示例按保存的 slug 顺序从静态清单补齐。
          const 卡片表 = new Map([
            ...远端条目.map((条) => [条.slug, 条]),
            ...本地再查.entries.map((条) => [条.slug, 条]),
          ]);
          const 排序后卡片 = 本地再查.featured.map((slug) => 卡片表.get(slug)).filter(Boolean);
          const 可用本地卡片 = 排序后卡片.length > 0 ? 排序后卡片 : 本地再查.entries;
          if (可用本地卡片.length > 0) {
            set精选列表(可用本地卡片);
            set默认slug(本地再查.default);
            return;
          }
          // 旧覆盖若只剩无法解析的 slug，不能把健康的静态精选一起遮掉。
        }
        set精选列表(远端条目);
        set默认slug(typeof 远端.default === 'string' ? 远端.default : '');
      })
      .catch(() => {});
    return () => {
      还在场上 = false;
    };
  }, []);

  // 幕后活 3：三套灯光机关（与线上逻辑一字不差）
  // a) 滚动超过 40px 导航变毛玻璃；b) .reveal 元素进入视口 14% 就亮相（每 4 个一组错峰 70ms）；
  // c) 带 data-par 的元素跟着鼠标飘（系数越大飘得越远，负数反方向），形成层次视差。
  React.useEffect(() => {
    const 滚动处理 = () =>
      导航ref.current?.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', 滚动处理, { passive: true });

    const 显现元素 = document.querySelectorAll('.lp .reveal');
    const 减少动效 = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const 观察者 = !减少动效 && 'IntersectionObserver' in window
      ? new IntersectionObserver(
          (记录们) =>
            记录们.forEach((记录) => {
              if (记录.isIntersecting) {
                记录.target.classList.add('in');
                观察者.unobserve(记录.target); // 亮过一次就不用再管了
              }
            }),
          { threshold: 0.14 },
        )
      : null;
    显现元素.forEach((元素, 序) => {
      元素.style.transitionDelay = `${(序 % 4) * 70}ms`;
      if (观察者) 观察者.observe(元素);
      else 元素.classList.add('in');
    });

    const 减少动效查询 = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const 窄屏查询 = window.matchMedia?.('(max-width: 980px)');
    const 清除视差 = () =>
      document.querySelectorAll('.lp [data-par]').forEach((元素) => 元素.style.removeProperty('transform'));
    const 同步视差状态 = () => {
      if (减少动效查询?.matches || 窄屏查询?.matches) 清除视差();
    };
    减少动效查询?.addEventListener?.('change', 同步视差状态);
    窄屏查询?.addEventListener?.('change', 同步视差状态);
    同步视差状态();

    const 视差处理 = (事件) => {
      // 减少动效与窄屏布局都不做视差；窄屏 CSS 自己负责主图居中，不能被行内 transform 覆盖。
      if (减少动效查询?.matches || 窄屏查询?.matches) {
        清除视差();
        return;
      }
      const 横 = (事件.clientX / window.innerWidth - 0.5) * 2; // 归一化到 [-1, 1]
      const 纵 = (事件.clientY / window.innerHeight - 0.5) * 2;
      document.querySelectorAll('.lp [data-par]').forEach((元素) => {
        const 系数 = Number(元素.dataset.par);
        元素.style.transform = `translate(${横 * 系数}px, ${纵 * 系数}px)`;
      });
    };
    window.addEventListener('mousemove', 视差处理);

    return () => {
      window.removeEventListener('scroll', 滚动处理);
      window.removeEventListener('mousemove', 视差处理);
      减少动效查询?.removeEventListener?.('change', 同步视差状态);
      窄屏查询?.removeEventListener?.('change', 同步视差状态);
      观察者?.disconnect();
    };
  }, [精选列表.length]);

  return (
    <div className="lp">
      <导航栏 navRef={导航ref} />
      <主视觉 />
      <核心体验 />
      <精选Demo区 featured={精选列表} defaultSlug={默认slug} />
      <命运机制区 />
      <人物生成区 />
      <创作台演示区 />
      <风格跑马灯区 />
      <自进化区 />
      <机制闭环区 />
      <为谁而造区 />
      <结尾CTA区 />
      <页脚 />
    </div>
  );
}
