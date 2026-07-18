// 玩家首页只消费一份经过收口的数据模型：精选清单决定“有哪些世界”，
// 正式剧情决定“旗舰世界里真实存在什么”，存档只负责补回玩家已经亲自获得的内容。
// 这样首页不会靠一组与剧情脱节的营销文案冒充可玩能力。

import { 构建选择展示文案 } from '../公共工具/选择文案.js';

const 存档键前缀 = 'interactive-cinema-save';
const 首页存档来源 = Symbol('homepage-save-source');

function 是普通对象(值) {
  return !!值 && typeof 值 === 'object' && !Array.isArray(值);
}

function 非空文本(值, 兜底 = '') {
  return typeof 值 === 'string' && 值.trim() ? 值.trim() : 兜底;
}

function 文本列表(值) {
  return Array.isArray(值)
    ? [...new Set(值.filter((条) => typeof 条 === 'string' && 条.trim()).map((条) => 条.trim()))]
    : [];
}

function 数组(值) {
  return Array.isArray(值) ? 值 : [];
}

function 安全slug(值) {
  const slug = 非空文本(值);
  return /^[a-z0-9][a-z0-9_-]*$/i.test(slug) ? slug : '';
}

export function 清洗精选条目(条目) {
  if (!是普通对象(条目)) return null;
  const slug = 安全slug(条目.slug);
  const title = 非空文本(条目.title);
  if (!slug || !title) return null;
  return {
    slug,
    title,
    cover: 非空文本(条目.cover),
    tagline: 非空文本(条目.tagline),
    chapters: 非空文本(条目.chapters),
    tags: 文本列表(条目.tags),
  };
}

export function 清洗精选数据(数据) {
  const 原列表 = Array.isArray(数据?.featured)
    ? 数据.featured
    : Array.isArray(数据?.entries)
      ? 数据.entries
      : [];
  const featured = 原列表.map(清洗精选条目).filter(Boolean);
  const 去重后 = [...new Map(featured.map((条目) => [条目.slug, 条目])).values()];
  const 候选默认 = 安全slug(数据?.default);
  return {
    default: 去重后.some((条目) => 条目.slug === 候选默认)
      ? 候选默认
      : (去重后[0]?.slug ?? ''),
    featured: 去重后,
  };
}

function 本机发布卡片(slug, 条目) {
  const 项目 = 是普通对象(条目?.publishedProject) ? 条目.publishedProject : null;
  const 节点表 = 是普通对象(项目?.story?.nodes) ? 项目.story.nodes : null;
  const 起点 = 非空文本(项目?.story?.startNodeId);
  if (
    !项目 ||
    项目.slug !== slug ||
    !Number.isFinite(条目?.publishedAt) ||
    !节点表 ||
    !起点 ||
    !是普通对象(节点表[起点])
  ) return null;

  const 资产路径 = 数组(项目.manifest?.assets)
    .map((资产) => 非空文本(资产?.previewUrl || 资产?.generatedPath || 资产?.targetPath))
    .find(Boolean) ?? '';
  const 首场全景 = Object.values(节点表)
    .map((节点) => 非空文本(节点?.panorama))
    .find(Boolean) ?? '';
  const 候选封面 = (资产路径 || 首场全景).replace(/^public/u, '');
  const cover = /^\/(?!\/)[^\u0000-\u001f]*$/u.test(候选封面) ? 候选封面 : '';
  const tagline = 非空文本(项目.storyBible)
    .split(/\r?\n/u)
    .map((行) => 行.trim())
    .find(Boolean)
    ?.slice(0, 80) ?? '';
  return 清洗精选条目({
    slug,
    title: 非空文本(项目.title, slug),
    cover,
    tagline: tagline || `${Object.keys(节点表).length} 个场景的本机互动影游`,
    chapters: `${Object.keys(节点表).length} 场景`,
    tags: ['本机项目', 'Browser'],
  });
}

