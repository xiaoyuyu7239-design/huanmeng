// 首页“核心体验”舞台与主视觉选展的数据出口。
// 舞台数据由 生成首页文摘.mjs 按 首页选展配置 预计算进 homepage-digest.json，
// 首页包因此不再内联整部剧情 JSON；换展改 首页选展配置.js 后重跑生成器即可。
import 首页文摘 from '../../公共资源/homepage-digest.json';

export { 主视觉选展 } from './首页选展配置.js';
export const 体验舞台 = 首页文摘.stage ?? null;
