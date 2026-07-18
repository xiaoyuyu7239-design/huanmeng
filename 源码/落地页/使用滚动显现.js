import React from 'react';

// 二级页共享的滚动显现 hook：客户端挂载后给目标元素补 reveal 类再观察，
// SSR 输出保持不变（无 JS 时内容始终可见）；系统减少动效时完全不启用。
export function 使用滚动显现(根ref, 选择器们) {
  React.useEffect(() => {
    const 根 = 根ref.current;
    if (!根 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    const 元素们 = 选择器们.flatMap((选择器) => [...根.querySelectorAll(选择器)]);
    if (元素们.length === 0) return undefined;
    const 观察者 = new IntersectionObserver(
      (记录们) => {
        for (const 记录 of 记录们) {
          if (!记录.isIntersecting) continue;
          记录.target.classList.add('in');
          观察者.unobserve(记录.target);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px' },
    );
    根.classList.add('is-motion-ready');
    元素们.forEach((元素, 索引) => {
      元素.classList.add('reveal');
      元素.style.setProperty('--reveal-delay', `${(索引 % 3) * 65}ms`);
      观察者.observe(元素);
    });
    return () => {
      观察者.disconnect();
      根.classList.remove('is-motion-ready');
      元素们.forEach((元素) => {
        元素.classList.remove('reveal', 'in');
      });
    };
  }, [根ref, 选择器们]);
}
