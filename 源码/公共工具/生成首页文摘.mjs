// 首页文摘：从正式 showcase 与各作品 story.json 提取首页平台层所需的轻量真实数据
// （女主与立绘阵容、公开阶段结局数、开场预览），避免把六部完整剧情 JSON 打进首页包。
// 产物 公共资源/homepage-digest.json 提交入库；玩家首页自测用同一函数重新生成并比对，
// 任何数据漂移（作品上架、开场改动、立绘更换）都会在测试里立刻暴露。
// 手动刷新：node 源码/公共工具/生成首页文摘.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 体验选展 } from '../落地页/首页选展配置.js';
import { 构建体验舞台 } from '../落地页/玩家首页模型.js';
import { 构建选择展示文案 } from './选择文案.js';

function 非空文本(值, 兜底 = '') {
  return typeof 值 === 'string' && 值.trim() ? 值.trim() : 兜底;
}

function 构建开场(节点, 名册) {
  if (!节点) return null;
  const lines = Array.isArray(节点.lines)
    ? 节点.lines.filter((行) => !!行 && 非空文本(行.text))
    : [];
  const choices = Array.isArray(节点.choices)
    ? 节点.choices.filter((选择) => !!选择 && 非空文本(选择.label))
    : [];
  const 有画面 = 非空文本(节点.backdrop) || 非空文本(节点.panorama);
  if (!有画面 || lines.length === 0 || choices.length === 0) return null;
  const 台词 = lines.find((行) => 行.speaker && 行.speaker !== 'narrator' && 行.speaker !== 'system')
    ?? lines[0];
  const 说话人 = 台词.speaker === 'narrator' || !台词.speaker
    ? '现场'
    : 台词.speaker === 'system'
      ? '系统'
      : (名册.get(台词.speaker) ?? '现场人物');
  return {
    chapter: 非空文本(节点.chapter),
    title: 非空文本(节点.title),
    location: 非空文本(节点.location),
    backdrop: 非空文本(节点.backdrop),
    panorama: 非空文本(节点.panorama),
    hotspotCount: Array.isArray(节点.hotspots) ? 节点.hotspots.length : 0,
    line: { name: 说话人, text: 非空文本(台词.text) },
    choices: choices.slice(0, 3).map((选择) => {
      const 文案 = 构建选择展示文案(选择);
      const 后果 = typeof 选择.consequence === 'string'
        ? 选择.consequence.trim().replace(/\s+/gu, ' ')
        : '';
      return {
        ...文案,
        // 防剧透兜底：caption 与选择后果同文时不入文摘（上游数据污染时首页不放大）。
        caption: 文案.caption && 文案.caption === 后果 ? '' : 文案.caption,
        // 带前置条件的选择在现场是锁定卡，预览必须如实标注。
        locked: !!选择.condition,
      };
    }),
  };
}

export function 生成首页文摘(精选, 剧情表) {
  const works = [];
  for (const 条目 of 精选.featured ?? []) {
    const 剧情 = 剧情表[条目.slug];
    if (!剧情) continue;
    const 主角 = 剧情.cast?.protagonist ?? null;
    const 角色们 = [主角, ...(Array.isArray(剧情.cast?.characters) ? 剧情.cast.characters : [])]
      .filter(Boolean);
    const 名册 = new Map(角色们.map((角色) => [角色.id, 非空文本(角色.name)]));
    works.push({
      slug: 条目.slug,
      title: 非空文本(剧情.title, 条目.title),
      tags: Array.isArray(条目.tags) ? 条目.tags : [],
      protagonist: 主角
        ? {
            name: 非空文本(主角.name),
            role: 非空文本(主角.role, '主角'),
            portrait: 非空文本(主角.portrait),
          }
        : null,
      castPortraits: 角色们
        .filter((角色) => 非空文本(角色.portrait))
        .map((角色) => ({
          name: 非空文本(角色.name),
          role: 非空文本(角色.role, '关键人物'),
          portrait: 角色.portrait,
        })),
      publicEndingCount: Object.values(剧情.nodes ?? {})
        .filter((节点) => !!节点?.ending && 节点.ending.tier !== 'secret').length,
      opening: 构建开场((剧情.nodes ?? {})[非空文本(剧情.startNodeId)], 名册),
    });
  }
  const 舞台剧情 = 剧情表[体验选展.slug];
  return {
    totals: {
      works: works.length,
      publicEndings: works.reduce((和, 作品) => 和 + 作品.publicEndingCount, 0),
      castPortraits: works.reduce((和, 作品) => 和 + 作品.castPortraits.length, 0),
    },
    works,
    // 核心体验舞台按 首页选展配置 预计算，首页不再为一个节点内联整部剧情。
    stage: 舞台剧情 ? 构建体验舞台(舞台剧情, 体验选展.slug, 体验选展.nodeId) : null,
  };
}

const 直接执行 = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (直接执行) {
  const 根 = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const 精选 = JSON.parse(await readFile(resolve(根, '公共资源/showcase.json'), 'utf8'));
  const 剧情表 = {};
  for (const 条目 of 精选.featured) {
    剧情表[条目.slug] = JSON.parse(
      await readFile(resolve(根, `公共资源/games/${条目.slug}/story.json`), 'utf8'),
    );
  }
  const 文摘 = 生成首页文摘(精选, 剧情表);
  await writeFile(
    resolve(根, '公共资源/homepage-digest.json'),
    `${JSON.stringify(文摘, null, 2)}\n`,
  );
  console.log(
    `首页文摘已生成：${文摘.totals.works} 部作品 · ${文摘.totals.publicEndings} 个公开阶段结局 · ${文摘.totals.castPortraits} 张立绘`,
  );
}
