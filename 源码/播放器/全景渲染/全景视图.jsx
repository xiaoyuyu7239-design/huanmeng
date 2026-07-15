// ============================================================================
// 这个文件是放映厅的「球幕放映机 + 观众的脖子」：把 2:1 全景图糊在一个半径 500
// 的大球内壁上（SphereGeometry 翻转法线，人站球心往外看），玩家拖拽就是转脖子
// （0.12°/像素、纯跟手无惯性），滚轮/滑杆是望远镜（fov 20–130），撒手不动 1.8 秒
// 后镜头会像呼吸一样轻轻晃（autoDrift 正弦漂移）。片子若是"平面视频"，就不搭
// 球幕，直接摆一台铺满屏幕的电视。热点不是画在球上的，而是一群 DOM 纸签按钮：
// 每帧用相机把它们的 3D 位置投影成屏幕坐标钉上去（平面模式则按百分比伪投影）。
// 图片加载失败也不黑屏——现场用 canvas 画一张"临时全景"顶上。
// 与线上 App.js 的 Yt(PanoramaView) 及其辅助函数逐行等价
// （分析文档：播放器界面分析.md §2，样式类名一字不差）。
//
// 【导出清单】
//   default 全景视图(props)   props 与线上 Yt 一致：
//     node hotspots seenHotspots autoDrift reducedMotion
//     highlightedHotspotId highlightedHotspotFocusKey
//     videoAudioEnabled videoVolume onHotspot
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  SRGBColorSpace,
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  TextureLoader,
  LinearFilter,
  CanvasTexture,
  Vector3,
  MathUtils,
} from 'three';
import { 取平面视频过场, 取平面视频地址 } from './视觉模式.js';
import { 控制平面视频声音 } from '../音频系统/音频管理.js';

// 默认视野角度（线上常量 _t = 100）
const 默认FOV = 100;
const 默认调色板 = { from: '#10151f', via: '#31404f', to: '#c78356' };
const 空操作 = () => {};

