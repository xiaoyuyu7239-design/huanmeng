// 这个文件是创作台的"文件柜"：所有本机项目都锁在浏览器 localStorage 这个柜子里。
// 别的模块想存项目、取项目、列项目、删项目，都从这里拿钥匙，不许自己直接翻柜子。
// 柜子上的钥匙编号(localStorage 键名)和线上产品一字不差，
// 所以播放器(/play)、落地页(首页精选)读同一把钥匙就能天然打通。
//
// 【给第二棒的接口】浏览器直连 Agent/生图/TTS 需要的密钥设置也存在这里：
//   读浏览器设置() / 写浏览器设置(设置) → localStorage "creator:browser-settings:v1"
//   补正健康状态(健康) → 用本机密钥把 deepseekConfigured 等布尔位补成 true

// ---- 存储键(照抄线上源码，一个字符都不能差) ----
export const 项目存储键 = 'creator:browser-projects:v1';   // 本机项目柜
export const 设置存储键 = 'creator:browser-settings:v1';   // 模型/密钥设置柜
export const 精选存储键 = 'creator:browser-showcase:v1';   // 落地页精选 Demo 柜
export const 选中项目键 = 'creator:selected-slug';          // 记住上次打开哪个项目

// ---- 通用小工具 ----

// localStorage 在隐私模式、沙箱 iframe、存储额度耗尽时都可能抛异常。
// 读失败时让界面仍能打开；写失败则抛出一条可直接展示给用户的错误，
// 上层不得把失败冒充成“已保存”。
function 读存储项(键) {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(键);
  } catch {
    return null;
  }
}

function 存储错误(动作, 原错) {
  const 是额度问题 = 原错?.name === 'QuotaExceededError' || 原错?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  const 原因 = 是额度问题
    ? '浏览器本机存储空间已满，请先删除不需要的项目或清理空间。'
    : '浏览器阻止了本机存储，请检查隐私/站点存储设置。';
  const 错误 = new Error(`${动作}失败：${原因}`);
  错误.name = 'CreatorStorageError';
  错误.cause = 原错;
  return 错误;
}

function 写存储项(键, 值, 动作) {
  try {
    if (typeof window === 'undefined') throw new Error('window is unavailable');
    window.localStorage.setItem(键, 值);
  } catch (错) {
    throw 存储错误(动作, 错);
  }
}

function 删存储项(键, 动作) {
  try {
    if (typeof window === 'undefined') throw new Error('window is unavailable');
    window.localStorage.removeItem(键);
  } catch (错) {
    throw 存储错误(动作, 错);
  }
}

// 输入任意对象 → 深拷贝一份 → 吐出新对象（和线上一样用 JSON 转一圈，简单粗暴但够用）
export function 深拷贝(值) {
  return JSON.parse(JSON.stringify(值));
}

// 新版语音必须明确标成 ready；只有完全没有 voiceStatus 的旧数据才允许凭 voiceSrc 兼容。
// stale / failed / pending 即使还留着旧音频地址，也不能算作当前台词的可用成品。
export function 语音已就绪(句) {
  if (!句 || typeof 句 !== 'object') return false;
  if (句.voiceStatus === 'ready') return true;
  return 句.voiceStatus == null && typeof 句.voiceSrc === 'string' && 句.voiceSrc.trim().length > 0;
}

function 非空字符串(值) {
  return typeof 值 === 'string' && 值.trim().length > 0;
}

// 资产只有真正生成出的地址（或 generated-image 对应的目标地址）才算可用；
// 明确处于失败、等待、过期或占位状态时，残留预览不能把就绪数抬高。
export function 图片资产已就绪(资产) {
  if (!资产 || typeof 资产 !== 'object') return false;
  if (['stale', 'failed', 'pending', 'generating', 'generated-placeholder'].includes(资产.status)) return false;
  if (非空字符串(资产.previewUrl) || 非空字符串(资产.generatedPath)) return true;
  return 资产.status === 'generated-image' && 非空字符串(资产.targetPath);
}

// 图片就绪看“每个剧情节点是否有可播放视觉”，而不是 manifest 恰好列了多少项。
// 旧项目可直接用 node.panorama；新流水线则可由绑定到该节点的已生成资产覆盖。
export function 节点图片已覆盖(节点, 资产们 = []) {
  if (!节点 || typeof 节点 !== 'object') return false;
  if (非空字符串(节点.panorama)) return true;
  return 资产们.some(
    (资产) => Array.isArray(资产?.usedByNodes) && 资产.usedByNodes.includes(节点.id) && 图片资产已就绪(资产)
  );
}

