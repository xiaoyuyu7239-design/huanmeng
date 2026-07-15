// 播放器总控：把剧情引擎、全景、音频、存档和界面组件接成一条完整可玩的链路。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  RotateCcw,
  Save,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

import 全景视图 from './全景渲染/全景视图.jsx';
import 顶部栏 from './界面组件/顶部栏.jsx';
import 状态栏 from './界面组件/状态栏.jsx';
import 对白区 from './界面组件/对白区.jsx';
import {
  STORY_TITLE,
  getVisibleScoreDefinitions,
  storyNodeList,
} from './剧情引擎/剧情加载.js';
import {
  创建初始状态,
  取当前节点,
  已到最后一行,
  推进对白,
  做出选择,
  点击热点,
  可用选择列表,
  锁定选择列表,
  找解锁热点,
  锁定提示,
  结局已达成,
  本周目决策,
  本周目因果回放,
  生成选择反馈,
  命运类型显示名,
  条件满足,
  更新设置,
} from './剧情引擎/状态与结算.js';
import {
  保存存档,
  读取存档,
  删除存档,
  导出存档码,
  导入存档码,
  清空重开,
  进入下一轮,
} from './剧情引擎/存档系统.js';
import {
  播放界面音效,
  销毁音频,
  批量销毁引用,
  语音已启用,
  语音音量,
  创建对白语音,
  切换对白语音,
  场景声音模式,
  取节点音乐轨列表,
  音乐轨key,
  更新BGM轨,
  创建自动播放解锁器,
  试听已禁用,
} from './音频系统/音频管理.js';
import { 取平面视频地址 } from './全景渲染/视觉模式.js';