export default function 全景视图({
  node: 原始节点,
  hotspots: 原始热点们,
  seenHotspots: 原始已看热点,
  autoDrift: 自动环视,
  reducedMotion: 减少动效,
  highlightedHotspotId: 引导热点id = '',
  highlightedHotspotFocusKey: 引导聚焦key = 0,
  videoAudioEnabled: 视频声音开启 = false,
  videoVolume: 视频音量 = 1,
  onHotspot: 点热点 = 空操作,
}) {
  // setActiveStory 已经会规范化节点；这里仍保留组件级防线，方便独立复用和抵御旧存档/热更新。
  const 节点 = useMemo(() => 规范化视图节点(原始节点), [原始节点]);
  const 热点们 = useMemo(
    () => 规范化视图热点(Array.isArray(原始热点们) ? 原始热点们 : 节点.hotspots),
    [原始热点们, 节点.hotspots],
  );
  const 已看热点 = Array.isArray(原始已看热点) ? 原始已看热点 : [];
  const 容器Ref = useRef(null); // 360 分支挂 canvas 的 div
  const 渲染器Ref = useRef(null); // WebGLRenderer
  const 相机Ref = useRef(null); // PerspectiveCamera
  const 材质Ref = useRef(null); // 球面材质（贴图就贴在它身上）
  const 纹理Ref = useRef(null); // 当前贴图（换图时旧的要 dispose）
  const 视频Ref = useRef(null); // 平面视频分支的 <video>

  const 过场 = 取平面视频过场(节点);
  const 平面视频src = 取平面视频地址(节点); // 非空 = 走平面视频分支，完全不建 Three.js
  const 入场 = 解析入场视角(节点);

  // 相机状态全放 ref 里：拖拽/漂移每帧都在改，走 React state 会卡成 PPT
  const 相机状态Ref = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    lon: 入场.yaw,
    lat: 入场.pitch,
    fov: 入场.fov,
    driftAnchorLon: 入场.yaw, // 漂移锚点：镜头围着"松手位置"晃，而不是越晃越远
    driftAnchorLat: 入场.pitch,
    lastInteraction: Date.now(),
  });
  const 热点快照Ref = useRef(热点们); // 渲染循环里读的热点列表（避免闭包吃到旧值）
  // 设置变化不值得拆掉并重建整套 WebGL；渲染循环从 ref 读取最新值即可。
  const 动效设置Ref = useRef({ 自动环视, 减少动效 });
  const [投影热点, set投影热点] = useState([]); // 每帧算出的 {id,x,y,visible} 列表
  const [纹理状态, set纹理状态] = useState('loading'); // "loading" | "ready" | "fallback"
  const [当前fov, set当前fov] = useState(入场.fov); // 同步给"视角远近"滑杆的 React 态
  const 已看集合 = useMemo(() => new Set(已看热点), [已看热点]);

  // (热点, style) → 一枚热点纸签按钮 → JSX。已触发过加 is-seen、被引导加 is-guided；
  // 点击 stopPropagation 防止顺带触发拖拽层。
  const 渲染热点 = useCallback(
    (热点, 样式) => {
      const 已看 = 已看集合.has(`${节点.id}:${热点.id}`);
      const 被引导 = 引导热点id === 热点.id;
      return (
        <button
          className={`hotspot ${已看 ? 'is-seen' : ''} ${被引导 ? 'is-guided' : ''}`}
          onClick={(事件) => {
            事件.stopPropagation();
            点热点(热点);
          }}
          style={样式}
          title={热点.description}
          type="button"
          key={热点.id}
        >
          <span />
          <strong>{热点.label}</strong>
        </button>
      );
    },
    [引导热点id, 节点.id, 点热点, 已看集合],
  );

  // 热点列表变了就更新快照，渲染循环下一帧立刻用上
  useEffect(() => {
    热点快照Ref.current = 热点们;
  }, [热点们]);

  useEffect(() => {
    动效设置Ref.current = { 自动环视, 减少动效 };
  }, [自动环视, 减少动效]);

  // 节点切换：把相机整体重置为新节点的入场视角（没有补间动画——直接跳，
  // 视觉过渡由纹理加载期间的"载入全景"提示层承担），并清空旧投影热点
  useEffect(() => {
    const 视角 = 解析入场视角(节点);
    const 状态 = 相机状态Ref.current;
    状态.lon = 视角.yaw;
    状态.lat = 视角.pitch;
    状态.fov = 视角.fov;
    状态.driftAnchorLon = 视角.yaw;
    状态.driftAnchorLat = 视角.pitch;
    状态.lastInteraction = Date.now();
    set当前fov(视角.fov);
    set投影热点([]);
  }, [节点.id, 节点.entryView?.yaw, 节点.entryView?.pitch, 节点.entryView?.fov]);

  // 引导聚焦：玩家点了被锁的选择后，相机直接扭头对准解锁热点并拉近（fov ≤ 70）
  useEffect(() => {
    if (!引导热点id || 平面视频src) return;
    const 热点 = 热点们.find((条) => 条.id === 引导热点id);
    if (!热点) return;
    const 状态 = 相机状态Ref.current;
    状态.lon = 归一化180(热点.yaw);
    状态.lat = 钳制(热点.pitch, -45, 45);
    状态.fov = Math.min(状态.fov, 70);
    状态.driftAnchorLon = 状态.lon;
    状态.driftAnchorLat = 状态.lat;
    状态.lastInteraction = Date.now();
    set当前fov(状态.fov);
  }, [平面视频src, 引导聚焦key, 引导热点id, 热点们]);

  // 搭建 Three.js 球幕 + 每帧渲染循环（仅 360 分支；平面视频分支根本不进来）
  useEffect(() => {
    const 容器 = 容器Ref.current;
    if (平面视频src || !容器) return;
    const 场景 = new Scene();
    const 相机 = new PerspectiveCamera(入场.fov, 容器.clientWidth / 容器.clientHeight, 0.1, 1200);
    相机Ref.current = 相机;
    let 渲染器;
    try {
      渲染器 = new WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      // WebGL 不可用时保留 CSS 调色板背景，界面和剧情仍可继续操作。
      set纹理状态('fallback');
      return undefined;
    }
    渲染器.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 高 DPI 封顶 2，省电
    渲染器.setSize(容器.clientWidth, 容器.clientHeight);
    渲染器.outputColorSpace = SRGBColorSpace;
    容器.appendChild(渲染器.domElement);
    渲染器Ref.current = 渲染器;
    // 半径 500、96×48 分段的大球；scale(-1,1,1) 翻转法线——人在球心，看的是内壁
    const 几何 = new SphereGeometry(500, 96, 48);
    几何.scale(-1, 1, 1);
    const 材质 = new MeshBasicMaterial({ color: 0xffffff });
    材质Ref.current = 材质;
    const 球 = new Mesh(几何, 材质);
    场景.add(球);

    let 帧号 = 0;
    // 窗口变了 → 重算宽高比和画布尺寸（Math.max(…,1) 防除零）
    const 适配尺寸 = () => {
      const 宽 = Math.max(容器.clientWidth, 1);
      const 高 = Math.max(容器.clientHeight, 1);
      相机.aspect = 宽 / 高;
      相机.updateProjectionMatrix();
      渲染器.setSize(宽, 高);
    };
    // 每帧：算漂移 → 钳纬度 → 更新相机 → 渲染 → 把热点投影成屏幕坐标
    const 渲染一帧 = () => {
      const 状态 = 相机状态Ref.current;
      const 动效设置 = 动效设置Ref.current;
      // 自动环视：开着、没减少动效、没在拖、闲置超 1800ms 才开始"呼吸式"晃动
      if (动效设置.自动环视 && !动效设置.减少动效 && !状态.dragging && Date.now() - 状态.lastInteraction > 1800) {
        const 闲置 = Date.now() - 状态.lastInteraction - 1800;
        状态.lon = 状态.driftAnchorLon + Math.sin(闲置 * 45e-5) * 3.8; // 水平 ±3.8°
        状态.lat = 状态.driftAnchorLat + Math.sin(闲置 * 32e-5) * 1.1; // 垂直 ±1.1°
      }
      状态.lat = Math.max(-72, Math.min(72, 状态.lat)); // 纬度统一钳 ±72，防翻跟头
      相机.fov = 状态.fov;
      相机.updateProjectionMatrix();
      相机.lookAt(球面坐标(状态.lon, 状态.lat, 500));
      渲染器.render(场景, 相机);
      set投影热点(投影热点列表(相机, 渲染器.domElement, 热点快照Ref.current));
      帧号 = requestAnimationFrame(渲染一帧);
    };
    window.addEventListener('resize', 适配尺寸);
    适配尺寸();
    渲染一帧();
    return () => {
      cancelAnimationFrame(帧号);
      window.removeEventListener('resize', 适配尺寸);
      几何.dispose();
      材质.dispose();
      纹理Ref.current?.dispose();
      渲染器.dispose();
      渲染器.domElement.remove();
      渲染器Ref.current = null;
      相机Ref.current = null;
      材质Ref.current = null;
      纹理Ref.current = null;
    };
  }, [平面视频src]);

  // 加载全景贴图；失败就现画一张"临时全景"顶上（占位画布见文件底部）
  useEffect(() => {
    if (平面视频src) {
      set纹理状态('ready');
      set投影热点([]);
      return;
    }
    const 材质 = 材质Ref.current;
    if (!材质) return;
    set纹理状态('loading');
    let 已卸载 = false; // 为什么要这个旗子：加载是异步的，回来时组件可能已经换节点了
    const 启用占位 = () => {
      if (已卸载) return;
      替换纹理(材质, 纹理Ref, 生成占位全景(节点));
      set纹理状态('fallback');
    };
    if (!节点.panorama) {
      启用占位();
      return () => {
        已卸载 = true;
      };
    }
    try {
      new TextureLoader().load(
        节点.panorama,
        (纹理) => {
          if (已卸载) {
            纹理.dispose();
            return;
          }
          纹理.colorSpace = SRGBColorSpace;
          纹理.minFilter = LinearFilter;
          纹理.magFilter = LinearFilter;
          替换纹理(材质, 纹理Ref, 纹理);
          set纹理状态('ready');
        },
        undefined,
        启用占位,
      );
    } catch {
      启用占位();
    }
    return () => {
      已卸载 = true;
    };
  }, [平面视频src, 节点]);

  // 平面视频分支的声音接管（自动播放被拦会先静音播，等玩家第一次交互再出声）
  useEffect(() => {
    if (平面视频src)
      return 控制平面视频声音(视频Ref.current, { 声音开启: 视频声音开启, 音量: 视频音量 });
  }, [平面视频src, 节点.id, 视频声音开启, 视频音量]);

  // ---- 拖拽 / 缩放（Pointer Events，鼠标触屏一套逻辑）----

  const 按下 = useCallback((事件) => {
    事件.currentTarget.setPointerCapture(事件.pointerId);
    相机状态Ref.current.dragging = true;
    相机状态Ref.current.lastX = 事件.clientX;
    相机状态Ref.current.lastY = 事件.clientY;
    相机状态Ref.current.lastInteraction = Date.now();
  }, []);

  const 移动 = useCallback((事件) => {
    const 状态 = 相机状态Ref.current;
    if (!状态.dragging) return;
    const dx = 事件.clientX - 状态.lastX;
    const dy = 事件.clientY - 状态.lastY;
    状态.lon -= dx * 0.12; // 灵敏度 0.12°/像素；lon 减、lat 加（和线上一致）
    状态.lat += dy * 0.12;
    状态.lastX = 事件.clientX;
    状态.lastY = 事件.clientY;
    状态.lastInteraction = Date.now();
  }, []);

  // 松手：无惯性，立即停；漂移锚点挪到当前视角（下次晃就围着这里晃）
  const 松开 = useCallback((事件) => {
    const 状态 = 相机状态Ref.current;
    状态.dragging = false;
    状态.driftAnchorLon = 状态.lon;
    状态.driftAnchorLat = 状态.lat;
    状态.lastInteraction = Date.now();
    事件.currentTarget.releasePointerCapture(事件.pointerId);
  }, []);

  const 滚轮 = useCallback((事件) => {
    事件.preventDefault();
    const 状态 = 相机状态Ref.current;
    const 新fov = Math.max(20, Math.min(130, 状态.fov + 事件.deltaY * 0.025));
    状态.fov = 新fov;
    set当前fov(新fov); // 同步滑杆 UI
    状态.lastInteraction = Date.now();
  }, []);

  // ---- 平面视频分支：不建球幕，直接一台铺满的电视 + 百分比定位的热点 ----
  if (平面视频src) {
    return (
      <div
        className="panorama is-flat-video"
        style={{
          '--fallback-from': 节点.palette.from,
          '--fallback-via': 节点.palette.via,
          '--fallback-to': 节点.palette.to,
        }}
      >
        <video
          autoPlay
          className="panorama-flat-video"
          loop={过场?.loop ?? 节点.videoConfig?.loop ?? false}
          muted={!视频声音开启}
          playsInline
          poster={过场?.poster}
          preload="metadata"
          ref={视频Ref}
          src={平面视频src}
          key={`${节点.id}:${平面视频src}`} // 换源强制重建 video 元素
        />
        <div className="vignette" />
        {平面热点布局(节点, 热点们).map(({ hotspot: 热点, xPercent: x, yPercent: y }) =>
          渲染热点(热点, { left: `${x}%`, top: `${y}%` }),
        )}
      </div>
    );
  }

  // ---- 360 全景分支 ----
  return (
    <div
      className="panorama"
      onPointerDown={按下}
      onPointerMove={移动}
      onPointerUp={松开}
      onPointerCancel={松开}
      onWheel={滚轮}
      ref={容器Ref}
      style={{
        '--fallback-from': 节点.palette.from,
        '--fallback-via': 节点.palette.via,
        '--fallback-to': 节点.palette.to,
      }}
    >
      <div className="vignette" />
      <div className="horizon-glow" />
      {投影热点.map((投影) => {
        const 热点 = 热点们.find((条) => 条.id === 投影.id);
        return !热点 || !投影.visible ? null : 渲染热点(热点, { left: 投影.x, top: 投影.y });
      })}
      {纹理状态 === 'loading' && <div className="asset-state">载入全景</div>}
      {纹理状态 === 'fallback' && <div className="asset-state">临时全景</div>}
      <div
        className="zoom-controller"
        onClick={(事件) => 事件.stopPropagation()}
        onPointerDown={(事件) => 事件.stopPropagation()}
      >
        <div className="zoom-header">
          <span className="zoom-label">视角远近</span>
          <span className="zoom-value">{Math.round(当前fov)}°</span>
        </div>
        <div className="zoom-slider-container">
          <input
            className="zoom-slider"
            max="130"
            min="20"
            onChange={(事件) => {
              const 值 = Number(事件.target.value);
              set当前fov(值);
              相机状态Ref.current.fov = 值;
              相机状态Ref.current.lastInteraction = Date.now();
            }}
            type="range"
            value={Math.round(当前fov)}
          />
        </div>
      </div>
    </div>
  );
}

