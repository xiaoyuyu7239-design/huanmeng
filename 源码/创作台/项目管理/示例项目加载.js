// 这个文件是"样片仓库管理员"：线上创作台里那些"发布示例项目"(内置示例)，
// 在线上来自服务器的 generated-games 生成包；本地复刻没有服务器，
// 就由这位管理员去公共资源里搬：/showcase.json 拿名录，/games/<slug>/story.json 拿剧情正片。
//
// 为什么要"补齐结构"：爬到手的示例只有 story.json(剧情本体)，而创作台的项目对象还需要
// prompts / manifest 两张清单(线上生成包里有，我们没爬到)。这里按 story 里的真实全景图路径
// 推导出这两张清单——剧情、对白、选择、全景路径全是真数据，只有清单的"骨架"是照规则补的，
// 否则校验规则会把每个示例项目误报成缺提示词/缺资产。

import { 归一化项目 } from './本机项目存储.js';
import { 全景基线 } from '../校验发布/校验规则.js';

// 无输入 → 抓 /showcase.json → 同时吐出默认 slug 与完整卡片元数据。
// 不能只留 slug/title：创作台保存“首页精选”时还需要原卡的封面、简介和标签。
export async function 加载示例项目名录() {
  try {
    const 响应 = await fetch('/showcase.json', { cache: 'no-cache' });
    if (!响应.ok) return { defaultSlug: '', projects: [] };
    const 数据 = await 响应.json();
    const projects = Array.isArray(数据.featured)
      ? 数据.featured
          .filter((条) => 条 && typeof 条.slug === 'string' && 条.slug)
          .map((条) => ({
            ...条,
            slug: 条.slug,
            title: 条.title || 条.slug,
            source: 'server',
          }))
      : [];
    const defaultSlug = typeof 数据.default === 'string' && projects.some((条) => 条.slug === 数据.default)
      ? 数据.default
      : projects[0]?.slug ?? '';
    return { defaultSlug, projects };
  } catch {
    return { defaultSlug: '', projects: [] };
  }
}

// 保留原有列表接口，给只关心下拉列表的调用方使用。
export async function 加载示例项目列表() {
  return (await 加载示例项目名录()).projects;
}

// 输入 slug → 抓 /games/<slug>/story.json → 补齐清单 → 吐出完整项目对象；抓不到就抛错
export async function 加载示例项目(slug) {
  const 响应 = await fetch(`/games/${encodeURIComponent(slug)}/story.json`, { cache: 'no-cache' });
  if (!响应.ok) throw new Error(`Request failed with ${响应.status}`);
  const 剧情 = await 响应.json();
  let 创作资料 = null;
  try {
    const 创作响应 = await fetch(`/games/${encodeURIComponent(slug)}/creator.json`, { cache: 'no-cache' });
    if (创作响应.ok) {
      const 候选 = await 创作响应.json();
      // companion 只在明确绑定当前作品时合并；404、坏 JSON 或错绑都安全回退空白作者骨架。
      if (
        候选?.storyId === slug &&
        Number.isInteger(候选?.schemaVersion) && 候选.schemaVersion >= 1 &&
        候选?.authoring && typeof 候选.authoring === 'object' && !Array.isArray(候选.authoring) &&
        Number.isInteger(候选.authoring.schemaVersion) && 候选.authoring.schemaVersion >= 1
      ) {
        创作资料 = 候选;
      }
    }
  } catch {
    创作资料 = null;
  }
  return 由剧情构造项目(slug, 剧情, 创作资料);
}

// 输入(slug, story) → 按每个节点的真实 panorama 路径推导 prompts/manifest → 吐出项目对象
export function 由剧情构造项目(slug, 剧情, 创作资料 = null) {
  const 节点们 = Object.values(剧情.nodes ?? {});
  const 提示词们 = [];
  const 资产们 = [];
  for (const 节点 of 节点们) {
    const 全景路径 = (节点.panorama ?? '').trim();
    if (!全景路径) continue; // 没配全景的节点没有对应资产，校验时会给出 warning，这是真实状态
    const 提示词id = `${节点.id}-panorama`;
    // 提示词正文 = 硬性全景基线 + 节点真实简介(校验规则要求 prompt 必须包含基线)
    提示词们.push({
      id: 提示词id,
      nodeId: 节点.id,
      targetFile: 全景路径.split('/').pop() || `${节点.id}.jpg`,
      prompt: `${全景基线}. ${节点.synopsis ?? 节点.title ?? ''}`.trim(),
      negativePrompt: 'text, watermark, logo, blurry, deformed',
    });
    资产们.push({
      id: 节点.id,
      type: 'panorama-image',
      targetPath: `public${全景路径}`,      // 校验规则要求以 public/panoramas/ 开头
      promptId: 提示词id,
      status: 'generated-image',            // 示例项目的全景图都是已爬到的真实成图
      requiredSize: '4096x2048',
      usedByNodes: [节点.id],
      previewUrl: 全景路径,                  // 直接用与线上一致的 /panoramas/... 路径预览
    });
  }
  return 归一化项目({
    slug,
    title: 剧情.title || slug,
    story: 剧情,
    prompts: { prompts: 提示词们 },
    manifest: { assets: 资产们 },
    storyBible: typeof 创作资料?.storyBible === 'string' ? 创作资料.storyBible : '',
    ...(创作资料?.authoring ? { authoring: 创作资料.authoring } : {}),
    qaReport: '',                            // 还没跑过校验，底部状态条会显示"待校验"
    voiceCasting: { provider: 'minimax', model: 'speech-2.8-turbo', updatedAt: '', profiles: {} },
    musicDesign: {
      provider: 'yunwu-suno',
      model: 'suno_music_open',
      defaultMv: 'chirp-v5',
      assignments: { defaultPlaybackMode: 'uploaded-first' },
      updatedAt: '',
      tracks: {},
    },
  });
}
