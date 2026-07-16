// 播放器入口与播放器壳层共用同一份来源判断，避免“能读草稿”和“返回创作台”
// 各自猜测不同的查询参数。只有两个显式参数同时存在，才视为创作草稿试玩。
export function 解析试玩来源(查询字符串 = '') {
  const 参数 = 查询字符串 instanceof URLSearchParams
    ? 查询字符串
    : new URLSearchParams(typeof 查询字符串 === 'string' ? 查询字符串 : '');
  const 有作品 = Boolean(参数.get('game')?.trim());
  const 是创作草稿 = 有作品 && 参数.get('preview') === 'draft' && 参数.get('from') === 'creator';
  return Object.freeze({
    kind: 是创作草稿 ? 'creator-draft' : 'player',
    allowDraft: 是创作草稿,
    returnLabel: 是创作草稿 ? '返回创作项目' : '返回玩家首页',
  });
}

export function 构建试玩返回地址(来源, gameId = '') {
  if (来源?.kind !== 'creator-draft') return '/';
  const 项目 = typeof gameId === 'string' ? gameId.trim() : '';
  return 项目 ? `/creator?project=${encodeURIComponent(项目)}` : '/creator';
}
