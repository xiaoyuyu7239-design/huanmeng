// ============================================================================
// 这个文件是剧情引擎的「出厂质检台」：不开浏览器、不开界面，直接用 node 把
// 引擎的每个零件拆下来在台架上过一遍——分数规范化、effect 结算、八类条件判定、
// 存档消毒、存档码编解码、BGM 选轨策略……全绿才算能出厂。
// 运行方式：node 源码/播放器/剧情引擎/引擎自测.mjs
//
// 为什么开头要注册一个 JSON 钩子：剧情加载.js 里 `import xx from '….json'` 这种
// 写法 Vite 直接支持，但 node 要求额外的 import 属性；这里给 node 装一个"翻译官"
// （load 钩子），碰到 .json 就现场翻译成 `export default {...}` 的 JS 模块，
// 这样同一份源码在浏览器和 node 里都能跑，不用改引擎本体。
// ============================================================================

import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      const 文本 = readFileSync(fileURLToPath(url), 'utf8');
      return { format: 'module', source: `export default ${文本};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// ---- 浏览器环境桩：假 localStorage + 假 window（引擎只用到这几样）----
const 假存储仓 = new Map();
let 下次项目仓写失败 = false;
const 假localStorage = {
  getItem: (键) => (假存储仓.has(键) ? 假存储仓.get(键) : null),
  setItem: (键, 值) => {
    if (下次项目仓写失败 && 键 === 'creator:browser-projects:v1') {
      下次项目仓写失败 = false;
      const 错误 = new Error('mock project store write failure');
      错误.name = 'SecurityError';
      throw 错误;
    }
    假存储仓.set(键, String(值));
  },
  removeItem: (键) => {
    假存储仓.delete(键);
  },
  clear: () => 假存储仓.clear(),
};
globalThis.localStorage = 假localStorage;
let 窗口监听次数 = 0;
globalThis.window = {
  localStorage: 假localStorage,
  addEventListener: () => {
    窗口监听次数 += 1;
  },
  removeEventListener: () => {},
};

// 钩子和桩都就位后，才能动态 import 引擎模块（静态 import 会赶在桩之前执行）
const 加载 = await import('./剧情加载.js');
const 引擎 = await import('./状态与结算.js');
const 存档 = await import('./存档系统.js');
const 音频 = await import('../音频系统/音频管理.js');
const 创作存储 = await import('../../创作台/项目管理/本机项目存储.js');
const 创作校验 = await import('../../创作台/校验发布/校验规则.js');
const 静态精选 = JSON.parse(
  readFileSync(new URL('../../../公共资源/showcase.json', import.meta.url), 'utf8'),
);

// ---- 迷你断言器：一条一勾，最后汇总 ----
let 通过 = 0;
let 失败 = 0;
function 检查(名字, 函数) {
  try {
    函数();
    通过 += 1;
    console.log(`  ✓ ${名字}`);
  } catch (错) {
    失败 += 1;
    console.error(`  ✗ ${名字}\n    ${错.message}`);
  }
}
function 相等(实际, 期望, 说明 = '') {
  const a = JSON.stringify(实际);
  const b = JSON.stringify(期望);
  if (a !== b) throw new Error(`${说明} 期望 ${b} 实际 ${a}`);
}
function 为真(值, 说明 = '') {
  if (!值) throw new Error(`${说明} 期望真值，实际 ${JSON.stringify(值)}`);
}
function 编码原始存档(原始) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(原始))));
}

// ============================ 一、剧情加载 ============================
console.log('【一】剧情加载（单例 / 兜底 / loadStoryBySlug / 规范化）');

检查('默认与离线兜底原子一致（第九席 / 25节点 / ninth-seat）', () => {
  相等(加载.STORY_TITLE, '第九席');
  相等(加载.STORY_ID, 'ninth-seat');
  相等(加载.BUNDLED_STORY_ID, 'ninth-seat');
  相等(加载.START_NODE_ID, 's00-blue-salon');
  相等(加载.ACTIVE_GAME_ID, 'ninth-seat');
  相等(静态精选.default, 'ninth-seat');
  相等(存档.存档键(), 'interactive-cinema-save:ninth-seat:v2');
  相等(加载.storyNodeList.length, 25);
  为真(加载.storyNodes['s00-blue-salon'], '起始节点存在');
});

检查('兜底剧情的分数定义规范化（4个公开维度）', () => {
  const 定义 = 加载.getScoreDefinitions();
  const 压力 = 定义.find((d) => d.id === 'pressure');
  为真(['evidence', 'agency', 'pressure', 'public_truth'].every((id) => 定义.some((d) => d.id === id)));
  相等(压力.min, 0);
  相等(压力.visibility, 'public');
  相等(压力.warnAt, 75);
});

检查('校验骨架：坏剧情抛错且状态不动', () => {
  const 原标题 = 加载.STORY_TITLE;
  let 抛了 = '';
  try {
    加载.setActiveStory({ title: '坏' });
  } catch (e) {
    抛了 = e.message;
  }
  相等(抛了, 'Story data is malformed: missing nodes or startNodeId.');
  try {
    加载.setActiveStory({ startNodeId: 'x', nodes: { y: {} } });
  } catch (e) {
    抛了 = e.message;
  }
  相等(抛了, 'Story start node "x" is missing.');
  相等(加载.STORY_TITLE, 原标题, '抛错后标题不变');
});

// 极简剧情：专测 scores 兜底（节点里没用任何全局键，避免自动补齐干扰）
const 空白剧情 = {
  title: '空白',
  startNodeId: 'only',
  mechanics: { scores: '一坨垃圾' },
  nodes: { only: { id: 'only', title: '唯一', lines: [{ speaker: 'narrator', text: 'x' }], hotspots: [], choices: [] } },
};

检查('scores 全非法 → 兜底三件套 career/integrity/stress', () => {
  加载.setActiveStory(空白剧情, 'fb');
  const 定义 = 加载.getScoreDefinitions();
  相等(定义.map((d) => d.id), ['career', 'integrity', 'stress']);
  相等(定义[0].initial, 32);
  相等(定义[2].warnAt, 70);
  相等(加载.ACTIVE_GAME_ID, 'fb');
});

检查('slug 清洗：怪字符换 - ，空串兜底 bundled', () => {
  加载.setActiveStory(空白剧情, 'a b/c!!');
  相等(加载.ACTIVE_GAME_ID, 'a-b-c--');
  加载.setActiveStory(空白剧情, '');
  相等(加载.ACTIVE_GAME_ID, 'bundled');
});

检查('仅有 assetPath 的平面视频会在加载边界补成可播放地址', () => {
  加载.setActiveStory({
    title: '视频兼容',
    startNodeId: 'video',
    nodes: {
      video: {
        id: 'video',
        lines: [],
        hotspots: [],
        choices: [],
        cinematics: [{ type: 'flat-video', trigger: 'beforeEnter', assetPath: 'assets/videos/scene.mp4' }],
      },
    },
  }, 'asset-demo');
  相等(加载.storyNodes.video.cinematics[0].src, '/videos/asset-demo/scene.mp4');
});

const 仓库键 = 创作存储.项目存储键;
const 极简项目 = (slug, title) => {
  const 项目 = 创作存储.新建本机项目(title, slug);
  项目.story.id = slug;
  项目.story.title = title;
  return 项目;
};

检查('新建模板：开场双选择通往两个结局，且发布校验无错误', () => {
  const 模板 = 创作存储.新建本机项目('最小闭环', 'minimum-loop');
  const 节点们 = Object.values(模板.story.nodes);
  相等([节点们.length, 模板.story.nodes['s00-start'].choices.length], [3, 2]);
  相等(节点们.filter((节点) => !!节点.ending).length, 2);
  为真(
    模板.story.nodes['s00-start'].choices.every((选择) => !!模板.story.nodes[选择.next]?.ending),
    '两个选择都必须落到真实结局节点',
  );
  相等(创作校验.运行校验(模板).errors, []);
});

// 旧仓只有 project：它仍是可编辑草稿，普通播放器必须回落同 slug 静态作品。
const 旧草稿剧情 = 极简项目('draftgame', '旧仓草稿片').story;
假localStorage.setItem(仓库键, JSON.stringify({ draftgame: { project: { slug: 'draftgame', story: 旧草稿剧情 } } }));
let 旧仓静态请求数 = 0;
globalThis.fetch = async () => {
  旧仓静态请求数 += 1;
  return { ok: true, json: async () => 极简项目('draftgame', '同名静态片').story };
};
{
  const 普通成功 = await 加载.loadStoryBySlug('draftgame');
  检查('旧 project 不自动发布：普通加载回落同 slug 静态作品', () => {
    为真(普通成功);
    相等(旧仓静态请求数, 1);
    相等(加载.STORY_TITLE, '同名静态片');
    相等(创作存储.读已发布本机项目('draftgame'), null);
  });

  globalThis.fetch = async () => {
    throw new Error('allowDraft 命中旧草稿时不应发请求');
  };
  const 预览成功 = await 加载.loadStoryBySlug('draftgame', { allowDraft: true });
  检查('显式 allowDraft 可继续试玩旧 project 草稿', () => {
    为真(预览成功);
    相等(加载.STORY_TITLE, '旧仓草稿片');
    相等(加载.ACTIVE_GAME_ID, 'draftgame');
  });
}

// 新合同：发布冻结一份快照；之后保存只推进草稿，普通玩家与创作预览看到不同版本。
假localStorage.removeItem(仓库键);
const 首次发布 = 创作存储.发布本机项目(极简项目('snapshot-game', '已发布版本'));
const 首次发布时刻 = 首次发布.publishedAt;
创作存储.保存本机项目(极简项目('snapshot-game', '发布后草稿'));
const 发布后原文 = JSON.parse(假localStorage.getItem(仓库键))['snapshot-game'];
检查('保存草稿原样保留 publishedProject / publishedAt，列表暴露发布状态', () => {
  相等(发布后原文.project.story.title, '发布后草稿');
  相等(发布后原文.publishedProject.story.title, '已发布版本');
  相等(发布后原文.publishedAt, 首次发布时刻);
  const [列表项] = 创作存储.本机项目列表();
  相等([列表项.hasPublished, 列表项.publishedAt], [true, 首次发布时刻]);
});

globalThis.fetch = async () => {
  throw new Error('合法本机快照或草稿命中时不应发请求');
};
{
  const 普通成功 = await 加载.loadStoryBySlug('snapshot-game');
  检查('普通加载只读已发布快照', () => {
    为真(普通成功);
    相等(加载.STORY_TITLE, '已发布版本');
  });
  const 草稿成功 = await 加载.按slug加载剧情('snapshot-game', { allowDraft: true });
  检查('硬契约别名透传 allowDraft 并优先读取最新草稿', () => {
    为真(草稿成功);
    相等(加载.STORY_TITLE, '发布后草稿');
  });
}

检查('已发布快照读取为归一化深拷贝，读取和修改都不回写', () => {
  const 读取前原文 = 假localStorage.getItem(仓库键);
  const 第一次 = 创作存储.读已发布本机项目('snapshot-game');
  第一次.story.title = '调用方误改';
  const 第二次 = 创作存储.读已发布本机项目('snapshot-game');
  相等(第二次.story.title, '已发布版本');
  相等(假localStorage.getItem(仓库键), 读取前原文);
});

检查('校验失败在存储边界阻断，且不覆盖上一次玩家版本', () => {
  const 失败前原文 = 假localStorage.getItem(仓库键);
  const 坏草稿 = 极简项目('snapshot-game', '不合格草稿');
  坏草稿.story.nodes[坏草稿.story.startNodeId].choices = [];
  let 错误名 = '';
  try {
    创作存储.发布本机项目(坏草稿);
  } catch (错) {
    错误名 = 错?.name;
  }
  相等(错误名, 'CreatorPublishValidationError');
  相等(假localStorage.getItem(仓库键), 失败前原文);
  相等(创作存储.读已发布本机项目('snapshot-game').story.title, '已发布版本');
});

检查('发布写失败不产生 project / publishedProject 半更新', () => {
  const 失败前原文 = 假localStorage.getItem(仓库键);
  下次项目仓写失败 = true;
  let 抛了 = false;
  try {
    创作存储.发布本机项目(极简项目('snapshot-game', '不应落盘'));
  } catch {
    抛了 = true;
  }
  为真(抛了, '模拟存储失败必须向上抛出');
  相等(假localStorage.getItem(仓库键), 失败前原文);
});

// 草稿试玩必须诚实：坏草稿不得暗中改播同格旧快照或静态版；
// 普通玩家的坏发布快照仍可继续走同 slug 静态回退。
const 坏草稿仓 = JSON.parse(假localStorage.getItem(仓库键));
坏草稿仓['snapshot-game'].project.story = { title: '坏草稿' };
假localStorage.setItem(仓库键, JSON.stringify(坏草稿仓));
let 坏草稿静态请求数 = 0;
globalThis.fetch = async () => {
  坏草稿静态请求数 += 1;
  return { ok: true, json: async () => 极简项目('snapshot-game', '不应播放的静态片').story };
};
{
  const 成功 = await 加载.loadStoryBySlug('snapshot-game', { allowDraft: true });
  检查('allowDraft 遇坏草稿严格失败，不回落发布版或静态版', () => {
    为真(!成功);
    相等(坏草稿静态请求数, 0);
    相等(加载.STORY_TITLE, '发布后草稿', '失败不得切换手上的剧情');
  });
}

const 缺归属草稿仓 = JSON.parse(假localStorage.getItem(仓库键));
缺归属草稿仓['snapshot-game'].project = {
  story: 极简项目('snapshot-game', '缺少项目slug的草稿').story,
};
假localStorage.setItem(仓库键, JSON.stringify(缺归属草稿仓));
{
  const 成功 = await 加载.loadStoryBySlug('snapshot-game', { allowDraft: true });
  检查('allowDraft 拒绝缺少同 slug 项目归属的伪草稿', () => {
    为真(!成功);
    相等(坏草稿静态请求数, 0);
  });
}

const 坏快照仓 = JSON.parse(假localStorage.getItem(仓库键));
坏快照仓['snapshot-game'].publishedProject.story = { title: '坏快照' };
假localStorage.setItem(仓库键, JSON.stringify(坏快照仓));
let 坏快照静态请求数 = 0;
globalThis.fetch = async () => {
  坏快照静态请求数 += 1;
  return { ok: true, json: async () => 极简项目('snapshot-game', '快照损坏后的静态片').story };
};
{
  const 成功 = await 加载.loadStoryBySlug('snapshot-game');
  检查('坏已发布快照不挡住同 slug 静态回退', () => {
    为真(成功);
    相等(坏快照静态请求数, 1);
    相等(加载.STORY_TITLE, '快照损坏后的静态片');
  });
}
假localStorage.removeItem(仓库键);

{
  let 请求过的url = '';
  const 远端剧情 = { title: '远端片', startNodeId: 'r1', nodes: { r1: { id: 'r1', title: 'R1', lines: [], hotspots: [], choices: [] } } };
  globalThis.fetch = async (url) => ((请求过的url = url), { ok: true, json: async () => 远端剧情 });
  const 成功 = await 加载.loadStoryBySlug('a-b');
  检查('fetch 成功：规范 slug 请求 + 切换', () => {
    为真(成功);
    相等(请求过的url, '/games/a-b/story.json');
    相等(加载.STORY_TITLE, '远端片');
    相等(加载.ACTIVE_GAME_ID, 'a-b');
  });

  请求过的url = '';
  const 非规范成功 = await 加载.loadStoryBySlug('a/b');
  检查('非规范 slug 在请求前拒绝，不与 a-b 共用存档身份', () => {
    为真(!非规范成功);
    相等(请求过的url, '');
    相等(加载.ACTIVE_GAME_ID, 'a-b');
  });

  globalThis.fetch = async () => ({ ok: false });
  const 失败1 = await 加载.loadStoryBySlug('missing');
  检查('fetch !ok → false 且状态保持上一部', () => {
    为真(!失败1);
    相等(加载.STORY_TITLE, '远端片', '失败后仍是上一部');
  });

  globalThis.fetch = async () => {
    throw new Error('断网');
  };
  const 失败2 = await 加载.按slug加载剧情('missing');
  检查('  · 网络异常返回 false（经由硬契约别名 按slug加载剧情）', () => 为真(!失败2));

  globalThis.fetch = async () => ({ ok: true, json: async () => ({ title: '缺骨架' }) });
  const 失败3 = await 加载.loadStoryBySlug('bad');
  检查('  · 远端数据校验失败返回 false', () => 为真(!失败3));
}

检查('节点加载边界：空画面与脏字段被补成播放器安全形状', () => {
  加载.setActiveStory(
    {
      title: '',
      startNodeId: 'main',
      nodes: {
        main: {
          id: '',
          title: null,
          panorama: null,
          palette: null,
          lines: '不是数组',
          choices: [{ label: null, next: null }, null],
          hotspots: [{ yaw: '坏', pitch: Infinity }, '垃圾'],
        },
        spare: null,
      },
    },
    'boundary-test',
  );
  const 主 = 加载.storyNodes.main;
  相等(加载.STORY_TITLE, '互动影游');
  相等([主.id, 主.title, 主.panorama], ['main', 'main', '']);
  相等(主.lines, []);
  相等([主.choices.length, 主.choices[0].id, 主.choices[0].label, 主.choices[0].next], [1, 'main-choice-1', '继续', 'main']);
  相等([主.hotspots.length, 主.hotspots[0].yaw, 主.hotspots[0].pitch], [1, 0, 0]);
  相等(主.palette, { from: '#10151f', via: '#31404f', to: '#c78356' });
  相等([加载.storyNodes.spare.id, 加载.storyNodes.spare.lines, 加载.storyNodes.spare.choices], ['spare', [], []]);
});

检查('机制加载边界：畸形 Effect/Condition 嵌套字段不会让播放器崩溃', () => {
  加载.setActiveStory(
    {
      title: '畸形机制',
      startNodeId: 'main',
      nodes: {
        main: {
          id: 'main',
          title: '入口',
          lines: [],
          hotspots: [{ id: 'bad-hotspot', effect: { flags: {}, memories: '错误', globals: [] } }],
          choices: [
            {
              id: 'bad-choice',
              label: '继续',
              next: 'end',
              effect: { flags: {}, memories: {}, relationships: [], globals: [] },
              condition: { flags: {}, minRelationship: {}, minGlobal: {}, maxGlobal: {} },
            },
          ],
        },
        end: { id: 'end', title: '结局', lines: [], hotspots: [], choices: [], ending: { title: '完成' } },
      },
    },
    'malformed-mechanics',
  );
  const 选择 = 加载.storyNodes.main.choices[0];
  相等([选择.effect.flags, 选择.effect.memories], [[], []]);
  相等(
    [选择.condition.flags, 选择.condition.minRelationship, 选择.condition.minGlobal, 选择.condition.maxGlobal],
    [[], [], [], []],
  );
  相等(加载.getRelationshipCharacterIds(), []);
  const 开局 = 引擎.创建初始状态();
  const 结算后 = 引擎.应用效果({ ...开局, flags: undefined, memories: undefined }, { flags: {}, memories: {} });
  相等([结算后.flags, 结算后.memories], [[], []]);
  为真(引擎.条件满足(开局, 选择.condition));
});

检查('cast 加载边界：无 cast 安全回退，畸形类型与系统关系不会泄漏进状态', () => {
  加载.setActiveStory(空白剧情, 'legacy-without-cast');
  相等(加载.getStoryProtagonist().name, '你');
  相等(加载.getStoryCharacterList(), []);

  加载.setActiveStory(
    {
      title: '畸形角色阵容',
      startNodeId: 'only',
      cast: {
        protagonist: { id: 'wrong', name: 7, color: 'red' },
        characters: [
          {
            id: 'su',
            name: '',
            romanceable: 'false',
            relationship: {
              enabled: 'false',
              initial: { spark: null, trust: '', boundary: false },
            },
          },
          { id: 'system', name: '不应进入关系表' },
          { id: 'su', name: '重复角色' },
        ],
      },
      nodes: {
        only: {
          id: 'only',
          title: '唯一',
          lines: [{ speaker: 'you', text: '测试。' }],
          hotspots: [],
          choices: [
            {
              id: 'bad-system-relation',
              label: '继续',
              next: 'only',
              effect: { relationships: { system: { trust: 10 }, you: { spark: 10 } } },
            },
          ],
        },
      },
    },
    'malformed-cast',
  );
  const [角色] = 加载.getStoryCharacterList();
  相等([角色.id, 角色.name, 角色.romanceable, 角色.relationship.enabled], ['su', 'Su', false, true]);
  相等(角色.relationship.initial, { spark: 30, trust: 30, boundary: 50 });
  相等(加载.getRelationshipCharacterIds(), ['su']);
  相等(Object.keys(引擎.创建初始状态().relationships), ['su']);
});

// 两部已发布作品的真实兼容回归：防止以后只让合成测试通过、却再次破坏线上数据。
const 第十五封愿望 = JSON.parse(
  readFileSync(new URL('../../../公共资源/games/project-20260620-231058/story.json', import.meta.url), 'utf8'),
);
const 第九席 = JSON.parse(
  readFileSync(new URL('../../../公共资源/games/ninth-seat/story.json', import.meta.url), 'utf8'),
);
const 七仙女下凡 = JSON.parse(
  readFileSync(new URL('../../../公共资源/games/project-20260620-201739/story.json', import.meta.url), 'utf8'),
);

检查('真实回归·第十五封愿望：三位动态角色进入状态、结算并可经存档消毒', () => {
  加载.setActiveStory(第十五封愿望, 'project-20260620-231058');
  const 开局 = 引擎.创建初始状态();
  相等(加载.getStoryProtagonist().name, '沈知意');
  相等(引擎.说话人显示名('you'), '沈知意');
  相等(加载.getStoryCharacterList().map((角色) => 角色.id), ['wen_tianmo', 'lin_wanqing', 'hua_rongli']);
  相等(开局.relationships.wen_tianmo, { spark: 0, trust: 30, boundary: 60 });
  相等(开局.relationships.lin_wanqing, { spark: 0, trust: 30, boundary: 60 });
  相等(开局.relationships.hua_rongli, { spark: 25, trust: 30, boundary: 55 });
  const 选择 = 加载.storyNodes['s00-character-select'].choices.find((条) => 条.id === 'choice-tianmo');
  const 结算后 = 引擎.应用效果(开局, 选择.effect);
  相等(结算后.relationships.wen_tianmo.trust, 38);
  const 扩展后 = 引擎.应用效果(结算后, { relationships: { guest_reviewer: { trust: 5 } } });
  相等(扩展后.relationships.guest_reviewer.trust, 35, '合法扩展角色不再静默丢弃');
  const 净 = 存档.消毒存档({
    ...扩展后,
    relationships: {
      ...扩展后.relationships,
      wen_tianmo: { trust: 999 },
      lin_wanqing: { trust: 12 },
      hua_rongli: { trust: 44 },
    },
  });
  相等(净.relationships.wen_tianmo.trust, 100);
  相等(净.relationships.lin_wanqing.trust, 12);
  相等(净.relationships.hua_rongli.trust, 44);
  相等(净.relationships.guest_reviewer.trust, 35);
  为真(
    !引擎.条件满足(开局, {
      minRelationship: [{ character: 'not_in_state', metric: 'trust', value: 1 }],
    }),
    '未知角色条件安全返回未满足',
  );
});

// 旧标量关系迁移的引擎能力用合成样例继续覆盖：
// 正式作品《第七织女》翻新后已全部使用三维关系，不再包含旧格式。
检查('旧标量关系迁移为 globals 并按路径正确解锁（合成样例）', () => {
  const 旧式剧情 = {
    title: '旧标量迁移样例',
    startNodeId: 'a',
    nodes: {
      a: {
        id: 'a',
        choices: [
          { id: 'ka', label: '结识', next: 'b', effect: { relationships: { 'dong-yong': 15 } } },
          { id: 'kb', label: '路过', next: 'b', effect: {} },
        ],
      },
      b: {
        id: 'b',
        choices: [
          {
            id: 'kc',
            label: '求助',
            next: 'a',
            condition: { relationships: { 'dong-yong': { min: 10 } } },
            effect: { relationships: { 'dong-yong': 20 } },
          },
        ],
      },
    },
  };
  加载.setActiveStory(旧式剧情, 'legacy-scalar-sample');
  const 所有选择 = 加载.storyNodeList.flatMap((节点) => 节点.choices);
  const 结识 = 所有选择.find((条) => 条.id === 'ka');
  const 路过 = 所有选择.find((条) => 条.id === 'kb');
  const 求助 = 所有选择.find((条) => 条.id === 'kc');
  const 开局 = 引擎.创建初始状态();
  相等(
    [加载.getScoreDefinition('dong_yong_affinity').initial, 加载.getScoreDefinition('dong_yong_affinity').visibility],
    [0, 'hidden'],
  );
  相等(开局.globals.dong_yong_affinity, 0);
  相等(结识.effect.globals.dong_yong_affinity, 15);
  相等(求助.condition.minGlobal, [{ key: 'dong_yong_affinity', value: 10 }]);
  为真(!引擎.选择可用(开局, 求助), '未建立信任时锁定');
  const 信任路径 = 引擎.应用效果(开局, 结识.effect);
  const 独行路径 = 引擎.应用效果(开局, 路过.effect);
  为真(引擎.选择可用(信任路径, 求助), '先选 ka 后解锁');
  为真(!引擎.选择可用(独行路径, 求助), '另一条路径仍锁定');
  相等(引擎.应用效果(信任路径, 求助.effect).globals.dong_yong_affinity, 35);
});

检查('真实回归·第七织女：三维关系初值与结盟 flag 按路径正确解锁', () => {
  加载.setActiveStory(七仙女下凡, 'project-20260620-201739');
  const 所有选择 = 加载.storyNodeList.flatMap((节点) => 节点.choices);
  const 接受帮助 = 所有选择.find((条) => 条.id === 'c01-1');
  const 独自行动 = 所有选择.find((条) => 条.id === 'c01-2');
  const 请董野干扰 = 所有选择.find((条) => 条.id === 'c05-3');
  const 开局 = 引擎.创建初始状态();
  相等(加载.getStoryProtagonist().name, '云织');
  相等(开局.relationships['dong-yong'], { spark: 10, trust: 20, boundary: 60 });
  相等(接受帮助.effect.relationships['dong-yong'], { spark: 3, trust: 8 });
  相等(请董野干扰.condition.flags, ['dongye_ally']);
  为真(!引擎.选择可用(开局, 请董野干扰), '未结盟时锁定');
  const 结盟路径 = 引擎.应用效果(开局, 接受帮助.effect);
  const 独行路径 = 引擎.应用效果(开局, 独自行动.effect);
  为真(引擎.选择可用(结盟路径, 请董野干扰), '先选 c01-1 后解锁');
  为真(!引擎.选择可用(独行路径, 请董野干扰), '另一条路径仍锁定');
  相等(引擎.应用效果(结盟路径, 请董野干扰.effect).relationships['dong-yong'].trust, 36, '合作后信任累加');
});

// ============================ 二、状态与结算 ============================
console.log('【二】状态与结算（初始形状 / effect 结算 / 八类条件 / 结局与因果）');

// 自测专用小剧情：涵盖 分数钳制/字典覆盖/自动补齐/热点/条件/结局
const 测试剧情 = {
  title: '引擎自测剧情',
  startNodeId: 'n1',
  cast: {
    protagonist: {
      name: '许澄',
      role: 'AI 直播总导演',
      pronouns: '她',
      color: '#b85c70',
      accent: '#4b2431',
    },
    characters: [
      {
        id: 'su',
        name: '许知微',
        shortName: '知微',
        role: '前调查记者',
        theme: '信任与牺牲',
        color: '#83c99a',
        accent: '#1e4830',
        romanceable: true,
        relationship: { enabled: true, initial: { spark: 25, trust: 35, boundary: 60 } },
      },
    ],
  },
  mechanics: {
    scores: [
      { id: 'truth', label: '真相', initial: 0, min: 0, max: 100, visibility: 'public', tone: 'truth' },
      { id: 'pressure', label: '压力', initial: 0, min: -20, max: 100, visibility: 'debug', tone: 'pressure' },
      { id: 'insight', initial: 5, min: 0, max: 50, visibility: 'hidden', format: 'percent' },
      { id: 'overflow', initial: 150 },
      { id: 'BadKey!', label: '非法id应被拒收' },
      '整条垃圾',
      { id: 'trust', label: '作者自定义标签' },
    ],
  },
  nodes: {
    n1: {
      id: 'n1',
      title: '第一幕',
      chapter: '序章',
      lines: [
        { speaker: 'narrator', text: '雨夜。' },
        { speaker: 'you', text: '谁在那里？' },
        { speaker: 'su', text: '是我。' },
      ],
      hotspots: [
        {
          id: 'h1',
          label: '线索一',
          description: '桌上的信',
          yaw: 0,
          pitch: 0,
          effect: { flags: ['f_clue'], globals: { truth: 2 }, memories: ['看过信'] },
        },
      ],
      choices: [
        {
          id: 'c_go',
          label: '前进',
          next: 'n2',
          fateType: 'river',
          consequence: '走向第二幕',
          effect: {
            globals: { truth: 8, pressure: -100, mystery: 3 },
            relationships: { su: { trust: 10, spark: 1000 }, 假角色: { trust: 5 } },
            flags: ['f_go', 'f_clue'],
            memories: ['出发'],
            route: 'su',
          },
        },
        { id: 'c_locked', label: '锁着的门', next: 'n2', condition: { flags: ['f_clue'] }, lockedHint: '先找线索。' },
        {
          id: 'c_cond',
          label: '硬条件',
          next: 'n2',
          condition: {
            route: 'su',
            flags: ['f_clue'],
            missingFlags: ['f_bad'],
            memories: ['看过信'],
            missingMemories: ['没这回事'],
            minRelationship: [{ character: 'su', metric: 'trust', value: 40 }],
            minGlobal: [{ key: 'truth', value: 10 }, { key: 'cond_only', value: 0 }],
            maxGlobal: [{ key: 'pressure', value: 0 }],
          },
        },
      ],
    },
    n2: {
      id: 'n2',
      title: '第二幕',
      chapter: '第一章',
      lines: [{ speaker: 'narrator', text: '走廊尽头。' }],
      hotspots: [],
      choices: [{ id: 'c_end', label: '终局', next: 'e1' }],
    },
    e1: {
      id: 'e1',
      title: '结局幕',
      chapter: '结局',
      lines: [{ speaker: 'narrator', text: '完。' }],
      hotspots: [],
      choices: [],
      ending: { title: '测试结局', subtitle: '一切尘埃落定', type: 'growth' },
    },
  },
};
加载.setActiveStory(测试剧情, 'engine-test');

检查('分数规范化：字典覆盖 / 非法id拒收 / 自动补齐剧情用到的键', () => {
  const 定义 = 加载.getScoreDefinitions();
  相等(加载.getScoreDefinition('trust').label, '信任', '字典强制覆盖作者label');
  相等(加载.getScoreDefinition('insight').label, '洞察', '缺label走字典');
  相等(加载.getScoreDefinition('insight').format, 'percent');
  为真(!定义.some((d) => d.id === 'BadKey!'), '非法id被拒收');
  const 神秘 = 加载.getScoreDefinition('mystery');
  相等([神秘.initial, 神秘.min, 神秘.max, 神秘.visibility, 神秘.tone], [0, 0, 100, 'debug', 'custom'], 'effect里用到的未声明键自动补齐');
  为真(定义.some((d) => d.id === 'cond_only'), 'condition里引用的键也补齐');
  相等(加载.getScoreDefinition('overflow').label, 'Overflow', '无字典键人性化标签');
});

检查('getVisibleScoreDefinitions 只滤 hidden', () => {
  const 可见 = 加载.getVisibleScoreDefinitions();
  为真(!可见.some((d) => d.id === 'insight'), 'hidden被滤掉');
  为真(可见.some((d) => d.id === 'pressure'), 'debug保留');
});

const 初始 = 引擎.创建初始状态();
检查('创建初始状态：形状与钳制（overflow 初始 150 → 100）', () => {
  相等(初始.gameId, 'engine-test');
  相等(初始.storyId, 'engine-test');
  相等(初始.currentNodeId, 'n1');
  相等(初始.visitedNodes, ['n1']);
  相等(初始.loopCount, 1);
  相等(初始.route, null);
  相等(初始.relationships.su, { spark: 25, trust: 35, boundary: 60 });
  相等(Object.keys(初始.relationships), ['su'], '只初始化当前故事声明或引用的角色');
  相等(初始.globals.overflow, 100, '初始值也按min/max钳');
  相等(初始.globals.insight, 5);
  相等(初始.settings.audio.sceneAudioDefault, 'voice');
  相等(初始.settings.autoAdvance, false, '自动推进默认关闭，不能替玩家做选择');
  相等(初始.dialogueLog, [], '新周目从空对白历史开始');
});

检查('对白历史：当前行白名单快照 / 连续幂等 / 上限 240 / 阅读时长封顶', () => {
  const 记第一行 = 引擎.记录当前对白(初始, 100);
  相等(记第一行.dialogueLog.length, 1);
  相等(
    记第一行.dialogueLog[0],
    {
      id: '1-n1-0-100',
      loop: 1,
      nodeId: 'n1',
      nodeTitle: '第一幕',
      lineIndex: 0,
      speaker: 'narrator',
      text: '雨夜。',
      emotion: undefined,
      createdAt: 100,
    },
  );
  相等(引擎.记录当前对白(记第一行, 101).dialogueLog.length, 1, '同一行连续记录不重复追加');

  const 白名单 = 引擎.规范化对白日志([
    { id: '伪造', nodeId: 'n1', lineIndex: 1, speaker: 'hacker', text: '<script>坏内容</script>' },
    { id: '越界', nodeId: 'n1', lineIndex: 99, text: '不能钳到最后一句' },
    { nodeId: '幽灵节点', lineIndex: 0, text: '不存在' },
    { nodeId: 'constructor', lineIndex: 0, text: '原型链也不能混入' },
    null,
  ]);
  相等(白名单.length, 1);
  相等([白名单[0].speaker, 白名单[0].text], ['you', '谁在那里？'], '展示字段从真实剧情还原');

  const 塞满 = Array.from({ length: 242 }, (_, i) => ({
    id: `对白-${i}`,
    loop: 1,
    nodeId: 'n1',
    lineIndex: i % 3,
    createdAt: i,
  }));
  const 封顶 = 引擎.规范化对白日志(塞满);
  相等(封顶.length, 240);
  相等(封顶[0].id, '1-n1-2-2-2', '对白历史只保留最新 240 条并重建受控唯一 id');
  相等(引擎.计算对白阅读时长(''), 1800);
  为真(引擎.计算对白阅读时长('这是一段需要稍微停留的对白。') > 1800);
  相等(引擎.计算对白阅读时长('很长。'.repeat(100)), 5200);
});

检查('应用效果：累加 / 钳制 / 并集 / 路线覆盖', () => {
  const 效果 = 测试剧情.nodes.n1.choices[0].effect;
  const 后 = 引擎.应用效果(初始, 效果);
  相等(后.globals.truth, 8);
  相等(后.globals.pressure, -20, '压力钳到min=-20');
  相等(后.globals.mystery, 3);
  相等(后.relationships.su.trust, 45);
  相等(后.relationships.su.spark, 100, '关系钳到100');
  为真(!('假角色' in 后.relationships), '未知角色被忽略');
  相等(后.flags, ['f_go', 'f_clue']);
  相等(后.memories, ['出发']);
  相等(后.route, 'su');
  const 又 = 引擎.应用效果(后, { flags: ['f_go'], route: null });
  相等(又.flags, ['f_go', 'f_clue'], '旗标幂等去重');
  相等(又.route, null, '显式null覆盖路线');
  相等(引擎.应用效果(后, { route: undefined }).route, 'su', '不给route保持原样');
  相等(引擎.应用效果(初始, undefined), 初始, '空effect原样返回');
});

检查('条件判定：八类逐一验证', () => {
  const 基准 = 引擎.应用效果(初始, {
    globals: { truth: 10, pressure: -5 },
    relationships: { su: { trust: 10 } },
    flags: ['f_clue'],
    memories: ['看过信'],
    route: 'su',
  });
  为真(引擎.条件满足(基准, undefined), '无条件恒真');
  为真(引擎.条件满足(基准, { route: 'su' }) && !引擎.条件满足(基准, { route: 'lin' }), 'route');
  为真(引擎.条件满足(基准, { flags: ['f_clue'] }) && !引擎.条件满足(基准, { flags: ['f_clue', '没有'] }), 'flags');
  为真(引擎.条件满足(基准, { missingFlags: ['没有'] }) && !引擎.条件满足(基准, { missingFlags: ['f_clue'] }), 'missingFlags');
  为真(引擎.条件满足(基准, { memories: ['看过信'] }) && !引擎.条件满足(基准, { memories: ['别的'] }), 'memories');
  为真(引擎.条件满足(基准, { missingMemories: ['别的'] }) && !引擎.条件满足(基准, { missingMemories: ['看过信'] }), 'missingMemories');
  为真(
    引擎.条件满足(基准, { minRelationship: [{ character: 'su', metric: 'trust', value: 45 }] }) &&
      !引擎.条件满足(基准, { minRelationship: [{ character: 'su', metric: 'trust', value: 46 }] }),
    'minRelationship',
  );
  为真(引擎.条件满足(基准, { minGlobal: [{ key: 'truth', value: 10 }] }) && !引擎.条件满足(基准, { minGlobal: [{ key: 'truth', value: 11 }] }), 'minGlobal');
  为真(引擎.条件满足(基准, { maxGlobal: [{ key: 'pressure', value: 0 }] }) && !引擎.条件满足(基准, { maxGlobal: [{ key: 'truth', value: 9 }] }), 'maxGlobal');
  const 缺键 = { ...基准, globals: { truth: 10 } };
  为真(引擎.条件满足(缺键, { minGlobal: [{ key: 'insight', value: 5 }] }) && !引擎.条件满足(缺键, { minGlobal: [{ key: 'insight', value: 6 }] }), '账上没有的键回退定义initial=5');
  为真(引擎.条件满足(基准, 测试剧情.nodes.n1.choices[2].condition), '全套硬条件一次通过');
});

检查('可用/锁定选择列表 + 解锁热点提示', () => {
  相等(引擎.可用选择列表(初始).map((c) => c.id), ['c_go']);
  相等(引擎.锁定选择列表(初始).map((c) => c.id), ['c_locked', 'c_cond']);
  const 节点 = 引擎.取当前节点(初始);
  相等(引擎.锁定提示(节点, 节点.choices[1]), '先点击「线索一」：桌上的信', '热点旗标交集 → 引导文案');
  相等(引擎.找解锁热点(节点, 节点.choices[0]), null, '无condition.flags → null');
  相等(引擎.锁定提示(节点, { condition: { flags: ['别处的'] }, lockedHint: '去别处。' }), '去别处。');
  相等(引擎.锁定提示(节点, { condition: { flags: ['别处的'] } }), '先调查场景中的线索，再做选择。');
});

检查('推进对白 / 点击热点幂等 / 做出选择全流程', () => {
  const s2 = 引擎.推进对白(初始);
  相等(s2.lineIndex, 1);
  const 安全前进 = 引擎.安全推进对白(初始, 'n1', 0);
  相等([安全前进.lineIndex, 安全前进.dialogueLog.length], [1, 1], '安全推进同时记录当前对白');
  为真(
    引擎.安全推进对白(安全前进, 'n1', 0) === 安全前进,
    '点击与自动计时器同刻触发时，旧行操作不能再推进第二次',
  );
  相等(引擎.推进对白(引擎.推进对白(s2)).lineIndex, 2, '最后一行不再前进');
  为真(引擎.已到最后一行(引擎.推进对白(s2)));

  const 热点 = 测试剧情.nodes.n1.hotspots[0];
  const s3 = 引擎.点击热点(初始, 'h1', 热点.effect);
  相等(s3.seenHotspots, ['n1:h1']);
  相等(s3.globals.truth, 2);
  为真(引擎.点击热点(s3, 'h1', 热点.effect) === s3, '看过的热点原样返回（不重复给数值）');

  const s4 = 引擎.做出选择(s3, 测试剧情.nodes.n1.choices[0]);
  相等(s4.currentNodeId, 'n2');
  相等(s4.lineIndex, 0);
  相等(s4.globals.truth, 10, '2+8');
  相等(s4.visitedNodes, ['n1', 'n2']);
  相等(s4.decisionLog.length, 1);
  const 记 = s4.decisionLog[0];
  相等([记.loop, 记.nodeId, 记.nodeTitle, 记.choiceId, 记.label, 记.next, 记.fateType, 记.consequence], [1, 'n1', '第一幕', 'c_go', '前进', 'n2', 'river', '走向第二幕']);

  相等(引擎.跳转节点(初始, '不存在的').currentNodeId, 'n1', '断链回起始节点');

  const s5 = 引擎.做出选择(s4, 测试剧情.nodes.n2.choices[0]);
  相等(s5.currentNodeId, 'e1');
  相等(s5.unlockedEndings, ['e1'], '进结局节点即解锁');
  为真(引擎.结局已达成(s5), '结局节点1行台词，行0即最后一行');
  相等(引擎.本周目因果回放(s5).map((d) => d.choiceId), ['c_go', 'c_end']);
  globalThis.__s5 = s5;
});

检查('决策日志封顶 120 条', () => {
  const 塞满 = {
    ...初始,
    decisionLog: Array.from({ length: 120 }, (_, i) => ({ ...引擎.生成决策记录(初始, 测试剧情.nodes.n1, 测试剧情.nodes.n1.choices[0]), id: `旧-${i}` })),
  };
  const 后 = 引擎.做出选择(塞满, 测试剧情.nodes.n1.choices[0]);
  相等(后.decisionLog.length, 120);
  相等(后.decisionLog[0].id, '旧-1', '最老一条被挤掉');
});

检查('选择反馈与展示名（文案逐字对照）', () => {
  const 反馈 = 引擎.生成选择反馈(测试剧情.nodes.n1.choices[0]);
  相等(反馈.changes, ['真相 +8', '压力 -100', 'Mystery +3', '知微 信任 +10', '知微 牵连 +1000', '假角色 信任 +5', '路线锁定：知微']);
  相等(反馈.unlocks, ['记忆：出发', '因果标记：f_go', '因果标记：f_clue']);
  相等(引擎.生成选择反馈({ label: 'x', caption: '备注' }).consequence, '备注', 'consequence缺省用caption');
  相等([引擎.路线显示名(null), 引擎.路线显示名('team'), 引擎.路线显示名('solo')], ['未锁定', '群像', '独立']);
  相等(
    [
      引擎.说话人显示名('narrator'),
      引擎.说话人显示名('you'),
      引擎.说话人显示名('system'),
      引擎.说话人显示名('wen_tianmo'),
      引擎.说话人显示名('lin_wanqing'),
      引擎.说话人显示名('hua_rongli'),
      引擎.说话人显示名('guest_reviewer'),
      引擎.说话人显示名('路人甲'),
    ],
    ['旁白', '许澄', '系统', '温甜茉', '林晚晴', '花容离', 'Guest Reviewer', '路人甲'],
  );
  相等(引擎.路线显示名('su'), '知微', '当前故事路线使用 cast 展示名');
  相等([引擎.命运类型显示名('river'), 引擎.命运类型显示名('wheel'), 引擎.命运类型显示名(undefined)], ['命运长河', '循环之轮', '因果之网']);
  相等(引擎.格式化数值(7, 加载.getScoreDefinition('insight')), '7%');
  为真(引擎.是否警示(70, 加载.getScoreDefinition('pressure')) && !引擎.是否警示(69, 加载.getScoreDefinition('pressure')), 'pressure基调>=70告警');
});

检查('叙事反馈：自然语言关系变化 / 界限风险 / 不泄漏工程字段', () => {
  const effect = {
    relationships: {
      su: { spark: 8, trust: 4, boundary: -6 },
      hacker_id: { trust: 5 },
    },
    globals: { truth: 8, pressure: 9, mystery: 3 },
    memories: ['artifact_found', '你保留了可复核的副本', 'trust +8'],
    flags: ['secret_flag'],
    route: 'su',
  };
  const 关系反馈 = 引擎.生成关系变化叙述(effect);
  为真(关系反馈[0].includes('知微') && 关系反馈[0].includes('界限') && 关系反馈[0].includes('选择空间'), '靠近但界限下降必须提示风险');
  为真(关系反馈[1].includes('某位同伴'), '未知角色不能展示 id');
  const 叙事反馈 = 引擎.生成叙事选择反馈({ label: '保留证据', consequence: '可继续复核', effect });
  为真(叙事反馈.changes.some((条) => 条.includes('真相有了新的进展')));
  为真(!叙事反馈.changes.some((条) => 条.includes('压力') || 条.includes('Mystery')), '非公开工程分不展示');
  为真(叙事反馈.unlocks.some((条) => 条.includes('可复核的副本')));
  const 玩家文案 = JSON.stringify([...叙事反馈.changes, ...叙事反馈.unlocks]);
  为真(
    !/\b(?:su|hacker_id|trust|boundary|spark|secret_flag|artifact_found)\b|[+-]\s*\d/i.test(玩家文案),
    `玩家文案不得泄漏 id、英文维度、内部 flag 或增量：${玩家文案}`,
  );

  const 稳健关系 = 引擎.关系组合摘要({ spark: 82, trust: 78, boundary: 84 });
  const 风险关系 = 引擎.关系组合摘要({ spark: 82, trust: 78, boundary: 12 });
  为真(稳健关系.includes('在意') && 稳健关系.includes('共同确认') && 稳健关系.includes('清晰的选择空间'));
  为真(风险关系.includes('界限') && 风险关系.includes('同意与拒绝'), '组合摘要必须识别高亲近低界限风险');
  为真(!/\b(?:trust|boundary|spark)\b|\d|[+-]/i.test(`${稳健关系}${风险关系}`), '组合摘要只输出关系含义');
});

检查('设置规范化：钳音量 / 兼容旧字段 / 布尔归一', () => {
  const 设 = 引擎.规范化设置({ audio: { masterVolume: 5, uiVolume: '坏', sceneAudioDefault: 'mix', muted: 1 } });
  相等(设.audio.masterVolume, 1);
  相等(设.audio.uiVolume, 0.72, '坏值回默认');
  相等(设.audio.sceneAudioDefault, 'mix');
  相等(设.audio.muted, true);
  // 旧字段 sceneAudioPriority：只有当 sceneAudioDefault 为空(null)时才轮到它
  //（默认设置里 sceneAudioDefault 恒有值 'voice'，与线上行为一字不差）
  相等(引擎.规范化设置({ audio: { sceneAudioDefault: null, sceneAudioPriority: 'mix' } }).audio.sceneAudioDefault, 'mix', '旧字段在default为null时兼容');
  相等(引擎.规范化设置({ audio: { sceneAudioPriority: 'mix' } }).audio.sceneAudioDefault, 'voice', '默认值在场时旧字段被遮蔽(线上同款)');
  相等(引擎.规范化设置().autoAdvance, false, '旧存档缺字段时补 false');
  相等(引擎.规范化设置({ autoAdvance: true }).autoAdvance, true);
  相等(引擎.规范化设置({ autoAdvance: 'false' }).autoAdvance, false, '字符串不能意外开启');
  相等(引擎.规范化设置({ autoAdvance: 1 }).autoAdvance, false, '数字不能意外开启');
  相等(引擎.规范化设置({ autoDrift: 'false' }).autoDrift, false, '坏存档字符串不能开启自动环视');
  相等(引擎.规范化设置({ reducedMotion: 'true' }).reducedMotion, false, '减少动效只接受真布尔');
  相等(引擎.规范化设置({ uiScale: '巨大' }).uiScale, 'comfortable', '界面缩放非法值回退');
  相等(引擎.更新设置(初始, { uiScale: 'compact' }).settings.uiScale, 'compact');
});

// ============================ 三、存档系统 ============================
console.log('【三】存档系统（键名 / 自动存档 / 消毒 / 存档码 / 重开与周目）');

检查('存档键名 = interactive-cinema-save:<gameId>:v2', () => {
  相等(存档.存档键(), 'interactive-cinema-save:engine-test:v2');
});

检查('保存→读取 往返一致（gameId 强制改写）', () => {
  const s5 = globalThis.__s5;
  存档.保存存档({ ...s5, gameId: '伪造的' });
  为真(假存储仓.has('interactive-cinema-save:engine-test:v2'));
  const 读回 = 存档.读取存档();
  相等(读回.gameId, 'engine-test');
  相等(读回.storyId, 'engine-test');
  相等(读回.currentNodeId, 'e1');
  相等(读回.globals.truth, 10);
  相等(读回.flags, s5.flags);
  相等(读回.decisionLog.length, 2);
  相等(读回.route, 'su', '当前故事角色路线跨刷新保留');
});

检查('自动读档复核作品归属，稳定 storyId 兼容运行别名', () => {
  const 键 = 存档.存档键();
  const 样例 = globalThis.__s5;
  假localStorage.setItem(键, JSON.stringify({ ...样例, gameId: 'other-game', storyId: 'other-game' }));
  相等(存档.读取存档(), null, '放错格子的跨作品存档必须拒绝');

  假localStorage.setItem(键, JSON.stringify({ ...样例, gameId: 'bundled', storyId: 'engine-test' }));
  const 稳定归属档 = 存档.读取存档();
  为真(稳定归属档);
  相等([稳定归属档.gameId, 稳定归属档.storyId], ['engine-test', 'engine-test']);

  const { gameId: _忽略game, storyId: _忽略story, ...无归属旧档 } = 样例;
  假localStorage.setItem(键, JSON.stringify(无归属旧档));
  为真(存档.读取存档(), '无作品标识的旧档继续按当前键兼容');
});

检查('读档兜底：无存档 / 坏JSON / 非对象 JSON → null', () => {
  存档.删除存档();
  相等(存档.读取存档(), null);
  假localStorage.setItem(存档.存档键(), '{烂掉的');
  相等(存档.读取存档(), null);
  for (const 非状态 of [null, [], '伪存档', 7]) {
    假localStorage.setItem(存档.存档键(), JSON.stringify(非状态));
    相等(存档.读取存档(), null, `非对象 JSON 不得消毒成新档：${JSON.stringify(非状态)}`);
  }
  存档.删除存档();
});

检查('消毒存档：逐字段回填与钳制', () => {
  const 净 = 存档.消毒存档({
    currentNodeId: '幽灵节点',
    lineIndex: 99,
    relationships: { su: { trust: 999, spark: '坏' }, 假角色: {} },
    globals: { insight: 200, 没定义的: 7, 坏的: 'x' },
    flags: ['a', 3, 'a'],
    memories: [null, '记一条'],
    visitedNodes: ['n2', '幽灵节点', 'n2'],
    seenHotspots: ['n1:h1', 8],
    route: '黑客',
    loopCount: 0,
    unlockedEndings: ['e1', '幽灵节点'],
    decisionLog: [{ nodeId: 'n1' }, '垃圾', null],
    dialogueLog: [
      { id: '可信索引', nodeId: 'n1', lineIndex: 2, speaker: '伪造者', text: '伪造台词' },
      { nodeId: '幽灵节点', lineIndex: 0, text: '不应保留' },
    ],
    settings: { autoAdvance: 'true', audio: { bgmVolume: 3 } },
    lastSavedAt: 123,
    私货字段: '应保留',
  });
  相等(净.currentNodeId, 'n1', '坏节点回起始');
  相等(净.lineIndex, 2, '行索引钳到n1的3行内');
  相等(净.relationships.su.trust, 100);
  相等(净.relationships.su.spark, 0, '非数字字符串→Number()=NaN→钳成0(线上同款)');
  相等(净.relationships.su.boundary, 60, '缺失维度回当前角色配置的初始值');
  为真(!('lin' in 净.relationships), '不再向当前故事注入旧作品角色');
  为真(!('假角色' in 净.relationships));
  相等(净.globals.insight, 50, '按定义max=50钳');
  相等(净.globals.没定义的, 7, '未声明但是有限数→按0-100收留');
  为真(!('坏的' in 净.globals));
  相等(净.flags, ['a']);
  相等(净.memories, ['记一条']);
  相等(净.visitedNodes, ['n2']);
  相等(净.seenHotspots, ['n1:h1']);
  相等(净.route, null);
  相等(存档.消毒存档({ route: 'su' }).route, 'su', '当前 cast 角色是合法路线');
  相等(净.loopCount, 1);
  相等(净.unlockedEndings, ['e1']);
  相等(净.decisionLog.length, 1);
  相等(净.decisionLog[0].id, 'n1-choice', '缺id拼 nodeId-choiceId');
  相等(净.decisionLog[0].nodeTitle, 'Unknown Scene');
  相等(净.decisionLog[0].label, 'Unknown choice');
  相等(净.dialogueLog.length, 1);
  相等([净.dialogueLog[0].speaker, 净.dialogueLog[0].text], ['su', '是我。'], '存档对白按剧情白名单重建');
  相等(净.settings.autoAdvance, false, '坏存档不能意外打开自动推进');
  相等(净.settings.audio.bgmVolume, 1, '音量钳到1');
  相等(净.lastSavedAt, 123);
  相等(净.私货字段, '应保留', '未知字段随存档保留');
  相等(存档.消毒存档({ decisionLog: '不是数组' }).decisionLog, []);
  相等(存档.消毒存档({ dialogueLog: '不是数组' }).dialogueLog, []);
});

检查('消毒存档：对白历史封顶 240 且自动推进显式布尔保留', () => {
  const dialogueLog = Array.from({ length: 245 }, (_, i) => ({
    id: `存档对白-${i}`,
    nodeId: 'n1',
    lineIndex: i % 3,
    loop: 1,
    createdAt: i,
  }));
  const 净 = 存档.消毒存档({ dialogueLog, settings: { autoAdvance: true } });
  相等(净.dialogueLog.length, 240);
  相等(净.dialogueLog[0].id, '1-n1-2-5-5');
  相等(净.settings.autoAdvance, true);
});

检查('存档码：UTF-8 base64 往返 / 坏码 null / 首尾空白容忍', () => {
  const s5 = globalThis.__s5;
  const 码 = 存档.导出存档码(s5);
  为真(/^[A-Za-z0-9+/=]+$/.test(码), 'base64字符集');
  const 回 = 存档.导入存档码(`  ${码}  `);
  相等(回.currentNodeId, 'e1');
  相等(回.memories, s5.memories, '中文记忆无损往返');
  相等(回.globals.pressure, s5.globals.pressure);
  为真(存档.导入存档码(存档.导出存档码({ ...s5, gameId: 'other-game', storyId: 'other-game' })), '导出时强制写入当前作品归属');
  相等(
    存档.导入存档码(编码原始存档({ ...s5, gameId: 'other-game', storyId: 'other-game' })),
    null,
    '拒绝跨作品导入',
  );
  相等(存档.导入存档码('!!!不是码!!!'), null);
  相等(存档.导入存档码(btoa('{"currentNodeId":')), null, '半截JSON也返回null');
  for (const 非状态 of [null, [], '伪存档', 7]) {
    相等(存档.导入存档码(编码原始存档(非状态)), null, '合法 Base64 中的非对象 JSON 也必须拒绝');
  }
});

检查('存档码：稳定 storyId 跨 bundled/正式 slug 互认，歧义旧码拒绝', () => {
  加载.setActiveStory(第九席, 'bundled');
  const 内置状态 = 引擎.创建初始状态();
  const 新码 = 存档.导出存档码(内置状态);
  const { storyId: _忽略, ...旧码状态 } = 内置状态;
  const 歧义旧码 = 编码原始存档({ ...旧码状态, gameId: 'bundled' });
  const 正式旧码 = 编码原始存档({ ...旧码状态, gameId: 'ninth-seat' });
  加载.setActiveStory(第九席, 'ninth-seat');
  相等(存档.导入存档码(新码).storyId, 'ninth-seat');
  相等(存档.导入存档码(正式旧码).storyId, 'ninth-seat');
  相等(存档.导入存档码(歧义旧码), null, '无 storyId 的 bundled 码来源不明，必须拒绝');
  加载.setActiveStory(测试剧情, 'engine-test');
});

检查('清空重开：只留设置，其余归零', () => {
  const 带设置 = 引擎.更新设置(globalThis.__s5, {
    autoAdvance: true,
    audio: { bgmVolume: 0.9 },
  });
  const 新局 = 存档.清空重开(带设置.settings);
  相等(新局.settings.audio.bgmVolume, 0.9);
  相等(新局.settings.autoAdvance, true);
  相等(新局.dialogueLog, [], '重开清空上一局对白历史');
  相等([新局.currentNodeId, 新局.loopCount, 新局.flags, 新局.unlockedEndings, 新局.route], ['n1', 1, [], [], null]);
  相等(存档.清空重开(undefined).settings.audio.bgmVolume, 0.5, '无旧设置用出厂默认');
});

检查('进入下一轮：周目+1，保留结局/跨周目记忆/设置', () => {
  const s5 = globalThis.__s5;
  const 下轮 = 存档.进入下一轮({
    ...s5,
    persistentMemories: ['祖传记忆'],
    dialogueLog: 引擎.记录当前对白(s5, 300).dialogueLog,
    settings: 引擎.规范化设置(s5.settings, { autoAdvance: true }),
  });
  相等(下轮.loopCount, 2);
  相等(下轮.currentNodeId, 'n1');
  相等(下轮.memories, ['祖传记忆', '看过信', '出发', '测试结局'], '结局标题并入记忆');
  相等(下轮.persistentMemories, 下轮.memories);
  相等(下轮.unlockedEndings, ['e1']);
  相等([下轮.flags, 下轮.route, 下轮.decisionLog], [[], null, []]);
  相等(下轮.dialogueLog, [], '新周目重新记录对白历史');
  相等(下轮.settings.autoAdvance, true, '自动推进偏好跨周目保留');
});

// ============================ 四、音频系统（纯逻辑部分）============================
console.log('【四】音频系统（BGM五策略 / 静音矩阵 / 音量计算）');

检查('BGM 选轨五策略 + 旧字段兼容', () => {
  const 层 = { generated: { source: 'generated', src: '/music/g.mp3' }, uploaded: { source: 'uploaded', src: '/music/u.mp3' } };
  const 混 = 音频.取节点音乐轨列表({ musicLayers: 层, musicPlayback: { mode: 'mix', generatedVolume: 0.5, loop: false } });
  相等(混, [
    { source: 'generated', src: '/music/g.mp3', volume: 0.5, loop: false },
    { source: 'uploaded', src: '/music/u.mp3', volume: 0.72, loop: false },
  ]);
  相等(音频.取节点音乐轨列表({ musicLayers: 层, musicPlayback: { mode: 'generated-only' } })[0].src, '/music/g.mp3');
  相等(音频.取节点音乐轨列表({ musicLayers: { generated: 层.generated }, musicPlayback: { mode: 'uploaded-only' } }), [], '缺层被过滤');
  相等(音频.取节点音乐轨列表({ musicLayers: { uploaded: 层.uploaded }, musicPlayback: { mode: 'generated-first' } })[0].src, '/music/u.mp3', 'generated缺→退uploaded');
  相等(音频.取节点音乐轨列表({ musicLayers: 层, musicPlayback: { mode: '乱写' } })[0], { source: 'uploaded', src: '/music/u.mp3', volume: 1, loop: true }, '非法模式当uploaded-first,单轨音量1,默认循环');
  const 旧 = 音频.取节点音乐轨列表({ musicSrc: '/music/old.mp3' });
  相等(旧, [{ source: 'generated', src: '/music/old.mp3', volume: 1, loop: true }], '旧版musicSrc转generated层');
  相等(音频.音乐轨key(旧[0]), 'generated:/music/old.mp3');
});

检查('场景声音模式与静音矩阵', () => {
  相等(音频.场景声音模式({ audioPlayback: { mode: 'video' } }, 'voice'), 'video');
  相等(音频.场景声音模式({ audioPlayback: { mode: '乱写' } }, 'voice'), 'voice');
  相等(音频.场景声音模式({}, 'mix'), 'mix');
  const 基 = { muted: false, masterMuted: false, uiMuted: false, voiceMuted: false, bgmMuted: false, masterVolume: 0.8, uiVolume: 0.72, voiceVolume: 1, bgmVolume: 0.5 };
  为真(音频.语音已启用(基) && !音频.语音已启用({ ...基, voiceMuted: true }) && !音频.语音已启用({ ...基, masterVolume: 0 }));
  相等(音频.语音音量(基), 0.8);
  为真(!音频.BGM已静音(基) && 音频.BGM已静音({ ...基, muted: true }) && 音频.BGM已静音({ ...基, bgmVolume: 0 }));
  为真(!音频.试听已禁用(基) && 音频.试听已禁用({ ...基, uiMuted: true }) && 音频.试听已禁用({ ...基, uiVolume: 0 }));
  相等([音频.钳制音量01(5), 音频.钳制音量01(-1), 音频.钳制音量01('坏')], [1, 0, 0]);
});

检查('播放界面音效：静音/零音量下安静跳过（node里不建Audio）', () => {
  const 基 = { muted: true, masterMuted: false, uiMuted: false, masterVolume: 0.8, uiVolume: 0.72 };
  音频.播放界面音效('click', 基);
  音频.播放界面音效('advance', { ...基, muted: false, uiVolume: 0 });
});

检查('更新BGM轨：空轨清场 / 自动播放解锁器计数', () => {
  const 元素引用 = { current: null };
  const key引用 = { current: 'generated:/music/g.mp3' };
  音频.更新BGM轨({ 轨: undefined, 元素引用, key引用, 音频设置: {}, 自动播放被拦: () => {} });
  相等([元素引用.current, key引用.current], [null, '']);
  窗口监听次数 = 0;
  const 解锁器 = 音频.创建自动播放解锁器(() => []);
  解锁器.请求解锁();
  解锁器.请求解锁();
  相等(窗口监听次数, 2, '重复请求只挂一次(两个事件)');
  解锁器.清理();
});

// ============================ 汇总 ============================
console.log(`\n自测结果：通过 ${通过} 项，失败 ${失败} 项`);
if (失败 > 0) process.exitCode = 1;
