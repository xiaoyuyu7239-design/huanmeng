// 用服务端渲染把 games 目录自动发现的全部本地故事逐节点送进壳层，检查空字段、渲染崩溃与 React 告警。
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const 当前目录 = dirname(fileURLToPath(import.meta.url));
const 项目根 = resolve(当前目录, '../..');
const 存储 = new Map();

const 服务 = await createServer({
  root: 项目根,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false },
});

globalThis.localStorage = {
  getItem: (键) => 存储.get(键) ?? null,
  setItem: (键, 值) => 存储.set(键, String(值)),
  removeItem: (键) => 存储.delete(键),
  clear: () => 存储.clear(),
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  addEventListener() {},
  removeEventListener() {},
  location: { assign() {} },
};

let 通过 = 0;
let 节点通过 = 0;
let 作品总数 = 0;

function 无告警渲染(名字, 元素) {
  const 原consoleError = console.error;
  const 告警们 = [];
  console.error = (...参数) => 告警们.push(参数.map(String).join(' '));
  try {
    const html = renderToString(元素);
    if (告警们.length > 0) throw new Error(`${名字} 触发 React 告警：${告警们.join(' | ')}`);
    return html;
  } finally {
    console.error = 原consoleError;
  }
}

try {
  const 剧情模块 = await 服务.ssrLoadModule('/源码/播放器/剧情引擎/剧情加载.js');
  const 状态模块 = await 服务.ssrLoadModule('/源码/播放器/剧情引擎/状态与结算.js');
  const { default: 播放器应用, 关系手账 } = await 服务.ssrLoadModule('/源码/播放器/播放器应用.jsx');
  const 游戏根 = resolve(项目根, '公共资源/games');
  const 剧情路径们 = (await readdir(游戏根, { withFileTypes: true }))
    .filter((条目) => 条目.isDirectory())
    .map((条目) => resolve(游戏根, 条目.name, 'story.json'))
    .sort((甲, 乙) => 甲.localeCompare(乙, 'zh-CN'));
  作品总数 = 剧情路径们.length;
  if (作品总数 < 6 || !剧情路径们.some((路径) => basename(dirname(路径)) === 'ninth-seat')) {
    throw new Error(`games 自动发现未覆盖《第九席》在内的第六部作品，实际发现 ${作品总数} 部`);
  }

  for (const 路径 of 剧情路径们) {
    const slug = basename(dirname(路径));
    const 剧情 = JSON.parse(await readFile(路径, 'utf8'));
    剧情模块.setActiveStory(剧情, slug);
    for (const 节点 of Object.values(剧情.nodes)) {
      存储.clear();
      const 初始状态 = 状态模块.创建初始状态();
      存储.set(
        `interactive-cinema-save:${slug}:v2`,
        JSON.stringify({
          ...初始状态,
          currentNodeId: 节点.id,
          lineIndex: Math.max((节点.lines?.length ?? 1) - 1, 0),
          visitedNodes: [剧情.startNodeId, 节点.id],
        }),
      );
      const html = 无告警渲染(`${slug}/${节点.id}`, React.createElement(播放器应用));
      if (!html.includes('game-shell') || !html.includes(剧情.title)) {
        throw new Error(`${slug}/${节点.id} 未渲染出播放器壳层或故事标题`);
      }
      节点通过 += 1;
    }
    if (slug === 'project-20260620-231058') {
      const 手账状态 = 状态模块.创建初始状态();
      手账状态.relationships.wen_tianmo.trust = '异常旧值';
      手账状态.decisionLog = [
        {
          id: 'trace-wen',
          loop: 1,
          nodeTitle: '雨夜校园入口',
          label: '回应温甜茉的招呼',
          consequence: '她记住了你的认真回应。',
          effect: { relationships: { wen_tianmo: { trust: 8 } } },
          createdAt: 1,
        },
      ];
      const 手账html = 无告警渲染('关系手账', React.createElement(关系手账, { state: 手账状态 }));
      if (
        !['温甜茉', '林晚晴', '花容离', '她记住了你的认真回应。'].every((文本) => 手账html.includes(文本)) ||
        (手账html.match(/role="progressbar"/g) ?? []).length !== 3 ||
        手账html.includes('NaN')
      ) {
        throw new Error('关系手账未正确渲染角色、三维关系、痕迹或异常值兜底');
      }
      console.log('  ✓ 关系手账：三角色、三维刻度、决策痕迹与异常值兜底');
    }
    if (slug === 'ninth-seat') {
      const 手账状态 = 状态模块.创建初始状态();
      手账状态.relationships.lu_chenzhou.trust = '异常旧值';
      手账状态.decisionLog = [
        {
          id: 'trace-lu',
          loop: 1,
          nodeTitle: '信号机房',
          label: '共同保全原始流',
          consequence: '他把主控密钥放回了两人都看得见的位置。',
          effect: { relationships: { lu_chenzhou: { trust: 8, boundary: 7 } } },
          createdAt: 1,
        },
      ];
      const 手账html = 无告警渲染('第九席关系手账', React.createElement(关系手账, { state: 手账状态 }));
      if (
        !['陆沉舟', '周衍', '贺清野', '沈确', '他把主控密钥放回了两人都看得见的位置。'].every((文本) => 手账html.includes(文本)) ||
        ['林渺', '乔雯'].some((文本) => 手账html.includes(文本)) ||
        (手账html.match(/role="progressbar"/g) ?? []).length !== 3 ||
        手账html.includes('NaN')
      ) {
        throw new Error('第九席关系手账未正确区分四名可发展角色与两名女性同盟角色');
      }
      console.log('  ✓ 第九席关系手账：四名可发展角色、三维刻度、女性同盟不数值化');
    }
    通过 += 1;
    console.log(`  ✓ ${slug}：${剧情.title}（${Object.keys(剧情.nodes).length} 节点）`);
  }

  // 创作台刚新建的项目允许尚未生成全景，也可能缺少可选数组/调色板；加载边界应补齐后试玩。
  存储.clear();
  const 本机slug = 'local-empty-panorama';
  const 本机剧情 = {
    title: '本机空画面项目',
    startNodeId: 'scene-1',
    nodes: {
      'scene-1': {
        id: 'scene-1',
        title: '尚未生成画面',
        panorama: '',
        lines: [{ speaker: 'local_guide', text: '先写故事，再生成场景。' }],
      },
    },
  };
  存储.set(
    'creator:browser-projects:v1',
    JSON.stringify({ [本机slug]: { project: { story: 本机剧情 } } }),
  );
  if (!(await 剧情模块.loadStoryBySlug(本机slug))) throw new Error('本机新项目未能从草稿仓库加载');
  const 本机节点 = 剧情模块.storyNodes['scene-1'];
  if (
    本机节点.panorama !== '' ||
    !Array.isArray(本机节点.choices) ||
    !Array.isArray(本机节点.hotspots) ||
    !本机节点.palette?.from
  )
    throw new Error('本机新项目未在加载边界补齐安全字段');
  const 本机html = 无告警渲染('本机空画面项目', React.createElement(播放器应用));
  if (!本机html.includes('game-shell') || !本机html.includes('本机空画面项目'))
    throw new Error('本机空画面项目未渲染出播放器壳层');
  const 空手账html = 无告警渲染(
    '空关系手账',
    React.createElement(关系手账, { state: 状态模块.创建初始状态() }),
  );
  if (!空手账html.includes('这段故事还没有可记录的关系变化')) throw new Error('空关系手账未渲染空状态');
  console.log('  ✓ 本机新项目：空 panorama 使用安全占位字段并完成壳层渲染');
  存储.clear();

  const { default: 落地页应用 } = await 服务.ssrLoadModule('/源码/落地页/落地页应用.jsx');
  const 落地页html = 无告警渲染('落地页', React.createElement(落地页应用));
  if (!落地页html.includes('class="lp"')) throw new Error('落地页壳层渲染失败');
  console.log('  ✓ 落地页壳层');

  const { default: 创作台应用 } = await 服务.ssrLoadModule('/源码/创作台/创作台应用.jsx');
  const 创作台html = 无告警渲染('创作台', React.createElement(创作台应用));
  if (!创作台html.includes('studio-shell')) throw new Error('创作台壳层渲染失败');
  console.log('  ✓ 创作台壳层');
} finally {
  await 服务.close();
}

console.log(`页面壳层自测：播放器 ${通过} / ${作品总数} 部、${节点通过} 个发布节点及 1 个本机空画面项目，加落地页与创作台全部通过`);
