// ============================================================================
// 这个文件是放映厅的「门楣招牌」：左边一块能点的品牌牌（点了退场回创作台），
// 中间挂着"现在演到哪一幕"的场次牌（章节｜场景名｜地点），右边三个纸质按钮
// （回忆/存档/设置）负责拉开右侧小抽屉。对应线上 App.js 的 header.topbar 与
// Ae(IconButton)（分析文档：播放器界面分析.md §5.1，类名一字不差）。
//
// 【导出清单】
//   default 顶部栏({剧情标题, 节点, 当前面板, 切换面板, 返回创作台})
// ============================================================================

import { House, Archive, Save, Settings } from 'lucide-react';

// ({active, children, label, onClick}) → 一枚顶栏图标按钮（线上 Ae）→ JSX
function 图标按钮({ 激活, children, 标签, 点击 }) {
  return (
    <button
      className={激活 ? 'icon-button is-active' : 'icon-button'}
      onClick={点击}
      title={标签}
      type="button"
    >
      {children}
      <span>{标签}</span>
    </button>
  );
}

export default function 顶部栏({ 剧情标题, 节点, 当前面板, 切换面板, 返回创作台 }) {
  return (
    <header className="topbar">
      <button
        aria-label="返回创作台"
        className="brand-button"
        onClick={返回创作台}
        title="返回创作台"
        type="button"
      >
        <House size={18} />
        <span>{剧情标题}</span>
      </button>
      <div className="scene-meta">
        <span>{节点.chapter}</span>
        <strong>{节点.title}</strong>
        <small>{节点.location}</small>
      </div>
      <div className="top-actions">
        <图标按钮 激活={当前面板 === 'memories'} 标签="回忆" 点击={() => 切换面板('memories')}>
          <Archive size={18} />
        </图标按钮>
        <图标按钮 激活={当前面板 === 'save'} 标签="存档" 点击={() => 切换面板('save')}>
          <Save size={18} />
        </图标按钮>
        <图标按钮 激活={当前面板 === 'settings'} 标签="设置" 点击={() => 切换面板('settings')}>
          <Settings size={18} />
        </图标按钮>
      </div>
    </header>
  );
}
