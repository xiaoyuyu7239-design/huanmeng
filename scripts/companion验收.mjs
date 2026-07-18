// companion 验收：用创作台自己的校验器验证每部在架作品的 creator.json——
// 发布校验 0 错误、创作资产 0 错误、完成度 100%。作为一次性验收脚本保留，可重复运行。
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const 根 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { 由剧情构造项目 } = await import(resolve(根, '源码/创作台/项目管理/示例项目加载.js'));
const { 运行校验 } = await import(resolve(根, '源码/创作台/校验发布/校验规则.js'));
const { 校验创作资产, 计算创作资产完成度 } = await import(resolve(根, '源码/创作台/女性向资产/创作资产模型.js'));

const 精选 = JSON.parse(await readFile(resolve(根, '公共资源/showcase.json'), 'utf8'));
for (const 条目 of 精选.featured) {
  const 剧情 = JSON.parse(await readFile(resolve(根, `公共资源/games/${条目.slug}/story.json`), 'utf8'));
  const companion = JSON.parse(await readFile(resolve(根, `公共资源/games/${条目.slug}/creator.json`), 'utf8'));
  assert.equal(companion.storyId, 条目.slug, `${条目.slug} companion 绑定错位`);
  const 项目 = 由剧情构造项目(条目.slug, 剧情, companion);
  const 报告 = 运行校验(项目);
  assert.deepEqual(报告.errors, [], `${条目.slug} 发布校验存在错误:\n${(报告.errors ?? []).join('\n')}`);
  const 资产报告 = 校验创作资产(项目);
  assert.deepEqual(资产报告.errors ?? [], [], `${条目.slug} 创作资产存在错误`);
  const 完成度 = 计算创作资产完成度(项目);
  assert.equal(完成度.percentage, 100, `${条目.slug} 创作资产完成度 ${完成度.percentage}% ≠ 100%`);
  console.log(`  ✓ ${条目.slug}《${条目.title}》companion 验收通过（完成度 100%）`);
}
console.log('companion 验收：在架作品全部通过');
