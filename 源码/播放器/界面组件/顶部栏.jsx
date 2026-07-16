// ============================================================================
// 这个文件是放映厅的「门楣招牌」：左边一块能点的品牌牌（按试玩来源退回玩家首页或原创作项目），
// 中间挂着"现在演到哪一幕"的场次牌（章节｜场景名｜地点），右边三个纸质按钮
// （回忆/存档/设置）负责拉开右侧小抽屉。对应线上 App.js 的 header.topbar 与
// Ae(IconButton)（分析文档：播放器界面分析.md §5.1，类名一字不差）。
//
// 【导出清单】
//   default 顶部栏({剧情标题, 节点, 当前面板, 切换面板, 返回目标, 返回标签})
// ============================================================================

import { House, Archive, History, Save, Settings } from 'lucide-react';

// ({active, children, label, onClick}) → 一枚顶栏图标按钮（线上 Ae）→ JSX
function 图标按钮({ 激活, children, 标签, 点击 }) {
  return (
    <button
      aria-pressed={激活}
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

export default function 顶部栏({
  剧情标题,
  节点,
  当前面板,
  切换面板,
  返回目标,
  返回标签 = '返回玩家首页',
  显示对白记录 = false,
}) {
  return (
    <header className="topbar">
      <button
        aria-label={返回标签}
        className="brand-button"
        onClick={返回目标}
        title={返回标签}
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
        {显示对白记录 && (
          <图标按钮 激活={当前面板 === 'history'} 标签="对白" 点击={() => 切换面板('history')}>
            <History size={18} />
          </图标按钮>
        )}
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
