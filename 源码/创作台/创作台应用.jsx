// 这个文件是创作台的"总指挥部"：/creator 页面的主组件。
// 布局像一间三开间的工作室——顶栏是前台(项目切换+全套动作按钮)，
// 左间住 AI 创作助手，中间是剧情流程图的绘图桌，右间是资产/音乐/属性的陈列架，
// 地上还有一条五格仪表盘(校验/结构/图片/语音/音乐就绪状态)。
// 本地复刻没有服务器，整个创作台等价于线上的"浏览器只读模式"：
// 示例项目从 /showcase.json + /games/<slug>/story.json 读，全部写操作落进 localStorage。
//
// ══════════ 给第二棒(AI助手 + 资产生成)的接口说明 ══════════
// 1) 左栏替换点：<助手面板占位 工作台={工作台} /> ——
//    在 助手对话/ 目录建你的真组件(建议 助手对话/助手面板.jsx，default export)，
//    然后把本文件里这一行的 助手面板占位 换成你的组件即可，接的 props 不变(就一个 工作台 对象)。
// 2) 工作台 对象 = 全部共享状态和动作(见下方 useMemo 的字段注释)：
//    项目/当前节点/消息列表/追加消息/应用本机写入/编辑剧情/静默保存/健康状态 等都在里面，
//    Agent 应用草稿 = 拿到新项目对象后调 工作台.应用本机写入(新项目, 系统消息文案)。
// 3) 资产生成挂点：所有"生成图片/生成语音/局部重绘/上传"按钮现在都调 占位提示(功能名)
//    冒一条系统消息；第二棒在 资产生成/ 实现真逻辑后，替换这些调用点(全文搜"占位提示(")。
// 4) 密钥：生产凭据只能由未来的服务端生成代理读取；浏览器设置只允许非敏感显示偏好。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Film, Plus, Trash2, Check, Play, Image, LoaderCircle, WandSparkles, Mic, ChevronDown,
  RefreshCw, Sparkles, Settings, CircleHelp, Bot, Brain, LayoutTemplate, GitBranch,
  ImagePlus, Info, Send, Database, NotebookText, Workflow, LayoutGrid, Network,
  ListPlus, Circle, Lock, KeyRound, Music, SlidersHorizontal, Zap, Maximize, Expand,
  Upload, Download, Save, RotateCcw,
} from 'lucide-react';
import {
  读本机项目, 保存本机项目, 删除本机项目, 本机项目列表, 合并项目列表,
  新建本机项目, 归一化项目, 深拷贝, 默认slug, 清洗slug, 读选中slug, 写选中slug,
  补正健康状态, 读精选覆盖, 写精选覆盖,
} from './项目管理/本机项目存储.js';
import { 加载示例项目名录, 加载示例项目 } from './项目管理/示例项目加载.js';
import { 运行校验, 生成QA报告, 校验选择机制结构 } from './校验发布/校验规则.js';
import 就绪状态条 from './校验发布/就绪状态条.jsx';
import { 新增节点, 插入节点, 移动节点, 拖拽重排, 按章节分组 } from './节点编辑/图操作.js';
import 节点卡片 from './节点编辑/节点卡片.jsx';
import 节点编辑弹窗 from './节点编辑/节点编辑弹窗.jsx';
import 新建项目弹窗 from './项目管理/新建项目弹窗.jsx';
import 精选弹窗 from './项目管理/精选弹窗.jsx';
import 设置弹窗 from './项目管理/设置弹窗.jsx';

// 创作侧尚无服务端 health 接口，全部按未接入起步；浏览器值不得把开关伪造为 true。
const 基础健康 = {
  mode: 'readonly',
  deepseekConfigured: false,
  imageConfigured: false,
  ttsConfigured: false,
  musicConfigured: false,
  deepseekModel: 'deepseek-chat',
  imageModel: '',
  ttsModel: '',
  musicModel: '',
  musicMv: 'chirp-v5',
};

// 输入毫秒时间戳 → 转成"HH:mm" → 吐出字符串(拿不到时间的地方显示 "--:--")
function 格式化时间(毫秒) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(毫秒));
}

function 资源预览url(值) {
  if (typeof 值 !== 'string' || !值.trim()) return '';
  const 路径 = 值.trim().replace(/^public/, '');
  return 路径;
}

// 输入资产 → 找它的预览图地址(previewUrl 优先，其次生成/目标路径) → 吐出 URL 或 ""
function 资产预览url(资产) {
  if (!资产) return '';
  return 资源预览url(资产.previewUrl) || 资源预览url(资产.generatedPath) || 资源预览url(资产.targetPath);
}

// story 里的 panorama 是播放器可直接读取的旧式视觉，只允许在创作台只读预览，不冒充 manifest 绑定资产。
function 节点全景url(节点) {
  return 资源预览url(节点?.panorama);
}

// 输入节点 → 看它有没有进场平面视频(cinematics 里 beforeEnter 的 flat-video) → 吐出布尔
function 节点有视频(节点) {
  return !!节点?.cinematics?.some(
    (段) => 段?.type === 'flat-video' && 段.trigger === 'beforeEnter' && !!(段.src || 段.assetPath)
  );
}

// 输入 JSON 文本 → 空串算"删掉这个字段"；能解析且是纯对象才放行 → 吐出 {ok, value|error}
function 解析JSON对象(文本) {
  const 清理 = 文本.trim();
  if (!清理) return { ok: true, value: undefined };
  try {
    const 值 = JSON.parse(清理);
    if (!值 || typeof 值 !== 'object' || Array.isArray(值)) {
      return { ok: false, error: '这里必须填写 JSON 对象，不能是数组、字符串或数字。' };
    }
    return { ok: true, value: 值 };
  } catch (错) {
    return { ok: false, error: `JSON 格式错误：${错 instanceof Error ? 错.message : String(错)}` };
  }
}

// 所有存储/加载异常都经过这里转成可展示文案，避免把 [object Object] 扔给用户。
function 错误文案(错, 兜底 = '操作失败，请稍后重试。') {
  return 错 instanceof Error && 错.message ? 错.message : typeof 错 === 'string' && 错 ? 错 : 兜底;
}

// 选择 id 会进入因果回放，不能用 choices.length + 1：中间删过一条后会撞上既有 id。
function 不重复的选择id(选择们) {
  const 已有 = new Set((选择们 ?? []).map((选择) => 选择?.id).filter((id) => typeof id === 'string' && id));
  let 序号 = 1;
  while (已有.has(`choice-${序号}`)) 序号 += 1;
  return `choice-${序号}`;
}

// 输入(改过的句, 原句) → 台词/说话人变了就把已生成语音标记为"需更新"并清掉生成痕迹 → 原地改
function 标记语音过期(新句, 旧句) {
  新句.voiceStatus = 旧句?.voiceSrc ? 'stale' : 旧句?.voiceStatus;
  delete 新句.voiceHash;
  delete 新句.voiceGeneratedAt;
  delete 新句.voiceError;
}

