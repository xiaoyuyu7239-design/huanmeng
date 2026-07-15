// ============================================================================
// 这个文件是播放器的「调音台」：桌上四个推子（总音量/界面/语音/音乐）各管一路，
// 任何一路都能单独静音，总闸（muted/masterMuted）一拉全场安静；
// 三类声音各有玩法——界面音效"啪一下就完"（还带实例缓存，连点会叠放）、
// 对白语音一行一个播放器、BGM 是"生成 + 上传"双卡座（换场景若还是同一首，
// 唱片不换、无缝续播）。浏览器不许自动出声时，全都乖乖等玩家第一次点击再补播。
// 与线上 App.js 的音频函数逐条等价（分析文档：播放器状态分析.md §8）。
//
// 【导出清单】（括号内是线上压缩名）
//  界面音效：
//   界面音效素材表(qt)  界面音效基础音量(Ht)
//   播放界面音效(名字, 音频设置)(Gt)   一次性音效，静音/音量过小自动跳过
//  通用工具：
//   销毁音频(元素)(ne/Ot)  批量销毁引用(...refs)(Bt)  钳制音量01(值)(Qe)
//  开关与音量判定（喂 settings.audio 进来）：
//   语音已启用(音频设置)   ($ 派生值：三静音全关 且 两路音量>0)
//   语音音量(音频设置)     (z 派生值：master × voice，视频原声也用它)
//   BGM已静音(音频设置)    (He 派生值：任一静音 或 音量≤0)
//   试听已禁用(音频设置)   (设置面板"试听"按钮的 disabled 条件)
//  对白语音：
//   创建对白语音(src, 音量, 设状态)      自动播放一行语音，状态回调 playing/idle/blocked
//   切换对白语音({现有音频,src,音量,设状态}) 手动按钮：播放中→暂停，否则→播放
//  BGM 双轨：
//   场景声音模式(节点, 默认模式)(Mn)   取节点 audioPlayback.mode，只认 voice/video/mix
//   取节点音乐轨列表(节点)(kn)         按 musicPlayback.mode 五策略算出该播的轨
//   音乐轨key(轨)(st)                  "source:src"，换没换歌全看这个 key
//   更新BGM轨({轨,元素引用,key引用,音频设置,自动播放被拦})(Ge)  单轨创建/复用/调音量
//   创建自动播放解锁器(取音频列表)(yt/ce/h)  被浏览器拦了就等首次交互补播
//  平面视频：
//   控制平面视频声音(视频元素, {声音开启, 音量})(Kt)  有声优先，被拦回退静音等交互
// ============================================================================

// 界面音效素材表：音效名 → 文件路径（与线上同路径，文件在 公共资源/audio/ui/）
export const 界面音效素材表 = {
  advance: '/audio/ui/advance.mp3',
  back: '/audio/ui/back.mp3',
  choice: '/audio/ui/choice.mp3',
  choiceMajor: '/audio/ui/choice-major.mp3',
  click: '/audio/ui/click.mp3',
  error: '/audio/ui/error.mp3',
  panelClose: '/audio/ui/panel-close.mp3',
  panelOpen: '/audio/ui/panel-open.mp3',
  success: '/audio/ui/success.mp3',
  toggle: '/audio/ui/toggle.mp3',
};

// 每个音效自带的基础响度（最终音量 = 总音量 × 界面音量 × 这里的基础值）
export const 界面音效基础音量 = {
  advance: 0.42,
  back: 0.58,
  choice: 0.58,
  choiceMajor: 0.62,
  click: 0.5,
  error: 0.68,
  panelClose: 0.46,
  panelOpen: 0.46,
  success: 0.56,
  toggle: 0.52,
};

// 界面音效的 Audio 实例缓存：同一个音效反复播不重新建（模块级，全播放器共享）
const 音效缓存 = new Map();

