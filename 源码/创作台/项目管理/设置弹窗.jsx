// Level 5 后的安全设置说明：浏览器不再接收或保存任何生产模型密钥。
// 创作侧生成能力尚未接入服务端时必须如实显示“未接入”，不能因本机存在字符串而显示在线。
import React from 'react';
import { Bot, ImagePlus, KeyRound, MessageCircle, Mic, Server, ShieldCheck, X } from 'lucide-react';

const 服务说明 = [
  {
    id: 'relationship',
    icon: <MessageCircle size={18} />,
    title: '玩家关系回应',
    status: '服务端代理已就绪',
    description: '密钥、角色白名单、限流和费用预算都在服务进程内；实际模型未配置时使用作者备用回应。',
  },
  {
    id: 'agent',
    icon: <Bot size={18} />,
    title: '剧情创作 Agent',
    status: '尚未接入',
    description: '当前创作助手仍是明确占位能力；后续接入时必须复用服务端密钥与预算保护。',
  },
  {
    id: 'image',
    icon: <ImagePlus size={18} />,
    title: '图片与音乐生成',
    status: '尚未接入',
    description: '本机创作台不会直接把用户密钥发送给第三方，也不会在后台产生生成费用。',
  },
  {
    id: 'voice',
    icon: <Mic size={18} />,
    title: '对白语音合成',
    status: '尚未接入',
    description: '现有本地音频仍可播放；新语音生成要等服务端能力与数据政策完成。',
  },
];

export default function 设置弹窗({ on关闭 }) {
  return (
    <section aria-modal="true" className="creator-editor-overlay" role="dialog">
      <div className="creator-settings-dialog">
        <div className="creator-editor-head">
          <div>
            <span>工作区设置</span>
            <strong>生成服务与安全</strong>
          </div>
          <button onClick={on关闭} title="关闭" type="button">
            <X size={18} />
          </button>
        </div>

        <div className="creator-settings-body">
          <div className="creator-settings-note">
            <span><ShieldCheck size={14} /> 服务端密钥托管</span>
            <strong>浏览器不再接收、显示或保存任何生产 API Key。</strong>
            <small>旧版本留在当前站点 localStorage 中的模型密钥会自动清除；项目、精选和玩家存档不受影响。</small>
          </div>

          {服务说明.map((服务) => (
            <div className="creator-settings-card" key={服务.id}>
              <div className="creator-settings-card-head">
                <strong>{服务.icon}{服务.title}</strong>
                <span>{服务.description}</span>
              </div>
              <div className="creator-settings-grid">
                <div className="creator-settings-field">
                  <span>当前状态</span>
                  <div className="creator-settings-service-state">
                    <i className={服务.id === 'relationship' ? 'is-ready' : ''} />
                    <strong>{服务.status}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="creator-settings-note">
            <span><Server size={14} /> 部署约束</span>
            <strong>关系模型只通过服务端环境变量配置。</strong>
            <small>变量不得使用 VITE_ 前缀；数据保留政策未确认时，即使存在密钥也会强制停留在备用模式。</small>
          </div>
        </div>

        <div className="creator-editor-actions">
          <span className="creator-save-state"><KeyRound size={14} /> 密钥不进入浏览器</span>
          <button onClick={on关闭} type="button">已了解并关闭</button>
        </div>
      </div>
    </section>
  );
}