// ---- 私有小工具（与线上 Ie/Se/D/Re/Ze/ft/Wt/Xt/Jt 一一对应）----

function 规范化视图节点(原始值) {
  const 原始 = 原始值 && typeof 原始值 === 'object' && !Array.isArray(原始值) ? 原始值 : {};
  const 原调色板 =
    原始.palette && typeof 原始.palette === 'object' && !Array.isArray(原始.palette)
      ? 原始.palette
      : {};
  return {
    ...原始,
    id: typeof 原始.id === 'string' && 原始.id ? 原始.id : 'unknown-node',
    panorama: typeof 原始.panorama === 'string' ? 原始.panorama.trim() : '',
    hotspots: 规范化视图热点(原始.hotspots),
    palette: {
      ...原调色板,
      from: 安全颜色(原调色板.from, 默认调色板.from),
      via: 安全颜色(原调色板.via, 默认调色板.via),
      to: 安全颜色(原调色板.to, 默认调色板.to),
    },
  };
}

function 规范化视图热点(原始列表) {
  return Array.isArray(原始列表)
    ? 原始列表
        .filter((热点) => !!热点 && typeof 热点 === 'object' && !Array.isArray(热点))
        .map((热点, 索引) => ({
          ...热点,
          id: typeof 热点.id === 'string' && 热点.id ? 热点.id : `hotspot-${索引 + 1}`,
          label: typeof 热点.label === 'string' && 热点.label ? 热点.label : '线索',
          description: typeof 热点.description === 'string' ? 热点.description : '',
          yaw: Number.isFinite(Number(热点.yaw)) ? Number(热点.yaw) : 0,
          pitch: Number.isFinite(Number(热点.pitch)) ? Number(热点.pitch) : 0,
        }))
    : [];
}