// (音效名, settings.audio) → 播一声界面音效 → 无返回值。
// 静音矩阵：muted / masterMuted / uiMuted 任一开着直接不播；算完音量 ≤0.01 也不播。
// 正在播放时 cloneNode 叠放一份，让连续点击"哒哒哒"每下都有声。
export function 播放界面音效(音效名, 音频设置) {
  if (typeof window === 'undefined' || 音频设置.muted || 音频设置.masterMuted || 音频设置.uiMuted)
    return;
  const 音量 = 钳制音量01(音频设置.masterVolume) * 钳制音量01(音频设置.uiVolume) * 界面音效基础音量[音效名];
  if (音量 <= 0.01) return;
  const 缓存实例 = 取缓存音效(音效名);
  const 实例 = 缓存实例.paused ? 缓存实例 : 缓存实例.cloneNode(true);
  实例.volume = 音量;
  实例.currentTime = 0;
  实例.play().catch(() => {});
}

// (音效名) → 从缓存拿 Audio，没有就建一个（preload="auto"）存进去
function 取缓存音效(音效名) {
  const 已有 = 音效缓存.get(音效名);
  if (已有) return 已有;
  const 实例 = new Audio(界面音效素材表[音效名]);
  实例.preload = 'auto';
  音效缓存.set(音效名, 实例);
  return 实例;
}

// (任意值) → 钳到 0-1 的音量；非有限数一律 0
export function 钳制音量01(值) {
  return Number.isFinite(值) ? Math.max(0, Math.min(1, 值)) : 0;
}

// ---- 通用销毁工具 ----

// (Audio/Video 元素或 null) → 停播、卸掉 src、load 释放资源；出错不吭声
export function 销毁音频(元素) {
  if (元素)
    try {
      元素.pause();
      元素.removeAttribute('src');
      元素.src = '';
      元素.load();
    } catch {}
}

// (...ref对象) → 逐个销毁 ref.current 并置 null（离开页面/卸载组件时一把清干净）
export function 批量销毁引用(...引用们) {
  for (const 引用 of 引用们) {
    销毁音频(引用.current);
    引用.current = null;
  }
}

// ---- 开关与音量判定（全部只读 settings.audio，纯函数）----

// 语音总开关：三层静音（总开关/总音量静音/语音静音）全没开，且两路音量都 > 0
export function 语音已启用(音频设置) {
  return (
    !音频设置.muted &&
    !音频设置.masterMuted &&
    !音频设置.voiceMuted &&
    音频设置.masterVolume > 0 &&
    音频设置.voiceVolume > 0
  );
}

// 对白语音的实际音量 = 总音量 × 语音音量（平面视频原声也用这个值）
export function 语音音量(音频设置) {
  return 音频设置.masterVolume * 音频设置.voiceVolume;
}

// BGM 静音判定：任一静音开关开着、或总/音乐音量 ≤ 0。
// 注意静音时 BGM 并不停播——只把 muted 拉上、volume 归 0，进度继续走（解除立刻有声）。
export function BGM已静音(音频设置) {
  return (
    音频设置.muted ||
    音频设置.masterMuted ||
    音频设置.bgmMuted ||
    音频设置.masterVolume <= 0 ||
    音频设置.bgmVolume <= 0
  );
}

// 设置面板"试听"按钮的禁用条件（界面音效这一路只要有任何一环不通就灰掉）
export function 试听已禁用(音频设置) {
  return (
    音频设置.muted ||
    音频设置.masterMuted ||
    音频设置.uiMuted ||
    音频设置.masterVolume <= 0 ||
    音频设置.uiVolume <= 0
  );
}

// ---- 对白语音 ----

// (voiceSrc, 音量, 设状态回调) → 建一个 Audio 自动开播 → 返回 Audio 元素（调用方存进 ref，
// 换行/卸载时用 销毁音频 收掉）。状态回调会收到 "playing" / "idle" / "blocked"。
// 调用方约定：src 为空该置 "missing"、语音未启用该置 "idle"，都轮不到本函数出场。
export function 创建对白语音(voiceSrc, 音量, 设状态) {
  const 音频 = new Audio(voiceSrc);
  音频.volume = 音量;
  音频.addEventListener('playing', () => 设状态('playing'));
  音频.addEventListener('ended', () => 设状态('idle'));
  音频.addEventListener('pause', () => 设状态('idle'));
  音频.addEventListener('error', () => 设状态('blocked'));
  音频.play().catch(() => 设状态('blocked'));
  return 音频;
}