// 旧版精选缓存可能保存的是草稿元数据。读取端必须重新核对项目仓：
// 正式清单中的 slug 只采用正式卡片；本机 slug 只有存在有效 publishedProject 才能保留，
// 且卡片文案从冻结快照重建，绝不继续信任缓存里的标题与梗概。
export function 核对本机精选覆盖(缓存, 项目仓, 正式数据) {
  if (!是普通对象(缓存) || !是普通对象(项目仓)) return null;
  const 正式 = 清洗精选数据(正式数据);
  const 正式slug = new Set(正式.featured.map((条目) => 条目.slug));
  const 发布卡片 = new Map();
  for (const [slug, 条目] of Object.entries(项目仓)) {
    const 安全id = 安全slug(slug);
    if (!安全id || 安全id !== slug) continue;
    const 卡片 = 本机发布卡片(slug, 条目);
    if (卡片) 发布卡片.set(slug, 卡片);
  }

  const 缓存条目 = 数组(缓存.entries).map(清洗精选条目).filter(Boolean);
  const 原顺序 = Array.isArray(缓存.featured)
    ? 缓存.featured
    : 缓存条目.map((条目) => 条目.slug);
  const featured = 文本列表(原顺序)
    .map(安全slug)
    .filter((slug) => slug && (正式slug.has(slug) || 发布卡片.has(slug)));
  if (featured.length === 0) return null;
  return {
    default: featured.includes(安全slug(缓存.default)) ? 安全slug(缓存.default) : featured[0],
    featured,
    entries: featured.map((slug) => 发布卡片.get(slug)).filter(Boolean),
  };
}

// 固定旗舰来自仓库内的正式静态清单；远端与本机覆盖只负责补充、排序其他世界。
// 即使本机伪造同 slug 条目，也不能把官方封面/梗概与官方剧情混成两套内容。
export function 合并首页精选(静态数据, 远端数据 = 静态数据, 本地覆盖 = null) {
  const 静态 = 清洗精选数据(静态数据);
  const 远端 = 清洗精选数据(远端数据);
  const 旗舰slug = 静态.default;
  const 旗舰条目 = 静态.featured.find((条目) => 条目.slug === 旗舰slug) ?? null;
  const 本地条目 = 数组(本地覆盖?.entries).map(清洗精选条目).filter(Boolean);
  const 卡片表 = new Map([
    ...静态.featured.map((条目) => [条目.slug, 条目]),
    ...远端.featured.map((条目) => [条目.slug, 条目]),
    ...本地条目.map((条目) => [条目.slug, 条目]),
  ]);
  if (旗舰条目) 卡片表.set(旗舰slug, 旗舰条目);
  const 本地顺序 = 文本列表(本地覆盖?.featured).filter((slug) => 安全slug(slug));
  const 顺序 = [
    旗舰slug,
    ...本地顺序,
    ...远端.featured.map((条目) => 条目.slug),
    ...静态.featured.map((条目) => 条目.slug),
  ];
  return 清洗精选数据({
    default: 旗舰slug,
    featured: [...new Set(顺序)].map((slug) => 卡片表.get(slug)).filter(Boolean),
  });
}

function 剧情节点表(剧情) {
  return 是普通对象(剧情?.nodes) ? 剧情.nodes : {};
}

function 取剧情记忆白名单(剧情) {
  const 记忆 = [];
  for (const 节点 of Object.values(剧情节点表(剧情))) {
    for (const 条目 of [...数组(节点?.hotspots), ...数组(节点?.choices)]) {
      记忆.push(...文本列表(条目?.effect?.memories));
    }
  }
  return new Set(记忆);
}