function 安全颜色(值, 兜底) {
  return typeof 值 === 'string' && 值.trim() ? 值.trim() : 兜底;
}

// (节点) → 进场该看哪：entryView 优先，缺了退第一个热点，再缺退 0 →
// { yaw(归一化±180), pitch(钳±45), fov(钳34–110，默认100) }
function 解析入场视角(节点) {
  const 首热点 = (节点.hotspots ?? [])[0];
  return {
    yaw: 归一化180(首个有限数(节点.entryView?.yaw, 首热点?.yaw, 0)),
    pitch: 钳制(首个有限数(节点.entryView?.pitch, 首热点?.pitch, 0), -45, 45),
    fov: 钳制(首个有限数(节点.entryView?.fov, 默认FOV), 34, 110),
  };
}

// (...候选值) → 从左到右挑第一个真正的有限数字 → 数字（全军覆没给 0）
function 首个有限数(...候选们) {
  for (const 值 of 候选们) if (typeof 值 === 'number' && Number.isFinite(值)) return 值;
  return 0;
}

function 钳制(值, 下限, 上限) {
  return Math.max(下限, Math.min(上限, 值));
}

// (角度) → 折进 [-180, 180) 区间（转三圈半也给你算回一圈内）
function 归一化180(角度) {
  return ((((角度 + 180) % 360) + 360) % 360) - 180;
}