// ({现有音频, src, 音量, 设状态}) → 语音按钮的手动切换：正在播就暂停（状态回 idle），
// 停着就播 → 返回实际使用的 Audio 元素（调用方写回 ref）。
// 复用规则与线上一致：现有 Audio 还挂着 src 就继续用它，否则新建。
// 调用方约定：muted/masterMuted/voiceMuted 任一开着或没有 src 时不要调用（线上在处理器里先 return）。
export function 切换对白语音({ 现有音频, src, 音量, 设状态 }) {
  const 音频 = 现有音频 && 现有音频.src ? 现有音频 : new Audio(src);
  音频.volume = 音量;
  if (!音频.paused) {
    音频.pause();
    设状态('idle');
    return 音频;
  }
  音频
    .play()
    .then(() => 设状态('playing'))
    .catch(() => 设状态('blocked'));
  return 音频;
}

// ---- BGM 双轨 ----

// (节点, 默认模式) → 本节点的声音模式：节点 audioPlayback.mode 只认 voice/video/mix，
// 不合法就用玩家设置里的默认值
export function 场景声音模式(节点, 默认模式) {
  const 模式 = 节点.audioPlayback?.mode;
  return 模式 === 'voice' || 模式 === 'video' || 模式 === 'mix' ? 模式 : 默认模式;
}

// (节点) → 按 musicPlayback.mode 的五种策略算出"现在该上哪几张唱片" → 轨数组（0/1/2 条）。
//   mix：两轨同播，各用 generatedVolume/uploadedVolume（缺省 0.72）
//   generated-only / uploaded-only：只播指定层，音量 1
//   generated-first：生成优先，没有就用上传；uploaded-first（默认）：反过来
// 没 src 的层会被过滤掉；loop 取 musicPlayback.loop（缺省 true）。
export function 取节点音乐轨列表(节点) {
  const 模式 = 规范化音乐模式(节点);
  const 生成层 = 节点.musicLayers?.generated ?? 旧版生成层(节点);
  const 上传层 = 节点.musicLayers?.uploaded;
  const 循环 = 节点.musicPlayback?.loop ?? true;
  return 模式 === 'mix'
    ? [
        构造音乐轨(生成层, 节点.musicPlayback?.generatedVolume ?? 0.72, 循环),
        构造音乐轨(上传层, 节点.musicPlayback?.uploadedVolume ?? 0.72, 循环),
      ].filter((轨) => !!轨)
    : [
        构造音乐轨(
          模式 === 'generated-only'
            ? 生成层
            : 模式 === 'uploaded-only'
              ? 上传层
              : 模式 === 'generated-first'
                ? (生成层 ?? 上传层)
                : (上传层 ?? 生成层),
          1,
          循环,
        ),
      ].filter((轨) => !!轨);
}

// 音乐模式只认四种写法，其余（含缺省）一律当 "uploaded-first"（上传优先）
function 规范化音乐模式(节点) {
  const 模式 = 节点.musicPlayback?.mode;
  return 模式 === 'generated-first' ||
    模式 === 'generated-only' ||
    模式 === 'uploaded-only' ||
    模式 === 'mix'
    ? 模式
    : 'uploaded-first';
}

// 老版本剧情没有 musicLayers，只有 musicSrc/musicCueId/musicTitle 三个散字段——
// 把它们拼成一个"生成层"，让新逻辑照常吃得下
function 旧版生成层(节点) {
  if (节点.musicSrc)
    return {
      cueId: 节点.musicCueId ?? 'legacy-music',
      source: 'generated',
      src: 节点.musicSrc,
      title: 节点.musicTitle,
    };
}

// (音乐层, 音量, 循环) → 标准轨对象 { source, src, volume, loop }；没 src 返回 undefined
function 构造音乐轨(层, 音量, 循环) {
  if (层?.src)
    return {
      source: 层.source === 'uploaded' ? 'uploaded' : 'generated',
      src: 层.src,
      volume: 钳制区间(音量, 0, 1),
      loop: 循环,
    };
}

// (轨) → "source:src" 作为这张唱片的身份证；key 没变就说明还是同一首，不换碟无缝续播
export function 音乐轨key(轨) {
  return `${轨.source}:${轨.src}`;
}

