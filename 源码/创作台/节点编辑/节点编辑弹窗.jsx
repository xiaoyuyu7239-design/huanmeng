// 这个文件是"单个节点的化妆间"：点节点卡的"编辑节点"或右栏"场景设置"后弹出的大对话框。
// 上半张桌子改基础设定(章节/标题/地点/简介/节点声音)，下半张桌子左右两列——
// 左列一句句改对白，右列一条条改选择(去向/命运类型/Effect JSON…)。
// 所有改动只通过父组件递进来的回调写回内存(改一下→顶栏变"有未保存修改")，
// 点"保存修改"才真正落到 localStorage。
//
// 【给第二棒的接口】语音相关(音色目录、试听、生成语音)本棒只搭了 DOM 骨架：
//   - "生成当前节点语音"/"生成当前句语音"按钮点击会调 props.占位提示(功能名) 冒个泡
//   - 音色下拉的目录选项留空(只有 继承/自定义 两项)，第二棒把 voice-catalog 塞进来即可
import React, { useState } from 'react';
import { X, Plus, Trash2, Save, LoaderCircle, Mic, Image, ImagePlus, Upload } from 'lucide-react';
import { 语音已就绪 } from '../项目管理/本机项目存储.js';

// 节点声音四种播放方式(文案照抄线上常量)
const 节点声音选项 = [
  { id: 'default', label: '跟随全局', hint: '使用播放器设置里的默认节点声音' },
  { id: 'voice', label: '生成语音', hint: '只播生成对白；没有语音时视频可补位' },
  { id: 'video', label: '视频原声', hint: '只播视频声音；没有视频时语音可补位' },
  { id: 'mix', label: '同时播放', hint: '生成语音和视频原声一起播放' },
];

// 语音生成范围三个角色(文案照抄线上常量)
const 语音角色 = [
  { id: 'narrator', label: '旁白', hint: 'system / narrator' },
  { id: 'protagonist', label: '主角自己', hint: 'protagonist / you' },
  { id: 'opponent', label: '互动对手', hint: '其他对白角色' },
];

// 输入对白行 → 判断它的音色模式 → 吐出 "custom" | "catalog" | "inherit"
function 单句音色模式(句) {
  if (句.voiceMode === 'custom' || 句.customVoiceId === true) return 'custom';
  if (句.voiceMode === 'catalog' || (句.voiceId ?? '').trim()) return 'catalog';
  return 'inherit';
}

// 输入对白行 → 生成音色说明文字(有单句指定就亮出来，否则说未匹配) → 吐出字符串
function 单句音色文案(句) {
  const 模式 = 单句音色模式(句);
  if (模式 !== 'inherit' && (句.voiceId ?? '').trim()) return `单句 · ${句.voiceId.trim()}`;
  return '未匹配音色';
}

// 输入对白行 → 音色下拉框当前应选中的值 → 吐出 "__custom__" / voiceId / "__inherit__"
function 音色下拉值(句) {
  const 模式 = 单句音色模式(句);
  if (模式 === 'custom') return '__custom__';
  if (模式 === 'catalog' && (句.voiceId ?? '').trim()) return 句.voiceId.trim();
  return '__inherit__';
}

// 输入对白行 → 语音生成状态的中文说明 → 吐出字符串(文案照抄线上)
function 语音状态文案(句) {
  if (语音已就绪(句)) return '已生成';
  if (句.voiceStatus === 'stale') return '需更新';
  if (句.voiceStatus === 'failed') return 句.voiceError ? `失败：${句.voiceError}` : '生成失败';
  if (句.voiceStatus === 'pending') return '等待生成';
  return '未生成';
}

function 语音状态类(句) {
  if (语音已就绪(句)) return 'ready';
  return ['stale', 'failed', 'pending'].includes(句.voiceStatus) ? 句.voiceStatus : 'missing';
}

// 输入 effect/condition 对象 → 变成好看的 JSON 文本(空值给空串) → 吐出字符串
function 转JSON文本(值) {
  return 值 == null ? '' : JSON.stringify(值, null, 2);
}

