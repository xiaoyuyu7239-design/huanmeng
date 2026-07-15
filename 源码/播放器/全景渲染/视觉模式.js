// ============================================================================
// 这个文件是放映厅的「验片员」：一个场景节点递过来，他先看一眼片盒——
// 里面装的是"360°全景照片"还是"平面视频"？如果是视频，具体该放哪个文件？
// 全景视图拿到他的结论后才决定：搭 Three.js 球幕，还是直接摆一台平面电视。
// 与线上 visualMode-CY4SjBFQ.js 逐行等价（分析文档：播放器界面分析.md §1）。
//
// 【导出清单（括号内是线上压缩名）】
//   解析视觉模式(节点, 选项)   (r/u)  → "image" | "video"
//   找平面视频过场(节点)       (f/t)  → cinematics 里第一条平面视频条目 | null
//   取平面视频过场(节点, 选项) (a/m)  → 仅 video 模式下返回该条目，否则 null
//   取平面视频地址(节点, 选项) (b/l)  → 视频 URL | ""（空串代表走全景分支）
//
// 【重要结论（照抄分析文档 §1.2）】cinematics 不是开场过场动画列表：
// 它在播放器中唯一用途是 { type:"flat-video", trigger:"beforeEnter" } 条目
// 会让整个节点以"平面视频"当场景背景（beforeEnter = 进入节点即播放）。
// ============================================================================

// (任意值) → 只认 "image"/"video" 两种写法，别的一律当没写 → 合法类型或 undefined
function 规范化全景类型(值) {
  return 值 === 'image' || 值 === 'video' ? 值 : undefined;
}

// (地址字符串) → 靠扩展名判断是不是视频（mp4/webm/mov，容忍 ?query/#hash 结尾）→ boolean
function 是视频地址(地址) {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(地址);
}

// (节点) → 在 cinematics 里找第一条「type=flat-video 且 trigger=beforeEnter
// 且真的有 src 或 assetPath」的条目 → 该条目 | null
export function 找平面视频过场(节点) {
  return (
    节点?.cinematics?.find(
      (条) => 条.type === 'flat-video' && 条.trigger === 'beforeEnter' && !!(条.src || 条.assetPath),
    ) ?? null
  );
}

// (节点) → 有 panorama 且它不是视频扩展名，才算"有全景图" → boolean
function 节点有图(节点) {
  return !!(节点?.panorama && !是视频地址(节点.panorama));
}

// (节点) → 有平面视频过场，或 panorama 本身就是视频地址，都算"有视频" → boolean
function 节点有视频(节点) {
  return !!(找平面视频过场(节点) || 是视频地址(节点?.panorama ?? ''));
}

// (节点, {hasImage, hasVideo}) → 判定这个节点用哪种画面 → "image" | "video"。
// 规则（与线上一致）：作者声明 image 且真有图 → image；
// 否则只要有视频资源就偏向 video；最后兜底 image。
export function 解析视觉模式(节点, 选项 = {}) {
  const 有图 = 选项.hasImage ?? 节点有图(节点);
  const 有视频 = 选项.hasVideo ?? 节点有视频(节点);
  const 声明 = 规范化全景类型(节点?.panoramaType);
  return 声明 === 'image' && 有图 ? 'image' : (声明 === 'video' && 有视频) || 有视频 ? 'video' : 'image';
}

// (节点, 选项) → 只有判成 video 模式才把过场条目交出去（poster/loop 都在里面）→ 条目 | null
export function 取平面视频过场(节点, 选项 = {}) {
  return 解析视觉模式(节点, 选项) === 'video' ? 找平面视频过场(节点) : null;
}

// (节点, 选项) → 平面视频的最终地址：优先过场条目的 src，再兼容 assetPath，
// 退而取 panorama（前提它是视频地址）→ URL 字符串；非 video 模式一律 ""
export function 取平面视频地址(节点, 选项 = {}) {
  if (!节点 || 解析视觉模式(节点, 选项) !== 'video') return '';
  const 过场 = 找平面视频过场(节点);
  return 过场?.src || 过场?.assetPath || (是视频地址(节点.panorama ?? '') ? (节点.panorama ?? '') : '');
}
