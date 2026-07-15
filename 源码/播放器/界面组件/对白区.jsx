// ============================================================================
// 这个文件是屏幕下方的「台词提词卡」：一张米色纸卡，左上角深色徽章写着这句话
// 是谁说的（角色有专属色点），中间是台词正文；右上角一个小喇叭（点了听这句的
// 配音，播放中会呼吸发光），右下角一枚红蜡封"继续"按钮（念到本节点最后一句
// 就藏起来，把位置让给选择区）。对应线上 App.js 的 div.dialogue-main、
// In(SpeakerBadge)、Ln(VoiceButton)（分析文档：播放器界面分析.md §5.3）。
//
// 【导出清单】
//   default 对白区({行, 语音状态, 语音禁用, 点语音, 已到最后一行, 点继续})
// ============================================================================

import { VolumeX, Volume2, ChevronRight } from 'lucide-react';
import { 取角色档案, 说话人显示名 } from '../剧情引擎/状态与结算.js';

// ({speaker}) → 说话人徽章（线上 In）：角色表里有就用角色名+专属色，
// 否则用旁白/沈砚/系统等兜底名 → JSX
function 说话人徽章({ speaker }) {
  const 角色 = 取角色档案(speaker);
  const 名字 = 角色?.name ?? 说话人显示名(speaker);
  return (
    <div className="speaker-badge" style={角色 ? { '--speaker-color': 角色.color } : undefined}>
      <span />
      <strong>{名字}</strong>
    </div>
  );
}

// ({disabled, onClick, status}) → 语音小喇叭（线上 Ln）：title 跟着状态换文案，
// 无语音/静音时禁用并换成"哑喇叭"图标 → JSX
function 语音按钮({ 禁用, 点击, 状态 }) {
  const 提示 =
    状态 === 'playing'
      ? '暂停语音'
      : 状态 === 'blocked'
        ? '播放语音'
        : 状态 === 'missing'
          ? '无语音'
          : '播放语音';
  return (
    <button
      className={状态 === 'playing' ? 'voice-button is-playing' : 'voice-button'}
      disabled={禁用 || 状态 === 'missing'}
      onClick={点击}
      title={提示}
      type="button"
    >
      {禁用 || 状态 === 'missing' ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}

export default function 对白区({ 行, 语音状态, 语音禁用, 点语音, 已到最后一行, 点继续 }) {
  return (
    <div className="dialogue-main">
      <说话人徽章 speaker={行?.speaker} />
      <p>{行?.text}</p>
      <语音按钮 禁用={语音禁用} 点击={点语音} 状态={语音状态} />
      {!已到最后一行 && (
        <button className="next-button" onClick={点继续} title="继续" type="button">
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