function 进度属于作品(进度, slug, storyId) {
  if (!是普通对象(进度)) return false;
  const 进度storyId = 非空文本(进度.storyId);
  const 进度gameId = 安全slug(进度.gameId);
  // 无身份的早期存档只有在它确实由当前作品专属存档键读取时才兼容；
  // 外部直接传入的无归属对象仍保持拒绝，避免首页模型误认跨作品数据。
  if (!进度storyId && !进度gameId) return 进度[首页存档来源] === slug;
  // 稳定 storyId 是最高优先级归属，可跨 bundled / 正式运行身份使用。
  if (进度storyId) return 进度storyId === storyId;
  return 进度gameId !== 'bundled' && (进度gameId === slug || 进度gameId === storyId);
}

function 构建安全进度(原进度, 剧情, slug) {
  const storyId = 非空文本(剧情?.id, slug);
  if (!进度属于作品(原进度, slug, storyId)) return null;
  const 节点表 = 剧情节点表(剧情);
  const 记忆白名单 = 取剧情记忆白名单(剧情);
  const 结局白名单 = new Set(
    Object.values(节点表)
      .filter((节点) => 是普通对象(节点?.ending))
      .map((节点) => 非空文本(节点.id))
      .filter(Boolean),
  );
  const memories = 文本列表([
    ...数组(原进度.memories),
    ...数组(原进度.persistentMemories),
  ]).filter((条) => 记忆白名单.has(条));
  const unlockedEndings = 文本列表(原进度.unlockedEndings).filter((id) => 结局白名单.has(id));
  const visitedNodes = 文本列表(原进度.visitedNodes).filter((id) => !!节点表[id]);
  return {
    hasSave: true,
    loopCount: Math.max(1, Math.min(99, Math.trunc(Number(原进度.loopCount) || 1))),
    memories,
    unlockedEndings,
    visitedCount: visitedNodes.length,
    lastSavedAt: Number.isFinite(Number(原进度.lastSavedAt)) ? Number(原进度.lastSavedAt) : null,
  };
}

function 构建角色(角色) {
  if (!是普通对象(角色)) return null;
  const id = 非空文本(角色.id);
  const name = 非空文本(角色.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    shortName: 非空文本(角色.shortName, name),
    role: 非空文本(角色.role, '故事中的关键人物'),
    theme: 非空文本(角色.theme, '尚待了解'),
    portrait: 非空文本(角色.portrait),
    // 情绪差分：第二情绪立绘与标签由剧情数据声明，首页角色卡悬停换装使用。
    moodPortrait: 非空文本(角色.moodPortrait),
    moodLabel: 非空文本(角色.moodLabel),
    color: 非空文本(角色.color, '#bda8b7'),
    accent: 非空文本(角色.accent, '#342b34'),
    romanceable: 角色.romanceable === true,
  };
}

function 构建结局(剧情, 进度) {
  const 已解锁 = new Set(进度?.unlockedEndings ?? []);
  return Object.values(剧情节点表(剧情))
    .filter((节点) => 是普通对象(节点?.ending))
    .map((节点) => ({
      id: 非空文本(节点.id),
      title: 非空文本(节点.ending.title, 非空文本(节点.title, '阶段结果')),
      subtitle: 非空文本(节点.ending.subtitle),
      type: 非空文本(节点.ending.type),
      secret: 节点.ending.tier === 'secret',
      unlocked: 已解锁.has(节点.id),
    }))
    // 隐藏结局在玩家亲自抵达之前不进入首页模型，避免营销页提前剧透。
    .filter((结局) => !结局.secret || 结局.unlocked);
}

