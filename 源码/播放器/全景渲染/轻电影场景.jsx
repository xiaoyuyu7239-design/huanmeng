// 第九席的默认演出舞台：横向场景底图上叠放当前说话角色的竖版立绘。
// 360 全景不在这里常驻；玩家点“调查场景”后，由播放器应用切换到既有全景视图。
//
// 【接入契约】
//   节点.backdrop：轻电影背景（缺失/加载失败时使用暮色渐变）
//   行.expression / 行.emotion：表情键；角色 portraits 命中失败后回退 portrait
//   调查中 + 进入调查：受控按钮，aria-expanded 与外层调查视图同步

import { useEffect, useMemo, useState } from 'react';
import { Search, Undo2 } from 'lucide-react';
import { 解析说话人呈现 } from '../界面组件/角色呈现.js';

const 空操作 = () => {};

export default function 轻电影场景({
  节点 = {},
  行 = {},
  背景,
  调查中 = false,
  可调查,
  进入调查 = 空操作,
  调查入口ref,
  调查区域id = 'cinema-investigation-view',
  调查标签 = '调查场景',
  调查提示,
}) {
  const 呈现 = useMemo(() => 解析说话人呈现(行), [行]);
  const 背景地址 = 取非空字符串(背景) || 取非空字符串(节点.backdrop);
  const [背景失败, set背景失败] = useState(false);
  const [立绘失败, set立绘失败] = useState(false);
  const 调查点数量 = Array.isArray(节点.hotspots) ? 节点.hotspots.length : 0;
  const 显示调查入口 = typeof 可调查 === 'boolean' ? 可调查 : 调查点数量 > 0;
  const 站位 = 解析站位(行.portraitSide ?? 呈现.角色?.portraitSide);

  useEffect(() => set背景失败(false), [背景地址]);
  useEffect(() => set立绘失败(false), [呈现.立绘]);

  return (
    <section
      aria-label={`${取非空字符串(节点.title) || '当前场景'}角色演出`}
      className={`cinema-stage is-${站位}${调查中 ? ' is-investigating' : ''}`}
      data-expression={呈现.表情键}
      data-speaker={呈现.speaker}
    >
      <div className="cinema-backdrop-layer" aria-hidden="true">
        {背景地址 && !背景失败 ? (
          <img
            className="cinema-backdrop"
            src={背景地址}
            alt=""
            onError={() => set背景失败(true)}
          />
        ) : (
          <div className="cinema-backdrop-placeholder" />
        )}
      </div>
      <div className="cinema-stage-wash" aria-hidden="true" />
      <div className="cinema-stage-grain" aria-hidden="true" />

      {!呈现.无立绘 && (
        <figure
          className={`cinema-character${呈现.立绘 && !立绘失败 ? '' : ' has-fallback'}`}
          style={{ '--character-color': 呈现.color, '--character-accent': 呈现.accent }}
        >
          {呈现.立绘 && !立绘失败 ? (
            <img
              className="cinema-character-portrait"
              src={呈现.立绘}
              alt={`${呈现.名字}，${呈现.表情名}`}
              onError={() => set立绘失败(true)}
            />
          ) : (
            <div className="cinema-character-fallback" aria-hidden="true">
              <span>{取首字(呈现.名字)}</span>
            </div>
          )}
          <figcaption className="cinema-character-caption">
            <span>{呈现.表情名}</span>
            <strong>{呈现.名字}</strong>
            {呈现.role && <small>{呈现.role}</small>}
          </figcaption>
        </figure>
      )}

      <div className="cinema-scene-label" aria-hidden="true">
        {节点.chapter && <span>{节点.chapter}</span>}
        {节点.location && <strong>{节点.location}</strong>}
      </div>

      {显示调查入口 && (
        <button
          aria-controls={调查区域id}
          aria-expanded={调查中}
          className="cinema-investigate-button"
          onClick={进入调查}
          ref={调查入口ref}
          type="button"
        >
          {调查中 ? <Undo2 aria-hidden="true" size={18} /> : <Search aria-hidden="true" size={18} />}
          <span>
            <strong>{调查中 ? '返回角色演出' : 调查标签}</strong>
            <small>
              {取非空字符串(调查提示) ||
                (调查点数量 > 0 ? `${调查点数量} 个线索可查看` : '转动视角查看细节')}
            </small>
          </span>
        </button>
      )}
    </section>
  );
}

function 解析站位(值) {
  return 值 === 'left' || 值 === 'center' ? 值 : 'right';
}

function 取首字(名字) {
  return Array.from(取非空字符串(名字) || '角')[0];
}

function 取非空字符串(值) {
  return typeof 值 === 'string' ? 值.trim() : '';
}
