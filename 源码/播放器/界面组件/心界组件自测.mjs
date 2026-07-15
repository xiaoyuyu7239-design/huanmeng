// Level 3 UI 契约测试；已挂入 npm test，覆盖组件语义、回退与作用域样式。
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const 当前目录 = dirname(fileURLToPath(import.meta.url));
const 项目根 = resolve(当前目录, '../../..');
const 服务 = await createServer({
  root: 项目根,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false },
});

function 断言(条件, 消息) {
  if (!条件) throw new Error(消息);
}

function 无告警渲染(元素) {
  const 原consoleError = console.error;
  const 告警们 = [];
  console.error = (...参数) => 告警们.push(参数.map(String).join(' '));
  try {
    const html = renderToStaticMarkup(元素);
    断言(告警们.length === 0, `触发 React 告警：${告警们.join(' | ')}`);
    return html;
  } finally {
    console.error = 原consoleError;
  }
}

try {
  const 剧情模块 = await 服务.ssrLoadModule('/源码/播放器/剧情引擎/剧情加载.js');
  剧情模块.setActiveStory(
    {
      id: 'heartscape-component-fixture',
      title: '心界组件测试',
      startNodeId: 'opening',
      cast: {
        protagonist: { name: '许澄', portrait: '/portraits/xu.png' },
        characters: [
          {
            id: 'architect',
            name: '陆沉舟',
            role: '实时系统架构师',
            color: '#7f9fbd',
            portrait: '/portraits/architect-base.png',
            portraits: {
              concerned: '/portraits/architect-concerned.png',
              default: '/portraits/architect-default.png',
            },
          },
          {
            id: 'reporter',
            name: '周衍',
            role: '调查记者',
            portrait: '/portraits/reporter.png',
          },
        ],
      },
      nodes: {
        opening: {
          id: 'opening',
          chapter: '第一章',
          title: '第九席亮起',
          location: '主控蓝厅',
          backdrop: '/scenes/control-room.png',
          lines: [{ speaker: 'architect', text: '决定权在你。' }],
          hotspots: [{ id: 'ninth-seat', label: '第九席' }],
          choices: [],
        },
      },
    },
    'heartscape-component-fixture',
  );

  const { default: 轻电影场景 } = await 服务.ssrLoadModule('/源码/播放器/全景渲染/轻电影场景.jsx');
  const { default: 对白历史面板 } = await 服务.ssrLoadModule('/源码/播放器/界面组件/对白历史面板.jsx');
  const 节点 = 剧情模块.storyNodes.opening;

  const 舞台html = 无告警渲染(
    React.createElement(轻电影场景, {
      节点,
      行: { speaker: 'architect', text: '决定权在你。', expression: 'concerned' },
      可调查: true,
      调查区域id: 'test-investigation',
    }),
  );
  断言(舞台html.includes('class="cinema-stage is-right"'), '未渲染轻电影舞台');
  断言(舞台html.includes('/scenes/control-room.png'), '未使用节点 backdrop');
  断言(舞台html.includes('/portraits/architect-concerned.png'), '未按 expression 命中 portraits');
  断言(['陆沉舟', '担忧', '实时系统架构师'].every((值) => 舞台html.includes(值)), '人物演出信息不完整');
  断言(舞台html.includes('aria-controls="test-investigation"'), '调查入口未关联调查视图');
  断言(舞台html.includes('aria-expanded="false"'), '调查入口未暴露折叠状态');

  const 旁白html = 无告警渲染(
    React.createElement(轻电影场景, {
      节点,
      行: { speaker: 'narrator', text: '灯暗了一秒。' },
      可调查: false,
    }),
  );
  断言(!旁白html.includes('cinema-character-portrait'), '旁白不应渲染人物立绘');
  断言(!旁白html.includes('cinema-character-caption'), '旁白不应渲染人物名牌');

  const 单图回退html = 无告警渲染(
    React.createElement(轻电影场景, {
      节点,
      行: { speaker: 'reporter', text: '记录还在。', expression: 'alert' },
      可调查: false,
    }),
  );
  断言(单图回退html.includes('/portraits/reporter.png'), '多表情未命中时没有回退单张 portrait');

  const 历史html = 无告警渲染(
    React.createElement(对白历史面板, {
      当前条目id: 'line-2',
      条目们: [
        { id: 'line-1', speaker: 'narrator', text: '灯暗了一秒。', chapter: '第一章' },
        {
          id: 'line-2',
          speaker: 'architect',
          text: '决定权在你。',
          expression: 'concerned',
          nodeTitle: '第九席亮起',
        },
        { id: 'blank', speaker: 'reporter', text: '   ' },
      ],
    }),
  );
  断言(历史html.includes('aria-label="已读对白"'), '历史列表缺少可访问名称');
  断言(历史html.includes('aria-current="true"'), '当前对白没有语义标记');
  断言(['灯暗了一秒。', '决定权在你。', '第九席亮起'].every((值) => 历史html.includes(值)), '历史条目内容不完整');
  断言(!历史html.includes('blank'), '空对白条目不应进入历史');

  const 空历史html = 无告警渲染(React.createElement(对白历史面板, { 条目们: [] }));
  断言(空历史html.includes('对白会从这里留下痕迹'), '历史空状态缺失');
  断言(空历史html.includes('role="status"'), '历史空状态缺少状态语义');

  // 让 Vite 实际解析一遍独立 CSS，而不只是做字符串断言。
  await 服务.ssrLoadModule('/源码/样式/播放器-心界.css');
  const 样式 = await readFile(resolve(项目根, '源码/样式/播放器-心界.css'), 'utf8');
  断言(样式.includes('.layout-portrait-cinema.theme-twilight .cinema-stage'), '轻电影样式未限制在主题作用域');
  断言(!/^\.cinema-(?:stage|character|investigate|backdrop)/m.test(样式), '存在未限定作用域的轻电影规则');
  断言(样式.includes('@media (max-width: 430px)'), '缺少 390px 级小屏适配');
  断言(样式.includes('@media (max-width: 350px) and (max-height: 640px)'), '缺少 320×568 级适配');
  断言(样式.includes('@media (prefers-reduced-motion: reduce)'), '缺少系统减少动效适配');
  断言(样式.includes('min-height: 44px'), '小屏交互没有 44px 触控下限');
  断言(!样式.includes('-webkit-line-clamp'), '移动端对白不得按固定行数截断');
  断言(样式.includes('overflow-y: auto'), '长对白与选择区必须保留纵向滚动能力');

  console.log('心界 UI 自测：轻电影立绘回退、旁白、调查入口、对白历史、空状态与作用域样式全部通过');
} finally {
  await 服务.close();
}