// (材质, 纹理Ref, 新纹理) → 旧纹理 dispose 掉、新纹理贴上球、通知 Three 刷新
function 替换纹理(材质, 纹理Ref对象, 新纹理) {
  纹理Ref对象.current?.dispose();
  纹理Ref对象.current = 新纹理;
  材质.map = 新纹理;
  材质.needsUpdate = true;
}

// (经度°, 纬度°, 半径) → 球面上那一点的三维坐标 → Vector3（相机 lookAt 用）
function 球面坐标(经度, 纬度, 半径) {
  const phi = MathUtils.degToRad(90 - 纬度);
  const theta = MathUtils.degToRad(经度 - 180);
  return new Vector3(
    半径 * Math.sin(phi) * Math.cos(theta),
    半径 * Math.cos(phi),
    半径 * Math.sin(phi) * Math.sin(theta),
  );
}

// (相机, 画布, 热点数组) → 把每个热点的球面位置投影成屏幕像素 →
// [{id, x, y, visible}]。visible = 在相机前半球（点积>0.12 留余量）且 NDC 没跑太远
// （允许略出屏 ±1.2，纸签一半在屏边也照样钉）。
function 投影热点列表(相机, 画布, 热点数组) {
  const 朝向 = new Vector3();
  相机.getWorldDirection(朝向);
  const 宽 = 画布.clientWidth;
  const 高 = 画布.clientHeight;
  return 热点数组.map((热点) => {
    const 世界点 = 球面坐标(热点.yaw, 热点.pitch, 500);
    const 在前方 = 世界点.clone().normalize().dot(朝向) > 0.12;
    const ndc = 世界点.clone().project(相机);
    return {
      id: 热点.id,
      x: ((ndc.x + 1) / 2) * 宽,
      y: ((-ndc.y + 1) / 2) * 高,
      visible: 在前方 && ndc.z < 1 && ndc.x > -1.2 && ndc.x < 1.2 && ndc.y > -1.2 && ndc.y < 1.2,
    };
  });
}

