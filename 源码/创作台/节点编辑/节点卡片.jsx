// 这个文件是流程图里的一张"车票"：中栏每个剧情节点就是一张这样的卡片——
// 左边一个抓手能拖着换座位，中间显示序号/标题/分支数，右边一排快捷按钮(插入/上移/下移/编辑)。
// 卡片自己不懂剧情，怎么选中、怎么挪动全听父组件递进来的回调。
import React from 'react';
import { LoaderCircle, GitBranch, Play, Check, Lock, Circle, ListPlus, ArrowUp, ArrowDown, Pencil, GripVertical } from 'lucide-react';

// 输入节点数据+状态旗子+一堆回调 → 拼出 article.studio-flow-node → 吐出 JSX
export default function 节点卡片({
  节点,
  序号,
  资产,
  忙碌,
  选中,
  禁用,
  拖动中,
  是悬停目标,
  可上移,
  可下移,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  on选中,
  on插入,
  on上移,
  on下移,
  on编辑,
}) {
  const 分支数 = 节点.choices?.length ?? 0;
  const 已完成 = 资产?.status === 'generated-image';
  const 未解锁 = !资产 || 资产.status === 'planned';
  // 状态旗子直接翻译成修饰类，样式表里每个类都有对应皮肤
  const 类名 = [
    'studio-flow-node',
    选中 ? 'is-selected' : '',
    忙碌 ? 'is-running' : '',
    已完成 ? 'is-complete' : '',
    未解锁 ? 'is-locked' : '',
    分支数 > 1 ? 'is-branch' : '',
    拖动中 ? 'is-dragging' : '',
    是悬停目标 ? 'is-drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={类名}
      onDragOver={(事件) => {
        if (禁用) return;
        事件.preventDefault(); // 不拦默认行为浏览器就不允许 drop
        事件.dataTransfer.dropEffect = 'move';
        onDragOver();
      }}
      onDrop={(事件) => {
        if (禁用) return;
        事件.preventDefault();
        onDrop();
      }}
    >
      <span
        className="studio-flow-drag"
        draggable={!禁用}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        title="拖动排序"
      >
        <GripVertical size={15} />
      </span>
      <button className="studio-flow-node-main" onClick={on选中} type="button">
        <span className="studio-node-play">
          {忙碌 ? <LoaderCircle className="spin" size={15} /> : 分支数 > 1 ? <GitBranch size={15} /> : <Play size={15} />}
        </span>
        <strong>
          {序号 + 1}-{分支数 + 1}
        </strong>
        <em>{节点.title}</em>
        <small>{分支数 > 0 ? `${分支数}/${Math.max(分支数, 1)}` : '0/0'}</small>
        {已完成 ? <Check size={15} /> : 未解锁 ? <Lock size={15} /> : <Circle size={15} />}
      </button>
      <div className="studio-flow-actions">
        <button disabled={禁用} onClick={on插入} title="在此后插入节点" type="button">
          <ListPlus size={14} />
        </button>
        <button disabled={禁用 || !可上移} onClick={on上移} title="上移节点" type="button">
          <ArrowUp size={14} />
        </button>
        <button disabled={禁用 || !可下移} onClick={on下移} title="下移节点" type="button">
          <ArrowDown size={14} />
        </button>
        <button onClick={on编辑} title="编辑节点" type="button">
          <Pencil size={14} />
        </button>
      </div>
    </article>
  );
}