// 占位表格组件(线上 Us)：左栏"记忆/模板"、右栏"属性/数值/事件"等预留 Tab 共用的小桌板
export function 占位面板({ icon, title, rows }) {
  return (
    <section className="studio-placeholder-panel">
      <div>
        {icon}
        <strong>{title}</strong>
      </div>
      <table>
        <tbody>
          {rows.map(([名, 值]) => (
            <tr key={名}>
              <th>{名}</th>
              <td>{值}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ══════════ 左栏：创作助手占位面板(第二棒整体替换这个组件) ══════════
// 输入 工作台 对象 → 渲染与线上同构的 aside.studio-agent-panel(欢迎语+上下文卡+输入框) → 吐出 JSX
function 助手面板占位({ 工作台 }) {
  const { 健康状态, 项目, 当前节点, 节点列表, 资产列表, 消息列表, 追加消息, 忙碌, 更新时间文案 } = 工作台;
  const [左栏tab, 设左栏tab] = useState('agent');
  const [输入文本, 设输入文本] = useState('');
  const 聊天滚动ref = useRef(null);
  const 输入框ref = useRef(null);

  // 新消息进来自动滚到底，像微信一样
  useEffect(() => {
    const 盒子 = 聊天滚动ref.current;
    if (盒子) 盒子.scrollTo({ top: 盒子.scrollHeight, behavior: 'smooth' });
  }, [消息列表]);

  // 快捷指令：把预设的中文指令填进输入框并聚焦(和线上一致，不直接发送)
  function 填入指令(文本) {
    设输入文本(文本);
    window.setTimeout(() => 输入框ref.current?.focus(), 0);
  }

  // 占位版发送：把话记进聊天记录，然后老实承认助手还没接入(第二棒替换成真 Agent 调用)
  function 发送(事件) {
    事件.preventDefault();
    if (!输入文本.trim()) return;
    追加消息('user', 输入文本.trim());
    设输入文本('');
    追加消息('system', '创作助手尚未接入。');
  }

  const 节点文案 = 当前节点?.title ?? (节点列表.length ? '未选择节点' : '暂无节点');
  const 场景总数 = 项目?.summary?.visualSceneCount ?? 项目?.summary?.nodeCount ?? 0;
  const 已覆盖 = 项目?.summary?.visualReadyCount ?? 0;
  const 资产文案 = 场景总数
    ? `${已覆盖}/${场景总数} 场景覆盖 · ${Math.max(场景总数 - 已覆盖, 0)} 待补齐`
    : '暂无场景';

  return (
    <aside className="studio-agent-panel">
      <div className="studio-agent-header">
        <div className="studio-agent-title">
          <div className="studio-agent-mark">
            <Bot size={17} />
          </div>
          <div>
            <strong>创作助手</strong>
            <span>{健康状态?.deepseekConfigured ? '服务端模型已连接' : '尚未接入服务端'}</span>
          </div>
        </div>
        <div className={健康状态?.deepseekConfigured ? 'studio-agent-status is-ready' : 'studio-agent-status'}>
          <i />
          {健康状态?.deepseekConfigured ? '在线' : '未接入'}
        </div>
        <div className="studio-side-tabs">
          <button className={左栏tab === 'agent' ? 'is-active' : ''} onClick={() => 设左栏tab('agent')} type="button">
            <Bot size={14} />
            助手
          </button>
          <button className={左栏tab === 'memory' ? 'is-active' : ''} onClick={() => 设左栏tab('memory')} type="button">
            <Brain size={14} />
            记忆
          </button>
          <button className={左栏tab === 'prompts' ? 'is-active' : ''} onClick={() => 设左栏tab('prompts')} type="button">
            <LayoutTemplate size={14} />
            模板
          </button>
        </div>
      </div>
      {左栏tab === 'agent' ? (
        <>
          <div className="studio-chat-log" ref={聊天滚动ref}>
            <section className="studio-agent-context-card">
              <div className="studio-agent-context-head">
                <span>当前项目</span>
                <strong>{项目?.title ?? '未选择项目'}</strong>
              </div>
              <dl>
                <div>
                  <dt>节点</dt>
                  <dd>{节点文案}</dd>
                </div>
                <div>
                  <dt>资产</dt>
                  <dd>{资产文案}</dd>
                </div>
                <div>
                  <dt>更新</dt>
                  <dd>{更新时间文案}</dd>
                </div>
              </dl>
            </section>
            <div className="studio-agent-quick-actions">
              <button
                disabled={!项目 || 忙碌}
                onClick={() => 填入指令('请基于当前项目校验剧情连贯性、死路、隐藏路线和结局覆盖，并按优先级列出要修改的节点。')}
                type="button"
              >
                <Check size={14} />
                校验剧情
              </button>
              <button
                disabled={!项目 || 忙碌}
                onClick={() =>
                  填入指令(
                    当前节点
                      ? `请基于当前节点「${当前节点.title}」设计下一幕，补充场景、对白、选择、后果和需要的资产。`
                      : '请基于当前项目设计下一幕，补充场景、对白、选择、后果和需要的资产。'
                  )
                }
                type="button"
              >
                <GitBranch size={14} />
                下一幕
              </button>
              <button
                disabled={!项目 || 忙碌}
                onClick={() => 填入指令('请列出当前项目缺失或占位的视觉资产，并给出适合 360 全景图生成的精炼提示词。')}
                type="button"
              >
                <ImagePlus size={14} />
                补资产
              </button>
            </div>
            {消息列表.map((消息, 序) => (
              <article className={`studio-message role-${消息.role}`} key={`${消息.role}-${序}`}>
                <div className="studio-message-avatar">
                  {消息.role === 'user' ? <Sparkles size={15} /> : 消息.role === 'agent' ? <Bot size={15} /> : <Info size={15} />}
                </div>
                <div className="studio-message-body">
                  <div>
                    <strong>{消息.role === 'user' ? '你' : 消息.role === 'agent' ? '创作助手' : '系统'}</strong>
                    <span>{格式化时间(Date.now())}</span>
                  </div>
                  <p>{消息.text}</p>
                </div>
              </article>
            ))}
          </div>
          <form className="studio-chat-input" onSubmit={发送}>
            <div className={输入文本.length > 0 ? 'studio-composer-shell is-populated' : 'studio-composer-shell'}>
              <textarea
                onChange={(事件) => 设输入文本(事件.target.value)}
                placeholder={健康状态?.deepseekConfigured ? '输入指令...' : '创作 Agent 尚未接入；可先把需求记在这里...'}
                ref={输入框ref}
                value={输入文本}
              />
              <div className="studio-composer-footer">
                <div className="studio-input-tools">
                  <button onClick={() => 填入指令('请基于当前项目提出 3 个最值得推进的创作任务。')} title="任务建议" type="button">
                    <Sparkles size={15} />
                  </button>
                  <button onClick={() => 填入指令('请检查当前节点需要的图片资产，并生成适合 360 全景图的提示词。')} title="图片提示词" type="button">
                    <Image size={15} />
                  </button>
                  <button onClick={() => 填入指令('请把当前项目整理成一组可复用的剧情生成提示词模板。')} title="提示词模板" type="button">
                    <LayoutTemplate size={15} />
                  </button>
                </div>
                <div className="studio-composer-actions">
                  <div className="studio-model-row">
                    <span>{健康状态?.deepseekConfigured ? 健康状态.deepseekModel : '服务端 Agent 未接入'}</span>
                    <ChevronDown size={13} />
                  </div>
                  <button className="studio-send-button" disabled={!输入文本.trim()} title="发送" type="submit">
                    <Send size={17} />
                  </button>
                </div>
              </div>
            </div>
          </form>
        </>
      ) : (
        <占位面板
          icon={左栏tab === 'memory' ? <Database size={18} /> : <NotebookText size={18} />}
          title={左栏tab === 'memory' ? '记忆表' : '提示词库'}
          rows={
            左栏tab === 'memory'
              ? [
                  ['项目摘要', 项目?.title ?? '未选择'],
                  ['当前节点', 当前节点?.title ?? '未选择'],
                  ['待接入', '长期记忆 API'],
                ]
              : [
                  ['节点提示词', `${项目?.summary?.promptCount ?? 0} 条`],
                  ['图片模型', 健康状态?.imageModel || '未配置'],
                  ['待接入', '可复用提示词模板'],
                ]
          }
        />
      )}
    </aside>
  );
}

// 中栏工具条上的小统计牌(线上 ct)：一个标签配一个数
function 迷你指标({ label, value }) {
  return (
    <div className="studio-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// 右栏缩略图条上的一格(线上 Ra)：小图+资产id+状态字
function 资产缩略图({ 资产, 选中, on选中 }) {
  const 预览 = 资产预览url(资产);
  return (
    <button className={选中 ? 'studio-asset-thumb is-selected' : 'studio-asset-thumb'} onClick={on选中} type="button">
      <span className="studio-thumb-frame">{预览 ? <img alt={资产.id} src={预览} /> : <Image size={18} />}</span>
      <strong>{资产.id}</strong>
      <small>{资产.status === 'generated-image' ? '已生成' : '等待生成'}</small>
    </button>
  );
}

// ══════════ 主组件 ══════════
export default function 应用() {
  // ---- 核心状态(对照线上 state 蓝图) ----
  const [健康状态, 设健康状态] = useState(() => 补正健康状态(基础健康));
  const [项目列表, 设项目列表] = useState([]);
  const [当前项目, 设当前项目] = useState(null);
  const [选中slug, 设选中slug] = useState(() => 读选中slug());
  const [选中节点id, 设选中节点id] = useState('');
  const [有未保存修改, 置脏] = useState(false);
  const [进行中动作, 设进行中动作] = useState('load'); // 非 null = 有事在忙，按钮要转圈
  const [顶部错误, 设顶部错误] = useState(null);
  const [消息列表, 设消息列表] = useState([
    { role: 'agent', text: '创作台已载入本机项目工具。你可以校验、编辑与发布；AI 创作和资产生成服务尚未接入。' },
  ]);
  const [右栏tab, 设右栏tab] = useState('assets');
  const [中栏视图, 设中栏视图] = useState('flow');
  const [编辑弹窗开, 设编辑弹窗开] = useState(false);
  const [新建弹窗开, 设新建弹窗开] = useState(false);
  const [新建标题, 设新建标题] = useState('新项目');
  const [新建slug, 设新建slug] = useState(() => 默认slug());
  const [设置弹窗开, 设设置弹窗开] = useState(false);
  const [精选弹窗开, 设精选弹窗开] = useState(false);
  const [精选加载中, 设精选加载中] = useState(false);
  const [精选候选, 设精选候选] = useState([]);
  const [精选slugs, 设精选slugs] = useState([]);
  const [默认Demo, 设默认Demo] = useState('');
  const [拖动节点id, 设拖动节点id] = useState('');
  const [悬停节点id, 设悬停节点id] = useState('');

  // ref：加载序号防止旧请求覆盖新请求；slug/示例名录给异步回调读最新值。
  const 加载序号ref = useRef(0);
  const 选中slugRef = useRef(选中slug);
  const 示例列表ref = useRef([]);
  const 示例默认slugRef = useRef('');
  const 跳过离页确认ref = useRef(false);

  // ---- 派生数据 ----
  const 节点列表 = useMemo(() => Object.values(当前项目?.story?.nodes ?? {}), [当前项目]);
  const 资产列表 = 当前项目?.manifest?.assets ?? [];
  const 当前节点 = 选中节点id ? 当前项目?.story?.nodes?.[选中节点id] ?? null : null;
  const 绑定资产 = 当前节点 ? 资产列表.find((资产) => (资产.usedByNodes ?? []).includes(当前节点.id)) ?? null : null;
  const 章节组 = useMemo(() => 按章节分组(节点列表), [节点列表]);
  const 当前条目 = 项目列表.find((条) => 条.slug === 选中slug);
  const 是本机项目 = 当前条目?.source === 'browser';
  const 更新时间文案 = 当前条目?.updatedAt ? 格式化时间(当前条目.updatedAt) : '--:--';
  const 忙碌 = 进行中动作 !== null;
  const 视觉场景总数 = 当前项目?.summary?.visualSceneCount ?? 当前项目?.summary?.nodeCount ?? 0;
  const 已覆盖场景数 = 当前项目?.summary?.visualReadyCount ?? 0;
  const 视觉缺口数 = Math.max(视觉场景总数 - 已覆盖场景数, 0);
  const 当前节点序号 = 当前节点 ? Math.max(节点列表.findIndex((节) => 节.id === 当前节点.id), 0) : 0;
  const 预览链接 = 当前项目?.slug ? `/play?game=${encodeURIComponent(当前项目.slug)}` : '/play';
  const 主视觉 = 当前节点?.panoramaType === 'video' ? 'video' : 'image';
  const 当前视觉预览 = 资产预览url(绑定资产) || 节点全景url(当前节点);
  const 当前有图 = !!当前视觉预览;
  const 当前有视频 = 节点有视频(当前节点);

  // ---- 消息与项目的公共小动作 ----

  // 输入(角色, 文本) → 往聊天记录尾部加一条 → 无返回
  function 追加消息(角色, 文本) {
    设消息列表((旧) => [...旧, { role: 角色, text: 文本 }]);
  }

  // 用最新的本机柜子内容重拼项目列表(示例列表打底，本机在前)
  function 刷新项目列表() {
    设项目列表(合并项目列表(示例列表ref.current, 本机项目列表()));
  }

  // 输入(项目, 系统消息?) → 写进 localStorage → 若还是当前项目就同步内存 → 刷新列表清脏旗
  // 这是所有"落盘"操作的唯一出口(线上 de)，发布/保存/切主视觉都从这走。
  function 应用本机写入(项目, 消息文案) {
    try {
      保存本机项目(项目);
      if (选中slugRef.current === 项目.slug) 设当前项目(归一化项目(项目));
      刷新项目列表();
      置脏(false);
      if (消息文案) 追加消息('system', 消息文案);
      return true;
    } catch (错) {
      const 文案 = 错误文案(错, '保存项目失败。');
      设顶部错误(文案);
      追加消息('system', 文案);
      return false;
    }
  }

  // 未接入功能的统一出口：冒一条系统消息(第二棒用真实现替换各调用点)
  function 占位提示(功能名) {
    追加消息('system', `${功能名}功能尚未接入。`);
  }

  // ---- 加载流程(线上 Pn) ----
  // 输入 slug → 拉示例名录 + 本机柜子 → 定选中项目 → 取项目详情(本机优先) → 铺满界面
  async function 加载全部(目标 = 选中slugRef.current) {
    const 序号 = 加载序号ref.current + 1;
    const 有原工作区 = !!当前项目?.story;
    加载序号ref.current = 序号;
    设进行中动作('load');
    设顶部错误(null);
    try {
      const 示例名录 = await 加载示例项目名录();
      if (序号 !== 加载序号ref.current) return; // 有更新的一轮加载在跑，这轮作废
      // 名录请求偶发失败时保留已经加载过的服务器列表，避免把当前合法项目误判成不存在并跳走。
      const 示例列表 = 示例名录.projects.length > 0 ? 示例名录.projects : 示例列表ref.current;
      示例列表ref.current = 示例列表;
      示例默认slugRef.current = 示例名录.defaultSlug || 示例默认slugRef.current;
      设健康状态(补正健康状态(基础健康));
      const 列表 = 合并项目列表(示例列表, 本机项目列表());
      设项目列表(列表);
      const 名录默认 = 列表.some((条) => 条.slug === 示例默认slugRef.current) ? 示例默认slugRef.current : '';
      const 落点slug = 列表.some((条) => 条.slug === 目标) ? 目标 : 名录默认 || 列表[0]?.slug || 目标;
      if (!落点slug) {
        设当前项目(null);
        设选中slug('');
        选中slugRef.current = '';
        return;
      }
      const 项目 = 读本机项目(落点slug) ?? (await 加载示例项目(落点slug));
      if (序号 !== 加载序号ref.current) return;
      if (
        !项目 ||
        项目.slug !== 落点slug ||
        !项目.story ||
        !项目.story.nodes ||
        typeof 项目.story.nodes !== 'object' ||
        Array.isArray(项目.story.nodes)
      ) {
        throw new Error(`项目 ${落点slug} 的剧情数据无效。`);
      }
      const 规整项目 = 归一化项目(项目);
      // 只有完整项目已经拿到后，才一起提交 slug 与工作区；加载失败时原工作区保持原样。
      选中slugRef.current = 落点slug;
      设选中slug(落点slug);
      设当前项目(规整项目);
      置脏(false);
      设编辑弹窗开(false);
      try {
        写选中slug(落点slug);
      } catch (错) {
        设顶部错误(错误文案(错, '项目已打开，但无法记住本次选择。'));
      }
    } catch (错) {
      if (序号 === 加载序号ref.current) {
        设顶部错误(错 instanceof Error ? 错.message : String(错));
        if (!有原工作区) {
          设当前项目(null);
          设选中slug('');
          选中slugRef.current = '';
          设选中节点id('');
        }
      }
    } finally {
      if (序号 === 加载序号ref.current) 设进行中动作(null);
    }
  }

  // 初次挂载读取上次选择；后续切换直接调用加载函数，成功前绝不改已提交 slug。
  useEffect(() => {
    void 加载全部(选中slugRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 浏览器刷新/关页不会经过 React 按钮，必须使用 beforeunload 保住未落盘的剧情。
  useEffect(() => {
    if (!有未保存修改) {
      跳过离页确认ref.current = false;
      return undefined;
    }
    const 离页处理 = (事件) => {
      if (跳过离页确认ref.current) return;
      事件.preventDefault();
      事件.returnValue = '';
    };
    window.addEventListener('beforeunload', 离页处理);
    return () => window.removeEventListener('beforeunload', 离页处理);
  }, [有未保存修改]);

  // 节点选择兜底：项目没了→清空；选中的节点被删了→回落到起始节点或第一个节点
  useEffect(() => {
    if (!当前项目?.story) {
      设选中节点id('');
      设编辑弹窗开(false);
      return;
    }
    if (选中节点id && !当前项目.story.nodes[选中节点id]) {
      设选中节点id(当前项目.story.startNodeId || Object.keys(当前项目.story.nodes)[0] || '');
      设编辑弹窗开(false);
      return;
    }
    if (!选中节点id) 设选中节点id(当前项目.story.startNodeId || Object.keys(当前项目.story.nodes)[0] || '');
  }, [当前项目, 选中节点id]);

  // ---- 项目管理动作 ----

  function 确认丢弃未保存修改(动作文案) {
    if (!有未保存修改) return true;
    return window.confirm(`当前项目有未保存修改，${动作文案}后将丢失。确认继续？`);
  }

  // 切换项目：有没保存的改动先拦一道确认(第二棒接入 Agent 草稿后，把草稿未应用也算进这个条件)
  function 切换项目(slug) {
    if (slug === 选中slug) return;
    if (!确认丢弃未保存修改('切换项目')) return;
    void 加载全部(slug);
  }

  // 打开新建弹窗：标题和 slug 都回到默认值
  function 打开新建弹窗() {
    设新建标题('新项目');
    设新建slug(默认slug());
    设新建弹窗开(true);
  }

  // 提交新建：标题/slug 校验 → 建模板项目 → 存柜子 → 切过去
  function 提交新建(事件) {
    事件?.preventDefault();
    const 干净slug = 清洗slug(新建slug);
    if (!新建标题.trim() || !干净slug) {
      设顶部错误('新项目需要标题和 slug。');
      return;
    }
    if (项目列表.some((条) => 条.slug === 干净slug)) {
      设顶部错误(`项目 slug 已存在：${干净slug}`);
      return;
    }
    设进行中动作('create-project');
    设顶部错误(null);
    try {
      const 新项目 = 新建本机项目(新建标题, 干净slug);
      保存本机项目(新项目);
      刷新项目列表();
      选中slugRef.current = 新项目.slug;
      设当前项目(新项目);
      设选中slug(新项目.slug);
      置脏(false);
      设新建弹窗开(false);
      追加消息('system', `已在当前浏览器新建项目：${新项目.title}`);
      try {
        写选中slug(新项目.slug);
      } catch (错) {
        设顶部错误(错误文案(错, '项目已创建，但无法记住本次选择。'));
      }
    } catch (错) {
      设顶部错误(错误文案(错, '新建项目失败。'));
    } finally {
      设进行中动作(null);
    }
  }

  // 删除项目：只有本机项目能删(示例项目是随部署打包的静态数据，按钮已禁用)
  function 删除项目() {
    if (!当前项目 || !是本机项目) return;
    if (!window.confirm(`确定删除本机项目「${当前项目.title}」吗？\n\n这只会删除当前浏览器里的项目数据。`)) return;
    设进行中动作('delete-project');
    设顶部错误(null);
    let 下一slug = '';
    try {
      const 被删slug = 当前项目.slug;
      删除本机项目(被删slug);
      const 新列表 = 合并项目列表(示例列表ref.current, 本机项目列表());
      设项目列表(新列表);
      设当前项目(null);
      置脏(false);
      设选中节点id('');
      选中slugRef.current = '';
      设选中slug('');
      下一slug = 新列表.some((条) => 条.slug === 示例默认slugRef.current)
        ? 示例默认slugRef.current
        : 新列表[0]?.slug ?? '';
      追加消息('system', `已删除本机项目：${被删slug}。`);
    } catch (错) {
      设顶部错误(错误文案(错, '删除项目失败。'));
    } finally {
      设进行中动作(null);
    }
    if (下一slug) void 加载全部(下一slug);
  }

  // ---- 剧情编辑管道 ----

  // 输入一个"怎么改"的函数 → 深拷贝 story 交给它改 → 换回项目并亮起"有未保存修改"(线上 ke)
  function 编辑剧情(改法) {
    设当前项目((旧) => {
      if (!旧?.story) return 旧;
      const 新剧情 = 深拷贝(旧.story);
      改法(新剧情);
      // 剧情一改，旧 QA 报告就不再能证明当前版本；同时重算摘要，避免节点/分支数停在旧值。
      return 归一化项目({ ...旧, story: 新剧情, qaReport: '' });
    });
    置脏(true);
  }

  // 保存修改(线上 Jr)：把内存里的项目落进浏览器柜子。
  // 示例项目也走这条路——静态部署没有服务器可写，保存即"另存为本机副本"(列表里会变成"标题（本机）")。
  function 保存修改() {
    if (!当前项目?.story) return;
    设进行中动作('save-graph');
    设顶部错误(null);
    try {
      应用本机写入(归一化项目({ ...当前项目 }), '节点、选择和对白修改已保存到当前浏览器。');
    } finally {
      设进行中动作(null);
    }
  }

  // 静默自动保存(线上 Ct)：生成语音等长任务开跑前，把没保存的剧情先落盘，防止白改。
  // 本棒没有长任务，先留给第二棒调用。
  function 静默保存() {
    if (!当前项目?.story || !有未保存修改) return;
    应用本机写入(归一化项目({ ...当前项目 }));
  }

  // ---- 校验与发布(线上 Mn 的浏览器分支) ----
  // 输入 "validate" | "publish" → 跑本地规则 → 写 QA 报告 → 本机项目落盘/示例项目留内存
  // 发布拦截：有错误时亮顶栏错误条，只算校验不算发布。
  function 校验或发布(动作) {
    if (!当前项目) return;
    设进行中动作(动作);
    设顶部错误(null);
    try {
      const 规整 = 归一化项目({ ...当前项目 });
      const 结果 = 运行校验(规整);
      const 新项目 = 归一化项目({ ...规整, qaReport: 生成QA报告(规整.slug, 结果) });
      if (是本机项目) {
        // 本机项目：报告连同项目一起写进 localStorage；发布成功即 /play?game=slug 可玩
        应用本机写入(
          新项目,
          动作 === 'publish' && 结果.errors.length === 0
            ? `已发布到当前浏览器预览：/play?game=${新项目.slug}`
            : `本机校验完成：${结果.errors.length} 个错误，${结果.warnings.length} 个警告。`
        );
      } else if (动作 === 'publish' && 结果.errors.length === 0) {
        // 示例项目发布成功必须落成同 slug 的本机覆盖，播放器会优先读取这份编辑版。
        应用本机写入(新项目, `已发布到当前浏览器预览：/play?game=${新项目.slug}`);
      } else {
        // 示例项目的单独校验（以及未通过的发布）只更新内存，不制造一份假发布副本。
        设当前项目(新项目);
        追加消息(
          'system',
          动作 === 'publish'
            ? `本机校验完成：${结果.errors.length} 个错误，${结果.warnings.length} 个警告。`
            : '校验完成，QA 报告已刷新。'
        );
      }
      if (动作 === 'publish' && 结果.errors.length > 0) {
        const 校验错误文案 = `发布前需要先修复 ${结果.errors.length} 个校验错误。`;
        // 如果 QA 报告落盘也失败，不要让后续的发布拦截提示把存储故障覆盖掉。
        设顶部错误((旧文案) => (旧文案 ? `${旧文案}；${校验错误文案}` : 校验错误文案));
      }
    } finally {
      设进行中动作(null);
    }
  }

  // ---- 节点图动作 ----
  // 为什么不走 编辑剧情 管道：这几个动作要立刻拿到"新节点的 id"来选中它，
  // 而 setState 的更新函数什么时候执行由 React 决定，从里面往外带值不可靠。
  // 所以先在外面算好完整结果，再把成品塞回 state。

  // 输入算好的新 story → 换进当前项目并亮"有未保存修改" → 顺手选中指定节点
  function 应用剧情结果(新剧情, 选中id) {
    设当前项目((旧) => (旧?.story ? 归一化项目({ ...旧, story: 新剧情, qaReport: '' }) : 旧));
    置脏(true);
    if (选中id) 设选中节点id(选中id);
  }

  function 动作新增节点() {
    if (!当前项目?.story) return;
    const 结果 = 新增节点(深拷贝(当前项目.story), 选中节点id || 当前项目.story.startNodeId);
    应用剧情结果(结果.story, 结果.nodeId);
  }

  function 动作插入节点(基准id = 选中节点id) {
    if (!当前项目?.story || !基准id) return;
    const 结果 = 插入节点(深拷贝(当前项目.story), 基准id);
    应用剧情结果(结果.story, 结果.nodeId);
  }

  function 动作移动节点(节点id, 方向) {
    if (!当前项目?.story || !节点id) return;
    应用剧情结果(移动节点(深拷贝(当前项目.story), 节点id, 方向), 节点id);
  }

  // 拖拽落下：把被拖节点插到目标下标，然后清掉拖拽高亮
  function 动作拖拽落下(目标下标) {
    const 被拖id = 拖动节点id;
    设拖动节点id('');
    设悬停节点id('');
    if (!当前项目?.story || !被拖id || 忙碌) return;
    应用剧情结果(拖拽重排(深拷贝(当前项目.story), 被拖id, 目标下标), 被拖id);
  }

  // 删除当前节点(线上 Kr)：只剩一个节点不许删；起点被删就换人；所有指向它的选择一并剪断
  function 动作删除节点() {
    if (!当前节点 || !当前项目?.story || Object.keys(当前项目.story.nodes).length <= 1) return;
    const 被删id = 当前节点.id;
    const 回落id = Object.keys(当前项目.story.nodes).find((id) => id !== 被删id) ?? 当前项目.story.startNodeId;
    编辑剧情((剧情) => {
      delete 剧情.nodes[被删id];
      if (剧情.startNodeId === 被删id) 剧情.startNodeId = 回落id;
      for (const 节点 of Object.values(剧情.nodes)) {
        节点.choices = (节点.choices ?? []).filter((选择) => 选择.next !== 被删id);
      }
    });
    设选中节点id(回落id);
  }

  // ---- 节点表单回调(全走 编辑剧情 管道) ----

  function 改节点(补丁) {
    if (!当前节点) return;
    编辑剧情((剧情) => {
      剧情.nodes[当前节点.id] = { ...剧情.nodes[当前节点.id], ...补丁 };
    });
  }

  function 改对白(下标, 补丁) {
    if (!当前节点) return;
    编辑剧情((剧情) => {
      const 节点 = 剧情.nodes[当前节点.id];
      const 行们 = [...(节点.lines ?? [])];
      const 旧句 = 行们[下标];
      const 新句 = { ...旧句, ...补丁 };
      // 台词或说话人变了，旧语音就不新鲜了
      if ((补丁.text !== undefined && 补丁.text !== 旧句?.text) || (补丁.speaker !== undefined && 补丁.speaker !== 旧句?.speaker)) {
        标记语音过期(新句, 旧句);
      }
      行们[下标] = 新句;
      节点.lines = 行们;
    });
  }

  function 加对白() {
    if (!当前节点) return;
    编辑剧情((剧情) => {
      const 节点 = 剧情.nodes[当前节点.id];
      节点.lines = [...(节点.lines ?? []), { speaker: 'narrator', text: '新的对白。' }];
    });
  }

  function 删对白(下标) {
    if (!当前节点) return;
    编辑剧情((剧情) => {
      const 节点 = 剧情.nodes[当前节点.id];
      节点.lines = (节点.lines ?? []).filter((句, 序) => 序 !== 下标);
    });
  }

  // 单句音色(线上 et)：inherit=清掉单句指定；custom/catalog=写模式和 voiceId；顺带标语音过期
  function 改单句音色(下标, 模式, voiceId = '') {
    if (!当前节点) return;
    编辑剧情((剧情) => {
      const 节点 = 剧情.nodes[当前节点.id];
      const 行们 = [...(节点.lines ?? [])];
      const 旧句 = 行们[下标];
      if (!旧句) return;
      const 新句 = { ...旧句 };
      if (模式 === 'inherit') {
        delete 新句.voiceMode;
        delete 新句.customVoiceId;
        delete 新句.voiceId;
      } else {
        新句.voiceMode = 模式;
        新句.customVoiceId = 模式 === 'custom';
        新句.voiceId = voiceId;
      }
      标记语音过期(新句, 旧句);
      行们[下标] = 新句;
      节点.lines = 行们;
    });
  }

  function 改选择(下标, 补丁) {
    if (!当前节点) return;
    编辑剧情((剧情) => {
      const 节点 = 剧情.nodes[当前节点.id];
      const 选择们 = [...(节点.choices ?? [])];
      选择们[下标] = { ...选择们[下标], ...补丁 };
      节点.choices = 选择们;
    });
  }

  // Effect/Condition JSON 落笔校验：通过就写回并返回 true；不通过 alert 并返回 false(弹窗会把文本弹回)
  function 改选择JSON(下标, 字段, 文本) {
    const 结果 = 解析JSON对象(文本);
    if (!结果.ok) {
      window.alert(结果.error);
      return false;
    }
    const 结构错误 = 校验选择机制结构(结果.value, 字段);
    if (结构错误.length > 0) {
      window.alert(`JSON 字段结构不正确：\n${结构错误.join('\n')}`);
      return false;
    }
    改选择(下标, { [字段]: 结果.value });
    return true;
  }

  function 加选择() {
    if (!当前节点 || !当前项目?.story) return;
    const 目标id = Object.keys(当前项目.story.nodes).find((id) => id !== 当前节点.id) ?? 当前节点.id;
    编辑剧情((剧情) => {
      const 节点 = 剧情.nodes[当前节点.id];
      const 已有选择 = 节点.choices ?? [];
      节点.choices = [
        ...已有选择,
        {
          id: 不重复的选择id(已有选择),
          label: '新的选择',
          caption: '选择反馈。',
          next: 目标id,
          fateType: 'river',
          consequence: '这个选择会改变后续路线。',
          effect: { globals: { integrity: 1 } },
        },
      ];
    });
  }

  function 删选择(下标) {
    if (!当前节点) return;
    编辑剧情((剧情) => {
      const 节点 = 剧情.nodes[当前节点.id];
      节点.choices = (节点.choices ?? []).filter((选择, 序) => 序 !== 下标);
    });
  }

  // 主视觉切换(线上 Bn)：点了立即保存，不走"有未保存修改"流程
  function 切换主视觉(类型) {
    if (!当前项目?.story || !当前节点 || 忙碌) return;
    const 新剧情 = 深拷贝(当前项目.story);
    新剧情.nodes[当前节点.id] = { ...新剧情.nodes[当前节点.id], panoramaType: 类型 };
    const 新项目 = 归一化项目({ ...当前项目, story: 新剧情, qaReport: '' });
    const 消息 = `当前场景主视觉已切换为${类型 === 'video' ? '视频' : '图片'}。`;
    if (是本机项目) {
      应用本机写入(新项目, 消息);
    } else {
      // 示例项目没有可写的服务器，切换只对本次会话生效
      设当前项目(新项目);
      置脏(true);
      追加消息('system', 消息);
    }
  }

  // ---- 落地页精选 Demo(线上 §7 的浏览器分支) ----

  // 打开弹窗：候选=本机项目+示例项目；勾选初值=本机覆盖，否则线上名录
  async function 打开精选弹窗() {
    设精选弹窗开(true);
    设精选加载中(true);
    try {
      const 本机 = 本机项目列表().map((条) => ({ slug: 条.slug, title: 条.title, nodeCount: 条.nodeCount, source: 'browser' }));
      let 示例 = 示例列表ref.current;
      if (示例.length === 0) {
        const 名录 = await 加载示例项目名录();
        示例 = 名录.projects;
        示例默认slugRef.current = 名录.defaultSlug;
      }
      示例列表ref.current = 示例;
      const 已占 = new Set(本机.map((条) => 条.slug));
      const 候选 = [...本机, ...示例.filter((条) => !已占.has(条.slug))];
      const 覆盖 = 读精选覆盖();
      设精选候选(候选);
      设精选slugs(覆盖.featured.length > 0 ? 覆盖.featured : 示例.map((条) => 条.slug));
      设默认Demo(覆盖.default || 示例默认slugRef.current || 示例[0]?.slug || '');
    } finally {
      设精选加载中(false);
    }
  }

  // 勾选逻辑：取消勾选时默认位让给剩下的第一个；勾选时没有默认就顺位当默认
  function 切换精选(slug) {
    if (精选slugs.includes(slug)) {
      const 剩下 = 精选slugs.filter((条) => 条 !== slug);
      设精选slugs(剩下);
      if (默认Demo === slug) 设默认Demo(剩下[0] ?? '');
    } else {
      设精选slugs([...精选slugs, slug]);
      if (!默认Demo) 设默认Demo(slug);
    }
  }

  function 保存精选() {
    const 定稿默认 = 精选slugs.includes(默认Demo) ? 默认Demo : 精选slugs[0] ?? '';
    try {
      const 定稿 = 写精选覆盖({ default: 定稿默认, featured: 精选slugs, entries: 精选候选 });
      设精选slugs(定稿.featured);
      设默认Demo(定稿.default);
      追加消息('system', '本机精选 Demo 已保存到当前浏览器。刷新首页后，这台浏览器会优先显示你的本机精选。');
      设精选弹窗开(false);
    } catch (错) {
      设顶部错误(错误文案(错, '保存首页精选失败。'));
    }
  }

  // ══════════ 给第二棒的共享工作台对象：左栏组件只吃这一个 prop ══════════
  const 工作台 = useMemo(
    () => ({
      健康状态,          // 模型配置情况(deepseekConfigured 等)
      项目: 当前项目,     // 当前项目完整对象(story/prompts/manifest/summary/qaReport…)
      当前节点,
      节点列表,
      资产列表,
      项目列表,
      选中slug,
      消息列表,          // 聊天记录 [{role:"agent"|"user"|"system", text}]
      追加消息,          // (角色, 文本) 往聊天里加一条
      忙碌,
      进行中动作,
      设进行中动作,       // Agent 请求进行中请设成 "chat"，结束设回 null
      更新时间文案,
      设顶部错误,
      设当前项目,         // 直接换整个项目对象(仅内存)
      编辑剧情,          // (改法) 深拷贝管道改 story，自动亮"有未保存修改"
      应用本机写入,       // (项目, 系统消息?) 唯一落盘出口：Agent 草稿应用后调它
      静默保存,          // 长任务开跑前把脏数据先落盘
      校验或发布,         // ("validate"|"publish")
      占位提示,          // (功能名) 未接入功能的统一提示
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [健康状态, 当前项目, 当前节点, 节点列表, 资产列表, 项目列表, 选中slug, 消息列表, 忙碌, 进行中动作, 更新时间文案]
  );

  // ══════════ 渲染 ══════════
  return (
    <main className="studio-shell">
      {/* ---- 顶栏 ---- */}
      <header className="studio-topbar">
        <div className="studio-brand">
          <div className="studio-logo">
            <Film size={26} />
          </div>
          <div>
            <strong>互动电影创作台</strong>
            <span>Interactive Cinema Creator</span>
          </div>
        </div>
        <div className="studio-project-title">
          <div className="studio-project-line">
            <select
              aria-label="切换项目"
              className="studio-project-select"
              disabled={忙碌}
              onChange={(事件) => 切换项目(事件.target.value)}
              value={选中slug}
            >
              {项目列表.map((条) => (
                <option key={条.slug} value={条.slug}>
                  {条.title}
                </option>
              ))}
            </select>
            <button disabled={忙碌} onClick={打开新建弹窗} title="新建项目" type="button">
              <Plus size={15} />
            </button>
            {/* 示例项目是随部署打包的静态数据，本地复刻删不掉，所以非本机项目禁用删除 */}
            <button disabled={!当前项目 || 忙碌 || !是本机项目} onClick={删除项目} title="删除项目" type="button">
              <Trash2 size={15} />
            </button>
          </div>
          <p>
            {是本机项目 ? '本机浏览器项目' : '发布示例项目'}
            {' · '}
            {有未保存修改 ? '有未保存修改' : '自动保存'} {更新时间文案}
            <Check size={14} />
          </p>
        </div>
        <nav className="studio-top-actions" aria-label="创作台操作">
          <a
            className="studio-action is-secondary"
            href={预览链接}
            onClick={(事件) => {
              if (!确认丢弃未保存修改('打开预览')) {
                事件.preventDefault();
                return;
              }
              // 用户已在页内明确确认，避免 beforeunload 再弹第二次。
              // 新标签打开不会卸载当前页，下一轮任务要恢复保护，避免后续真正离页时漏拦。
              if (有未保存修改) {
                跳过离页确认ref.current = true;
                window.setTimeout(() => {
                  跳过离页确认ref.current = false;
                }, 0);
              }
            }}
            title="打开当前游戏预览"
          >
            <Play size={17} />
            <span>预览</span>
          </a>
          <button
            className="studio-action is-secondary is-compactable"
            disabled={!当前项目 || 忙碌}
            onClick={() => 占位提示('生成图片')}
            title="一键生成全部缺失图片"
            type="button"
          >
            <WandSparkles size={17} />
            <span>生成图片</span>
          </button>
          <button
            className="studio-action is-secondary is-compactable"
            disabled={!当前项目 || 忙碌}
            onClick={() => 占位提示('生成语音')}
            title="一键生成全部缺失语音"
            type="button"
          >
            <Mic size={17} />
            <span>生成语音</span>
          </button>
          <button className="studio-action is-secondary" disabled={!当前项目 || 忙碌} onClick={() => 校验或发布('validate')} type="button">
            {进行中动作 === 'validate' ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
            <span>校验</span>
          </button>
          <button className="studio-action is-primary" disabled={!当前项目 || 忙碌} onClick={() => 校验或发布('publish')} type="button">
            {进行中动作 === 'publish' ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}
            <span>发布</span>
          </button>
          <span className="studio-divider" />
          <button className="studio-action is-muted is-compactable" disabled title="导出功能预留" type="button">
            <Download size={17} />
            <span>导出</span>
            <ChevronDown size={14} />
          </button>
          <button
            aria-label="刷新项目"
            className="studio-action is-icon-only"
            disabled={忙碌}
            onClick={() => {
              if (!确认丢弃未保存修改('刷新项目')) return;
              void 加载全部(选中slugRef.current);
            }}
            title="刷新项目"
            type="button"
          >
            <RefreshCw size={17} />
          </button>
          <button
            aria-label="落地页精选 Demo"
            className="studio-action is-icon-only"
            disabled={进行中动作 === 'load'}
            onClick={() => void 打开精选弹窗()}
            title="落地页精选 Demo"
            type="button"
          >
            <Sparkles size={17} />
          </button>
          <button
            aria-label="模型与密钥设置"
            className="studio-action is-icon-only"
            disabled={进行中动作 === 'load'}
            onClick={() => 设设置弹窗开(true)}
            title="模型与密钥设置"
            type="button"
          >
            <Settings size={17} />
          </button>
          <button aria-label="帮助预留" className="studio-action is-icon-only" disabled title="帮助预留" type="button">
            <CircleHelp size={17} />
          </button>
          <div className="studio-avatar">K</div>
        </nav>
      </header>
      {顶部错误 && <div className="studio-error">{顶部错误}</div>}

      {/* ---- 三栏工作区 ---- */}
      <section className="studio-workspace">
        {/* 左栏：AI 创作助手(占位版，第二棒整体替换) */}
        <助手面板占位 工作台={工作台} />

        {/* 中栏：剧情流程图 */}
        <section className="studio-graph-panel">
          <div className="studio-graph-toolbar">
            <button className="studio-chapter-picker" disabled type="button">
              {章节组[0]?.chapter ?? '全部章节'}
              <ChevronDown size={15} />
            </button>
            <div className="studio-graph-stats">
              <迷你指标 label="场景" value={当前项目?.summary?.nodeCount ?? 0} />
              <迷你指标 label="分支" value={当前项目?.summary?.choiceCount ?? 0} />
              <迷你指标 label="结局" value={当前项目?.summary?.endingCount ?? 0} />
              <迷你指标 label="视觉缺口" value={视觉缺口数} />
            </div>
            <div className="studio-graph-tools">
              <div className="studio-graph-edit-actions" aria-label="节点编辑">
                <button disabled={!当前项目?.story || 忙碌} onClick={动作新增节点} title="新增节点" type="button">
                  <Plus size={17} />
                </button>
                <button disabled={!当前节点 || 忙碌} onClick={() => 动作插入节点()} title="在当前节点后插入" type="button">
                  <ListPlus size={17} />
                </button>
              </div>
              <div className="studio-view-toggle" aria-label="节点视图">
                <button className={中栏视图 === 'flow' ? 'is-active' : ''} onClick={() => 设中栏视图('flow')} title="流程图" type="button">
                  <Workflow size={17} />
                </button>
                <button className={中栏视图 === 'grid' ? 'is-active' : ''} onClick={() => 设中栏视图('grid')} title="网格" type="button">
                  <LayoutGrid size={17} />
                </button>
                <button className="is-warm" disabled title="关系图预留" type="button">
                  <Network size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className="studio-flow-body">
            <aside className="studio-chapter-rail">
              {章节组.map((章) => (
                <button
                  className={当前节点?.chapter === 章.chapter ? 'is-active' : ''}
                  key={章.chapter}
                  onClick={() => 设选中节点id(章.nodes[0]?.id ?? '')}
                  type="button"
                >
                  <strong>{章.chapter}</strong>
                  <span>{章.nodes.length} 场景</span>
                </button>
              ))}
            </aside>
            <div className={中栏视图 === 'grid' ? 'studio-node-grid' : 'studio-flow-canvas'}>
              {节点列表.length > 0 ? (
                节点列表.map((节点, 序) => {
                  const 节点资产 = 资产列表.find((资产) => (资产.usedByNodes ?? []).includes(节点.id));
                  return (
                    <节点卡片
                      key={节点.id}
                      节点={节点}
                      序号={序}
                      资产={节点资产}
                      忙碌={false}
                      选中={选中节点id === 节点.id}
                      禁用={忙碌}
                      拖动中={拖动节点id === 节点.id}
                      是悬停目标={悬停节点id === 节点.id && 拖动节点id !== 节点.id}
                      可上移={序 > 0}
                      可下移={序 < 节点列表.length - 1}
                      onDragStart={(事件) => {
                        事件.dataTransfer.effectAllowed = 'move';
                        事件.dataTransfer.setData('text/plain', 节点.id);
                        设拖动节点id(节点.id);
                        设悬停节点id('');
                      }}
                      onDragOver={() => {
                        if (拖动节点id && 拖动节点id !== 节点.id) 设悬停节点id(节点.id);
                      }}
                      onDragEnd={() => {
                        设拖动节点id('');
                        设悬停节点id('');
                      }}
                      onDrop={() => 动作拖拽落下(序)}
                      on选中={() => 设选中节点id(节点.id)}
                      on插入={() => 动作插入节点(节点.id)}
                      on上移={() => 动作移动节点(节点.id, 'up')}
                      on下移={() => 动作移动节点(节点.id, 'down')}
                      on编辑={() => {
                        设选中节点id(节点.id);
                        设编辑弹窗开(true);
                      }}
                    />
                  );
                })
              ) : (
                <div className="studio-empty-node">
                  <Film size={22} />
                  <strong>还没有节点</strong>
                  <button disabled={!当前项目?.story || 忙碌} onClick={动作新增节点} type="button">
                    <Plus size={15} />
                    新增节点
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="studio-graph-footer">
            <div className="studio-legend">
              <span>
                <Check size={13} /> 已完成
              </span>
              <span>
                <LoaderCircle size={13} /> 进行中
              </span>
              <span>
                <Circle size={13} /> 未开始
              </span>
              <span>
                <Lock size={13} /> 未解锁
              </span>
              <span>
                <KeyRound size={13} /> 关键节点
              </span>
            </div>
            <div className="studio-zoom">
              <button disabled type="button">
                -
              </button>
              <span>100%</span>
              <button disabled type="button">
                +
              </button>
              <button disabled title="适配画布" type="button">
                <Maximize size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* 右栏：资产/音乐/属性/数值/事件 */}
        <aside className="studio-asset-panel">
          <div className="studio-right-tabs">
            <button className={右栏tab === 'assets' ? 'is-active' : ''} onClick={() => 设右栏tab('assets')} type="button">
              <Image size={16} />
              视觉资产
            </button>
            <button className={右栏tab === 'music' ? 'is-active' : ''} onClick={() => 设右栏tab('music')} type="button">
              <Music size={16} />
              音乐设计
            </button>
            <button className={右栏tab === 'properties' ? 'is-active' : ''} onClick={() => 设右栏tab('properties')} type="button">
              <NotebookText size={16} />
              属性
            </button>
            <button className={右栏tab === 'numbers' ? 'is-active' : ''} onClick={() => 设右栏tab('numbers')} type="button">
              <SlidersHorizontal size={16} />
              数值
            </button>
            <button className={右栏tab === 'events' ? 'is-active' : ''} onClick={() => 设右栏tab('events')} type="button">
              <Zap size={16} />
              事件
            </button>
          </div>
          {右栏tab === 'assets' ? (
            <>
              <div className="studio-current-scene">
                <span>当前场景</span>
                <strong>{当前节点 ? `${当前节点序号 + 1}-${(当前节点.choices?.length ?? 0) + 1}` : '--'}</strong>
                <em>{当前节点?.title ?? '未选择节点'}</em>
                <button disabled={!当前节点 || 忙碌} onClick={() => 设编辑弹窗开(true)} type="button">
                  场景设置
                </button>
              </div>
              {当前节点 && (当前有图 || 当前有视频) && (
                <div className="studio-visual-mode" role="radiogroup" aria-label="主视觉">
                  <span>主视觉</span>
                  <button
                    aria-checked={主视觉 === 'image'}
                    className={主视觉 === 'image' ? 'is-active' : ''}
                    disabled={!当前有图 || 忙碌}
                    onClick={() => 切换主视觉('image')}
                    role="radio"
                    title={当前有图 ? '使用图片全景作为当前场景主视觉' : '当前场景还没有可用图片'}
                    type="button"
                  >
                    <Image size={14} />
                    图片
                  </button>
                  <button
                    aria-checked={主视觉 === 'video'}
                    className={主视觉 === 'video' ? 'is-active' : ''}
                    disabled={!当前有视频 || 忙碌}
                    onClick={() => 切换主视觉('video')}
                    role="radio"
                    title={当前有视频 ? '使用平面视频作为当前场景主视觉' : '当前场景还没有可用视频'}
                    type="button"
                  >
                    <Film size={14} />
                    视频
                  </button>
                </div>
              )}
              <div className="studio-hero-asset">
                {当前视觉预览 ? (
                  <img alt={绑定资产?.id ?? 当前节点?.title ?? '当前场景全景'} src={当前视觉预览} />
                ) : (
                  <div className="studio-asset-placeholder">
                    <Image size={26} />
                    <span>等待生成视觉资产</span>
                  </div>
                )}
                <div className="studio-asset-badges">
                  <span>{绑定资产 ? '绑定全景图' : 当前视觉预览 ? '剧情全景 · 只读' : '全景图'}</span>
                  <span>2:1</span>
                </div>
                <button disabled title="全屏预览预留" type="button">
                  <Expand size={16} />
                </button>
              </div>
              <div className="studio-asset-strip" aria-label="全景图缩略图列表">
                {资产列表.map((资产) => (
                  <资产缩略图
                    key={资产.id}
                    资产={资产}
                    选中={绑定资产?.id === 资产.id}
                    on选中={() => {
                      const 落点 = 资产.usedByNodes?.[0];
                      if (落点) 设选中节点id(落点);
                    }}
                  />
                ))}
              </div>
              <div className="studio-asset-actions">
                <label className={绑定资产 && !忙碌 ? '' : 'is-disabled'}>
                  <Upload size={16} />
                  上传视频
                  {绑定资产 && (
                    <input
                      accept="video/mp4,video/webm,video/quicktime"
                      disabled={忙碌}
                      onChange={(事件) => {
                        占位提示('上传视频');
                        事件.currentTarget.value = '';
                      }}
                      type="file"
                    />
                  )}
                </label>
                <label className={绑定资产 && !忙碌 ? '' : 'is-disabled'}>
                  <Upload size={16} />
                  上传替换
                  {绑定资产 && (
                    <input
                      accept="image/*"
                      disabled={忙碌}
                      onChange={(事件) => {
                        占位提示('上传替换');
                        事件.currentTarget.value = '';
                      }}
                      type="file"
                    />
                  )}
                </label>
                <button disabled={!绑定资产 || 忙碌} onClick={() => 占位提示('重新生成')} type="button">
                  <RotateCcw size={16} />
                  重新生成
                </button>
                <button
                  disabled={!绑定资产 || 绑定资产.status !== 'generated-image' || 忙碌}
                  onClick={() => 占位提示('局部重绘')}
                  title="使用当前图片作为输入，调用图片编辑接口做局部重绘。"
                  type="button"
                >
                  <ImagePlus size={16} />
                  局部重绘
                </button>
              </div>
            </>
          ) : 右栏tab === 'music' ? (
            <section className="studio-music-panel">
              {/* 音乐生成细节归第二棒；这里保留场景头 + 线上无音轨时的占位表 */}
              <div className="studio-current-scene">
                <span>当前场景</span>
                <strong>{当前节点 ? `${当前节点序号 + 1}-${(当前节点.choices?.length ?? 0) + 1}` : '--'}</strong>
                <em>{当前节点?.title ?? '未选择节点'}</em>
                <button disabled type="button">
                  <Save size={14} />
                  保存
                </button>
              </div>
              <占位面板
                icon={<Music size={18} />}
                title="音乐设计"
                rows={[
                  ['状态', 当前项目?.musicDesign ? '等待选择节点' : '未初始化'],
                  ['模型', 健康状态?.musicModel || 'suno_music_open'],
                  ['当前节点', 当前节点?.id ?? '--'],
                ]}
              />
            </section>
          ) : 右栏tab === 'properties' ? (
            <占位面板
              icon={<NotebookText size={18} />}
              title="节点属性表"
              rows={[
                ['节点 ID', 当前节点?.id ?? '--'],
                ['章节', 当前节点?.chapter ?? '--'],
                ['地点', 当前节点?.location ?? '--'],
                ['对白', String(当前节点?.lines?.length ?? 0)],
                ['选择', String(当前节点?.choices?.length ?? 0)],
              ]}
            />
          ) : 右栏tab === 'numbers' ? (
            <占位面板
              icon={<SlidersHorizontal size={18} />}
              title="数值表预留"
              rows={[
                ['信任值', '待接入'],
                ['风险值', '待接入'],
                ['隐藏 boss 触发', '待接入'],
                ['结局权重', `${当前项目?.summary?.endingCount ?? 0} 个结局`],
              ]}
            />
          ) : (
            <占位面板
              icon={<Zap size={18} />}
              title="事件表预留"
              rows={[
                ['进入节点', 当前节点?.id ?? '--'],
                ['选择反馈', `${当前节点?.choices?.length ?? 0} 条`],
                ['奖励事件', '待接入'],
                ['延迟惩罚', '待接入'],
              ]}
            />
          )}
        </aside>
      </section>

      {/* ---- 底部就绪状态条 ---- */}
      <就绪状态条
        项目={当前项目}
        qa报告={当前项目?.qaReport}
        图片任务进行中={false}
        语音任务进行中={false}
      />

      {/* ---- 弹窗层 ---- */}
      {当前项目?.story && 当前节点 && 编辑弹窗开 && (
        <节点编辑弹窗
          节点={当前节点}
          全部节点={节点列表}
          绑定资产={绑定资产}
          忙碌={忙碌}
          保存中={进行中动作 === 'save-graph'}
          有未保存修改={有未保存修改}
          健康状态={健康状态}
          on改节点={改节点}
          on改对白={改对白}
          on加对白={加对白}
          on删对白={删对白}
          on改单句音色={改单句音色}
          on改选择={改选择}
          on改选择JSON={改选择JSON}
          on加选择={加选择}
          on删选择={删选择}
          on保存={保存修改}
          on删除节点={动作删除节点}
          on关闭={() => 设编辑弹窗开(false)}
          占位提示={占位提示}
        />
      )}
      {新建弹窗开 && (
        <新建项目弹窗
          标题={新建标题}
          设标题={设新建标题}
          slug={新建slug}
          设slug={设新建slug}
          创建中={进行中动作 === 'create-project'}
          忙碌={忙碌}
          on提交={提交新建}
          on关闭={() => 设新建弹窗开(false)}
        />
      )}
      {精选弹窗开 && (
        <精选弹窗
          加载中={精选加载中}
          候选项目={精选候选}
          精选slugs={精选slugs}
          默认slug={默认Demo}
          保存中={false}
          on勾选={切换精选}
          on设默认={设默认Demo}
          on保存={保存精选}
          on关闭={() => 设精选弹窗开(false)}
        />
      )}
      {设置弹窗开 && (
        <设置弹窗
          on关闭={() => 设设置弹窗开(false)}
        />
      )}
    </main>
  );
}