// (节点, 热点数组) → 平面视频模式的热点摆位：没有 3D 投影，就按"热点与入场视角的
// 角度差"伪投影成屏幕百分比，再按索引错开一点防重叠 →
// [{hotspot, xPercent(14–86), yPercent(18–68)}]
function 平面热点布局(节点, 热点数组) {
  const 视角 = 解析入场视角(节点);
  const fov = 钳制(视角.fov, 50, 110);
  const 基准pitch = 钳制(视角.pitch, -45, 45);
  const 中位 = 热点数组.length > 1 ? (热点数组.length - 1) / 2 : 0;
  return 热点数组.map((热点, 序) => {
    const dLon = 归一化180(热点.yaw - 视角.yaw);
    const dLat = 钳制(热点.pitch, -45, 45) - 基准pitch;
    const 偏移 = 序 - 中位;
    const x = 钳制(50 + (dLon / fov) * 42 + 偏移 * 4.5, 14, 86);
    const y = 钳制(50 - (dLat / 70) * 36 + Math.abs(偏移) * 2.5, 18, 68);
    return { hotspot: 热点, xPercent: x, yPercent: y };
  });
}

// (节点) → 全景图挂了时现画一张 2048×1024 的"临时全景"：
// palette 三色对角渐变打底 → 下半暗化 → 64 根城市剪影竖条（每 3 根一根暖窗光）
// → 中心暖色光晕 → CanvasTexture。让玩家看到的是"夜景剪影"而不是黑屏。
function 生成占位全景(节点) {
  const 画布 = document.createElement('canvas');
  画布.width = 2048;
  画布.height = 1024;
  const 笔 = 画布.getContext('2d');
  if (!笔) return new CanvasTexture(画布);
  const 渐变 = 笔.createLinearGradient(0, 0, 画布.width, 画布.height);
  try {
    渐变.addColorStop(0, 节点.palette.from);
    渐变.addColorStop(0.45, 节点.palette.via);
    渐变.addColorStop(1, 节点.palette.to);
  } catch {
    渐变.addColorStop(0, 默认调色板.from);
    渐变.addColorStop(0.45, 默认调色板.via);
    渐变.addColorStop(1, 默认调色板.to);
  }
  笔.fillStyle = 渐变;
  笔.fillRect(0, 0, 画布.width, 画布.height);
  const 暗化 = 笔.createLinearGradient(0, 画布.height * 0.58, 0, 画布.height);
  暗化.addColorStop(0, 'rgba(10, 11, 13, 0)');
  暗化.addColorStop(1, 'rgba(10, 11, 13, 0.86)');
  笔.fillStyle = 暗化;
  笔.fillRect(0, 画布.height * 0.5, 画布.width, 画布.height * 0.5);
  笔.globalAlpha = 0.35;
  for (let 根 = 0; 根 < 64; 根 += 1) {
    const x = (根 / 64) * 画布.width;
    const 高度 = 80 + Math.sin(根 * 1.8) * 44 + (根 % 5) * 18;
    笔.fillStyle = 根 % 3 === 0 ? 'rgba(255, 228, 164, 0.26)' : 'rgba(255, 255, 255, 0.12)';
    笔.fillRect(x, 画布.height * 0.52 - 高度, 10 + (根 % 4) * 12, 高度);
  }
  笔.globalAlpha = 1;
  const 光晕 = 笔.createRadialGradient(
    画布.width * 0.5,
    画布.height * 0.48,
    10,
    画布.width * 0.5,
    画布.height * 0.5,
    720,
  );
  光晕.addColorStop(0, 'rgba(255, 231, 190, 0.24)');
  光晕.addColorStop(1, 'rgba(255, 231, 190, 0)');
  笔.fillStyle = 光晕;
  笔.fillRect(0, 0, 画布.width, 画布.height);
  const 纹理 = new CanvasTexture(画布);
  纹理.colorSpace = SRGBColorSpace;
  return 纹理;
}
