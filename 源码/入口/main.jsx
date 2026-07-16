// 这个文件是"前台接待员"：看访客走进哪个门(网址路径)，就把他领到对应的大厅——
//   /            → 落地页(产品介绍)
//   /play /game  → 播放器(玩互动影游)，支持 ?game=作品slug 指定作品
//   /creators     → 创作者二级介绍页(能力边界与 EvoMap)
//   /worlds       → 历史互动实验归档(保留旧作品直达)
//   /creator     → 创作台(编辑剧情、生成资产)
// 和线上版行为完全一致：三个大厅按需加载，不进哪个门就不下载哪个门的代码。
import React from 'react';
import { createRoot } from 'react-dom/client';
import { 清除浏览器生产密钥 } from '../公共工具/浏览器密钥迁移.js';
import { 解析试玩来源 } from './试玩来源.js';
// 全局样式：整文件收编自线上产品(index.css)，保证像素级还原，任何页面都要用
import '../样式/全局.css';

// Level 5 安全迁移在所有入口执行，不要求用户先打开创作台。
清除浏览器生产密钥();

// 末尾斜杠不应改变页面类型：/play/、/game/、/creator/ 与无斜杠地址等价。
const 路径 = window.location.pathname.replace(/\/+$/, '') || '/';
const 是播放器 = 路径 === '/play' || 路径 === '/game';
const 是创作台 = 路径 === '/creator';
const 是创作者介绍 = 路径 === '/creators';
const 是世界归档 = 路径 === '/worlds';

// React.lazy = "用到再搬"：只有真正访问时才去加载那个模块的代码
const 当前应用 = 是创作台
  ? React.lazy(() => import('../创作台/创作台应用.jsx'))
  : 是创作者介绍
    ? React.lazy(() => import('../落地页/创作者介绍应用.jsx'))
    : 是世界归档
      ? React.lazy(() => import('../落地页/世界归档应用.jsx'))
      : 是播放器
        ? React.lazy(() => import('../播放器/播放器应用.jsx'))
        : React.lazy(() => import('../落地页/落地页应用.jsx'));

const 挂载点 = createRoot(document.getElementById('root'));

function 渲染() {
  挂载点.render(
    <React.StrictMode>
      <React.Suspense fallback={<div className="app-loading">载入中</div>}>
        <当前应用 />
      </React.Suspense>
    </React.StrictMode>
  );
}

async function 启动() {
  if (!是播放器) { 渲染(); return; }

  // 播放器需要先弄清楚"今天放哪部片"：
  // 1) ?game= 明确指定；2) 创作台设置的本机默认；3) 静态 showcase 默认。
  const 查询作品 = new URLSearchParams(window.location.search).get('game') ?? '';
  const 试玩来源 = 解析试玩来源(window.location.search);
  const { 按slug加载剧情 } = await import('../播放器/剧情引擎/剧情加载.js');
  if (查询作品) {
    if (试玩来源.allowDraft) await 按slug加载剧情(查询作品, { allowDraft: true });
    else await 按slug加载剧情(查询作品);
    渲染();
    return;
  }

  let 本机默认 = '';
  try {
    const 本机精选 = JSON.parse(window.localStorage.getItem('creator:browser-showcase:v1') ?? '{}');
    本机默认 = typeof 本机精选.default === 'string' ? 本机精选.default.trim() : '';
  } catch {}
  if (本机默认 && await 按slug加载剧情(本机默认)) {
    渲染();
    return;
  }

  try {
    const 响应 = await fetch('/showcase.json', { cache: 'no-cache' });
    if (响应.ok) {
      const 静态默认 = (await 响应.json()).default;
      if (typeof 静态默认 === 'string' && 静态默认) await 按slug加载剧情(静态默认);
    }
  } catch {
    // 断网时保留剧情模块自带的完整兜底故事。
  }
  渲染();
}

启动();