export default function 播放器应用() {
  const [state, setState] = useState(() => 读取存档() ?? 创建初始状态());
  const [当前面板, set当前面板] = useState(null);
  const [提示, set提示] = useState(null);
  const [选择反馈, set选择反馈] = useState(null);
  const [引导热点, set引导热点] = useState(null);
  const [语音状态, set语音状态] = useState('idle');

  const 语音ref = useRef(null);
  const 语音版本ref = useRef(0);
  const 生成音乐ref = useRef(null);
  const 上传音乐ref = useRef(null);
  const 生成音乐keyRef = useRef('');
  const 上传音乐keyRef = useRef('');
  const 音乐解锁器ref = useRef(null);
  const 存档失败已提示ref = useRef(false);

  const 节点 = 取当前节点(state);
  const 行 = 节点.lines[state.lineIndex] ?? 节点.lines[0] ?? { speaker: 'system', text: '当前节点没有对白。' };
  const voiceSrc = 行.voiceSrc ?? '';
  const 平面视频src = 取平面视频地址(节点);
  const 声音模式 = 场景声音模式(节点, state.settings.audio.sceneAudioDefault);
  const 可播放语音 = 语音已启用(state.settings.audio);
  const 当前语音音量 = 语音音量(state.settings.audio);
  const 视频声音开启 =
    !!平面视频src && 可播放语音 && (声音模式 === 'video' || 声音模式 === 'mix' || !voiceSrc);
  const 自动播放语音 =
    !!voiceSrc && 可播放语音 && (声音模式 === 'voice' || 声音模式 === 'mix' || !平面视频src);
  const 到最后一行 = 已到最后一行(state);
  const 已达成结局 = 结局已达成(state);

  const 可选项 = useMemo(() => (到最后一行 ? 可用选择列表(state) : []), [到最后一行, state]);
  const 锁定项 = useMemo(() => (到最后一行 ? 锁定选择列表(state) : []), [到最后一行, state]);
  const 可见分数定义 = useMemo(() => getVisibleScoreDefinitions(), []);
  const 结局回放 = useMemo(() => 本周目因果回放(state), [state]);
  const 音乐轨 = useMemo(() => 取节点音乐轨列表(节点), [节点]);
  const 音乐签名 = 音乐轨.map(音乐轨key).join('|');

  const 播音效 = useCallback(
    (名字) => 播放界面音效(名字, state.settings.audio),
    [state.settings.audio],
  );

  const 清理全部音频 = useCallback(() => {
    语音版本ref.current += 1;
    音乐解锁器ref.current?.清理();
    音乐解锁器ref.current = null;
    批量销毁引用(语音ref, 生成音乐ref, 上传音乐ref);
    生成音乐keyRef.current = '';
    上传音乐keyRef.current = '';
  }, []);

  useEffect(() => {
    document.title = STORY_TITLE;
  }, []);

  useEffect(() => {
    set引导热点(null);
  }, [节点.id]);

  useEffect(() => {
    try {
      if (!保存存档(state)) throw new Error('storage unavailable');
      存档失败已提示ref.current = false;
    } catch {
      if (!存档失败已提示ref.current) {
        存档失败已提示ref.current = true;
        set提示({ title: '自动存档失败', body: '浏览器存储不可用，请导出存档码保留进度。' });
      }
    }
  }, [state]);

  useEffect(() => {
    if (!提示) return undefined;
    const 定时器 = window.setTimeout(() => set提示(null), 3600);
    return () => window.clearTimeout(定时器);
  }, [提示]);

  useEffect(() => {
    if (!选择反馈) return undefined;
    const 定时器 = window.setTimeout(() => set选择反馈(null), 5200);
    return () => window.clearTimeout(定时器);
  }, [选择反馈]);

  // 换行时销毁上一句语音；有语音且当前场景允许时自动播放。
  useEffect(() => {
    const 当前版本 = ++语音版本ref.current;
    const 安全设置语音状态 = (状态) => {
      if (语音版本ref.current === 当前版本) set语音状态(状态);
    };
    销毁音频(语音ref.current);
    语音ref.current = null;
    if (!voiceSrc) {
      set语音状态('missing');
      return undefined;
    }
    if (!自动播放语音) {
      set语音状态('idle');
      return undefined;
    }
    const 音频 = 创建对白语音(voiceSrc, 当前语音音量, 安全设置语音状态);
    语音ref.current = 音频;
    return () => {
      if (语音版本ref.current === 当前版本) 语音版本ref.current += 1;
      销毁音频(音频);
      if (语音ref.current === 音频) 语音ref.current = null;
    };
  }, [voiceSrc, 节点.id, 当前语音音量, 自动播放语音, state.lineIndex]);

  // BGM 采用生成/上传双轨，同一首歌跨节点不重建，保证连续播放。
  useEffect(() => {
    音乐解锁器ref.current?.清理();
    const 解锁器 = 创建自动播放解锁器(() => [生成音乐ref.current, 上传音乐ref.current]);
    let 仍然有效 = true;
    const 请求解锁 = () => {
      if (仍然有效) 解锁器.请求解锁();
    };
    音乐解锁器ref.current = 解锁器;
    const 按来源 = new Map(音乐轨.map((轨) => [轨.source, 轨]));
    更新BGM轨({
      轨: 按来源.get('generated'),
      元素引用: 生成音乐ref,
      key引用: 生成音乐keyRef,
      音频设置: state.settings.audio,
      自动播放被拦: 请求解锁,
    });
    更新BGM轨({
      轨: 按来源.get('uploaded'),
      元素引用: 上传音乐ref,
      key引用: 上传音乐keyRef,
      音频设置: state.settings.audio,
      自动播放被拦: 请求解锁,
    });
    return () => {
      仍然有效 = false;
      解锁器.清理();
      if (音乐解锁器ref.current === 解锁器) 音乐解锁器ref.current = null;
    };
  }, [
    音乐签名,
    音乐轨,
    state.settings.audio.bgmMuted,
    state.settings.audio.bgmVolume,
    state.settings.audio.masterMuted,
    state.settings.audio.masterVolume,
    state.settings.audio.muted,
  ]);

  useEffect(() => {
    // 进入 BFCache 时页面只是冻结，不能把音轨销毁；否则返回后 effects 不会重建它们。
    const 离开页面 = (事件) => {
      if (!事件.persisted) 清理全部音频();
    };
    window.addEventListener('pagehide', 离开页面);
    return () => {
      window.removeEventListener('pagehide', 离开页面);
      清理全部音频();
    };
  }, [清理全部音频]);

  const 推进 = () => {
    if (到最后一行) return;
    播音效('advance');
    setState((旧) => 推进对白(旧));
  };

  const 切换语音 = () => {
    if (!voiceSrc || !可播放语音) return;
    const 当前版本 = 语音版本ref.current;
    语音ref.current = 切换对白语音({
      现有音频: 语音ref.current,
      src: voiceSrc,
      音量: 当前语音音量,
      设状态: (状态) => {
        if (语音版本ref.current === 当前版本) set语音状态(状态);
      },
    });
  };

  const 选择 = (选项) => {
    播音效(选项.major ? 'choiceMajor' : 'choice');
    set引导热点(null);
    set选择反馈(生成选择反馈(选项));
    setState((旧) => 做出选择(旧, 选项));
    set提示({
      title: 选项.major ? '路线发生变化' : '选择已记录',
      body: 选项.consequence ?? 选项.caption ?? '你的选择会影响信任、压力和结局。',
    });
  };

  const 触发热点 = (热点) => {
    播音效('success');
    set引导热点((旧) => (旧?.id === 热点.id ? null : 旧));
    setState((旧) => 点击热点(旧, 热点.id, 热点.effect));
    set提示({ title: 热点.label, body: 热点.description });
  };

  const 点击锁定项 = (选项) => {
    const 热点 = 找解锁热点(节点, 选项);
    播音效('error');
    if (热点) {
      set引导热点({ id: 热点.id, focusKey: Date.now() });
      set提示({
        title: '需要先发现线索',
        body: `请点击场景中的「${热点.label}」：${热点.description}`,
      });
      return;
    }
    set提示({
      title: '还不能进入下一场景',
      body: 选项.lockedHint ?? '这个选择还缺少解锁条件，请先调查当前场景中的线索。',
    });
  };

  const 重开 = () => {
    if (!window.confirm('确定重新开始？当前存档会被清空。')) return;
    播音效('back');
    try {
      删除存档();
    } catch {}
    setState((旧) => 清空重开(旧.settings));
    set当前面板(null);
    set选择反馈(null);
    set提示({ title: '已重新开始', body: '故事又回到了第一帧。' });
  };

  const 下一轮 = () => {
    播音效('back');
    setState((旧) => 进入下一轮(旧));
    set当前面板(null);
    set选择反馈(null);
    set提示({ title: '下一轮已开启', body: '已保留结局记录与跨周目记忆。' });
  };

  const 导出 = async () => {
    const 存档码 = 导出存档码(state);
    try {
      await navigator.clipboard.writeText(存档码);
      播音效('success');
      set提示({ title: '存档已复制', body: '导入时粘贴这段存档码即可。' });
    } catch {
      播音效('click');
      window.prompt('复制存档码', 存档码);
    }
  };

  const 导入 = () => {
    const 存档码 = window.prompt('粘贴存档码');
    if (!存档码) return;
    const 新状态 = 导入存档码(存档码);
    if (!新状态) {
      播音效('error');
      set提示({ title: '导入失败', body: '存档码无法解析。' });
      return;
    }
    播音效('success');
    setState(新状态);
    set当前面板(null);
    set选择反馈(null);
    set提示({ title: '导入成功', body: '已载入外部存档。' });
  };

  const 切换面板 = (面板) => {
    const 是关闭 = 当前面板 === 面板;
    播音效(是关闭 ? 'panelClose' : 'panelOpen');
    set当前面板(是关闭 ? null : 面板);
  };

  const 关闭面板 = () => {
    播音效('panelClose');
    set当前面板(null);
  };

  const 返回创作台 = () => {
    清理全部音频();
    window.location.assign('/creator');
  };

  return (
    <main className={`game-shell scale-${state.settings.uiScale}`}>
      <全景视图
        autoDrift={state.settings.autoDrift}
        highlightedHotspotFocusKey={引导热点?.focusKey ?? 0}
        highlightedHotspotId={引导热点?.id ?? ''}
        hotspots={节点.hotspots}
        node={节点}
        onHotspot={触发热点}
        reducedMotion={state.settings.reducedMotion}
        seenHotspots={state.seenHotspots}
        videoAudioEnabled={视频声音开启}
        videoVolume={当前语音音量}
      />

      <顶部栏
        剧情标题={STORY_TITLE}
        节点={节点}
        当前面板={当前面板}
        切换面板={切换面板}
        返回创作台={返回创作台}
      />

      <状态栏 state={state} 可见分数定义={可见分数定义} />

      <section className="dialogue-dock">
        <对白区
          行={行}
          语音状态={语音状态}
          语音禁用={!voiceSrc || !可播放语音}
          点语音={切换语音}
          已到最后一行={到最后一行}
          点继续={推进}
        />

        {选择反馈 && !已达成结局 && (
          <选择反馈板
            feedback={选择反馈}
            onClose={() => {
              播音效('panelClose');
              set选择反馈(null);
            }}
          />
        )}

        {到最后一行 && !已达成结局 && (
          <div className="choice-grid">
            {可选项.map((选项) => (
              <button
                className={选项.major ? 'choice-card is-major' : 'choice-card'}
                key={选项.id}
                onClick={() => 选择(选项)}
                type="button"
              >
                {选项.fateType && (
                  <i className={`fate-badge fate-${选项.fateType}`}>
                    {命运类型显示名(选项.fateType)}
                  </i>
                )}
                <span>{选项.label}</span>
                {选项.caption && <small>{选项.caption}</small>}
              </button>
            ))}
            {锁定项.map((选项) => (
              <button
                aria-label={`${选项.label} 需要先发现线索`}
                className="choice-card is-locked"
                key={选项.id}
                onClick={() => 点击锁定项(选项)}
                type="button"
              >
                <span className={`lock-label fate-${选项.fateType ?? 'web'}`}>
                  {命运类型显示名(选项.fateType)}
                </span>
                <span>{选项.label}</span>
                <small>{锁定提示(节点, 选项)}</small>
              </button>
            ))}
            {可选项.length === 0 && 锁定项.length === 0 && (
              <div className="choice-empty">
                <strong>暂无可前往的下一步</strong>
                <span>当前节点没有可用选择，请回到创作台检查节点分支配置。</span>
              </div>
            )}
          </div>
        )}

        {已达成结局 && (
          <结局板 节点={节点} 回放={结局回放} onExport={导出} onNextLoop={下一轮} onReset={重开} />
        )}
      </section>

      {当前面板 && (
        <侧面板 title={{ memories: '回忆', save: '存档', settings: '设置' }[当前面板]} onClose={关闭面板}>
          {当前面板 === 'memories' && <回忆面板 currentNode={节点} state={state} />}
          {当前面板 === 'settings' && (
            <设置面板
              settings={state.settings}
              onChange={(增量) => setState((旧) => 更新设置(旧, 增量))}
              onPreview={播音效}
            />
          )}
          {当前面板 === 'save' && (
            <存档面板 lastSavedAt={state.lastSavedAt} onExport={导出} onImport={导入} onReset={重开} />
          )}
        </侧面板>
      )}

      {提示 && (
        <div aria-live="polite" className="toast" role="status">
          <strong>{提示.title}</strong>
          <span>{提示.body}</span>
        </div>
      )}
    </main>
  );
}