// 输入项目对象 → 数一遍节点/选择/结局/提示词/资产/语音/音乐 → 吐出摘要对象
// (线上 summary 的重算函数，底部就绪状态条和统计条全靠它)
export function 重算摘要(项目) {
  const 节点们 = Object.values(项目.story?.nodes ?? {});
  const 资产们 = 项目.manifest?.assets ?? [];
  const 提示词们 = 项目.prompts?.prompts ?? [];
  const 对白们 = 节点们.flatMap((节点) => 节点.lines ?? []);
  const 音轨们 = Object.values(项目.musicDesign?.tracks ?? {});
  return {
    nodeCount: 节点们.length,
    choiceCount: 节点们.reduce((和, 节点) => 和 + (节点.choices?.length ?? 0), 0),
    endingCount: 节点们.filter((节点) => 节点.ending).length,
    promptCount: 提示词们.length,
    assetCount: 资产们.length,
    generatedAssetCount: 资产们.filter(
      (资产) => 资产.status === 'generated-image' || !!(资产.generatedPath || 资产.previewUrl)
    ).length,
    placeholderAssetCount: 资产们.filter((资产) => 资产.status === 'generated-placeholder').length,
    visualSceneCount: 节点们.length,
    visualReadyCount: 节点们.filter((节点) => 节点图片已覆盖(节点, 资产们)).length,
    voiceLineCount: 对白们.length,
    voiceReadyCount: 对白们.filter(语音已就绪).length,
    voiceFailedCount: 对白们.filter((句) => 句.voiceStatus === 'failed').length,
    musicTrackCount: 音轨们.length,
    musicReadyCount: 音轨们.filter((轨) => 轨.status === 'ready').length,
    musicSelectedCount: 音轨们.filter((轨) => 轨.selected).length,
  };
}

// 输入项目对象 → 把缺胳膊少腿的字段补齐、摘要重算 → 吐出规整的项目对象
// (线上的归一化函数 me：存柜子之前、从柜子取出之后都要过一遍这个"整形")
export function 归一化项目(项目) {
  return {
    ...项目,
    title: 项目.title || 项目.story?.title || 项目.slug,
    prompts: 项目.prompts ?? { prompts: [] },
    manifest: 项目.manifest ?? { assets: [] },
    activeImageJobs: 项目.activeImageJobs ?? [],
    activeVoiceJobs: 项目.activeVoiceJobs ?? [],
    activeMusicTasks: 项目.activeMusicTasks ?? [],
    summary: 重算摘要(项目),
  };
}

// ---- 本机项目柜的四个基本动作：读表 / 存一件 / 取一件 / 删一件 ----

// 读取项目柜的原始对象。普通展示遇到整仓坏 JSON 时空表降级；
// 保存/删除前则必须拦住，避免用一个空表覆盖尚可人工恢复的原数据。
function 读原始项目表({ 写入前 = false } = {}) {
  const 文本 = 读存储项(项目存储键);
  if (文本 == null) return {};
  try {
    const 对象 = JSON.parse(文本);
    if (!对象 || typeof 对象 !== 'object' || Array.isArray(对象)) {
      throw new Error('project store is not an object');
    }
    return 对象;
  } catch (错) {
    if (!写入前) return {};
    const 异常 = new Error('检测到本机项目数据已损坏，为避免覆盖原数据，已阻止本次写入。');
    异常.name = 'CreatorStorageDataError';
    异常.cause = 错;
    throw 异常;
  }
}

// 读整个柜子 → 校验每一格(slug 要对得上、时间戳要是数字) → 吐出 { slug: {project, updatedAt} }
// 为什么这么啰嗦：localStorage 里的数据可能被旧版本或者手贱改坏，坏的直接扔，不让它炸掉界面。
export function 读本机项目表() {
  const 原始 = 读原始项目表();
  const 干净表 = {};
  for (const [slug, 条目] of Object.entries(原始)) {
    try {
      if (!条目 || typeof 条目 !== 'object' || Array.isArray(条目)) continue;
      if (条目.project?.slug === slug && Number.isFinite(条目.updatedAt)) {
        干净表[slug] = { project: 归一化项目(条目.project), updatedAt: Number(条目.updatedAt) };
      }
    } catch {
      // 单个坏项目只隔离这一格，不得让其他项目一起“消失”。
      continue;
    }
  }
  return 干净表;
}

function 写回整表(表) {
  写存储项(项目存储键, 序列化项目表(表), '保存项目');
}