function 钳制区间(值, 下限, 上限) {
  return Number.isFinite(值) ? Math.max(下限, Math.min(上限, 值)) : 下限;
}

// ({轨, 元素引用, key引用, 音频设置, 自动播放被拦}) → 管好一个卡座 → 无返回值。
//   轨为空       → 销毁现有 Audio、key 清空（这一层这个节点不响）
//   key 变了     → 换碟：销毁旧的、new Audio 重建
//   key 没变     → 只更新 loop/muted/volume（换节点同一首歌就是这么无缝续播的）
//   静音时不停播 → muted=true、volume=0，进度照走
//   play 被浏览器拦下 → 调 自动播放被拦() 让调用方挂"首次交互补播"监听
// 元素引用/key引用 是 {current} 形状的对象（React ref 直接传进来）。
export function 更新BGM轨({ 轨, 元素引用, key引用, 音频设置, 自动播放被拦 }) {
  if (!轨) {
    销毁音频(元素引用.current);
    元素引用.current = null;
    key引用.current = '';
    return;
  }
  const 新key = 音乐轨key(轨);
  let 元素 = 元素引用.current;
  if (!元素 || key引用.current !== 新key) {
    销毁音频(元素);
    元素 = new Audio(轨.src);
    元素引用.current = 元素;
    key引用.current = 新key;
  }
  const 静音 = BGM已静音(音频设置);
  元素.loop = 轨.loop;
  元素.muted = 静音;
  元素.volume = 静音 ? 0 : 音频设置.masterVolume * 音频设置.bgmVolume * 轨.volume;
  if (元素.paused) 元素.play().catch(() => 自动播放被拦());
}

// (取音频列表函数) → { 请求解锁, 清理 }。浏览器拦了自动播放时调 请求解锁()：
// 挂一次性的 pointerdown/keydown 监听，玩家一动手就把列表里的音频全部补播。
// 清理() 摘监听（BGM effect 的 cleanup 和整体销毁时都要调）。
export function 创建自动播放解锁器(取音频列表) {
  let 已挂监听 = false;
  const 清理 = () => {
    window.removeEventListener('pointerdown', 重试);
    window.removeEventListener('keydown', 重试);
    已挂监听 = false;
  };
  const 重试 = () => {
    清理();
    for (const 音频 of 取音频列表()) if (音频) 音频.play().catch(() => {});
  };
  const 请求解锁 = () => {
    if (!已挂监听) {
      已挂监听 = true;
      window.addEventListener('pointerdown', 重试, { once: true });
      window.addEventListener('keydown', 重试, { once: true });
    }
  };
  return { 请求解锁, 清理 };
}

// ---- 平面视频原声 ----

// (video元素, {声音开启, 音量}) → 接管平面视频的声音 → 返回清理函数（或 undefined）。
// 声音开启时：先试有声播放；被浏览器拦下就回退静音播放，同时挂 pointerdown/keydown/
// touchstart 监听，等玩家第一次交互再恢复音量重播。声音关闭时：直接静音播放。
// 为什么这么绕：浏览器规定"没交互不许出声"，但视频画面得先动起来，所以先静音保画面。
export function 控制平面视频声音(视频元素, { 声音开启, 音量 }) {
  if (!视频元素) return;
  let 已收工 = false;
  const 交互事件 = ['pointerdown', 'keydown', 'touchstart'];
  const 摘监听 = () => {
    交互事件.forEach((名) => window.removeEventListener(名, 有声播放));
  };
  const 静音播放 = () => {
    if (已收工) return;
    视频元素.muted = true;
    视频元素.defaultMuted = true;
    视频元素.volume = 0;
    视频元素.play().catch(() => {});
  };
  const 有声播放 = () => {
    if (已收工) return;
    视频元素.muted = false;
    视频元素.defaultMuted = false;
    视频元素.volume = Math.max(0, Math.min(1, 音量));
    视频元素.play().then(摘监听).catch(静音播放);
  };
  if (声音开启) {
    有声播放();
    交互事件.forEach((名) => window.addEventListener(名, 有声播放, { passive: true }));
  } else {
    静音播放();
  }
  return () => {
    已收工 = true;
    摘监听();
    try {
      视频元素.pause();
    } catch {}
  };
}
