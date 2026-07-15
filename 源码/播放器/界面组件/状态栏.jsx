// ============================================================================
// 这个文件是屏幕左侧的「仪表盘」：一竖排小药丸，头两枚永远是"第几周目"和
// "锁了哪条路线"，后面按剧情定义把可见的全局数值一枚枚挂出来（压力爆表时
// 药丸会变红警示）。对应线上 App.js 的 aside.status-rail 与 Ee(StatusPill)、
// Nn(基调图标)（分析文档：播放器界面分析.md §5.2）。
// 注意：竖排的"状态"两个字是 CSS ::before 画的，这里不用写。
//
// 【导出清单】
//   default 状态栏({state, 可见分数定义})
// ============================================================================

import { RotateCcw, Map, Shield, Gauge, ChartColumn, BookOpen } from 'lucide-react';
import { 路线显示名, 格式化数值, 是否警示 } from '../剧情引擎/状态与结算.js';

// ({icon,label,value,warn}) → 一枚状态药丸（线上 Ee）→ JSX
function 状态胶囊({ 图标, 标签, 值, 警示 }) {
  return (
    <div className={警示 ? 'status-pill is-warn' : 'status-pill'}>
      {图标}
      <span>{标签}</span>
      <strong>{值}</strong>
    </div>
  );
}

// (分数定义) → 按 tone 挑一个 15px 小图标（线上 Nn 的分支表）→ JSX
function 基调图标(定义) {
  switch (定义.tone) {
    case 'truth':
    case 'morality':
      return <Shield size={15} />;
    case 'pressure':
      return <Gauge size={15} />;
    case 'resource':
      return <ChartColumn size={15} />;
    case 'route':
      return <Map size={15} />;
    case 'affinity':
      return <BookOpen size={15} />;
    default:
      return <ChartColumn size={15} />;
  }
}

export default function 状态栏({ state, 可见分数定义 }) {
  return (
    <aside className="status-rail">
      <状态胶囊 图标={<RotateCcw size={15} />} 标签="周目" 值={state.loopCount} />
      <状态胶囊 图标={<Map size={15} />} 标签="路线" 值={路线显示名(state.route)} />
      {可见分数定义.map((定义) => {
        const 值 = state.globals[定义.id] ?? 定义.initial;
        return (
          <状态胶囊
            key={定义.id}
            图标={基调图标(定义)}
            标签={定义.label}
            值={格式化数值(值, 定义)}
            警示={是否警示(值, 定义)}
          />
        );
      })}
    </aside>
  );
}
