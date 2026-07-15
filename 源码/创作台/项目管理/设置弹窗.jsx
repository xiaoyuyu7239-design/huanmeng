// 这个文件是"钥匙抽屉"：模型与密钥设置弹窗(顶栏齿轮打开)。
// 本地复刻没有服务器，所以等价于线上的"浏览器只读模式"——密钥只存进当前浏览器的
// localStorage(creator:browser-settings:v1)，换台电脑就要重填。
// 第二棒的 AI 助手/生图/配音直连全靠这个抽屉里的钥匙，字段键名(DEEPSEEK_API_KEY 等)不能改。
import React, { useState } from 'react';
import { X, Save, LoaderCircle } from 'lucide-react';
import { 读浏览器设置, 写浏览器设置 } from './本机项目存储.js';

// 抽屉里的格子：分区和字段说明(secret 字段只显示"已保存在此浏览器"，不回显原文)
const 设置分区 = [
  {
    id: 'agent',
    title: 'DeepSeek 剧情 Agent',
    description: '创作助手对话与剧情草稿生成使用的模型。',
    fields: [
      { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key', type: 'secret', placeholder: 'sk-...' },
      { key: 'DEEPSEEK_MODEL', label: 'DeepSeek 模型', type: 'text', placeholder: 'deepseek-chat' },
    ],
  },
  {
    id: 'image',
    title: '云雾 图片生成',
    description: '全景图生成与局部重绘使用的图片模型。',
    fields: [
      { key: 'YUNWU_API_KEY', label: '云雾 API Key', type: 'secret', placeholder: 'sk-...' },
      { key: 'IMAGE_MODEL', label: '图片模型', type: 'text', placeholder: 'gemini-2.5-flash-image' },
    ],
  },
  {
    id: 'tts',
    title: 'MiniMax 语音合成',
    description: '对白语音生成使用的 TTS 模型。',
    fields: [
      { key: 'MINIMAX_API_KEY', label: 'MiniMax API Key', type: 'secret', placeholder: 'eyJ...' },
      { key: 'MINIMAX_TTS_MODEL', label: 'TTS 模型', type: 'text', placeholder: 'speech-2.8-turbo' },
    ],
  },
  {
    id: 'music',
    title: '云雾 Suno 音乐',
    description: '场景配乐生成使用的音乐模型。',
    fields: [
      { key: 'YUNWU_SUNO_MODEL', label: '音乐模型', type: 'text', placeholder: 'suno_music_open' },
      { key: 'YUNWU_SUNO_MV', label: '默认 MV 版本', type: 'text', placeholder: 'chirp-v5' },
    ],
  },
];

// 输入(保存后的回调、关闭回调) → 渲染设置表单，保存时写 localStorage → 吐出 JSX
export default function 设置弹窗({ on保存完成, on关闭 }) {
  // 打开抽屉时先把已有的钥匙摆出来；secret 字段留空(只记住"已存过"这个事实)
  const [已存设置, 设已存设置] = useState(() => 读浏览器设置());
  const [草稿, 设草稿] = useState(() => {
    const 初始 = {};
    for (const 区 of 设置分区) for (const 字段 of 区.fields) 初始[字段.key] = 字段.type === 'secret' ? '' : 已存设置[字段.key] ?? '';
    return 初始;
  });
  const [保存中, 设保存中] = useState(false);
  const [保存错误, 设保存错误] = useState('');
  const [待清除密钥, 设待清除密钥] = useState({});

  // 点"保存到浏览器"：secret 字段留空表示"保持原钥匙不动"，填了才覆盖；文本字段空=删除
  function 保存() {
    设保存中(true);
    设保存错误('');
    try {
      const 新设置 = { ...读浏览器设置() };
      for (const 区 of 设置分区) {
        for (const 字段 of 区.fields) {
          const 值 = (草稿[字段.key] ?? '').trim();
          if (字段.type === 'secret') {
            if (待清除密钥[字段.key]) delete 新设置[字段.key];
            else if (值) 新设置[字段.key] = 值;
          } else if (值) {
            新设置[字段.key] = 值;
          } else {
            delete 新设置[字段.key];
          }
        }
      }
      写浏览器设置(新设置);
      设已存设置(新设置);
      设待清除密钥({});
      // 保存后不把密钥明文继续留在输入框和 React state；空输入仍表示下次保持已存值。
      设草稿((旧) => {
        const 新草稿 = { ...旧 };
        for (const 区 of 设置分区) {
          for (const 字段 of 区.fields) if (字段.type === 'secret') 新草稿[字段.key] = '';
        }
        return 新草稿;
      });
      on保存完成();
    } catch (错) {
      设保存错误(错 instanceof Error ? 错.message : '保存设置失败，请检查浏览器存储权限。');
    } finally {
      设保存中(false);
    }
  }

  return (
    <section aria-modal="true" className="creator-editor-overlay" role="dialog">
      <div className="creator-settings-dialog">
        <div className="creator-editor-head">
          <div>
            <span>工作区设置</span>
            <strong>模型与密钥</strong>
          </div>
          <button onClick={on关闭} title="关闭" type="button">
            <X size={18} />
          </button>
        </div>
        <div className="creator-settings-body">
          <div className="creator-settings-note">
            <span>浏览器 localStorage（当前浏览器）</span>
            <strong>每个玩家可以填写自己的 key；配置只保存在当前浏览器。</strong>
            <small>调用 Agent 时密钥仅随本次请求转发，不写入 Vercel 环境变量、GitHub 或项目文件。</small>
          </div>
          {设置分区.map((区) => (
            <div className="creator-settings-card" key={区.id}>
              <div className="creator-settings-card-head">
                <strong>{区.title}</strong>
                <span>{区.description}</span>
              </div>
              <div className="creator-settings-grid">
                {区.fields.map((字段) => {
                  const 已标记清除 = !!待清除密钥[字段.key];
                  return (
                    <div className="creator-settings-field" key={字段.key}>
                      <span>{字段.label}</span>
                      <input
                        disabled={保存中 || 已标记清除}
                        onChange={(事件) => {
                          const 值 = 事件.target.value;
                          设草稿((旧) => ({ ...旧, [字段.key]: 值 }));
                          if (字段.type === 'secret' && 值) {
                            设待清除密钥((旧) => ({ ...旧, [字段.key]: false }));
                          }
                        }}
                        placeholder={
                          字段.type === 'secret' && 已存设置[字段.key]
                            ? 已标记清除
                              ? '保存后清除已存密钥'
                              : '已保存在此浏览器（留空则保留）'
                            : 字段.placeholder
                        }
                        type={字段.type === 'secret' ? 'password' : 'text'}
                        value={草稿[字段.key] ?? ''}
                      />
                      {字段.type === 'secret' && 已存设置[字段.key] && (
                        <button
                          aria-pressed={已标记清除}
                          disabled={保存中}
                          onClick={() => {
                            const 新标记 = !已标记清除;
                            设待清除密钥((旧) => ({ ...旧, [字段.key]: 新标记 }));
                            if (新标记) 设草稿((旧) => ({ ...旧, [字段.key]: '' }));
                          }}
                          type="button"
                        >
                          {已标记清除 ? '撤销清除' : '清除已存密钥'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="creator-editor-actions">
          {保存错误 && <span className="creator-save-state is-dirty" role="alert">{保存错误}</span>}
          <button disabled={保存中} onClick={保存} type="button">
            {保存中 ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
            保存到浏览器
          </button>
          <button onClick={on关闭} type="button">
            关闭
          </button>
        </div>
      </div>
    </section>
  );
}
