import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  HeartHandshake,
  Network,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  构建创作角色列表,
  构建叙事关系图,
  计算创作资产完成度,
  校验创作资产,
  情绪强度文案,
} from './创作资产模型.js';
import '../../样式/创作台-女性向.css';

const 关系类型 = [
  ['potential-romance', '可发展关系'],
  ['ally', '同盟'],
  ['professional', '职业搭档'],
  ['rival', '对手'],
  ['mentor', '导师 / 同行'],
  ['family', '家人'],
  ['antagonistic', '冲突关系'],
];

const 资产类型 = [
  ['portrait-reference', '标准立绘'],
  ['expression-sheet', '表情参考'],
  ['wardrobe-reference', '服装参考'],
  ['voice-reference', '声线参考'],
  ['prop-reference', '道具参考'],
  ['location-reference', '场景参考'],
];

const 规则范围选项 = [
  ['story', '整部故事'],
  ['character', '角色'],
  ['node', '剧情节点'],
  ['relationship', '关系边'],
  ['asset', '一致性资产'],
];

const 内置规则id = new Set([
  'player-agency',
  'explicit-consent-boundary',
  'non-romance-equivalence',
  'female-alliance-correction',
]);

const 可清理孤儿代码 = new Set([
  'character-bible-orphan',
  'relationship-from-orphan',
  'relationship-to-orphan',
  'relationship-self-edge',
  'emotion-node-orphan',
  'consistency-asset-character-orphan',
  'consistency-asset-node-orphan',
]);

const 快速步骤 = [
  { id: 'bible', title: '角色圣经', copy: '先确定每个人想要什么、害怕什么，以及不可被越过的边界。', icon: BookOpen },
  { id: 'relationship', title: '关系设计', copy: '把恋爱、同盟、竞争和职业关系放在同一张叙事图里。', icon: HeartHandshake },
  { id: 'emotion', title: '章节节奏', copy: '用压力、联结与主导感校准节点节奏，不替代真实分支。', icon: Activity },
  { id: 'consistency', title: '一致性资产', copy: '管理视觉与声线参考，区分自动结构检查和人工内容审核。', icon: ShieldCheck },
];

function 取运行角色(项目, 角色id) {
  if (角色id === 'you') return 项目?.story?.cast?.protagonist ?? null;
  return (项目?.story?.cast?.characters ?? []).find((角色) => 角色?.id === 角色id) ?? null;
}

function 角色名称(项目, 角色id) {
  return 取运行角色(项目, 角色id)?.name || 角色id || '未声明角色';
}

function 取圣经(项目, 角色id) {
  return (项目?.authoring?.characterBibles ?? []).find((条) => 条?.characterId === 角色id) ?? null;
}

function 取情绪点(项目, 节点id) {
  return (项目?.authoring?.emotionPoints ?? []).find((条) => 条?.nodeId === 节点id) ?? null;
}

function 规范资源引用值(值) {
  return typeof 值 === 'string' ? 值.trim() : '';
}

function 是安全本机路径(值) {
  const 路径 = 规范资源引用值(值);
  return /^\/(?!\/)/u.test(路径) && !/[\u0000-\u001f]/u.test(路径);
}

function 是运行态立绘引用(项目, 资产) {
  if (资产?.kind !== 'portrait-reference') return false;
  const 资产路径 = 规范资源引用值(资产.sourcePath);
  if (!资产路径) return false;
  const cast = 项目?.story?.cast ?? {};
  const 角色们 = [cast.protagonist, ...(Array.isArray(cast.characters) ? cast.characters : [])].filter(Boolean);
  return 角色们.some((角色) => 规范资源引用值(角色.portrait) === 资产路径);
}

function 进度数字(值) {
  if (typeof 值 === 'number') return `${Math.round(值)}%`;
  if (值 && typeof 值 === 'object') return `${值.completed ?? 值.reviewed ?? 0}/${值.total ?? 0}`;
  return '待补充';
}

function 状态徽章({ 已确认, children }) {
  return (
    <span className={已确认 ? 'women-status-chip is-reviewed' : 'women-status-chip'}>
      {已确认 ? <CheckCircle2 size={13} /> : <Circle size={13} />}
      {children ?? (已确认 ? '已人工确认' : '待人工确认')}
    </span>
  );
}

function 空状态({ icon, title, copy, action }) {
  return (
    <div className="women-empty-state">
      {icon}
      <strong>{title}</strong>
      <p>{copy}</p>
      {action}
    </div>
  );
}

