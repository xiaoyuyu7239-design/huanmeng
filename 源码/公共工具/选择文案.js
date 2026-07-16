// 选择文案在数据里可以同时携带 label / intent / caption，
// 但玩家界面不应把同一句话重复显示三遍。这个无 React helper
// 是首页与播放器的共享边界：label 是主行动，intent / caption 只补充新信息。

function 非空文本(值) {
  return typeof 值 === 'string' ? 值.trim().replace(/\s+/gu, ' ') : '';
}

// 用于去重而不用于展示：忽略空白、标点和“【隐藏】”这类前缀标记。
// 因此“【隐藏】保留否决权”与“保留否决权”不会再被当成两句信息。
export function 选择文案比较键(值) {
  return 非空文本(值)
    .replace(/^(?:【[^】]{1,12}】|\[[^\]]{1,12}\])\s*/u, '')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function 与已有文案重复(值, 已有) {
  const 键 = 选择文案比较键(值);
  return !键 || 已有.some((条) => 选择文案比较键(条) === 键);
}

export function 构建选择展示文案(选择 = {}) {
  const 原标签 = 非空文本(选择?.label);
  const 原意图 = 非空文本(选择?.intent);
  const label = 原标签 || 原意图 || '继续';
  const intent = 与已有文案重复(原意图, [label]) ? '' : 原意图;
  const 原说明 = 非空文本(选择?.caption);
  const caption = 与已有文案重复(原说明, [label, intent]) ? '' : 原说明;
  return { label, intent, caption };
}