function 序列化项目表(表) {
  try {
    return JSON.stringify(表);
  } catch (错) {
    const 异常 = new Error('保存项目失败：项目数据不能序列化为 JSON。');
    异常.name = 'CreatorStorageDataError';
    异常.cause = 错;
    throw 异常;
  }
}

// 输入项目对象 → 盖上"现在"的时间戳塞进柜子 → 无返回。这一步就是"发布/保存到当前浏览器"的本体。
export function 保存本机项目(项目) {
  if (!项目?.slug || typeof 项目.slug !== 'string') throw new Error('保存项目失败：项目缺少有效 slug。');
  const 表 = 读原始项目表({ 写入前: true });
  表[项目.slug] = { project: 归一化项目(项目), updatedAt: Date.now() };
  写回整表(表);
}

// 输入 slug → 从柜子取出对应项目(归一化) → 没有就吐 null
export function 读本机项目(slug) {
  const 条目 = 读本机项目表()[slug];
  return 条目 ? 归一化项目(条目.project) : null;
}

// 输入 slug → 把那一格清空 → 无返回
export function 删除本机项目(slug) {
  const 原项目文本 = 读存储项(项目存储键);
  const 表 = 读原始项目表({ 写入前: true });
  delete 表[slug];
  const 新项目文本 = 序列化项目表(表);
  const 原精选文本 = 读存储项(精选存储键);
  const 精选变更 = 计算移除后的精选(slug, 原精选文本);

  // 两个 localStorage 键无法原子提交：先写项目表，再清精选；第二步若失败就补偿恢复项目表。
  // 因而调用方只会看到“都成功”或“项目仍在”，不会出现项目删了但首页残留死卡的半失败状态。
  写存储项(项目存储键, 新项目文本, '删除项目');
  if (!精选变更.changed) return;
  try {
    if (精选变更.text == null) 删存储项(精选存储键, '清理已删除项目的精选卡片');
    else 写存储项(精选存储键, 精选变更.text, '清理已删除项目的精选卡片');
  } catch (错) {
    try {
      if (原项目文本 == null) 删存储项(项目存储键, '恢复删除前的项目表');
      else 写存储项(项目存储键, 原项目文本, '恢复删除前的项目表');
    } catch (回滚错) {
      const 异常 = new Error('删除项目时精选清理失败，且项目表无法自动恢复。请立即刷新页面核对本机数据。');
      异常.name = 'CreatorStorageTransactionError';
      异常.cause = { writeError: 错, rollbackError: 回滚错 };
      throw 异常;
    }
    throw 错;
  }
}

// ---- 项目列表相关 ----

// 柜子里的项目 → 变成下拉框条目 [{slug, title:"标题（本机）", nodeCount, updatedAt, source:"browser"}]
// 按更新时间从新到旧排（线上就是这个顺序）
export function 本机项目列表() {
  return Object.values(读本机项目表())
    .map((条目) => ({
      slug: 条目.project.slug,
      title: `${条目.project.title || 条目.project.slug}（本机）`,
      nodeCount: 条目.project.summary?.nodeCount ?? Object.keys(条目.project.story?.nodes ?? {}).length,
      updatedAt: 条目.updatedAt,
      source: 'browser',
    }))
    .sort((甲, 乙) => 乙.updatedAt - 甲.updatedAt);
}

// 输入(示例项目列表, 本机项目列表) → 本机在前、示例按 slug 去重排后面 → 吐出合并列表
// 为什么去重：本机若存了同名 slug(比如改过示例项目后另存)，本机的那份优先，示例的隐掉。
export function 合并项目列表(示例列表, 本机列表) {
  const 已占slug = new Set(本机列表.map((条) => 条.slug));
  return [
    ...本机列表.map((条) => ({ ...条, source: 'browser' })),
    ...示例列表.filter((条) => !已占slug.has(条.slug)).map((条) => ({ ...条, source: 条.source ?? 'server' })),
  ];
}

// ---- 新建项目 ----

// 无输入 → 按当前日期时间拼一个默认 slug → 吐出形如 "project-20260713-181530"
export function 默认slug() {
  const 现在 = new Date();
  const 日期段 = 现在.toISOString().slice(0, 10).replace(/-/g, '');
  const 时间段 = `${现在.getHours()}${现在.getMinutes()}${现在.getSeconds()}`.padStart(6, '0');
  return `project-${日期段}-${时间段}`;
}

// 输入随手打的 slug → 转小写、非法字符换成 - 、砍掉开头的 - 、截 48 字 → 吐出干净 slug
export function 清洗slug(原文) {
  return 原文
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 48);
}