function 构建开场预览(剧情) {
  const 节点表 = 剧情节点表(剧情);
  const 节点 = 节点表[非空文本(剧情?.startNodeId)];
  if (!是普通对象(节点)) return null;
  const lines = Array.isArray(节点.lines)
    ? 节点.lines
        .filter((行) => 是普通对象(行) && 非空文本(行.text))
        .slice(0, 7)
        .map((行) => ({
          speaker: 非空文本(行.speaker, 'narrator'),
          text: 非空文本(行.text),
        }))
    : [];
  const choices = Array.isArray(节点.choices)
    ? 节点.choices
        .filter((选择) => 是普通对象(选择) && 非空文本(选择.label))
        .slice(0, 3)
        .map((选择) => ({
          id: 非空文本(选择.id, 非空文本(选择.label)),
          ...构建选择展示文案(选择),
        }))
    : [];
  if (!非空文本(节点.backdrop) || lines.length === 0 || choices.length === 0) return null;
  return {
    nodeId: 非空文本(节点.id, 非空文本(剧情.startNodeId)),
    chapter: 非空文本(节点.chapter),
    title: 非空文本(节点.title),
    location: 非空文本(节点.location),
    synopsis: 非空文本(节点.synopsis),
    backdrop: 非空文本(节点.backdrop),
    // 首页第一视角舞台直接展示开场节点的真实全景与线索数量，不另造营销数据。
    panorama: 非空文本(节点.panorama),
    hotspotCount: 数组(节点.hotspots).length,
    lines,
    choices,
  };
}

function 构建主播放行动(href, title, hasSave) {
  const 作品名 = 非空文本(title, '互动故事');
  return {
    href,
    mode: hasSave ? 'resume' : 'start',
    label: hasSave ? `继续《${作品名}》` : `进入《${作品名}》`,
    shortLabel: hasSave ? '继续故事' : '开始故事',
  };
}

function 构建首页路线(content, characters) {
  const 角色id = new Set(characters.map((角色) => 角色.id));
  return 数组(content?.homepage?.routes)
    .filter((路线) => 是普通对象(路线) && 非空文本(路线.id) && 非空文本(路线.title))
    .map((路线) => ({
      id: 非空文本(路线.id),
      title: 非空文本(路线.title),
      description: 非空文本(路线.description),
      note: 非空文本(路线.note),
      characterIds: 文本列表(路线.characterIds).filter((id) => 角色id.has(id)),
    }));
}

// 精选、剧情、存档 → 首页唯一可消费的数据模型。
export function 构建玩家首页模型(精选数据, 剧情, 原进度 = null) {
  const showcase = 清洗精选数据(精选数据);
  const defaultSlug = showcase.default;
  const catalogEntry = showcase.featured.find((条目) => 条目.slug === defaultSlug) ?? null;
  const storyId = 非空文本(剧情?.id, defaultSlug);
  const startNodeId = 非空文本(剧情?.startNodeId);
  const 节点表 = 剧情节点表(剧情);
  const storyReady = !!(
    defaultSlug &&
    catalogEntry &&
    是普通对象(剧情) &&
    (!非空文本(剧情.id) || storyId === defaultSlug) &&
    startNodeId &&
    节点表[startNodeId]
  );

  if (!storyReady) {
    const playHref = defaultSlug ? `/play?game=${encodeURIComponent(defaultSlug)}` : '/play';
    return {
      defaultSlug,
      catalogEntry,
      storyReady: false,
      playHref,
      playAction: 构建主播放行动(playHref, catalogEntry?.title, false),
      worlds: showcase.featured,
      moreWorlds: showcase.featured.filter((条目) => 条目.slug !== defaultSlug),
    };
  }

  const progress = 构建安全进度(原进度, 剧情, defaultSlug);
  const playHref = `/play?game=${encodeURIComponent(defaultSlug)}`;
  const 作品标题 = 非空文本(剧情.title, catalogEntry.title);
  const playAction = 构建主播放行动(playHref, 作品标题, !!progress?.hasSave);
  const protagonist = 构建角色(剧情.cast?.protagonist);
  const characters = Array.isArray(剧情.cast?.characters)
    ? 剧情.cast.characters.map(构建角色).filter(Boolean)
    : [];
  const endings = 构建结局(剧情, progress);
  const content = 是普通对象(剧情.content) ? 剧情.content : {};

  return {
    defaultSlug,
    catalogEntry,
    storyReady: true,
    playHref,
    playAction,
    story: {
      id: storyId,
      title: 作品标题,
      subtitle: 非空文本(剧情.subtitle),
      chapter: 非空文本(content.chapter, catalogEntry.chapters),
      estimatedMinutes: 非空文本(content.estimatedMinutes),
      themes: 文本列表(content.themes),
      contentNotes: 文本列表(content.contentNotes),
    },
    protagonist,
    characters,
    routes: 构建首页路线(content, characters),
    preview: 构建开场预览(剧情),
    progress: progress ?? {
      hasSave: false,
      loopCount: 1,
      memories: [],
      unlockedEndings: [],
      visitedCount: 0,
      lastSavedAt: null,
    },
    endings,
    publicEndingCount: Object.values(节点表).filter(
      (节点) => 是普通对象(节点?.ending) && 节点.ending.tier !== 'secret',
    ).length,
    // worlds 是首页可玩世界网格的完整清单（旗舰在首位）；moreWorlds 保留给二级归档语义。
    worlds: showcase.featured,
    moreWorlds: showcase.featured.filter((条目) => 条目.slug !== defaultSlug),
  };
}