export function 角色圣经面板({ 项目, on更新, compact = false }) {
  const 角色们 = useMemo(() => 构建创作角色列表(项目), [项目]);
  const [选中角色id, 设选中角色id] = useState(() => 角色们[0]?.id ?? 'you');
  const 有效选中id = 角色们.some((角色) => 角色.id === 选中角色id) ? 选中角色id : 角色们[0]?.id ?? '';
  const 角色 = 取运行角色(项目, 有效选中id);
  const 圣经 = 取圣经(项目, 有效选中id);

  function 改运行字段(字段, 值) {
    on更新((草稿) => {
      const 目标 = 取运行角色(草稿, 有效选中id);
      if (!目标) return;
      目标[字段] = 值;
      const 圣经资料 = 取圣经(草稿, 有效选中id);
      if (圣经资料) 圣经资料.reviewed = false;
      for (const 边 of 草稿.authoring?.relationshipEdges ?? []) {
        if (边.from === 有效选中id || 边.to === 有效选中id) 边.reviewed = false;
      }
      for (const 资产 of 草稿.authoring?.consistencyAssets ?? []) {
        if (资产.characterIds?.includes(有效选中id)) 资产.reviewed = false;
      }
      if (字段 === 'portrait' || 字段 === 'voiceId') {
        const 类型 = 字段 === 'portrait' ? 'portrait-reference' : 'voice-reference';
        const 资产id = `${字段 === 'portrait' ? 'portrait' : 'voice'}-${有效选中id}`;
        草稿.authoring.consistencyAssets ??= [];
        let 参考 = 草稿.authoring.consistencyAssets.find((资产) => 资产.id === 资产id);
        if (!参考) {
          参考 = { id: 资产id, kind: 类型, title: `${目标.name || 有效选中id}${字段 === 'portrait' ? '基准立绘' : '基准声线'}`, status: 'reference', characterIds: [有效选中id], nodeIds: [], sourcePath: '', notes: '', reviewed: false };
          草稿.authoring.consistencyAssets.push(参考);
        }
        参考.kind = 类型;
        参考.sourcePath = 值;
        参考.reviewed = false;
      }
    });
  }

  function 改圣经字段(字段, 值) {
    on更新((草稿) => {
      const 目标 = 取圣经(草稿, 有效选中id);
      if (!目标) return;
      目标[字段] = 值;
      if (字段 !== 'reviewed') 目标.reviewed = false;
    });
  }

  function 新增角色() {
    const 已有 = new Set((项目?.story?.cast?.characters ?? []).map((条) => 条.id));
    let 序号 = 1;
    while (已有.has(`character_${序号}`)) 序号 += 1;
    const id = `character_${序号}`;
    设选中角色id(id);
    on更新((草稿) => {
      草稿.story.cast ??= {
        protagonist: { id: 'you', name: '你', role: '故事主角', pronouns: '她' },
        characters: [],
      };
      草稿.story.cast.characters ??= [];
      草稿.story.cast.characters.push({
        id,
        name: `新角色 ${序号}`,
        role: '待设定身份',
        theme: '待设定关系主题',
        romanceable: false,
        relationship: { enabled: false, initial: { spark: 0, trust: 30, boundary: 70 } },
      });
    });
  }

  if (!项目?.story) {
    return <空状态 icon={<BookOpen size={24} />} title="还没有可编辑项目" copy="先创建或打开一个项目，再建立角色圣经。" />;
  }

  return (
    <section className={compact ? 'women-bible-layout is-compact' : 'women-bible-layout'} aria-label="角色圣经">
      <aside className="women-character-list">
        <div className="women-section-heading">
          <div>
            <span>CAST BIBLE</span>
            <strong>角色阵容</strong>
          </div>
          <button aria-label="新增角色" onClick={新增角色} title="新增角色" type="button">
            <Plus size={15} />
          </button>
        </div>
        <div className="women-character-scroll">
          {角色们.map((条) => {
            const 资料 = 取圣经(项目, 条.id);
            return (
              <button
                className={有效选中id === 条.id ? 'women-character-card is-active' : 'women-character-card'}
                key={条.id}
                onClick={() => 设选中角色id(条.id)}
                type="button"
              >
                <span className="women-character-avatar" style={{ '--avatar-color': 条.color || '#d8afbf' }}>
                  {条.portrait ? <img alt="" src={条.portrait} /> : <UserRound size={18} />}
                </span>
                <span>
                  <strong>{条.name || 条.id}</strong>
                  <small>{条.id === 'you' ? '玩家主角' : 条.role || '待设定身份'}</small>
                </span>
                {资料?.reviewed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </button>
            );
          })}
        </div>
        <button className="women-add-text-button" onClick={新增角色} type="button">
          <Plus size={15} /> 新增角色
        </button>
      </aside>

      {角色 && 圣经 ? (
        <div className="women-bible-editor">
          <div className="women-editor-title">
            <div>
              <span>{有效选中id === 'you' ? '玩家主体' : '叙事角色'} · ID 创建后锁定</span>
              <h3>{角色.name || 有效选中id}</h3>
            </div>
            <状态徽章 已确认={圣经.reviewed} />
          </div>
          <div className="women-form-grid">
            <label>
              <span>姓名</span>
              <input maxLength={40} onChange={(事件) => 改运行字段('name', 事件.target.value)} value={角色.name ?? ''} />
            </label>
            <label>
              <span>身份 / 职责</span>
              <input maxLength={80} onChange={(事件) => 改运行字段('role', 事件.target.value)} value={角色.role ?? ''} />
            </label>
            <label className="is-wide">
              <span>关系主题</span>
              <input
                maxLength={100}
                onChange={(事件) => 改运行字段('theme', 事件.target.value)}
                placeholder="例如：控制与托付、证据与姐妹同盟"
                value={角色.theme ?? ''}
              />
            </label>
            <label>
              <span>基准立绘路径</span>
              <input maxLength={500} onChange={(事件) => 改运行字段('portrait', 事件.target.value)} placeholder="填写站内角色立绘路径" value={角色.portrait ?? ''} />
            </label>
            <label>
              <span>运行态 voiceId</span>
              <input maxLength={160} onChange={(事件) => 改运行字段('voiceId', 事件.target.value)} placeholder="未配置可留空" value={角色.voiceId ?? ''} />
            </label>
            <label className="is-wide">
              <span>角色主动目标</span>
              <textarea
                maxLength={300}
                onChange={(事件) => 改圣经字段('desire', 事件.target.value)}
                placeholder="她/他在没有玩家介入时，也会主动推进什么？"
                value={圣经.desire ?? ''}
              />
            </label>
            <label>
              <span>核心恐惧</span>
              <textarea maxLength={240} onChange={(事件) => 改圣经字段('fear', 事件.target.value)} value={圣经.fear ?? ''} />
            </label>
            <label>
              <span>不可越过的边界</span>
              <textarea
                maxLength={300}
                onChange={(事件) => 改圣经字段('boundary', 事件.target.value)}
                placeholder="把同意、拒绝和私人信息边界写清楚"
                value={圣经.boundary ?? ''}
              />
            </label>
            <label>
              <span>成长弧</span>
              <textarea maxLength={300} onChange={(事件) => 改圣经字段('growth', 事件.target.value)} value={圣经.growth ?? ''} />
            </label>
            <label>
              <span>语言与声线</span>
              <textarea
                maxLength={300}
                onChange={(事件) => 改圣经字段('voice', 事件.target.value)}
                placeholder="句式、词汇、语速，以及绝不会说的话"
                value={圣经.voice ?? ''}
              />
            </label>
          </div>
          <label className="women-review-check">
            <input
              checked={!!圣经.reviewed}
              onChange={(事件) => 改圣经字段('reviewed', 事件.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>我已人工确认这份角色圣经</strong>
              <small>勾选只代表作者复核，不代表 AI 自动判断内容正确。</small>
            </span>
          </label>
        </div>
      ) : (
        <空状态 icon={<UserRound size={24} />} title="阵容尚未建立" copy="新增角色后即可填写角色目标、成长和边界。" />
      )}
    </section>
  );
}

export function 关系图面板({ 项目, on更新, compact = false }) {
  const 图 = useMemo(() => 构建叙事关系图(项目), [项目]);
  const 主角 = 图.nodes?.find((节点) => 节点.id === 'you');

  function 改边(edgeId, 字段, 值) {
    on更新((草稿) => {
      const 边 = (草稿.authoring?.relationshipEdges ?? []).find((条) => 条.id === edgeId);
      if (!边) return;
      边[字段] = 值;
      if (字段 !== 'reviewed') 边.reviewed = false;
      if (字段 === 'type') {
        const 是主角关系 = 边.from === 'you' || 边.to === 'you';
        const 对方id = 是主角关系 ? (边.from === 'you' ? 边.to : 边.from) : '';
        const 角色 = 取运行角色(草稿, 对方id);
        if (角色 && 对方id !== 'you') {
          if (值 !== 'potential-romance') {
            角色.romanceable = false;
          } else {
            // 已显式启用过三维关系时保持同步；未启用的角色不会因一次下拉选择自动进入可发展状态。
            角色.romanceable = 角色.relationship?.enabled === true;
          }
        }
      }
    });
  }

  function 改初值(角色id, 维度, 值) {
    on更新((草稿) => {
      const 角色 = 取运行角色(草稿, 角色id);
      if (!角色 || 角色id === 'you') return;
      角色.relationship ??= { enabled: true, initial: {} };
      角色.relationship.initial ??= {};
      角色.relationship.initial[维度] = Math.max(0, Math.min(100, Number(值) || 0));
      for (const 边 of 草稿.authoring?.relationshipEdges ?? []) {
        if (边.from === 角色id || 边.to === 角色id) 边.reviewed = false;
      }
    });
  }

  function 改关系启用(角色id, 启用, 边类型) {
    on更新((草稿) => {
      const 角色 = 取运行角色(草稿, 角色id);
      if (!角色 || 角色id === 'you') return;
      角色.relationship ??= { enabled: false, initial: { spark: 0, trust: 30, boundary: 70 } };
      角色.relationship.enabled = 启用;
      角色.relationship.initial ??= { spark: 0, trust: 30, boundary: 70 };
      角色.romanceable = 边类型 === 'potential-romance' ? 启用 : false;
      for (const 边 of 草稿.authoring?.relationshipEdges ?? []) {
        if (边.from === 角色id || 边.to === 角色id) 边.reviewed = false;
      }
    });
  }

  if (!图.nodes?.length) {
    return <空状态 icon={<Network size={24} />} title="还没有关系节点" copy="先在角色圣经中建立角色，关系图会以玩家主角为中心生成待确认关系。" />;
  }

  return (
    <section className={compact ? 'women-relationship-layout is-compact' : 'women-relationship-layout'} aria-label="关系设计">
      <div className="women-relationship-map" aria-label={`关系图，共 ${图.nodes.length} 个角色、${图.edges.length} 条关系`} role="region">
        <div className="women-map-copy">
          <span>RELATIONSHIP MAP</span>
          <strong>所有关系都要有边界，也要保留人物自己的目标</strong>
          <p>可攻略并不等于恋爱已经成立；非恋爱同盟、女性伙伴与职业对手也必须留在叙事关系图中。</p>
        </div>
        <div className="women-map-stage">
          {主角 && (
            <div className="women-map-protagonist">
              <UserRound size={20} />
              <strong>{主角.name}</strong>
              <small>玩家主角</small>
            </div>
          )}
          <div className="women-map-orbit">
            {图.nodes.filter((节点) => 节点.id !== 'you').map((节点) => (
              <div className="women-map-node" key={节点.id}>
                <span style={{ '--node-color': 节点.color || '#c9a6b8' }}>{节点.portrait ? <img alt="" src={节点.portrait} /> : <UsersRound size={17} />}</span>
                <strong>{节点.name}</strong>
                <small>{节点.relationshipEnabled ? '三维关系启用' : '叙事关系'}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="women-edge-list">
        <div className="women-section-heading">
          <div>
            <span>ACCESSIBLE EDGE LIST</span>
            <strong>关系边清单</strong>
          </div>
          <em>{图.edges.length} 条</em>
        </div>
        {图.edges.map((边) => {
          const 是主角关系 = 边.from === 'you' || 边.to === 'you';
          const 对方id = 是主角关系 ? (边.from === 'you' ? 边.to : 边.from) : '';
          const 对方 = 对方id ? 取运行角色(项目, 对方id) : null;
          const 初值 = 对方?.relationship?.initial ?? {};
          return (
            <details className="women-edge-card" key={边.id}>
              <summary>
                <span className="women-edge-line" />
                <div>
                  <strong>{角色名称(项目, 边.from)} × {角色名称(项目, 边.to)}</strong>
                  <small>{关系类型.find(([id]) => id === 边.type)?.[1] ?? 边.type}</small>
                </div>
                <状态徽章 已确认={边.reviewed} />
              </summary>
              <div className="women-edge-editor">
                <label>
                  <span>关系类型</span>
                  <select onChange={(事件) => 改边(边.id, 'type', 事件.target.value)} value={边.type ?? 'professional'}>
                    {关系类型.map(([值, 文案]) => <option key={值} value={值}>{文案}</option>)}
                  </select>
                </label>
                <label>
                  <span>关系主题</span>
                  <input maxLength={100} onChange={(事件) => 改边(边.id, 'label', 事件.target.value)} value={边.label ?? ''} />
                </label>
                <label className="is-wide">
                  <span>双向动力</span>
                  <textarea
                    maxLength={300}
                    onChange={(事件) => 改边(边.id, 'dynamic', 事件.target.value)}
                    placeholder="双方分别想从这段关系中得到什么？冲突从哪里来？"
                    value={边.dynamic ?? ''}
                  />
                </label>
                <label className="is-wide">
                  <span>关系边界</span>
                  <textarea maxLength={300} onChange={(事件) => 改边(边.id, 'boundary', 事件.target.value)} value={边.boundary ?? ''} />
                </label>
                {是主角关系 ? (
                  <>
                    <label className="women-inline-check is-wide">
                      <input
                        checked={!!对方?.relationship?.enabled}
                        disabled={!对方}
                        onChange={(事件) => 改关系启用(对方id, 事件.target.checked, 边.type)}
                        type="checkbox"
                      />
                      启用玩家三维关系；“可发展关系”勾选后才会进入心动 / 信任 / 边界运行状态
                    </label>
                    {对方?.relationship?.enabled ? (
                      <div className="women-metric-editor is-wide" aria-label={`${对方.name} 初始关系值`}>
                        {[
                          ['spark', '心动'],
                          ['trust', '信任'],
                          ['boundary', '边界'],
                        ].map(([维度, 文案]) => (
                          <label key={维度}>
                            <span>{文案}</span>
                            <input max={100} min={0} onChange={(事件) => 改初值(对方id, 维度, 事件.target.value)} type="number" value={初值[维度] ?? 0} />
                          </label>
                        ))}
                        <p>运行态只使用心动 / 信任 / 边界三维，不新增单值“好感度”。</p>
                      </div>
                    ) : (
                      <p className="women-numeric-note is-wide">这是叙事关系，不写入恋爱数值；仍可拥有同盟、权力冲突和独立成长。</p>
                    )}
                  </>
                ) : (
                  <p className="women-numeric-note is-wide">这条关系连接两名非玩家角色，只记录叙事动力与边界，不应改写任何角色相对玩家的运行数值。</p>
                )}
                <label className="women-inline-check is-wide">
                  <input checked={!!边.reviewed} onChange={(事件) => 改边(边.id, 'reviewed', 事件.target.checked)} type="checkbox" />
                  已人工确认关系动力与边界
                </label>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function 曲线折线(点们, 字段, 宽 = 720, 高 = 160) {
  if (!点们.length) return '';
  return 点们.map((点, 序) => {
    if (typeof 点[字段] !== 'number' || !Number.isFinite(点[字段])) return '';
    const x = 点们.length === 1 ? 宽 / 2 : 20 + (序 / (点们.length - 1)) * (宽 - 40);
    const 数值 = 点[字段];
    const y = 15 + ((100 - 数值) / 100) * (高 - 30);
    return `${x},${y}`;
  }).filter(Boolean).join(' ');
}

export function 情绪曲线面板({ 项目, on更新, compact = false }) {
  const 节点们 = Object.values(项目?.story?.nodes ?? {});
  const 点们 = 节点们.map((节点) => ({ node: 节点, point: 取情绪点(项目, 节点.id) })).filter((条) => 条.point);

  function 改点(nodeId, 字段, 值) {
    on更新((草稿) => {
      const 点 = (草稿.authoring?.emotionPoints ?? []).find((条) => 条.nodeId === nodeId);
      if (!点) return;
      点[字段] = ['intensity', 'agency', 'intimacy'].includes(字段)
        ? 值 === '' ? null : Math.max(0, Math.min(100, Number(值) || 0))
        : 值;
      if (字段 !== 'reviewed') 点.reviewed = false;
    });
  }

  if (!节点们.length) {
    return <空状态 icon={<Activity size={24} />} title="还没有可标注节点" copy="先建立剧情节点，再设计章节节奏。" />;
  }

  return (
    <section className={compact ? 'women-emotion-layout is-compact' : 'women-emotion-layout'} aria-label="章节情绪曲线">
      <div className="women-curve-card">
        <div className="women-map-copy">
          <span>EMOTIONAL PACING</span>
          <strong>压力、联结与主导感</strong>
          <p>曲线按编辑顺序展示，不代表玩家只有一条路线。空白点只是待填写草稿，不是 AI 推断。</p>
        </div>
        <div className="women-curve-legend" aria-label="曲线图例">
          <span className="is-tension">压力</span>
          <span className="is-intimacy">联结</span>
          <span className="is-agency">主导感</span>
        </div>
        <svg aria-label={`情绪曲线，共 ${点们.length} 个节点`} className="women-curve-svg" role="img" viewBox="0 0 720 160">
          {[25, 50, 75].map((值) => <line key={值} x1="20" x2="700" y1={15 + ((100 - 值) / 100) * 130} y2={15 + ((100 - 值) / 100) * 130} />)}
          <polyline className="is-tension" points={曲线折线(点们.map((条) => 条.point), 'intensity')} />
          <polyline className="is-intimacy" points={曲线折线(点们.map((条) => 条.point), 'intimacy')} />
          <polyline className="is-agency" points={曲线折线(点们.map((条) => 条.point), 'agency')} />
        </svg>
      </div>
      <div className="women-emotion-table-wrap">
        <table className="women-emotion-table">
          <thead>
            <tr><th>节点</th><th>压力</th><th>联结</th><th>主导感</th><th>情绪词</th><th>审核</th></tr>
          </thead>
          <tbody>
            {点们.map(({ node, point }) => (
              <tr key={node.id}>
                <th><strong>{node.title || node.id}</strong><small>{node.chapter || '未分章'}</small></th>
                {[
                  ['intensity', '压力'],
                  ['intimacy', '联结'],
                  ['agency', '主导感'],
                ].map(([字段, 文案]) => (
                  <td key={字段}>
                    <label><span className="sr-only">{node.title}{文案}</span><input aria-label={`${node.title}${文案}`} max={100} min={0} onChange={(事件) => 改点(node.id, 字段, 事件.target.value)} placeholder="未标注" type="number" value={point[字段] ?? ''} /></label>
                  </td>
                ))}
                <td><span className="women-emotion-word">{情绪强度文案(point.intensity)}</span></td>
                <td>
                  <label className="women-table-check" title="人工确认">
                    <input checked={!!point.reviewed} onChange={(事件) => 改点(node.id, 'reviewed', 事件.target.checked)} type="checkbox" />
                    <span>{point.reviewed ? '已确认' : '待确认'}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="women-emotion-notes">
        {点们.map(({ node, point }) => (
          <label key={node.id}>
            <span>{node.title} · 节奏说明</span>
            <input maxLength={240} onChange={(事件) => 改点(node.id, 'note', 事件.target.value)} placeholder="记录转折原因，不改变玩家状态" value={point.note ?? ''} />
          </label>
        ))}
      </div>
    </section>
  );
}

export function 一致性资产面板({ 项目, on更新, compact = false }) {
  const 报告 = useMemo(() => 校验创作资产(项目), [项目]);
  const 资产们 = 项目?.authoring?.consistencyAssets ?? [];
  const 规则们 = 项目?.authoring?.consistencyRules ?? [];
  const 角色们 = useMemo(() => 构建创作角色列表(项目), [项目]);
  const 关系们 = useMemo(() => 构建叙事关系图(项目).edges, [项目]);
  const 节点们 = Object.values(项目?.story?.nodes ?? {});

  function 改资产(id, 字段, 值) {
    on更新((草稿) => {
      const 资产 = (草稿.authoring?.consistencyAssets ?? []).find((条) => 条.id === id);
      if (!资产) return;
      资产[字段] = 值;
      if (字段 !== 'reviewed') 资产.reviewed = false;
    });
  }

  function 新增资产() {
    on更新((草稿) => {
      const 表 = 草稿.authoring.consistencyAssets ??= [];
      const 已有 = new Set(表.map((条) => 条.id));
      let 序号 = 1;
      while (已有.has(`reference_${序号}`)) 序号 += 1;
      表.push({
        id: `reference_${序号}`,
        kind: 'wardrobe-reference',
        title: `新参考资产 ${序号}`,
        status: 'draft',
        characterIds: [],
        nodeIds: [],
        sourcePath: '',
        notes: '',
        reviewed: false,
      });
    });
  }

  function 删除资产(id) {
    on更新((草稿) => {
      const 待删 = (草稿.authoring.consistencyAssets ?? []).find((资产) => 资产.id === id);
      if (是运行态立绘引用(草稿, 待删)) return;
      草稿.authoring.consistencyAssets = (草稿.authoring.consistencyAssets ?? []).filter((资产) => 资产.id !== id);
      for (const 规则 of 草稿.authoring.consistencyRules ?? []) {
        if (规则.scope === 'asset' && 规则.targetId === id) {
          规则.enabled = false;
          规则.reviewed = false;
        }
      }
    });
  }

  function 设为运行基准(资产) {
    if (资产.characterIds?.length !== 1) return;
    const 角色id = 资产.characterIds[0];
    if (!角色id || !资产.sourcePath) return;
    if (资产.kind === 'portrait-reference' && !是安全本机路径(资产.sourcePath)) return;
    if (!['portrait-reference', 'voice-reference'].includes(资产.kind)) return;
    on更新((草稿) => {
      const 角色 = 取运行角色(草稿, 角色id);
      if (!角色) return;
      if (资产.kind === 'portrait-reference') 角色.portrait = 资产.sourcePath;
      if (资产.kind === 'voice-reference') 角色.voiceId = 资产.sourcePath;
      const 圣经 = 取圣经(草稿, 角色id);
      if (圣经) 圣经.reviewed = false;
    });
  }

  function 改规则(id, 字段, 值) {
    on更新((草稿) => {
      const 规则 = (草稿.authoring?.consistencyRules ?? []).find((条) => 条.id === id);
      if (!规则) return;
      规则[字段] = 值;
      if (字段 === 'scope') 规则.targetId = '';
      if (字段 !== 'reviewed') 规则.reviewed = false;
    });
  }

  function 新增规则() {
    on更新((草稿) => {
      const 表 = 草稿.authoring.consistencyRules ??= [];
      const 已有 = new Set(表.map((条) => 条.id));
      let 序号 = 1;
      while (已有.has(`custom-rule-${序号}`)) 序号 += 1;
      表.push({
        id: `custom-rule-${序号}`,
        label: `新一致性规则 ${序号}`,
        scope: 'story',
        targetId: '',
        rule: '',
        severity: 'warning',
        enabled: true,
        reviewed: false,
      });
    });
  }

  function 删除规则(id) {
    if (内置规则id.has(id)) return;
    on更新((草稿) => {
      草稿.authoring.consistencyRules = (草稿.authoring.consistencyRules ?? []).filter((规则) => 规则.id !== id);
    });
  }

  function 规则目标列表(规则) {
    if (规则.scope === 'character') return 角色们.map((角色) => [角色.id, 角色.name]);
    if (规则.scope === 'node') return 节点们.map((节点) => [节点.id, 节点.title || 节点.id]);
    if (规则.scope === 'relationship') return 关系们.map((边) => [边.id, `${角色名称(项目, 边.from)} × ${角色名称(项目, 边.to)}`]);
    if (规则.scope === 'asset') return 资产们.map((资产) => [资产.id, 资产.title || 资产.id]);
    return [];
  }

  function 清理孤儿引用() {
    if (typeof window !== 'undefined' && !window.confirm('确定清理所有已失效的角色、节点和关系引用吗？\n\n有效内容不会删除；受影响的参考资产会退回待复核。')) return;
    on更新((草稿) => {
      const 角色id = new Set([
        草稿.story?.cast?.protagonist?.id || 'you',
        ...(草稿.story?.cast?.characters ?? []).map((角色) => 角色?.id).filter(Boolean),
      ]);
      const 节点id = new Set(Object.keys(草稿.story?.nodes ?? {}));
      const 作者 = 草稿.authoring;
      作者.characterBibles = (作者.characterBibles ?? []).filter((圣经) => 角色id.has(圣经.characterId));
      作者.emotionPoints = (作者.emotionPoints ?? []).filter((点) => 节点id.has(点.nodeId));
      const 原关系id = new Set((作者.relationshipEdges ?? []).map((边) => 边.id));
      作者.relationshipEdges = (作者.relationshipEdges ?? []).filter(
        (边) => 角色id.has(边.from) && 角色id.has(边.to) && 边.from !== 边.to,
      );
      const 保留关系id = new Set(作者.relationshipEdges.map((边) => 边.id));
      作者.consistencyAssets = (作者.consistencyAssets ?? []).map((资产) => {
        const characterIds = (资产.characterIds ?? []).filter((id) => 角色id.has(id));
        const nodeIds = (资产.nodeIds ?? []).filter((id) => 节点id.has(id));
        const 有变化 = characterIds.length !== (资产.characterIds ?? []).length || nodeIds.length !== (资产.nodeIds ?? []).length;
        return { ...资产, characterIds, nodeIds, reviewed: 有变化 ? false : 资产.reviewed === true };
      });
      for (const 规则 of 作者.consistencyRules ?? []) {
        if (规则.scope === 'relationship' && 原关系id.has(规则.targetId) && !保留关系id.has(规则.targetId)) {
          规则.enabled = false;
          规则.reviewed = false;
        }
      }
    });
  }

  const 问题们 = 报告.items ?? [
    ...(报告.errors ?? []).map((message) => ({ severity: 'error', message })),
    ...(报告.warnings ?? []).map((message) => ({ severity: 'warning', message })),
  ];
  const 有可清理孤儿 = 问题们.some((问题) => 可清理孤儿代码.has(问题.code));

  return (
    <section className={compact ? 'women-consistency-layout is-compact' : 'women-consistency-layout'} aria-label="一致性资产与检查">
      <div className="women-scan-card">
        <div>
          <span>STRUCTURE CHECK</span>
          <strong>一致性结构检查</strong>
          <p>自动检查只覆盖引用、数值范围和明确禁用字段；角色是否可信、视角是否平等仍需作者人工审核。</p>
        </div>
        <div className="women-scan-counts" aria-live="polite">
          <span className={报告.errors?.length ? 'is-error' : 'is-clear'}><strong>{报告.errors?.length ?? 0}</strong> 阻塞</span>
          <span className={报告.warnings?.length ? 'is-warning' : 'is-clear'}><strong>{报告.warnings?.length ?? 0}</strong> 提醒</span>
        </div>
        {有可清理孤儿 && <button className="women-orphan-cleanup" onClick={清理孤儿引用} type="button">清理失效引用</button>}
        {问题们.length ? (
          <>
          <p className="women-issue-total">共 {问题们.length} 条，列表可滚动查看全部路径。</p>
          <ul className="women-issue-list">
            {问题们.map((问题, 序) => (
              <li className={`is-${问题.severity ?? 'warning'}`} key={`${问题.id ?? 问题.message}-${序}`}>
                {问题.severity === 'error' ? <AlertTriangle size={14} /> : <Circle size={12} />}
                <span><strong>{问题.path || 问题.scope || '创作资产'}</strong>{问题.message}</span>
              </li>
            ))}
          </ul>
          </>
        ) : (
          <div className="women-scan-clear"><CheckCircle2 size={17} /> 当前结构检查没有发现问题；仍请完成内容人工复核。</div>
        )}
      </div>

      <div className="women-assets-card">
        <div className="women-section-heading">
          <div><span>REFERENCE ASSETS</span><strong>一致性参考资产</strong></div>
          <button onClick={新增资产} type="button"><Plus size={14} /> 新增</button>
        </div>
        <p className="women-section-note">这里只保存本机路径或语义引用，不把图片二进制塞进浏览器，也不会调用未接入的生成服务。</p>
        <div className="women-reference-list">
          {资产们.map((资产) => {
            const 单一角色 = 资产.characterIds?.length === 1;
            const 是运行立绘引用 = 是运行态立绘引用(项目, 资产);
            const 立绘路径可绑定 = 资产.kind !== 'portrait-reference' || 是安全本机路径(资产.sourcePath);
            const 可设为运行基准 = 单一角色 && !!资产.sourcePath &&
              ['portrait-reference', 'voice-reference'].includes(资产.kind) && 立绘路径可绑定;
            const 基准按钮说明 = !单一角色
              ? '运行态基准一次只能绑定一个角色；多角色关联仍可用于一致性参考'
              : !立绘路径可绑定
                ? '立绘只能绑定当前站点内的绝对路径'
                : undefined;
            return (
            <details className="women-reference-card" key={资产.id}>
              <summary>
                <span className="women-reference-icon"><Eye size={16} /></span>
                <span><strong>{资产.title || 资产.id}</strong><small>{资产类型.find(([id]) => id === 资产.kind)?.[1] ?? 资产.kind}</small></span>
                <状态徽章 已确认={资产.reviewed} />
              </summary>
              <div className="women-reference-editor">
                {是安全本机路径(资产.sourcePath) && 资产.kind !== 'voice-reference' && (
                  <figure className="women-reference-preview is-wide">
                    <img alt={`${资产.title || 资产.id}预览`} src={资产.sourcePath} />
                    <figcaption>本机参考预览；视觉一致性仍需作者人工判断。</figcaption>
                  </figure>
                )}
                {是安全本机路径(资产.sourcePath) && 资产.kind === 'voice-reference' && (
                  <div className="women-reference-audio is-wide"><audio controls src={资产.sourcePath} /><span>试听只播放现有本机音频，不调用生成服务。</span></div>
                )}
                <label><span>标题</span><input maxLength={100} onChange={(事件) => 改资产(资产.id, 'title', 事件.target.value)} value={资产.title ?? ''} /></label>
                <label><span>类型</span><select onChange={(事件) => 改资产(资产.id, 'kind', 事件.target.value)} value={资产.kind ?? 'portrait-reference'}>{资产类型.map(([值, 文案]) => <option key={值} value={值}>{文案}</option>)}</select></label>
                <label><span>审核状态</span><select onChange={(事件) => 改资产(资产.id, 'status', 事件.target.value)} value={资产.status ?? 'draft'}><option value="reference">来自现有角色数据</option><option value="draft">草稿</option><option value="approved">已批准</option><option value="retired">已停用</option></select></label>
                <label><span>关联角色（可多选）</span><select multiple onChange={(事件) => 改资产(资产.id, 'characterIds', [...事件.target.selectedOptions].map((选项) => 选项.value))} value={资产.characterIds ?? []}>{角色们.map((角色) => <option key={角色.id} value={角色.id}>{角色.name}</option>)}</select></label>
                <label className="is-wide"><span>本机路径 / 已有资源引用</span><input maxLength={500} onChange={(事件) => 改资产(资产.id, 'sourcePath', 事件.target.value)} placeholder="填写站内资源路径或 voiceId；不接受危险 URL" value={资产.sourcePath ?? ''} /></label>
                <label className="is-wide"><span>关联节点（可多选）</span><select multiple onChange={(事件) => 改资产(资产.id, 'nodeIds', [...事件.target.selectedOptions].map((选项) => 选项.value))} value={资产.nodeIds ?? []}>{节点们.map((节点) => <option key={节点.id} value={节点.id}>{节点.title || 节点.id}</option>)}</select></label>
                <label className="is-wide"><span>一致性说明</span><textarea maxLength={400} onChange={(事件) => 改资产(资产.id, 'notes', 事件.target.value)} value={资产.notes ?? ''} /></label>
                <label className="women-inline-check is-wide"><input checked={!!资产.reviewed} onChange={(事件) => 改资产(资产.id, 'reviewed', 事件.target.checked)} type="checkbox" />已人工核对形象 / 声线与角色圣经一致</label>
                <div className="women-reference-actions is-wide">
                  <button
                    disabled={!可设为运行基准}
                    onClick={() => 设为运行基准(资产)}
                    title={基准按钮说明}
                    type="button"
                  >设为运行态基准</button>
                  <button
                    className="is-danger"
                    disabled={是运行立绘引用}
                    onClick={() => 删除资产(资产.id)}
                    title={是运行立绘引用 ? '该参考由 story.cast 当前立绘生成；请先在角色圣经中更换或清空基准立绘' : '删除这份参考'}
                    type="button"
                  >删除参考</button>
                </div>
              </div>
            </details>
            );
          })}
        </div>
      </div>

      <div className="women-rules-card">
        <div className="women-section-heading">
          <div><span>AUTHOR RULES</span><strong>人工一致性规则</strong></div>
          <button onClick={新增规则} type="button"><Plus size={14} /> 新增规则</button>
        </div>
        <p className="women-section-note">共 {规则们.length} 条。角色、节点、关系或资产范围必须选择明确目标；阻塞级规则不会被静默降为提醒。</p>
        {规则们.map((规则) => {
          const 目标们 = 规则目标列表(规则);
          const 当前目标有效 = 目标们.some(([id]) => id === 规则.targetId);
          return (
            <div className="women-rule-row" key={规则.id}>
              <input aria-label={`${规则.label || 规则.id}启用状态`} checked={规则.enabled !== false} onChange={(事件) => 改规则(规则.id, 'enabled', 事件.target.checked)} type="checkbox" />
              <div className="women-rule-main">
                <div className="women-rule-fields">
                  <label><span>标题</span><input maxLength={100} onChange={(事件) => 改规则(规则.id, 'label', 事件.target.value)} value={规则.label ?? ''} /></label>
                  <label><span>范围</span><select onChange={(事件) => 改规则(规则.id, 'scope', 事件.target.value)} value={规则.scope ?? 'story'}>{规则范围选项.map(([值, 文案]) => <option key={值} value={值}>{文案}</option>)}</select></label>
                  <label>
                    <span>目标</span>
                    <select disabled={规则.scope === 'story'} onChange={(事件) => 改规则(规则.id, 'targetId', 事件.target.value)} value={规则.scope === 'story' ? '' : (规则.targetId ?? '')}>
                      <option value="">{规则.scope === 'story' ? '整部故事' : '请选择明确目标'}</option>
                      {规则.targetId && !当前目标有效 && <option value={规则.targetId}>无效目标 · {规则.targetId}</option>}
                      {目标们.map(([id, 文案]) => <option key={id} value={id}>{文案}</option>)}
                    </select>
                  </label>
                  <label><span>级别</span><select onChange={(事件) => 改规则(规则.id, 'severity', 事件.target.value)} value={规则.severity ?? 'warning'}><option value="error">阻塞发布</option><option value="warning">提醒复核</option></select></label>
                </div>
                <label className="women-rule-copy"><span>规则内容</span><textarea aria-label={`${规则.label || 规则.id}规则内容`} maxLength={400} onChange={(事件) => 改规则(规则.id, 'rule', 事件.target.value)} value={规则.rule ?? ''} /></label>
                <small>稳定 ID：{规则.id}</small>
              </div>
              <div className="women-rule-actions">
                <label className="women-rule-reviewed"><input checked={!!规则.reviewed} onChange={(事件) => 改规则(规则.id, 'reviewed', 事件.target.checked)} type="checkbox" />已复核</label>
                {!内置规则id.has(规则.id) && <button className="is-danger" onClick={() => 删除规则(规则.id)} type="button">删除</button>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function 快速创作面板({
  项目,
  忙碌,
  有未保存修改,
  on更新,
  on保存,
  on校验,
  on预览,
  on进入专业模式,
}) {
  const [步骤, 设步骤] = useState('bible');
  const 当前序号 = Math.max(0, 快速步骤.findIndex((条) => 条.id === 步骤));
  const 完成度 = useMemo(() => 计算创作资产完成度(项目), [项目]);
  const 总完成度 = Math.round(Number(完成度?.percentage ?? 完成度?.percent ?? 完成度?.overall ?? 0));
  const 分步完成度 = {
    bible: 完成度?.sections?.characterBibles,
    relationship: 完成度?.sections?.relationshipEdges,
    emotion: 完成度?.sections?.emotionPoints,
    consistency: {
      total: (完成度?.sections?.consistencyAssets?.total ?? 0) + (完成度?.sections?.consistencyRules?.total ?? 0),
      completed: (完成度?.sections?.consistencyAssets?.completed ?? 0) + (完成度?.sections?.consistencyRules?.completed ?? 0),
    },
  };

  const 面板 = 步骤 === 'relationship'
    ? <关系图面板 项目={项目} on更新={on更新} compact />
    : 步骤 === 'emotion'
      ? <情绪曲线面板 项目={项目} on更新={on更新} compact />
      : 步骤 === 'consistency'
        ? <一致性资产面板 项目={项目} on更新={on更新} compact />
        : <角色圣经面板 项目={项目} on更新={on更新} />;

  return (
    <section className="quick-creator-shell">
      <header className="quick-creator-hero">
        <div>
          <span><Sparkles size={14} /> WOMEN-CENTERED STORY DESIGN</span>
          <h1>先把人写清楚，再让关系发生</h1>
          <p>以角色主体性、双向边界和情绪节奏组织创作；所有内容保存在当前浏览器，未接入的 AI 不会假装工作。</p>
        </div>
        <div className="quick-progress-card" aria-label={`创作资产完成度 ${总完成度}%`}>
          <strong>{总完成度}%</strong>
          <span>人工确认进度</span>
          <i><b style={{ width: `${Math.max(0, Math.min(100, 总完成度))}%` }} /></i>
          <small>{有未保存修改 ? '有未保存修改' : '当前修改已保存'}</small>
        </div>
      </header>

      <nav className="quick-step-nav" aria-label="快速创作步骤">
        {快速步骤.map((条, 序) => {
          const Icon = 条.icon;
          return (
            <button aria-current={步骤 === 条.id ? 'step' : undefined} className={步骤 === 条.id ? 'is-active' : ''} key={条.id} onClick={() => 设步骤(条.id)} type="button">
              <span><Icon size={17} /></span>
              <span><small>0{序 + 1}</small><strong>{条.title}</strong></span>
              <em>{进度数字(分步完成度[条.id])}</em>
            </button>
          );
        })}
      </nav>

      <div className="quick-step-intro">
        <div><span>步骤 {当前序号 + 1} / {快速步骤.length}</span><h2>{快速步骤[当前序号].title}</h2></div>
        <p>{快速步骤[当前序号].copy}</p>
        <button onClick={on进入专业模式} type="button">进入专业模式 <ArrowRight size={14} /></button>
      </div>

      <div className="quick-step-panel">{面板}</div>

      <footer className="quick-creator-footer">
        <button disabled={当前序号 === 0 || 忙碌} onClick={() => 设步骤(快速步骤[当前序号 - 1].id)} type="button"><ArrowLeft size={15} /> 上一步</button>
        <div>
          <button disabled={!项目 || 忙碌 || !有未保存修改} onClick={on保存} type="button"><Save size={15} /> {有未保存修改 ? '保存当前项目' : '已保存'}</button>
          <button disabled={!项目 || 忙碌} onClick={on校验} type="button"><Check size={15} /> 校验</button>
          <button disabled={!项目 || 忙碌 || 有未保存修改} onClick={on预览} type="button"><Eye size={15} /> 试玩</button>
        </div>
        <button className="is-primary" disabled={当前序号 === 快速步骤.length - 1 || 忙碌} onClick={() => 设步骤(快速步骤[当前序号 + 1].id)} type="button">下一步 <ArrowRight size={15} /></button>
      </footer>
    </section>
  );
}
