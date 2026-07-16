// 全站启动即执行的旧版安全迁移：只处理创作台历史设置柜，不触碰项目、精选或玩家存档。
export const 浏览器设置存储键 = 'creator:browser-settings:v1';
const 允许的非敏感设置键 = new Set([
  'DEEPSEEK_MODEL',
  'IMAGE_MODEL',
  'MINIMAX_TTS_MODEL',
  'YUNWU_SUNO_MODEL',
  'YUNWU_SUNO_MV',
]);

export function 清洗非敏感浏览器设置(原始) {
  if (!原始 || typeof 原始 !== 'object' || Array.isArray(原始)) return {};
  return Object.fromEntries(
    Object.entries(原始).filter(
      ([键, 值]) => 允许的非敏感设置键.has(键) && typeof 值 === 'string' && 值.trim().length > 0,
    ),
  );
}

export function 清除浏览器生产密钥(storage = globalThis.localStorage) {
  try {
    const 原文本 = storage?.getItem?.(浏览器设置存储键);
    if (原文本 === null || 原文本 === undefined) return {};
    let 原始;
    try {
      原始 = JSON.parse(原文本);
    } catch {
      原始 = {};
    }
    const 安全设置 = 清洗非敏感浏览器设置(原始);
    const 安全文本 = JSON.stringify(安全设置);
    if (原文本 !== 安全文本) storage?.setItem?.(浏览器设置存储键, 安全文本);
    return 安全设置;
  } catch {
    return {};
  }
}