// 首页“核心体验”舞台：从任一正式作品的真实节点构建视频展示数据。
// 等各作品翻新完成后，把“画面效果最好”的作品/节点改在 首页体验展示.js 配置即可换展。
export function 构建体验舞台(剧情, slug, nodeId = '') {
  const 安全作品 = 安全slug(slug);
  if (!安全作品 || !是普通对象(剧情)) return null;
  const 节点表 = 剧情节点表(剧情);
  const 取视频 = (节点) =>
    数组(节点?.cinematics).find((段) => 是普通对象(段) && 段.type === 'flat-video' && 非空文本(段.src)) ?? null;
  const 指定节点 = 节点表[非空文本(nodeId)];
  const 节点 = 取视频(指定节点)
    ? 指定节点
    : Object.values(节点表).find((候选) => 是普通对象(候选) && 取视频(候选));
  const 视频 = 取视频(节点);
  if (!节点 || !视频) return null;

  const 名册 = new Map(
    [剧情.cast?.protagonist, ...数组(剧情.cast?.characters)]
      .filter(是普通对象)
      .map((角色) => [非空文本(角色.id), 非空文本(角色.name)])
      .filter(([id, name]) => id && name),
  );
  const 台词 = 数组(节点.lines)
    .filter((行) => 是普通对象(行) && 非空文本(行.text))
    .map((行) => ({ speaker: 非空文本(行.speaker, 'narrator'), text: 非空文本(行.text) }));
  const 现场台词 = 台词.find((行) => 行.speaker !== 'narrator' && 行.speaker !== 'system') ?? 台词[0] ?? null;
  const 说话人 = (id) => {
    if (id === 'narrator') return '现场';
    if (id === 'system') return '系统';
    return 名册.get(id) ?? '现场人物';
  };

  return {
    slug: 安全作品,
    playHref: `/play?game=${encodeURIComponent(安全作品)}`,
    storyTitle: 非空文本(剧情.title, 安全作品),
    chapter: 非空文本(节点.chapter),
    title: 非空文本(节点.title),
    location: 非空文本(节点.location),
    video: 非空文本(视频.src),
    poster: 非空文本(节点.panorama),
    hotspotCount: 数组(节点.hotspots).length,
    line: 现场台词 ? { name: 说话人(现场台词.speaker), text: 现场台词.text } : null,
  };
}

export function 读取首页存档(slug) {
  if (typeof window === 'undefined' || !安全slug(slug)) return null;
  try {
    const 原始 = JSON.parse(
      window.localStorage.getItem(`${存档键前缀}:${slug}:v2`) ?? 'null',
    );
    if (!是普通对象(原始)) return null;
    Object.defineProperty(原始, 首页存档来源, { value: slug });
    return 原始;
  } catch {
    return null;
  }
}