// 输入(标题, slug) → 造一个只有"开场"一个节点的新项目 → 吐出完整项目对象
// 模板里的每一句文案都照抄线上，起始节点固定叫 s00-start。
export function 新建本机项目(标题, slug) {
  const 干净标题 = 标题.trim() || '新项目';
  const 干净slug = 清洗slug(slug.trim()) || 默认slug();
  const 起始id = 's00-start';
  return 归一化项目({
    slug: 干净slug,
    title: 干净标题,
    story: {
      title: 干净标题,
      startNodeId: 起始id,
      cast: {
        protagonist: {
          id: 'you',
          name: '你',
          role: '故事主角',
          pronouns: '她',
          color: '#d7b6c9',
          accent: '#4b3045',
        },
        characters: [],
      },
      nodes: {
        [起始id]: {
          id: 起始id,
          chapter: '第一幕',
          title: '开场',
          location: '未设定',
          synopsis: '在这里写下故事的第一幕。',
          panorama: '',
          lines: [{ speaker: 'narrator', text: '新的故事从这里开始。' }],
          choices: [],
        },
      },
    },
    prompts: { prompts: [] },
    manifest: { assets: [] },
    storyBible: '这是当前浏览器中的本机项目。项目数据保存在 localStorage，不会上传到服务器。',
    qaReport: '',
    voiceCasting: {
      provider: 'minimax',
      model: 'speech-2.8-turbo',
      updatedAt: new Date().toISOString(),
      profiles: {},
    },
    musicDesign: {
      provider: 'yunwu-suno',
      model: 'suno_music_open',
      defaultMv: 'chirp-v5',
      assignments: { defaultPlaybackMode: 'uploaded-first' },
      updatedAt: new Date().toISOString(),
      tracks: {},
    },
    activeImageJobs: [],
    activeVoiceJobs: [],
    activeMusicTasks: [],
  });
}

// ---- 记住"上次打开的项目" ----

// 无输入 → 读上次选中的 slug → 读不到给线上默认值 "shadow-protocol"
// (线上默认就是这个内置示例；本地列表若没有它，加载流程会自动落到列表第一个)
export function 读选中slug() {
  return 读存储项(选中项目键) || 'shadow-protocol';
}

export function 写选中slug(slug) {
  写存储项(选中项目键, slug, '记住上次打开的项目');
}

// ---- 浏览器设置(模型/密钥) ----

// 无输入 → 读设置柜 → 吐出 { 键: 非空字符串值 }，坏数据一律当空
export function 读浏览器设置() {
  try {
    const 原始 = JSON.parse(读存储项(设置存储键) ?? '{}');
    if (!原始 || typeof 原始 !== 'object' || Array.isArray(原始)) return {};
    return Object.fromEntries(
      Object.entries(原始).filter(([, 值]) => typeof 值 === 'string' && 值.trim().length > 0)
    );
  } catch {
    return {};
  }
}

export function 写浏览器设置(设置) {
  写存储项(设置存储键, JSON.stringify(设置), '保存模型与密钥设置');
}

// 输入基础健康状态 → 拿本机密钥把"已配置"开关和模型名补上 → 吐出补正后的健康状态
// (静态部署没有服务端 health 接口，这里等价于线上的"浏览器设置覆盖 health"逻辑)
export function 补正健康状态(健康, 设置 = 读浏览器设置()) {
  return {
    ...健康,
    deepseekConfigured: 健康.deepseekConfigured || !!设置.DEEPSEEK_API_KEY,
    imageConfigured: 健康.imageConfigured || !!设置.YUNWU_API_KEY,
    ttsConfigured: 健康.ttsConfigured || !!设置.MINIMAX_API_KEY,
    musicConfigured: 健康.musicConfigured || !!设置.YUNWU_API_KEY,
    deepseekModel: 设置.DEEPSEEK_MODEL || 健康.deepseekModel,
    imageModel: 设置.IMAGE_MODEL || 健康.imageModel,
    ttsModel: 设置.MINIMAX_TTS_MODEL || 健康.ttsModel,
    musicModel: 设置.YUNWU_SUNO_MODEL || 健康.musicModel,
    musicMv: 设置.YUNWU_SUNO_MV || 健康.musicMv,
  };
}

// ---- 落地页精选 Demo 覆盖 ----

