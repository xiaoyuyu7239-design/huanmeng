// 用服务端渲染把 games 目录自动发现的全部本地故事逐节点送进壳层，检查空字段、渲染崩溃与 React 告警。
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import { 构建试玩返回地址, 解析试玩来源, 是规范作品slug } from '../入口/试玩来源.js';
import { 构建选择展示文案 } from '../公共工具/选择文案.js';

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
  location: { search: '', assign() {} },
};

let 通过 = 0;
let 节点通过 = 0;
let 作品总数 = 0;

const 普通玩家来源 = 解析试玩来源('?game=ninth-seat');
const 创作草稿来源 = 解析试玩来源('?game=work-b&preview=draft&from=creator');
const 无效作品来源 = 解析试玩来源('?game=Work%20B&preview=draft&from=creator');
if (
  普通玩家来源.allowDraft ||
  !普通玩家来源.hasExplicitGame ||
  普通玩家来源.gameId !== 'ninth-seat' ||
  普通玩家来源.returnLabel !== '返回玩家首页' ||
  构建试玩返回地址(普通玩家来源, 'ninth-seat') !== '/' ||
  !创作草稿来源.allowDraft ||
  创作草稿来源.returnLabel !== '返回创作项目' ||
  构建试玩返回地址(创作草稿来源, 'work-b') !== '/creator?project=work-b' ||
  !无效作品来源.hasExplicitGame ||
  !无效作品来源.invalidGame ||
  无效作品来源.allowDraft ||
  无效作品来源.gameId !== '' ||
  !解析试玩来源('?game=').invalidGame ||
  解析试玩来源('').hasExplicitGame ||
  !是规范作品slug('story_01') ||
  是规范作品slug('Story-01') ||
  是规范作品slug('story/01') ||
  解析试玩来源('?game=work-b&preview=draft').allowDraft ||
  解析试玩来源('?game=work-b&from=creator').allowDraft ||
  解析试玩来源('?preview=draft&from=creator').allowDraft
) {
  throw new Error('试玩来源未严格区分普通玩家与显式创作草稿预览');
}

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
  const { default: 播放器应用, 关系手账, 玩家可见后果, 选择通往结局 } = await 服务.ssrLoadModule('/源码/播放器/播放器应用.jsx');
  const 安全文案 = '这个选择已被故事记住。';
  for (const 原始工程文案 of ['+8', 'trust +8', 'career +8', '真相 +8', 'score=8', '因果标记：audit_ready', '{"boundary":-2}']) {
    if (玩家可见后果(原始工程文案, 安全文案) !== 安全文案) {
      throw new Error(`玩家可见后果未过滤工程文案：${原始工程文案}`);
    }
  }
  const 正常叙事文案 = '他把主控密钥放回了两人都看得见的位置。';
  if (玩家可见后果(正常叙事文案, 安全文案) !== 正常叙事文案) {
    throw new Error('玩家可见后果误伤了正常叙事文案');
  }
  if (玩家可见后果('career +8', 'route=solo') !== '这次选择已被故事记住。') {
    throw new Error('玩家可见后果允许工程化兜底文案再次泄漏');
  }
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
      if (!html.includes('aria-label="返回玩家首页"')) {
        throw new Error(`${slug}/${节点.id} 普通玩家入口没有返回玩家首页`);
      }
      if (节点.ending && !html.includes('返回玩家首页')) {
        throw new Error(`${slug}/${节点.id} 结局板没有返回玩家首页入口`);
      }
      if (节点.choices?.length > 0) {
        for (const 选项 of 节点.choices) {
          if (选择通往结局(选项) !== Boolean(剧情.nodes[选项.next]?.ending)) {
            throw new Error(`${slug}/${节点.id} 没有按 choice.next 识别结局选择`);
          }
        }
        if (slug !== 'ninth-seat' && html.includes('意图 ·')) {
          throw new Error(`${slug}/${节点.id} 把旧作品选择文案重复显示成了意图标签`);
        }
        if (slug === 'ninth-seat') {
          for (const 选项 of 节点.choices) {
            const 文案 = 构建选择展示文案(选项);
            if (!文案.intent && 选项.intent && html.includes(`意图 · ${选项.intent}`)) {
              throw new Error(`${slug}/${节点.id} 重复显示了与 label 等价的意图：${选项.intent}`);
            }
          }
        }
      }
      if (slug === 'ninth-seat' && 节点.id === 剧情.startNodeId) {
        if (!html.includes('data-layout="portrait-cinematic"') || !html.includes('自动播放') || !html.includes('调查现场')) {
          throw new Error('第九席首节点未渲染竖屏轻电影、自动播放或按需调查入口');
        }
      }
      const 关系AI节点 = new Set(['s12-lu-private', 's13-zhou-private', 's14-he-private', 's15-shen-private', 's16-lin-alliance']);
      if (slug === 'ninth-seat' && 关系AI节点.has(节点.id)) {
        if (!html.includes('relationship-chat-entry') || !html.includes('回应不会改变剧情选择、关系值或结局')) {
          throw new Error(`${slug}/${节点.id} 未在作者对白之后渲染受约束自由表达入口`);
        }
      } else if (html.includes('relationship-chat-entry')) {
        throw new Error(`${slug}/${节点.id} 不在正式关系白名单却出现了自由表达入口`);
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
        (手账html.match(/role="img"/g) ?? []).length !== 3 ||
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
        (手账html.match(/role="img"/g) ?? []).length !== 3 ||
        !手账html.includes('选择空间') ||
        !手账html.includes('查看关系细节') ||
        !手账html.includes('/ 100') ||
        手账html.includes('NaN')
      ) {
        throw new Error('第九席关系手账未正确区分四名可发展角色与两名女性同盟角色');
      }
      console.log('  ✓ 第九席关系手账：四名可发展角色、默认阶段反馈与按需精确值');
    }
    通过 += 1;
    console.log(`  ✓ ${slug}：${剧情.title}（${Object.keys(剧情.nodes).length} 节点）`);
  }

  剧情模块.setActiveStory(
    JSON.parse(await readFile(resolve(项目根, '公共资源/games/ninth-seat/story.json'), 'utf8')),
    'ninth-seat',
  );
  window.location.search = '?game=ninth-seat&preview=draft&from=creator';
  const 创作预览html = 无告警渲染('创作草稿试玩返回', React.createElement(播放器应用));
  if (!创作预览html.includes('aria-label="返回创作项目"')) {
    throw new Error('显式创作草稿试玩没有返回创作项目');
  }
  window.location.search = '';

  const 入口源码 = await readFile(resolve(项目根, '源码/入口/main.jsx'), 'utf8');
  if (
    !入口源码.includes('试玩来源.hasExplicitGame') ||
    !入口源码.includes('试玩来源.invalidGame') ||
    !入口源码.includes('按slug加载剧情(试玩来源.gameId, { allowDraft: true })') ||
    !入口源码.includes('if (!加载成功)') ||
    !入口源码.includes('渲染作品加载失败')
  ) {
    throw new Error('播放器入口未在挂载播放器前拦截无效或加载失败的显式作品');
  }

  const { default: 作品加载失败 } = await 服务.ssrLoadModule('/源码/入口/作品加载失败.jsx');
  const 普通失败html = 无告警渲染(
    '普通玩家作品失败',
    React.createElement(作品加载失败, { 来源: 普通玩家来源, 原因: 'load-failed' }),
  );
  const 草稿失败html = 无告警渲染(
    '创作草稿作品失败',
    React.createElement(作品加载失败, { 来源: 创作草稿来源, 原因: 'draft-load-failed' }),
  );
  const 无效地址html = 无告警渲染(
    '无效作品地址',
    React.createElement(作品加载失败, { 来源: 无效作品来源, 原因: 'invalid-slug' }),
  );
  if (
    !普通失败html.includes('class="player-load-error"') ||
    !普通失败html.includes('href="/"') ||
    !普通失败html.includes('没有用其他故事代替它') ||
    普通失败html.includes('game-shell') ||
    !草稿失败html.includes('href="/creator?project=work-b"') ||
    !草稿失败html.includes('有效本机草稿') ||
    草稿失败html.includes('game-shell') ||
    !无效地址html.includes('作品地址无效') ||
    !无效地址html.includes('href="/"') ||
    无效地址html.includes('重新尝试')
  ) throw new Error('作品加载失败页未严格区分玩家、创作草稿与无效地址返回目标');
  console.log('  ✓ 显式作品失败：独立错误壳、来源返回与无播放器兜底');
  const 播放器样式 = await readFile(resolve(项目根, '源码/样式/播放器-心界.css'), 'utf8');
  if (!播放器样式.includes('.game-shell .brand-button') || !播放器样式.includes('display: inline-flex')) {
    throw new Error('窄屏播放器仍可能隐藏唯一返回入口');
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
    JSON.stringify({ [本机slug]: { project: { slug: 本机slug, story: 本机剧情 } } }),
  );
  if (!(await 剧情模块.loadStoryBySlug(本机slug, { allowDraft: true }))) {
    throw new Error('显式草稿试玩未能从本机草稿仓库加载');
  }
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
  if (
    !落地页html.includes('class="lp lp-heartscape"') ||
    !落地页html.includes('<main') ||
    !落地页html.includes('href="/play?game=ninth-seat"') ||
    !落地页html.includes('这一次，故事会记住')
  ) throw new Error('玩家优先落地页壳层渲染失败');
  console.log('  ✓ 玩家优先落地页壳层');

  const {
    default: 创作台应用,
    构建创作试玩链接,
    解析创作项目入口,
    标记剧情规则待复核,
  } = await 服务.ssrLoadModule('/源码/创作台/创作台应用.jsx');
  if (
    解析创作项目入口('?project=work-b', 'work-a') !== 'work-b' ||
    解析创作项目入口('?project=package_work', 'work-a') !== 'package_work' ||
    解析创作项目入口('?project=Work%20B', 'work-a') !== 'work-a' ||
    解析创作项目入口('?project=../work-b', 'work-a') !== 'work-a'
  ) throw new Error('返回创作台时未安全恢复显式 project 查询参数');
  if (
    构建创作试玩链接('work-b', true) !== '/play?game=work-b&preview=draft&from=creator' ||
    构建创作试玩链接('work-b', false) !== '/play?game=work-b' ||
    构建创作试玩链接('package_work', true) !== '/play?game=package_work&preview=draft&from=creator' ||
    构建创作试玩链接('Work B', true) !== '/play'
  ) throw new Error('创作台没有区分本机草稿试玩与未保存内置示例的玩家版本');
  const 创作台html = 无告警渲染('创作台', React.createElement(创作台应用));
  if (
    !创作台html.includes('studio-shell') ||
    !创作台html.includes('creator-mode-switch') ||
    !创作台html.includes('quick-creator-shell') ||
    !创作台html.includes('先把人写清楚，再让关系发生')
  ) throw new Error('创作台双模式与快速工作区壳层渲染失败');

  const { 新建本机项目, 归一化项目 } = await 服务.ssrLoadModule('/源码/创作台/项目管理/本机项目存储.js');
  const 创作样例 = 新建本机项目('女性向创作测试', 'women-creator-test');
  创作样例.authoring.consistencyRules.at(-1).enabled = false;
  创作样例.authoring.consistencyRules.at(-1).reviewNote = '停用规则保留原结论';
  const 待复核样例 = 标记剧情规则待复核(创作样例);
  if (
    待复核样例.authoring.consistencyRules.filter((规则) => 规则.enabled !== false)
      .some((规则) => 规则.reviewStatus !== 'pending' || 规则.reviewNote !== '' || 规则.reviewed !== false) ||
    待复核样例.authoring.consistencyRules.at(-1).reviewNote !== '停用规则保留原结论'
  ) throw new Error('剧情或作者资产变化后未完整作废启用规则的旧人工结论');
  创作样例.story.cast.characters.push(
    {
      id: 'partner',
      name: '沈遥',
      role: '危机调查搭档',
      theme: '信任与边界',
      romanceable: true,
      relationship: { enabled: true, initial: { spark: 20, trust: 30, boundary: 70 } },
    },
    {
      id: 'ally',
      name: '林嘉',
      role: '平级数据同盟',
      theme: '证据与姐妹同盟',
      romanceable: false,
      relationship: { enabled: false, initial: { spark: 0, trust: 48, boundary: 80 } },
    },
  );
  const 规整样例 = 归一化项目(创作样例);
  规整样例.authoring.relationshipEdges.push({
    id: 'partner--ally',
    from: 'partner',
    to: 'ally',
    type: 'professional',
    label: '共同审计',
    dynamic: '一人追进度，一人守证据。',
    boundary: '不替对方承诺结论。',
    reviewed: true,
  });
  规整样例.authoring.consistencyRules.push({
    id: 'opening-agency',
    label: '开场主导感',
    scope: 'node',
    targetId: 规整样例.story.startNodeId,
    rule: '开场行动由玩家主角执行。',
    severity: 'error',
    enabled: true,
    reviewed: true,
  });
  规整样例.story.cast.characters.find((角色) => 角色.id === 'partner').portrait = '  /portraits/ninth-seat/xu-cheng.png  ';
  规整样例.authoring.consistencyAssets.push({
    id: 'portrait-partner-shared-reference',
    kind: 'portrait-reference',
    title: '多人关联但由运行态立绘生成的参考',
    status: 'approved',
    characterIds: ['partner', 'ally'],
    nodeIds: [],
    sourcePath: '/portraits/ninth-seat/xu-cheng.png',
    notes: '删除按钮必须说明先解除运行态立绘。',
    reviewed: true,
  });
  const {
    default: 快速创作面板,
    一致性资产面板,
    关系图面板,
    情绪曲线面板,
  } = await 服务.ssrLoadModule('/源码/创作台/女性向资产/创作资产面板.jsx');
  const noop = () => {};
  const 快速html = 无告警渲染('快速创作面板', React.createElement(快速创作面板, {
    项目: 规整样例,
    忙碌: false,
    有未保存修改: false,
    on更新: noop,
    on保存: noop,
    on校验: noop,
    on发布: noop,
    on预览: noop,
    on进入专业模式: noop,
  }));
  if (!快速html.includes('故事骨架') || !快速html.includes('最小可试玩故事') || !快速html.includes('关系设计') || !快速html.includes('一致性资产')) {
    throw new Error('快速创作首步、故事骨架或后续步骤缺失');
  }
  const 关系html = 无告警渲染('专业关系图', React.createElement(关系图面板, { 项目: 规整样例, on更新: noop }));
  if (!关系html.includes('沈遥') || !关系html.includes('林嘉') || !关系html.includes('叙事关系') || !关系html.includes('心动 / 信任 / 边界') || !关系html.includes('连接两名非玩家角色')) {
    throw new Error('专业关系图未同时覆盖可发展角色、非恋爱同盟和三维关系说明');
  }
  const 情绪html = 无告警渲染('专业情绪曲线', React.createElement(情绪曲线面板, { 项目: 规整样例, on更新: noop }));
  if (!情绪html.includes('role="img"') || !情绪html.includes('主导感') || !情绪html.includes('不代表玩家只有一条路线')) {
    throw new Error('情绪曲线缺少可访问图表、主导感或分支说明');
  }
  const 一致性html = 无告警渲染('一致性资产', React.createElement(一致性资产面板, { 项目: 规整样例, on更新: noop }));
  if (!一致性html.includes('自动检查只覆盖引用') || !一致性html.includes('女性同盟保留纠错权') || !一致性html.includes('新增规则') || !一致性html.includes('阻塞发布') || !一致性html.includes('请选择明确目标') || !一致性html.includes('请先在角色圣经中更换或清空基准立绘')) {
    throw new Error('一致性资产缺少诚实扫描说明，或规则新增/范围/目标/严重度编辑入口');
  }
  console.log('  ✓ 创作台壳层：快速/专业模式、角色、关系、情绪与一致性资产');
} finally {
  await 服务.close();
}

console.log(`页面壳层自测：播放器 ${通过} / ${作品总数} 部、${节点通过} 个发布节点及 1 个本机空画面项目，加落地页与创作台全部通过`);
