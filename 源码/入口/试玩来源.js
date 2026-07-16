// 播放器入口与播放器壳层共用同一份来源判断，避免“能读草稿”、
// “返回哪里”和“今天请求哪部作品”各自猜测不同的查询参数。
//
// game 是玩家存档键、本机项目键和静态资源目录共用的身份，因此只接受已经是
// canonical 的小写 slug；不在入口暗中 trim/转小写，否则两个不同地址可能落入同一存档格。
export const 作品slug格式 = /^[a-z0-9][a-z0-9_-]{0,47}$/;

export function 是规范作品slug(值) {
  return typeof 值 === 'string' && 作品slug格式.test(值);
}

export function 解析试玩来源(查询字符串 = '') {
  const 参数 = 查询字符串 instanceof URLSearchParams
    ? 查询字符串
    : new URLSearchParams(typeof 查询字符串 === 'string' ? 查询字符串 : '');
  const 显式指定作品 = 参数.has('game');
  const 原始作品 = 显式指定作品 ? (参数.get('game') ?? '') : '';
  const 作品有效 = 显式指定作品 && 是规范作品slug(原始作品);
  // 只有合法作品 + 两个来源参数同时存在，才能读本机草稿并返回该创作项目。
  const 是创作草稿 = 作品有效 && 参数.get('preview') === 'draft' && 参数.get('from') === 'creator';
  return Object.freeze({
    kind: 是创作草稿 ? 'creator-draft' : 'player',
    allowDraft: 是创作草稿,
    hasExplicitGame: 显式指定作品,
    gameId: 作品有效 ? 原始作品 : '',
    invalidGame: 显式指定作品 && !作品有效,
    returnLabel: 是创作草稿 ? '返回创作项目' : '返回玩家首页',
  });
}

export function 构建试玩返回地址(来源, gameId = '') {
  if (来源?.kind !== 'creator-draft') return '/';
  const 项目 = 是规范作品slug(gameId) ? gameId : '';
  return 项目 ? `/creator?project=${encodeURIComponent(项目)}` : '/creator';
}