// 无输入 → 读本机精选覆盖 → 吐出 { default: slug, featured: [slug] }，没存过就都是空
export function 读精选覆盖() {
  try {
    const 原始 = JSON.parse(读存储项(精选存储键) ?? '{}');
    const 对象 = 原始 && typeof 原始 === 'object' && !Array.isArray(原始) ? 原始 : {};
    return {
      default: typeof 对象.default === 'string' ? 对象.default : '',
      featured: Array.isArray(对象.featured) ? 对象.featured.filter((项) => typeof 项 === 'string' && 项) : [],
      entries: Array.isArray(对象.entries)
        ? 对象.entries.filter((项) => 项 && typeof 项 === 'object' && typeof 项.slug === 'string' && typeof 项.title === 'string')
        : [],
    };
  } catch {
    return { default: '', featured: [], entries: [] };
  }
}

// 输入 {default, featured} → 顺手把本机项目做成落地页卡片(entries) → 一起写进精选柜
// entries 的取值规则照抄线上：tagline 取 storyBible 第一行截 80 字、封面取第一张有预览图的资产。
export function 写精选覆盖({ default: 默认slug值, featured: 精选slugs, entries: 候选卡片 = [] }) {
  const 项目表 = 读本机项目表();
  const 候选表 = new Map(
    候选卡片
      .filter((项) => 项 && typeof 项.slug === 'string' && typeof 项.title === 'string')
      .map((项) => [项.slug, 项])
  );
  const 去重slugs = [...new Set(精选slugs.filter((slug) => typeof slug === 'string' && slug))];
  const 卡片们 = 去重slugs
    .map((slug) => {
      const 项目 = 项目表[slug]?.project;
      if (!项目) {
        const 候选 = 候选表.get(slug);
        if (!候选) return null;
        return {
          slug,
          title: 候选.title || slug,
          tagline: 候选.tagline || `${候选.nodeCount ?? 0} 个场景的互动影游`,
          cover: 候选.cover || '/panoramas/s00-character-select.webp',
          chapters: 候选.chapters || `${候选.nodeCount ?? 0} 场景`,
          tags: Array.isArray(候选.tags) ? 候选.tags.filter((项) => typeof 项 === 'string') : [],
        };
      }
      const 封面资产 = (项目.manifest?.assets ?? []).find(
        (资产) => 资产.previewUrl || 资产.generatedPath || 资产.targetPath
      );
      const 资产路径 = 封面资产?.previewUrl || 封面资产?.generatedPath || 封面资产?.targetPath || '';
      const 首场全景 = Object.values(项目.story?.nodes ?? {}).find((节点) => typeof 节点?.panorama === 'string' && 节点.panorama)?.panorama;
      return {
        slug: 项目.slug,
        title: 项目.title || 项目.slug,
        tagline:
          (项目.storyBible ?? '').split('\n').map((行) => 行.trim()).filter(Boolean)[0]?.slice(0, 80) ||
          `${项目.summary?.nodeCount ?? 0} 个场景的本机互动影游`,
        cover: 资产路径.replace(/^public/, '') || 首场全景 || '/panoramas/s00-character-select.webp',
        chapters: `${项目.summary?.nodeCount ?? 0} 场景`,
        tags: ['本机项目', 'Browser'],
      };
    })
    .filter(Boolean);
  const 实际slugs = 卡片们.map((项) => 项.slug);
  const 实际默认 = 实际slugs.includes(默认slug值) ? 默认slug值 : 实际slugs[0] ?? '';
  const 定稿 = { default: 实际默认, featured: 实际slugs, entries: 卡片们 };
  写存储项(精选存储键, JSON.stringify(定稿), '保存落地页精选');
  return 定稿;
}

// 只计算、不写存储：删除事务会在项目表写成功后应用结果，并在失败时回滚项目表。
function 计算移除后的精选(slug, 文本) {
  const 无变化 = { changed: false, text: 文本 };
  if (typeof 文本 !== 'string' || !文本) return 无变化;
  let 数据;
  try {
    数据 = JSON.parse(文本);
  } catch {
    return 无变化;
  }
  if (!数据 || typeof 数据 !== 'object' || Array.isArray(数据)) return 无变化;
  const 原精选 = Array.isArray(数据.featured) ? 数据.featured : [];
  const 原卡片 = Array.isArray(数据.entries) ? 数据.entries : [];
  if (!原精选.includes(slug) && !原卡片.some((项) => 项?.slug === slug)) return 无变化;
  const featured = 原精选.filter((项) => 项 !== slug);
  const entries = 原卡片.filter((项) => 项?.slug !== slug);
  if (entries.length === 0) {
    return { changed: true, text: null };
  }
  const 默认值 = 数据.default === slug || !featured.includes(数据.default) ? featured[0] ?? entries[0].slug : 数据.default;
  return { changed: true, text: JSON.stringify({ ...数据, default: 默认值, featured, entries }) };
}