function 选择反馈板({ feedback, onClose }) {
  return (
    <section className="choice-feedback-panel">
      <div className="choice-feedback-copy">
        <i className={`fate-badge fate-${feedback.fateType ?? 'web'}`}>
          {命运类型显示名(feedback.fateType)}
        </i>
        <strong>{feedback.label}</strong>
        {feedback.consequence && <p>{feedback.consequence}</p>}
      </div>
      <div className="choice-feedback-grid">
        <反馈列表 title="状态变化" entries={feedback.changes} empty="没有直接数值变化" />
        <反馈列表 title="因果记录" entries={feedback.unlocks} empty="没有新增记忆或标记" />
      </div>
      <button aria-label="关闭选择反馈" onClick={onClose} title="关闭选择反馈" type="button">
        <X size={16} />
      </button>
    </section>
  );
}

function 反馈列表({ title, entries, empty }) {
  const 列表 = entries.length > 0 ? entries : [empty];
  return (
    <div className={entries.length > 0 ? 'choice-feedback-list' : 'choice-feedback-list is-empty'}>
      <span>{title}</span>
      <ul>{列表.map((条, 索引) => <li key={`${条}-${索引}`}>{条}</li>)}</ul>
    </div>
  );
}

function 结局回放({ entries }) {
  const 列表 = entries.length
    ? entries
    : [{ id: 'empty', fateType: 'web', nodeTitle: '没有可回放的选择', consequence: '这个结局没有记录到本周目的关键选择。' }];
  return (
    <div className="ending-recap">
      <h3>因果回放</h3>
      <ol>
        {列表.map((条) => (
          <li key={条.id}>
            <span>{命运类型显示名(条.fateType)}</span>
            <strong>{条.nodeTitle}</strong>
            <p>{条.consequence ?? 条.label}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function 结局板({ 节点, 回放, onExport, onNextLoop, onReset }) {
  return (
    <div className={`ending-panel type-${节点.ending?.type ?? 'growth'}`}>
      <span>结局达成</span>
      <strong>{节点.ending?.title}</strong>
      <p>{节点.ending?.subtitle}</p>
      <结局回放 entries={回放} />
      <div className="ending-actions">
        <button onClick={onExport} type="button"><Download size={17} />导出存档</button>
        <button onClick={onNextLoop} type="button"><RotateCcw size={17} />进入下一轮</button>
        <button onClick={onReset} type="button"><RotateCcw size={17} />清空重开</button>
      </div>
    </div>
  );
}

function 侧面板({ title, onClose, children }) {
  return (
    <aside aria-label={title} className="side-panel">
      <div className="panel-head">
        <strong>{title}</strong>
        <button aria-label="关闭" onClick={onClose} title="关闭" type="button"><X size={18} /></button>
      </div>
      {children}
    </aside>
  );
}

function 回忆面板({ currentNode, state }) {
  const [标签, set标签] = useState('gallery');
  const 已到达 = storyNodeList.filter((节点) => state.visitedNodes.includes(节点.id));
  const 已解锁结局 = storyNodeList.filter((节点) => state.unlockedEndings.includes(节点.id) && 节点.ending);
  return (
    <div className="memory-panel">
      <div className="current-memory">
        <BookOpen size={18} />
        <div><strong>{currentNode.title}</strong><span>{currentNode.synopsis}</span></div>
      </div>
      <div className="loop-summary">
        <span>当前第 {state.loopCount} 周目</span>
        <strong>{state.unlockedEndings.length} 个结局已解锁</strong>
      </div>
      <div className="memory-tabs">
        <button className={标签 === 'gallery' ? 'is-active' : ''} onClick={() => set标签('gallery')} type="button">回忆</button>
        <button className={标签 === 'fate-map' ? 'is-active' : ''} onClick={() => set标签('fate-map')} type="button">命运地图</button>
      </div>
      {标签 === 'gallery' ? (
        <div className="memory-columns">
          <记忆栏目 title="已到达场景" entries={已到达.map((节点) => ({ tag: 节点.chapter, text: 节点.title }))} />
          <记忆栏目 title="已解锁结局" entries={已解锁结局.map((节点) => ({ tag: '结局', text: 节点.ending.title ?? 节点.title }))} empty="还没有完成任何结局" />
          <记忆栏目 title="已发现回忆" entries={state.memories.map((条) => ({ tag: '记忆', text: 条 }))} empty="还没有发现隐藏回忆" />
          <记忆栏目 title="跨周目记忆" entries={state.persistentMemories.map((条) => ({ tag: '轮回', text: 条 }))} empty="下一轮后会保留关键记忆" />
        </div>
      ) : <命运地图 state={state} visitedNodes={已到达} />}
    </div>
  );
}

function 记忆栏目({ title, entries, empty }) {
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {entries.length > 0
          ? entries.map((条, 索引) => <li key={`${条.tag}-${条.text}-${索引}`}><span>{条.tag}</span><strong>{条.text}</strong></li>)
          : <li><strong>{empty}</strong></li>}
      </ul>
    </section>
  );
}

function 命运地图({ state, visitedNodes }) {
  const 本轮选择 = 本周目决策(state);
  const 隐藏可能 = visitedNodes.flatMap((节点) =>
    节点.choices
      .filter((选项) => 选项.condition && !条件满足(state, 选项.condition))
      .map((选项) => ({ 节点, 选项 })),
  );
  const 所有结局 = storyNodeList.filter((节点) => 节点.ending);
  return (
    <div className="fate-map-panel">
      <section>
        <h3>命运长河</h3>
        <ol className="fate-node-list">
          {visitedNodes.map((节点, 索引) => <li key={节点.id}><span>{String(索引 + 1).padStart(2, '0')}</span><strong>{节点.title}</strong><em>{节点.ending ? '结局' : 节点.chapter}</em></li>)}
        </ol>
      </section>
      <section>
        <h3>本周目关键选择</h3>
        <ol className="fate-decision-list">
          {(本轮选择.length ? 本轮选择 : [{ id: 'empty', fateType: 'web', nodeTitle: '还没有关键选择', consequence: '推进到第一个选择后，命运地图会记录你的行动。' }]).map((条) => (
            <li key={条.id}><i className={`fate-badge fate-${条.fateType ?? 'web'}`}>{命运类型显示名(条.fateType)}</i><strong>{条.nodeTitle}</strong><p>{条.consequence ?? 条.label}</p></li>
          ))}
        </ol>
      </section>
      <section>
        <h3>未显现的可能</h3>
        <ul className="fate-lock-list">
          {(隐藏可能.length ? 隐藏可能 : [{ 节点: { id: 'empty', title: '暂时没有被锁住的路线' }, 选项: { id: 'empty', fateType: 'wheel', lockedHint: '继续推进或进入下一周目后，会出现更多隐藏条件。' } }]).map(({ 节点, 选项 }) => (
            <li key={`${节点.id}-${选项.id}`}><span className={`lock-label fate-${选项.fateType ?? 'web'}`}>{命运类型显示名(选项.fateType)}</span><strong>{节点.title}</strong><p>{选项.lockedHint ?? '这里似乎还有另一种可能。'}</p></li>
          ))}
        </ul>
      </section>
      <section>
        <h3>结局图谱</h3>
        <ul className="fate-ending-list">
          {所有结局.map((节点) => {
            const 已解锁 = state.unlockedEndings.includes(节点.id);
            return <li className={已解锁 ? 'is-unlocked' : ''} key={节点.id}><span>{已解锁 ? '已解锁' : '未解锁'}</span><strong>{节点.ending.title ?? 节点.title}</strong></li>;
          })}
        </ul>
      </section>
    </div>
  );
}

function 设置面板({ settings, onChange, onPreview }) {
  const 改音频 = (增量) => onChange({ audio: 增量 });
  const audio = settings.audio;
  return (
    <div className="settings-panel">
      <开关行 label="自动环视" description="暂停操作后缓慢移动视角" checked={settings.autoDrift} onChange={(值) => onChange({ autoDrift: 值 })} />
      <开关行 label="减少动效" description="关闭环境漂移和部分过渡" checked={settings.reducedMotion} onChange={(值) => onChange({ reducedMotion: 值 })} />
      <开关行 label="声音" description="启用界面反馈音和对白语音" checked={!audio.muted} onChange={(值) => 改音频({ muted: !值 })} />
      <音量行 label="总音量" value={audio.masterVolume} muted={audio.masterMuted} onMute={() => 改音频({ masterMuted: !audio.masterMuted })} onChange={(值) => 改音频({ masterVolume: 值 })} />
      <音量行 label="界面音效" value={audio.uiVolume} muted={audio.uiMuted} inheritedMuted={audio.masterMuted} onMute={() => 改音频({ uiMuted: !audio.uiMuted })} onChange={(值) => 改音频({ uiVolume: 值 })} />
      <音量行 label="对白语音" value={audio.voiceVolume} muted={audio.voiceMuted} inheritedMuted={audio.masterMuted} onMute={() => 改音频({ voiceMuted: !audio.voiceMuted })} onChange={(值) => 改音频({ voiceVolume: 值 })} />
      <div className={audio.masterMuted ? 'volume-row is-muted' : 'volume-row'}>
        <div className="volume-row-head"><Volume2 size={15} /><strong>默认节点声音</strong><small>{{ voice: '语音', video: '视频', mix: '同时' }[audio.sceneAudioDefault]}</small></div>
        <div aria-label="默认节点声音" className="segmented is-three" role="radiogroup">
          {[['voice', '生成语音'], ['video', '视频原声'], ['mix', '同时播放']].map(([值, 文案]) => (
            <button aria-checked={audio.sceneAudioDefault === 值} className={audio.sceneAudioDefault === 值 ? 'is-active' : ''} key={值} onClick={() => { onPreview('click'); 改音频({ sceneAudioDefault: 值 }); }} role="radio" type="button">{文案}</button>
          ))}
        </div>
      </div>
      <音量行 label="背景音乐" value={audio.bgmVolume} muted={audio.bgmMuted} inheritedMuted={audio.masterMuted} onMute={() => 改音频({ bgmMuted: !audio.bgmMuted })} onChange={(值) => 改音频({ bgmVolume: 值 })} />
      <button className="audio-preview-button" disabled={试听已禁用(audio)} onClick={() => onPreview('success')} type="button"><Volume2 size={16} />试听</button>
      <div className="segmented">
        <button className={settings.uiScale === 'comfortable' ? 'is-active' : ''} onClick={() => onChange({ uiScale: 'comfortable' })} type="button">舒展</button>
        <button className={settings.uiScale === 'compact' ? 'is-active' : ''} onClick={() => onChange({ uiScale: 'compact' })} type="button">紧凑</button>
      </div>
    </div>
  );
}

function 开关行({ label, description, checked, onChange }) {
  return (
    <label className="toggle-row">
      <input checked={checked} onChange={(事件) => onChange(事件.target.checked)} type="checkbox" />
      <span><strong>{label}</strong><small>{description}</small></span>
    </label>
  );
}

function 音量行({ label, value, muted, inheritedMuted = false, onMute, onChange }) {
  const 有效静音 = muted || inheritedMuted || value <= 0;
  const 提示 = muted ? `取消${label}静音` : inheritedMuted ? `${label}受总音量静音影响` : `${label}静音`;
  return (
    <div className={有效静音 ? 'volume-row is-muted' : 'volume-row'}>
      <div className="volume-row-head">
        <button aria-label={`${label}静音`} className={`volume-mute ${muted ? 'is-muted' : ''} ${inheritedMuted ? 'is-inherited' : ''}`} disabled={inheritedMuted} onClick={onMute} title={提示} type="button">
          {有效静音 ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <strong>{label}</strong><small>{Math.round(value * 100)}%</small>
      </div>
      <input aria-label={`${label}音量`} max="1" min="0" onChange={(事件) => onChange(Number(事件.target.value))} step="0.05" type="range" value={value} />
    </div>
  );
}

function 存档面板({ lastSavedAt, onExport, onImport, onReset }) {
  const 时间 = Number.isFinite(lastSavedAt) ? new Date(lastSavedAt).toLocaleString() : '尚未保存';
  return (
    <div className="save-panel">
      <div className="save-time"><Save size={20} /><div><strong>自动存档</strong><span>{时间}</span></div></div>
      <div className="save-actions">
        <button onClick={onExport} type="button"><Download size={17} />导出</button>
        <button onClick={onImport} type="button"><Upload size={17} />导入</button>
        <button className="danger" onClick={onReset} type="button"><RotateCcw size={17} />重开</button>
      </div>
    </div>
  );
}
