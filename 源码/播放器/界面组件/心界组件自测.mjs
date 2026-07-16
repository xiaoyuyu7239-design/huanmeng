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
  const { default: 全景视图, 应用键盘视角 } = await 服务.ssrLoadModule('/源码/播放器/全景渲染/全景视图.jsx');
  const { default: 顶部栏 } = await 服务.ssrLoadModule('/源码/播放器/界面组件/顶部栏.jsx');
  const { default: 对白区 } = await 服务.ssrLoadModule('/源码/播放器/界面组件/对白区.jsx');
  const { 限制焦点在面板 } = await 服务.ssrLoadModule('/源码/播放器/播放器应用.jsx');
  const { default: 对白历史面板 } = await 服务.ssrLoadModule('/源码/播放器/界面组件/对白历史面板.jsx');
  const { default: 关系私聊面板, 关系回应标签 } = await 服务.ssrLoadModule('/源码/播放器/界面组件/关系私聊面板.jsx');
  const 关系客户端 = await 服务.ssrLoadModule('/源码/播放器/关系AI/关系私聊客户端.js');
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

  const 全景html = 无告警渲染(
    React.createElement(全景视图, {
      node: {
        id: 'keyboard-panorama',
        panorama: '/panorama.jpg',
        entryView: { yaw: 16, pitch: -4, fov: 92 },
        hotspots: [
          { id: 'front', label: '眼前线索', description: '在当前视野中', yaw: 12, pitch: 0 },
          { id: 'behind', label: '身后线索', description: '初始视野之外', yaw: 176, pitch: 8 },
        ],
      },
      seenHotspots: [],
    }),
  );
  断言(全景html.includes('aria-label="360度调查场景"') && 全景html.includes('tabindex="0"'), '全景调查容器不可由键盘聚焦');
  断言(['使用方向键转动视角', '全部线索 · 2', '眼前线索', '身后线索'].every((值) => 全景html.includes(值)), '全景键盘说明或视野外线索索引缺失');
  const 左转 = 应用键盘视角({ lon: 10, lat: 70, fov: 100 }, 'ArrowLeft', { yaw: 16, pitch: -4, fov: 92 });
  const 上转 = 应用键盘视角({ lon: 10, lat: 70, fov: 100 }, 'ArrowUp', { yaw: 16, pitch: -4, fov: 92 });
  const 放大 = 应用键盘视角({ lon: 10, lat: 0, fov: 24 }, '+', { yaw: 16, pitch: -4, fov: 92 });
  const 复位 = 应用键盘视角({ lon: -90, lat: 30, fov: 40 }, 'Home', { yaw: 16, pitch: -4, fov: 92 });
  断言(左转.lon === -2 && 上转.lat === 72 && 放大.fov === 20, '方向键或加减号没有按安全边界调整视角');
  断言(复位.lon === 16 && 复位.lat === -4 && 复位.fov === 92, 'Home 没有恢复节点入场视角');
  断言(应用键盘视角({ lon: 0, lat: 0, fov: 100 }, 'Enter') === null, '非视角按键不应被全景容器吞掉');

  const 顶栏html = 无告警渲染(
    React.createElement(顶部栏, {
      剧情标题: '第九席',
      节点,
      当前面板: 'history',
      切换面板: () => {},
      返回目标: () => {},
      显示对白记录: true,
    }),
  );
  断言(
    顶栏html.includes('aria-controls="player-panel-history"') &&
      顶栏html.includes('aria-expanded="true"') &&
      顶栏html.includes('aria-controls="player-panel-settings"'),
    '顶栏抽屉按钮没有暴露展开状态或稳定控制目标',
  );
  const 对白html = 无告警渲染(
    React.createElement(对白区, {
      行: { speaker: 'architect', text: '决定权在你。' },
      语音状态: 'missing',
      语音禁用: true,
      点语音: () => {},
      已到最后一行: false,
      点继续: () => {},
    }),
  );
  断言(
    对白html.includes('aria-label="当前对白"') &&
      对白html.includes('role="region"') &&
      对白html.includes('tabindex="-1"'),
    '剧情阶段切换后没有可编程聚焦的对白落点',
  );

  const 原document = globalThis.document;
  const 首项 = { getAttribute: () => null, focus: () => { globalThis.document.activeElement = 首项; } };
  const 末项 = { getAttribute: () => null, focus: () => { globalThis.document.activeElement = 末项; } };
  const 假面板 = {
    focus: () => { globalThis.document.activeElement = 假面板; },
    querySelectorAll: () => [首项, 末项],
  };
  globalThis.document = { activeElement: 末项 };
  let 已阻止 = false;
  限制焦点在面板({ key: 'Tab', shiftKey: false, currentTarget: 假面板, preventDefault: () => { 已阻止 = true; } });
  断言(已阻止 && globalThis.document.activeElement === 首项, '面板 Tab 没有从末项循环到首项');
  已阻止 = false;
  限制焦点在面板({ key: 'Tab', shiftKey: true, currentTarget: 假面板, preventDefault: () => { 已阻止 = true; } });
  断言(已阻止 && globalThis.document.activeElement === 末项, '面板 Shift+Tab 没有从首项循环到末项');
  if (原document === undefined) delete globalThis.document;
  else globalThis.document = 原document;

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

  const 正式第九席 = JSON.parse(await readFile(resolve(项目根, '公共资源/games/ninth-seat/story.json'), 'utf8'));
  const 私聊节点id们 = ['s12-lu-private', 's13-zhou-private', 's14-he-private', 's15-shen-private', 's16-lin-alliance'];
  const 私聊配置们 = 私聊节点id们.map((id) =>
    关系客户端.取关系私聊配置('ninth-seat', 正式第九席.content, 正式第九席.nodes[id]),
  );
  断言(私聊配置们.every(Boolean), '五个正式关系场景必须生成合法客户端配置');
  断言(关系客户端.取关系私聊配置('ninth-seat', 正式第九席.content, 正式第九席.nodes['s17-solo-review']) === null, '独立复盘不能被模型替玩家生成内心');
  断言(关系客户端.取关系私聊配置('other-story', 正式第九席.content, 正式第九席.nodes['s12-lu-private']) === null, '非正式作品不能复用第九席关系契约');

  const 陆配置 = 私聊配置们[0];
  const 陆角色 = 正式第九席.cast.characters.find((角色) => 角色.id === 陆配置.characterId);
  const 私聊空态html = 无告警渲染(
    React.createElement(关系私聊面板, {
      character: 陆角色,
      config: 陆配置,
      entries: [],
      setEntries: () => {},
      usedTurns: 0,
      setUsedTurns: () => {},
    }),
  );
  断言(['章节后私聊', '陆沉舟', '这段对话还没有开始', '不会改变心动、信任、边界、路线或结局'].every((值) => 私聊空态html.includes(值)), '关系私聊空态或边界说明不完整');
  断言(new RegExp(`maxlength="${关系客户端.关系私聊输入上限}"`, 'i').test(私聊空态html), '私聊输入框没有浏览器长度限制');

  const 私聊记录html = 无告警渲染(
    React.createElement(关系私聊面板, {
      character: 陆角色,
      config: 陆配置,
      entries: [
        { id: 'p1', role: 'player', text: '我需要先说清边界。' },
        {
          id: 'c1', role: 'character', text: '我听清了。', source: 'fallback', serviceStatus: 'unconfigured',
          memoryCandidate: '临时摘要，不进入剧情。',
        },
      ],
      setEntries: () => {},
      usedTurns: 1,
      setUsedTurns: () => {},
    }),
  );
  断言(私聊记录html.includes('作者预设回应 · AI 未接入'), '未接入状态必须明确标注预设回应');
  断言(私聊记录html.includes('临时摘要，不进入剧情。'), '结构化临时摘要缺失');
  断言(关系回应标签({ source: 'model-assisted', serviceStatus: 'connected' }) === 'AI 理解 · 作者定稿回应', '模型辅助成功态标签错误');
  断言(关系回应标签({ source: 'safety', serviceStatus: 'guarded' }) === '安全支持信息', '现实安全态标签错误');

  const 清空后达限html = 无告警渲染(
    React.createElement(关系私聊面板, {
      character: 陆角色,
      config: 陆配置,
      entries: [],
      setEntries: () => {},
      usedTurns: 陆配置.maxTurns,
      setUsedTurns: () => {},
    }),
  );
  断言(清空后达限html.includes(`${陆配置.maxTurns} / ${陆配置.maxTurns} 轮`), '清空正文后已用轮数不能归零');
  断言(清空后达限html.includes('本次章节私聊已结束') && /<textarea[^>]*disabled=""/u.test(清空后达限html), '清空正文后达到三轮仍必须禁用输入');

  let 浏览器请求 = null;
  const 浏览器回应 = await 关系客户端.发送关系私聊({
    config: 陆配置,
    message: '请先听我把边界说完。',
    turnId: 'turn_component_123456789',
    fetchImpl: async (url, options) => {
      浏览器请求 = { url, options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({
        ok: true,
        source: 'model-assisted',
        serviceStatus: 'connected',
        intent: 'set_boundary',
        intentLabel: '说明边界',
        reply: '我会停在你确认的位置。',
        memoryCandidate: '本轮章节私聊的表达标签：说明边界。不写入剧情状态。',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  断言(浏览器请求.url === '/api/relationship-chat', '客户端必须走同源关系代理');
  断言(
    Object.keys(浏览器请求.body).sort().join('|') === 'characterId|message|nodeId|schemaVersion|storyId|turnId',
    '客户端请求夹带了模型、提示词或剧情状态字段',
  );
  断言(!JSON.stringify(浏览器请求.body).includes('API_KEY'), '客户端请求不能携带密钥');
  断言(浏览器回应.source === 'model-assisted' && 浏览器回应.intent === 'set_boundary', '客户端没有保留合法模型辅助回应');

  let 危机网络调用 = 0;
  const 离线危机回应 = await 关系客户端.发送关系私聊({
    config: 陆配置,
    message: '我已经吞了很多安眠药。',
    turnId: 'turn_crisis_local_123456',
    fetchImpl: async () => { 危机网络调用 += 1; throw new Error('offline'); },
  });
  断言(离线危机回应.source === 'safety' && /急救服务/u.test(离线危机回应.reply), '离线时明确危机必须退出角色扮演并显示现实支持');
  断言(危机网络调用 === 0, '浏览器识别到明确危机后不得向网络或角色模型外发');
  断言(
    关系客户端.生成本地备用回应(陆配置, '我现在想自杀。').source === 'safety',
    '本地备用函数也必须保留现实危机安全边界',
  );

  await 断言拒绝(
    关系客户端.发送关系私聊({
      config: 陆配置,
      message: '这次请求需要按时降级。',
      turnId: 'turn_timeout_123456789',
      timeoutMs: 5,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      }),
    }),
    /响应超时/u,
    '浏览器请求必须有独立超时，不能永久停留在回应中',
  );
  await 断言拒绝(
    关系客户端.发送关系私聊({
      config: 陆配置,
      message: '响应头到了，正文也不能无限等待。',
      turnId: 'turn_slow_body_123456789',
      timeoutMs: 5,
      fetchImpl: async () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"ok":true'));
          // 故意不 close，模拟代理只返回响应头和半截 JSON。
        },
      }), { headers: { 'content-type': 'application/json' } }),
    }),
    /响应超时/u,
    '浏览器超时必须覆盖响应 JSON 正文读取',
  );

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
  断言(样式.includes('.relationship-chat-entry'), '缺少关系私聊入口样式');
  断言(样式.includes('.relationship-chat-service.is-fallback'), '缺少 AI 未接入/备用状态样式');
  断言(样式.includes('.relationship-chat-log.is-empty'), '缺少私聊空状态样式');
  断言(样式.includes('.game-shell .choice-feedback-panel > button'), '小屏选择反馈关闭按钮没有 44px 触控保护');
  断言(样式.includes('.ending-actions {\n    display: grid;'), '320×568 结局操作没有切为两列可滚动布局');
  断言(样式.includes('.relationship-chat-panel {\n    display: block;'), '极矮屏私聊没有整层滚动兜底');

  console.log('心界 UI 自测：轻电影、全景键盘、焦点循环、对白历史、五场关系私聊与小屏滚动全部通过');
} finally {
  await 服务.close();
}

async function 断言拒绝(promise, pattern, message) {
  try {
    await promise;
  } catch (错误) {
    断言(pattern.test(String(错误?.message ?? 错误)), message);
    return;
  }
  throw new Error(message);
}
