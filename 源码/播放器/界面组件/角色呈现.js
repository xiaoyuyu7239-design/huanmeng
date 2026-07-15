// 轻电影舞台与对白历史共用的人物呈现边界。
// 剧情允许只提供一张 portrait，也允许用 portraits 按 expression / emotion 存多张；
// 这里把几种作者数据形态收敛成稳定的 {名字, 表情, 立绘}，组件不直接猜 story 结构。

import { 取角色档案, 说话人显示名 } from '../剧情引擎/状态与结算.js';

const 无立绘说话人 = new Set(['narrator', 'system']);

const 表情中文字典 = {
  neutral: '平静',
  default: '平静',
  calm: '沉静',
  composed: '从容',
  restrained: '克制',
  serious: '认真',
  focused: '专注',
  concerned: '担忧',
  worried: '忧虑',
  tense: '紧绷',
  alert: '警觉',
  firm: '坚定',
  determined: '笃定',
  thoughtful: '思索',
  thinking: '思索',
  gentle: '柔和',
  soft: '柔和',
  smile: '浅笑',
  smiling: '浅笑',
  sad: '低落',
  angry: '愠怒',
  surprised: '意外',
};

export function 是无立绘说话人(speaker) {
  return 无立绘说话人.has(非空字符串(speaker).toLowerCase());
}

export function 解析表情(行 = {}) {
  const 原始 =
    非空字符串(行.expressionLabel) ||
    非空字符串(行.expression) ||
    非空字符串(行.emotion) ||
    非空字符串(行.mood) ||
    'neutral';
  const 键 = 原始.toLowerCase();
  return {
    key: 键,
    label: 表情中文字典[键] ?? 原始,
  };
}

// 支持以下 portraits 写法：
// { concerned: '/a.png', default: '/base.png' }
// { concerned: { src: '/a.png' } }
// [{ expression: 'concerned', src: '/a.png' }]
export function 解析立绘地址(角色, 行 = {}) {
  if (!角色 || 是无立绘说话人(行.speaker)) return '';
  const 表情 = 解析表情(行);
  const 显式地址 = 取资源地址(行.portrait);
  if (显式地址) return 显式地址;

  const 行立绘组地址 = 从立绘组取地址(行.portraits, 表情.key);
  if (行立绘组地址) return 行立绘组地址;

  const 角色立绘组地址 = 从立绘组取地址(角色.portraits, 表情.key);
  if (角色立绘组地址) return 角色立绘组地址;

  return 取资源地址(角色.portrait);
}

export function 解析说话人呈现(行 = {}) {
  const speaker = 非空字符串(行.speaker) || 'narrator';
  const 角色 = 行.character && typeof 行.character === 'object' ? 行.character : 取角色档案(speaker);
  const 表情 = 解析表情(行);
  const 名字 =
    非空字符串(行.speakerName) ||
    非空字符串(行.name) ||
    非空字符串(角色?.name) ||
    说话人显示名(speaker);
  return {
    speaker,
    角色,
    名字,
    role: 非空字符串(行.role) || 非空字符串(角色?.role),
    color: 非空字符串(行.color) || 非空字符串(角色?.color) || '#d7b6c9',
    accent: 非空字符串(行.accent) || 非空字符串(角色?.accent) || '#4b3045',
    表情键: 表情.key,
    表情名: 表情.label,
    立绘: 是无立绘说话人(speaker) ? '' : 解析立绘地址(角色, 行),
    无立绘: 是无立绘说话人(speaker),
  };
}

function 从立绘组取地址(立绘组, 表情键) {
  const 兜底键们 = 去重([表情键, 'default', 'neutral', 'calm']);
  if (Array.isArray(立绘组)) {
    for (const 键 of 兜底键们) {
      const 命中 = 立绘组.find((条目) => {
        if (!条目 || typeof 条目 !== 'object') return false;
        const 条目键 =
          非空字符串(条目.expression) ||
          非空字符串(条目.emotion) ||
          非空字符串(条目.key) ||
          非空字符串(条目.id);
        return 条目键.toLowerCase() === 键;
      });
      const 地址 = 取资源地址(命中);
      if (地址) return 地址;
    }
    return 取资源地址(立绘组.find((条目) => 取资源地址(条目)));
  }
  if (!立绘组 || typeof 立绘组 !== 'object') return '';
  const 键映射 = new Map(Object.keys(立绘组).map((键) => [键.toLowerCase(), 键]));
  for (const 键 of 兜底键们) {
    const 原键 = 键映射.get(键);
    const 地址 = 取资源地址(原键 ? 立绘组[原键] : undefined);
    if (地址) return 地址;
  }
  return '';
}

function 取资源地址(值) {
  if (typeof 值 === 'string') return 值.trim();
  if (!值 || typeof 值 !== 'object') return '';
  return (
    非空字符串(值.src) ||
    非空字符串(值.url) ||
    非空字符串(值.path) ||
    非空字符串(值.portrait)
  );
}

function 去重(列表) {
  return [...new Set(列表.filter(Boolean))];
}

function 非空字符串(值) {
  return typeof 值 === 'string' ? 值.trim() : '';
}