// 输入(整套 props) → 拼出 creator-editor-overlay + creator-editor-dialog → 吐出 JSX
export default function 节点编辑弹窗({
  节点,
  全部节点,
  绑定资产,
  忙碌,
  保存中,
  有未保存修改,
  健康状态,
  on改节点,
  on改对白,
  on加对白,
  on删对白,
  on改单句音色,
  on改选择,
  on改选择JSON, // (下标, "effect"|"condition", 文本) → 校验通过写回并返回 true；失败 alert 并返回 false
  on加选择,
  on删选择,
  on保存,
  on删除节点,
  on关闭,
  占位提示, // (功能名) → 语音/图片生成等未接入功能先冒个系统消息
}) {
  // 语音生成范围的勾选是纯界面状态，第二棒接真生成时再提升到主应用
  const [语音范围, 设语音范围] = useState(语音角色.map((角) => 角.id));
  const 声音模式 = ['voice', 'video', 'mix'].includes(节点.audioPlayback?.mode) ? 节点.audioPlayback.mode : 'default';
  const 对白们 = 节点.lines ?? [];
  const 选择们 = 节点.choices ?? [];

  return (
    <section aria-modal="true" className="creator-editor-overlay" role="dialog">
      <div className="creator-editor-dialog">
        <div className="creator-editor-head">
          <div className="creator-editor-title">
            <span>节点模板编辑</span>
            <strong>{节点.title}</strong>
            <div className="creator-editor-meta">
              <em>{节点.id}</em>
              <em>{节点.chapter}</em>
              <em>{节点.location}</em>
              {绑定资产 && <em>绑定资产 {绑定资产.id}</em>}
            </div>
          </div>
          <button onClick={on关闭} title="关闭" type="button">
            <X size={18} />
          </button>
        </div>
        <div className="creator-editor-body">
          {/* ---- 基础设定 ---- */}
          <section className="creator-editor-section creator-node-basics">
            <div className="creator-editor-section-head">
              <div>
                <strong>基础设定</strong>
                <span>控制当前场景在剧情图、预览和资产队列中的展示。</span>
              </div>
            </div>
            <div className="creator-form-grid">
              <label>
                <span>节点 ID</span>
                <input disabled value={节点.id} />
              </label>
              <label>
                <span>章节</span>
                <input disabled={忙碌} value={节点.chapter ?? ''} onChange={(事件) => on改节点({ chapter: 事件.target.value })} />
              </label>
              <label>
                <span>标题</span>
                <input disabled={忙碌} value={节点.title ?? ''} onChange={(事件) => on改节点({ title: 事件.target.value })} />
              </label>
              <label>
                <span>地点</span>
                <input disabled={忙碌} value={节点.location ?? ''} onChange={(事件) => on改节点({ location: 事件.target.value })} />
              </label>
            </div>
            <label className="creator-field-wide">
              <span>节点简介</span>
              <textarea disabled={忙碌} value={节点.synopsis ?? ''} onChange={(事件) => on改节点({ synopsis: 事件.target.value })} />
            </label>
            <div className="creator-node-audio" role="radiogroup" aria-label="节点声音播放方式">
              <span>节点声音</span>
              {节点声音选项.map((选项) => (
                <button
                  key={选项.id}
                  aria-checked={声音模式 === 选项.id}
                  className={声音模式 === 选项.id ? 'is-active' : ''}
                  disabled={忙碌}
                  onClick={() => on改节点({ audioPlayback: { mode: 选项.id } })}
                  role="radio"
                  title={选项.hint}
                  type="button"
                >
                  <strong>{选项.label}</strong>
                  <small>{选项.hint}</small>
                </button>
              ))}
            </div>
          </section>

          {/* ---- 结局设定：开关只增删 ending 元数据，保留已有 choices，避免切换时破坏路线 ---- */}
          <section className="creator-editor-section creator-ending-settings">
            <div className="creator-editor-section-head">
              <div>
                <strong>结局设定</strong>
                <span>标记结局并编辑播放器结算页文案；现有选择不会被自动清空。</span>
              </div>
              <label className="creator-choice-toggle">
                <input
                  checked={!!节点.ending}
                  disabled={忙碌}
                  onChange={(事件) =>
                    on改节点({
                      ending: 事件.target.checked
                        ? 节点.ending ?? { title: 节点.title || '新的结局', subtitle: '', type: 'growth' }
                        : undefined,
                    })
                  }
                  type="checkbox"
                />
                <span>这是结局节点</span>
              </label>
            </div>
            {节点.ending && (
              <>
                <div className="creator-form-grid">
                  <label>
                    <span>结局标题</span>
                    <input
                      disabled={忙碌}
                      onChange={(事件) => on改节点({ ending: { ...节点.ending, title: 事件.target.value } })}
                      placeholder="新的结局"
                      value={节点.ending.title ?? ''}
                    />
                  </label>
                  <label>
                    <span>结局类型</span>
                    <input
                      disabled={忙碌}
                      onChange={(事件) => on改节点({ ending: { ...节点.ending, type: 事件.target.value } })}
                      placeholder="growth / regret / romance"
                      value={节点.ending.type ?? ''}
                    />
                  </label>
                </div>
                <label className="creator-field-wide">
                  <span>结局副标题</span>
                  <textarea
                    disabled={忙碌}
                    onChange={(事件) => on改节点({ ending: { ...节点.ending, subtitle: 事件.target.value } })}
                    placeholder="描述玩家抵达这个结局后的结果。"
                    value={节点.ending.subtitle ?? ''}
                  />
                </label>
              </>
            )}
          </section>

          {/* ---- 当前节点音色(语音模块骨架，细节由第二棒接管) ---- */}
          <section className="creator-voice-panel">
            <div className="creator-voice-head">
              <div>
                <strong>当前节点音色</strong>
                <span>
                  {节点.title ?? '未选择节点'} · {对白们.filter(语音已就绪).length}/
                  {对白们.length} 已生成 · {健康状态?.ttsConfigured ? 健康状态.ttsModel : 'MiniMax 未配置'}
                </span>
              </div>
              <div>
                <button disabled type="button">
                  <Save size={15} />
                  保存节点音色
                </button>
                <button disabled={忙碌 || !对白们.length} onClick={() => 占位提示('生成当前节点语音')} type="button">
                  <Mic size={15} />
                  生成当前节点语音
                </button>
              </div>
            </div>
            <div className="creator-voice-scope" aria-label="语音生成范围">
              <span>生成范围</span>
              {语音角色.map((角) => (
                <label key={角.id}>
                  <input
                    checked={语音范围.includes(角.id)}
                    disabled={忙碌}
                    onChange={() =>
                      设语音范围((旧) => {
                        const 新 = 旧.includes(角.id) ? 旧.filter((id) => id !== 角.id) : [...旧, 角.id];
                        return 语音角色.map((项) => 项.id).filter((id) => 新.includes(id));
                      })
                    }
                    type="checkbox"
                  />
                  <strong>{角.label}</strong>
                  <small>{角.hint}</small>
                </label>
              ))}
            </div>
            <div className="creator-voice-grid">
              {/* 音色档案由第二棒从 voice-catalog 填充；现在只有诚实的空态 */}
              <p className="creator-voice-empty">当前节点还没有可配置的对白音色。</p>
            </div>
          </section>

          {/* ---- 左：对白列表；右：选择列表 ---- */}
          <div className="creator-editor-columns">
            <div className="creator-edit-list">
              <div className="creator-edit-list-head">
                <div>
                  <strong>对白</strong>
                  <span>{对白们.length} 句对白</span>
                </div>
                <button disabled={忙碌} onClick={on加对白} type="button">
                  <Plus size={15} />
                  添加
                </button>
              </div>
              {对白们.map((句, 下标) => (
                <div className="creator-line-row" key={`${节点.id}-line-${下标}`}>
                  <div className="creator-line-fields">
                    <span className="creator-row-index">{String(下标 + 1).padStart(2, '0')}</span>
                    <input
                      aria-label={`第 ${下标 + 1} 句说话人`}
                      disabled={忙碌}
                      value={句.speaker ?? ''}
                      onChange={(事件) => on改对白(下标, { speaker: 事件.target.value })}
                    />
                    <textarea
                      aria-label={`第 ${下标 + 1} 句对白`}
                      disabled={忙碌}
                      value={句.text ?? ''}
                      onChange={(事件) => on改对白(下标, { text: 事件.target.value })}
                    />
                    <button className="creator-icon-button" disabled={忙碌} onClick={() => on删对白(下标)} title="删除对白" type="button">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="creator-line-voice">
                    <div className="creator-line-voice-copy">
                      <span>音色</span>
                      <strong>{单句音色文案(句)}</strong>
                    </div>
                    <div className="creator-line-voice-select">
                      <select
                        aria-label={`第 ${下标 + 1} 句音色`}
                        disabled={忙碌}
                        value={音色下拉值(句)}
                        onChange={(事件) => {
                          const 值 = 事件.target.value;
                          if (值 === '__inherit__') on改单句音色(下标, 'inherit');
                          else if (值 === '__custom__') on改单句音色(下标, 'custom', (句.voiceId ?? '').trim());
                          else on改单句音色(下标, 'catalog', 值);
                        }}
                      >
                        <option value="__inherit__">继承：未匹配音色</option>
                        {/* 音色目录选项由第二棒接 voice-catalog 后插入这里 */}
                        <option value="__custom__">自定义 voice_id</option>
                      </select>
                      {单句音色模式(句) === 'custom' && (
                        <input
                          aria-label={`第 ${下标 + 1} 句自定义音色 ID`}
                          disabled={忙碌}
                          onChange={(事件) => on改单句音色(下标, 'custom', 事件.target.value)}
                          placeholder="MiniMax 自定义 voice_id"
                          value={句.voiceId ?? ''}
                        />
                      )}
                    </div>
                    <em className={`voice-status status-${语音状态类(句)}`}>{语音状态文案(句)}</em>
                    <button className="creator-inline-action" disabled={忙碌} onClick={() => 占位提示('生成当前句语音')} type="button">
                      <Mic size={14} />
                      生成当前句语音
                    </button>
                    {句.voiceSrc && <audio controls src={句.voiceSrc} />}
                  </div>
                </div>
              ))}
            </div>
            <div className="creator-edit-list">
              <div className="creator-edit-list-head">
                <div>
                  <strong>选择与反馈</strong>
                  <span>{选择们.length} 条分支</span>
                </div>
                <button disabled={忙碌} onClick={on加选择} type="button">
                  <Plus size={15} />
                  添加
                </button>
              </div>
              {选择们.map((选择, 下标) => (
                <div className="creator-choice-row" key={`${节点.id}-choice-${下标}`}>
                  <div className="creator-choice-fields">
                    <span className="creator-row-index">{String(下标 + 1).padStart(2, '0')}</span>
                    <input
                      aria-label={`第 ${下标 + 1} 个选择`}
                      disabled={忙碌}
                      value={选择.label ?? ''}
                      onChange={(事件) => on改选择(下标, { label: 事件.target.value })}
                    />
                    <input
                      aria-label={`第 ${下标 + 1} 个选择反馈`}
                      disabled={忙碌}
                      placeholder="选择反馈"
                      value={选择.caption ?? ''}
                      onChange={(事件) => on改选择(下标, { caption: 事件.target.value })}
                    />
                    <select
                      aria-label={`第 ${下标 + 1} 个选择目标节点`}
                      disabled={忙碌}
                      value={选择.next ?? ''}
                      onChange={(事件) => on改选择(下标, { next: 事件.target.value })}
                    >
                      {全部节点.map((目标) => (
                        <option key={目标.id} value={目标.id}>
                          {目标.title}
                        </option>
                      ))}
                    </select>
                    <button className="creator-icon-button" disabled={忙碌} onClick={() => on删选择(下标)} title="删除选择" type="button">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="creator-choice-mechanics">
                    <label>
                      <span>命运类型</span>
                      <select disabled={忙碌} value={选择.fateType ?? 'river'} onChange={(事件) => on改选择(下标, { fateType: 事件.target.value })}>
                        <option value="river">命运长河</option>
                        <option value="web">因果之网</option>
                        <option value="wheel">循环之轮</option>
                      </select>
                    </label>
                    <label>
                      <span>结局回放</span>
                      <input
                        disabled={忙碌}
                        placeholder="这次选择未来会如何被解释"
                        value={选择.consequence ?? ''}
                        onChange={(事件) => on改选择(下标, { consequence: 事件.target.value })}
                      />
                    </label>
                    <label>
                      <span>锁定提示</span>
                      <input
                        disabled={忙碌}
                        placeholder="未满足条件时给玩家的非剧透提示"
                        value={选择.lockedHint ?? ''}
                        onChange={(事件) => on改选择(下标, { lockedHint: 事件.target.value })}
                      />
                    </label>
                    <label className="creator-choice-toggle">
                      <input checked={!!选择.major} disabled={忙碌} onChange={(事件) => on改选择(下标, { major: 事件.target.checked })} type="checkbox" />
                      <span>关键选择</span>
                    </label>
                    {/* JSON 框用 defaultValue + key 的组合拳：平时随便打字不打扰，失焦(onBlur)才校验；
                        校验失败要把文本弹回上次的合法值，靠换 key 强制重挂 textarea 实现 */}
                    <label className="creator-mechanic-json">
                      <span>Effect JSON</span>
                      <textarea
                        key={`${选择.id}-effect-${JSON.stringify(选择.effect ?? null)}`}
                        defaultValue={转JSON文本(选择.effect)}
                        disabled={忙碌}
                        onBlur={(事件) => {
                          if (!on改选择JSON(下标, 'effect', 事件.currentTarget.value)) {
                            事件.currentTarget.value = 转JSON文本(选择.effect);
                          }
                        }}
                        placeholder='{"globals":{"integrity":8},"flags":["found_truth"]}'
                      />
                    </label>
                    <label className="creator-mechanic-json">
                      <span>Condition JSON</span>
                      <textarea
                        key={`${选择.id}-condition-${JSON.stringify(选择.condition ?? null)}`}
                        defaultValue={转JSON文本(选择.condition)}
                        disabled={忙碌}
                        onBlur={(事件) => {
                          if (!on改选择JSON(下标, 'condition', 事件.currentTarget.value)) {
                            事件.currentTarget.value = 转JSON文本(选择.condition);
                          }
                        }}
                        placeholder='{"flags":["found_truth"],"minGlobal":[{"key":"integrity","value":50}]}'
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* ---- 底部动作条：保存 / 绑定资产 / 删除与关闭 ---- */}
        <div className="creator-editor-actions">
          <div className="creator-action-group creator-save-group">
            <span className={有未保存修改 ? 'creator-save-state is-dirty' : 'creator-save-state'}>
              {有未保存修改 ? '有未保存修改' : '已保存'}
            </span>
            <button className="creator-action-primary" disabled={!有未保存修改 || 忙碌} onClick={on保存} type="button">
              {保存中 ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              {有未保存修改 ? '保存修改' : '已保存'}
            </button>
          </div>
          {绑定资产 && (
            <div className="creator-action-group creator-asset-group">
              <span className="creator-bound-asset-label">
                绑定资产 <b>{绑定资产.id}</b>
              </span>
              <button disabled={忙碌} onClick={() => 占位提示('生成图片')} title="生成绑定资产图片" type="button">
                <Image size={16} />
                生成图片
              </button>
              <button disabled={忙碌} onClick={() => 占位提示('局部重绘')} title="局部重绘绑定资产" type="button">
                <ImagePlus size={16} />
                局部重绘
              </button>
              <label className="creator-upload-button creator-icon-button is-disabled" title="上传绑定资产图片">
                <Upload size={16} />
                <input accept="image/*" disabled type="file" />
              </label>
            </div>
          )}
          <div className="creator-action-group creator-close-group">
            <button className="creator-action-danger" disabled={全部节点.length <= 1 || 忙碌} onClick={on删除节点} type="button">
              <Trash2 size={16} />
              删除当前节点
            </button>
            <button onClick={on关闭} type="button">
              关闭
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
