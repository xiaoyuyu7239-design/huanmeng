import React from 'react';
import {
  ArrowRight,
  BookHeart,
  BriefcaseBusiness,
  Check,
  Compass,
  Eye,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import 首页文摘 from '../../公共资源/homepage-digest.json';
import { 主视觉选展 } from './首页体验展示.js';

const 关系维度 = [
  ['心动', '靠近不是默认答案'],
  ['信任', '承诺需要被兑现'],
  ['边界', '拒绝始终会被尊重'],
];

function 区块标题({ eyebrow, title, description, align = 'left' }) {
  return (
    <header className={`hx-section-head hx-section-head--${align} reveal`}>
      <span className="hx-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </header>
  );
}

function 播放按钮({ href, children, secondary = false }) {
  return (
    <a className={`hx-button ${secondary ? 'hx-button--secondary' : 'hx-button--primary'}`} href={href}>
      {children}
      <ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} />
    </a>
  );
}

function 内容提示({ notes, 来源 }) {
  if (!notes?.length) return null;
  return (
    <p className="hx-content-note">
      <ShieldCheck aria-hidden="true" size={15} />
      内容提示{来源 ? `（《${来源}》）` : ''}：{notes.join('、')}。
    </p>
  );
}

// 剧情装置：从 23:40:00 走到零点前一秒后循环，只做叙事氛围，不代表任何真实直播。
// SSR 与 reduced-motion 均停留在初始帧「23:40:00 · 距零点 20:00」。
const 倒计时总秒数 = 20 * 60;
const 补零 = (数值) => String(数值).padStart(2, '0');

function 直播倒计时() {
  const [剩余秒, set剩余秒] = React.useState(倒计时总秒数);
  React.useEffect(() => {
    const 偏好 = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let 定时器 = 0;
    // 与核心体验区同约：运行中切换“减少动态”偏好也要立即冻结/恢复走字。
    const 同步 = () => {
      window.clearInterval(定时器);
      if (偏好?.matches) return;
      定时器 = window.setInterval(() => {
        set剩余秒((当前) => (当前 <= 1 ? 倒计时总秒数 : 当前 - 1));
      }, 1000);
    };
    偏好?.addEventListener?.('change', 同步);
    同步();
    return () => {
      偏好?.removeEventListener?.('change', 同步);
      window.clearInterval(定时器);
    };
  }, []);

  const 总秒 = (23 * 60 + 40) * 60 + (倒计时总秒数 - 剩余秒);
  const 时钟 = `${补零(Math.floor(总秒 / 3600) % 24)}:${补零(Math.floor((总秒 % 3600) / 60))}:${补零(总秒 % 60)}`;
  const 剩余 = `${补零(Math.floor(剩余秒 / 60))}:${补零(剩余秒 % 60)}`;
  return (
    <strong>
      {时钟} · 距零点 {剩余}
    </strong>
  );
}

export function 玩家主视觉({ 首页 }) {
  if (!首页.storyReady) {
    return (
      <section className="hx-hero hx-hero--fallback" id="top">
        <div className="hx-wrap">
          <span className="hx-eyebrow">幻梦</span>
          <h1>故事正在准备开启。</h1>
          <p>你仍然可以从世界列表选择一部已发布的互动故事。</p>
          <播放按钮 href={首页.playAction.href}>查看可玩世界</播放按钮>
        </div>
      </section>
    );
  }

  const { playAction, story } = 首页;
  // 立绘拼贴改为跨作品女主同台：选展只配置作品顺序，立绘与姓名从首页文摘的正式 cast 解析。
  const 拼贴位 = [
    { 位置: 'main', par: 5, 优先: true },
    { 位置: 'front', par: 8 },
    { 位置: 'back', par: 11 },
  ];
  const 立绘组 = 主视觉选展
    .map((slug) => 首页文摘.works.find((作品) => 作品.slug === slug))
    .filter((作品) => 作品?.protagonist?.portrait)
    .slice(0, 拼贴位.length)
    .map((作品, 索引) => ({ 作品, ...拼贴位[索引] }));
  const 头部作品 = 首页文摘.works.slice(0, 3).map((作品) => `《${作品.title}》`).join('');
  // 世界数取运行时精选（远端与本机发布会扩充世界网格），避免与页内其他区块口径打架。
  const 世界数 = 首页.worlds?.length ?? 首页文摘.totals.works;
  return (
    <section className="hx-hero" id="top">
      <div className="hx-stars" aria-hidden="true" data-par="-6" />
      <div className="hx-hero-aurora" aria-hidden="true" />
      <div className="hx-wrap hx-hero-grid">
        <div className="hx-hero-copy reveal">
          <span className="hx-eyebrow">女性向互动叙事平台 · {世界数} 个可玩世界</span>
          <h1>
            这一次，故事会记住
            <em>你如何选择。</em>
          </h1>
          <p className="hx-hero-lead">
            {头部作品}……{世界数} 个世界同时亮灯，每一个都会记住你的选择。
          </p>
          <p className="hx-hero-promise">
            故事不是问你选谁，而是记住你保全了什么、拒绝了什么，以及决定权最终留在谁手里。
          </p>
          <div className="hx-actions">
            <播放按钮 href={playAction.href}>{playAction.label}</播放按钮>
            <a className="hx-text-link" href="#worlds">
              浏览全部世界 <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hx-hero-meta" role="list" aria-label="平台一览">
            <div role="listitem">
              <span>{世界数}</span>
              <small>可玩世界</small>
            </div>
            <div role="listitem">
              <span>360°</span>
              <small>全景调查现场</small>
            </div>
            <div role="listitem">
              <span>{首页文摘.totals.publicEndings}+</span>
              <small>阶段结局 · 恋爱非通关条件</small>
            </div>
          </div>
          <内容提示 notes={story.contentNotes} 来源={story.title} />
        </div>

        <div className="hx-hero-stage reveal" aria-label="来自多个世界的女主立绘" role="group">
          <span className="hx-hero-badge" data-par="-3">
            <i className="hx-status-dot" aria-hidden="true" />
            结构化记忆 · 故事会记住你
          </span>
          {立绘组.map(({ 作品, 位置, par, 优先 }) => (
            <div className={`hx-portrait hx-portrait--${位置}`} data-par={par} key={作品.slug}>
              <figure className="hx-portrait-card">
                <img
                  alt={`${作品.protagonist.name}，《${作品.title}》${作品.protagonist.role}`}
                  decoding="async"
                  fetchPriority={优先 ? 'high' : undefined}
                  height="1536"
                  loading={优先 ? 'eager' : 'lazy'}
                  src={作品.protagonist.portrait}
                  width="1024"
                />
                <figcaption className="hx-portrait-label">
                  <b>{作品.protagonist.name}</b> ·《{作品.title}》
                </figcaption>
              </figure>
            </div>
          ))}
          <div className="hx-art-status hx-art-status--time">
            <small>
              <i className="hx-status-dot" aria-hidden="true" />
              今夜开演
            </small>
            <strong>{世界数} 个世界可进入</strong>
          </div>
          <div className="hx-art-status hx-art-status--veto">
            <small>
              <i className="hx-status-dot" aria-hidden="true" />
              人类否决权
            </small>
            <strong>等待你恢复</strong>
          </div>
        </div>
      </div>
      <a className="hx-scroll-cue" href="#story">
        <i className="hx-cue-line" aria-hidden="true" />
        <span>
          从第一项决定开始 <span aria-hidden="true">↓</span>
        </span>
      </a>
    </section>
  );
}

const 玩法四步 = [
  ['01', '环视现场', '360° 打量每一处细节，找到可以核对的线索。'],
  ['02', '听完当事人', '对白有立场；谁在解释、谁在回避，你自己判断。'],
  ['03', '亲自作选择', '每个选择写明可预见的代价，系统不会替你按下确认。'],
  ['04', '后果被记住', '心动、信任、边界与证据都会写进你的关系手账。'],
];

// 核心体验区（对标原版视频舞台）：循环播放平台真实作品的实景视频，
// 叠 HUD 信息片、脉冲热点与对白卡；视口外与减少动效偏好下自动暂停。
export function 核心体验区({ 舞台 }) {
  const 视频ref = React.useRef(null);
  React.useEffect(() => {
    const 视频 = 视频ref.current;
    if (!视频) return undefined;
    const 偏好 = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const 同步播放 = () => {
      if (偏好?.matches) {
        视频.pause();
        return;
      }
      视频.play().catch(() => {});
    };
    偏好?.addEventListener?.('change', 同步播放);
    const 观察者 = 'IntersectionObserver' in window
      ? new IntersectionObserver(
          ([记录]) => {
            if (偏好?.matches) return;
            if (记录.isIntersecting) 视频.play().catch(() => {});
            else 视频.pause();
          },
          { threshold: 0.15 },
        )
      : null;
    观察者?.observe(视频);
    同步播放();
    return () => {
      偏好?.removeEventListener?.('change', 同步播放);
      观察者?.disconnect();
    };
  }, []);

  if (!舞台) return null;
  return (
    <section className="hx-section hx-experience" id="experience">
      <div className="hx-wrap">
        <区块标题
          description={`以下画面来自平台作品《${舞台.storyTitle}》的实际游戏场景；进入后即是可环视、可调查的第一视角现场。`}
          eyebrow="核心体验 · 真实游戏画面"
          title="把镜头交给你：现场正在发生。"
        />
        <div className="hx-story-stage hx-story-stage--video reveal">
          <video
            aria-hidden="true"
            autoPlay
            loop
            muted
            playsInline
            poster={舞台.poster}
            preload="metadata"
            ref={视频ref}
            src={舞台.video}
            tabIndex={-1}
          />
          <div className="hx-stage-shade" aria-hidden="true" />
          <div className="hx-stage-hud">
            <span className="hx-chip">
              <b>{舞台.chapter}</b>
              {舞台.title}
            </span>
            <span className="hx-chip hx-chip--loose">{舞台.location}</span>
            {舞台.hotspotCount > 0 && (
              <span className="hx-chip">
                <i className="hx-status-dot" aria-hidden="true" />
                现场线索 {舞台.hotspotCount}
              </span>
            )}
          </div>
          <span className="hx-stage-hotspot" aria-hidden="true" style={{ top: '42%', left: '34%' }} />
          <span className="hx-stage-hotspot" aria-hidden="true" style={{ top: '60%', left: '70%' }} />
          {舞台.line && (
            <div className="hx-stage-dialogue-card">
              <span className="hx-dialogue-who">
                <i aria-hidden="true" />
                {舞台.line.name}
              </span>
              <p>“{舞台.line.text}”</p>
            </div>
          )}
          <a className="hx-stage-badge" href={舞台.playHref}>
            <Eye aria-hidden="true" size={14} />
            进入《{舞台.storyTitle}》现场
          </a>
        </div>

        <div className="hx-loop-row" aria-label="玩法四步">
          {玩法四步.map(([序号, 标题, 说明]) => (
            <article className="hx-loop-step reveal" key={序号}>
              <span>{序号}</span>
              <h3>{标题}</h3>
              <p>{说明}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// 多世界开场预览：数据来自首页文摘（正式剧情的真实开场节点），任意作品可切换试看。
// 切换标签的动态内容不挂 reveal——滚动显现观察器只随作品数量与存档变化重新接线
//（见 落地页应用.jsx 的依赖数组），不随本组件内部状态重跑，
// 切换后新渲染的节点若带 reveal 会永远停在隐藏态。
export function 真实选择区({ 首页 }) {
  const 可预览 = 首页文摘.works.filter((作品) => 作品.opening);
  const [当前slug, set当前slug] = React.useState(首页.defaultSlug);
  const 作品 = 可预览.find((条) => 条.slug === 当前slug) ?? 可预览[0];
  if (!作品) return null;
  const 预览 = 作品.opening;
  const 是旗舰 = 作品.slug === 首页.defaultSlug;
  const 进入href = `/play?game=${encodeURIComponent(作品.slug)}`;
  const 进入按钮文案 = 是旗舰 && 首页.playAction.mode === 'resume'
    ? 首页.playAction.label
    : '进入故事后亲自选择';
  return (
    <section className="hx-section hx-story" id="story">
      <div className="hx-wrap">
        <区块标题
          description="任选一个世界，看它开场的真实场景与选项；此处只做预览，不会提交选择。进入故事、听完现场后再亲自决定。"
          eyebrow={`开场选择预览 · ${可预览.length} 个世界任你试`}
          title="每个世界的第一幕，都已经在等你。"
        />
        <div aria-label="选择要预览开场的世界" className="hx-open-tabs reveal" role="group">
          {可预览.map((条) => (
            <button
              aria-pressed={条.slug === 作品.slug}
              className={`hx-open-tab${条.slug === 作品.slug ? ' is-active' : ''}`}
              key={条.slug}
              onClick={() => set当前slug(条.slug)}
              type="button"
            >
              {条.title}
            </button>
          ))}
        </div>
        <p className="hx-sr-only" role="status">
          当前预览：《{作品.title}》
        </p>
        <div className="hx-story-stage hx-story-stage--live">
          {预览.panorama ? (
            <div
              aria-hidden="true"
              className="hx-stage-pano"
              style={{ backgroundImage: `url("${预览.panorama}")` }}
            />
          ) : (
            <img
              alt=""
              aria-hidden="true"
              height="1024"
              loading="lazy"
              src={预览.backdrop}
              width="1536"
            />
          )}
          <div className="hx-stage-shade" aria-hidden="true" />
          <div className="hx-stage-hud">
            <span className="hx-chip">
              <b>{预览.chapter}</b>
              {预览.title}
            </span>
            <span className="hx-chip hx-chip--loose">{预览.location}</span>
            {预览.hotspotCount > 0 && (
              <span className="hx-chip">
                <i className="hx-status-dot" aria-hidden="true" />
                现场线索 {预览.hotspotCount}
              </span>
            )}
            {/* 倒计时是旗舰专属剧情装置：常挂只隐藏，避免切换标签把叙事时钟重置回初始帧。 */}
            <span className="hx-chip hx-chip--loose" hidden={是旗舰 ? undefined : true}>
              <b>直播倒计时</b>
              <直播倒计时 />
            </span>
          </div>
          <span className="hx-stage-hotspot" aria-hidden="true" style={{ top: '38%', left: '30%' }} />
          <span className="hx-stage-hotspot" aria-hidden="true" style={{ top: '58%', left: '66%' }} />
          {预览.line && (
            <div className="hx-stage-dialogue-card">
              <span className="hx-dialogue-who">
                <i aria-hidden="true" />
                {预览.line.name}
              </span>
              <p>“{预览.line.text}”</p>
            </div>
          )}
          <a className="hx-stage-badge" href={进入href}>
            <Eye aria-hidden="true" size={14} />
            360° 全景现场 · 进入《{作品.title}》
          </a>
        </div>

        <div className="hx-choice-grid" aria-label={`《${作品.title}》开场选择预览`}>
          {预览.choices.map((选择, 索引) => (
            <article className="hx-choice-card" key={`${作品.slug}-${索引}`}>
              <span className="hx-choice-index">0{索引 + 1}</span>
              <strong>{选择.label}</strong>
              {选择.intent && <span className="hx-choice-intent">行动意图 · {选择.intent}</span>}
              {选择.caption && <p>{选择.caption}</p>}
              {选择.locked ? (
                <span className="hx-choice-preview-note hx-choice-note--locked">
                  先在现场找到线索，它才会亮起 · 预览不会提交
                </span>
              ) : (
                <span className="hx-choice-preview-note">预览不会提交这项选择</span>
              )}
            </article>
          ))}
        </div>
        <div className="hx-choice-cta">
          <播放按钮 href={进入href}>{进入按钮文案}</播放按钮>
        </div>
        <p className="hx-choice-foot reveal">
          <Fingerprint aria-hidden="true" size={18} />
          当前版本使用作者分支与结构化剧情状态，让每个选择的后果都可回看、可验证。
        </p>
      </div>
    </section>
  );
}

const 未解锁记忆 = [
  ['证据如何被保全', '可能留下 · 等待故事推进'],
  ['拒绝是否被尊重', '可能留下 · 等待故事推进'],
  ['决定由谁共同承担', '可能留下 · 等待故事推进'],
];

export function 故事记忆区({ 首页 }) {
  const 已有记忆 = 首页.progress.memories;
  return (
    <section className="hx-section hx-memory" id="memories">
      <div className="hx-wrap hx-memory-grid">
        <div>
          <区块标题
            description="心动、信任与边界不会合成一个攻略值。角色会回应你兑现过的承诺，也会记得你是否尊重拒绝。"
            eyebrow={`旗舰精读 ·《${首页.story.title}》 · 不是好感度`}
            title="故事记住的，是你们共同做过的事。"
          />
          <div className="hx-memory-cards">
            {已有记忆.length > 0
              ? 已有记忆.slice(0, 4).map((记忆, 索引) => (
                  <article className="hx-memory-card is-unlocked reveal" key={记忆}>
                    <Check aria-hidden="true" size={17} />
                    <div>
                      <small>已获得的故事记忆 {String(索引 + 1).padStart(2, '0')}</small>
                      <strong>{记忆}</strong>
                    </div>
                  </article>
                ))
              : 未解锁记忆.map(([标题, 状态]) => (
                  <article className="hx-memory-card reveal" key={标题}>
                    <LockKeyhole aria-hidden="true" size={16} />
                    <div>
                      <small>{状态}</small>
                      <strong>{标题}</strong>
                    </div>
                  </article>
                ))}
          </div>
        </div>

        <aside className="hx-journal reveal" aria-label="关系手账说明">
          <div className="hx-journal-top">
            <BookHeart aria-hidden="true" size={20} />
            <div>
              <span>关系手账</span>
              <strong>{首页.progress.hasSave ? `第 ${首页.progress.loopCount} 周目` : '从第一次选择开始记录'}</strong>
            </div>
          </div>
          <div className="hx-journal-metrics">
            {关系维度.map(([名称, 说明], 索引) => (
              <div key={名称}>
                <span>{名称}</span>
                <i aria-hidden="true" style={{ '--meter-scale': [0.14, 0.24, 0.62][索引] }} />
                <small>{说明}</small>
              </div>
            ))}
          </div>
          <p>默认只显示关系阶段；精确值由玩家主动展开。靠近和保留边界可以同时成立。</p>
          {首页.progress.hasSave && (
            <dl>
              <div>
                <dt>已走过场景</dt>
                <dd>{首页.progress.visitedCount}</dd>
              </div>
              <div>
                <dt>已解锁结果</dt>
                <dd>{首页.progress.unlockedEndings.length}</dd>
              </div>
            </dl>
          )}
        </aside>
      </div>
    </section>
  );
}

export function 角色群像区({ 首页 }) {
  const 主角 = 首页.protagonist;
  if (!主角) return null;
  const 主角台词 = 首页.preview?.lines.find((行) => 行.speaker === 主角.id)?.text;
  return (
    <section className="hx-section hx-characters" id="characters">
      <div className="hx-wrap">
        <区块标题
          description="吸引力来自共同工作、价值观与可验证的承诺；没有人是奖品，也没有人只为衬托你而存在。"
          eyebrow={`旗舰精读 ·《${首页.story.title}》现场关键人物`}
          title="他们都有自己的职责、立场和不能越过的边界。"
        />
        <article className="hx-protagonist reveal">
          <div className="hx-protagonist-image">
            {主角.portrait && (
              <img
                alt={`${主角.name}，${主角.role}`}
                height="1536"
                loading="lazy"
                src={主角.portrait}
                width="1024"
              />
            )}
          </div>
          <div className="hx-protagonist-copy">
            <span>你将作出决定</span>
            <h3>{主角.name}</h3>
            <strong>{主角.role}</strong>
            <p>主导不是独自承担一切，而是让权力、证据和责任都可追溯。</p>
            {主角台词 && <blockquote>“{主角台词}”</blockquote>}
          </div>
        </article>

        <div className="hx-cast-grid">
          {首页.characters.map((角色) => (
            <article
              className="hx-character-card reveal"
              key={角色.id}
              style={{ '--character': 角色.color, '--character-deep': 角色.accent }}
            >
              <div className="hx-character-image">
                {角色.portrait && (
                  <img
                    alt={`${角色.name}，${角色.role}`}
                    height="1536"
                    loading="lazy"
                    src={角色.portrait}
                    width="1024"
                  />
                )}
                {角色.moodPortrait && (
                  <img
                    alt=""
                    aria-hidden="true"
                    className="hx-mood-img"
                    decoding="async"
                    height="1536"
                    loading="lazy"
                    src={角色.moodPortrait}
                    width="1024"
                  />
                )}
                {角色.moodLabel && (
                  <span aria-hidden="true" className="hx-mood-tag">
                    {角色.moodLabel}
                  </span>
                )}
              </div>
              <div className="hx-character-copy">
                <h3>{角色.name}</h3>
                <p>{角色.role}</p>
                <span>{角色.theme}</span>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
}

// 全平台人物廊：跨作品立绘传送带，数据来自首页文摘的正式 cast（立绘齐备者）；
// 数组复制两份实现无缝循环，副本对读屏隐藏，悬停与键盘聚焦均可暂停（规则在 落地页可访问性.css）。
export function 平台人物廊() {
  const 阵容 = [];
  const 已收录 = new Set();
  for (const 作品 of 首页文摘.works) {
    for (const 角色 of 作品.castPortraits) {
      if (已收录.has(角色.portrait)) continue;
      已收录.add(角色.portrait);
      阵容.push({ ...角色, 作品标题: 作品.title });
    }
  }
  if (阵容.length < 4) return null;
  // 计数只认实际供图的作品：有作品暂无立绘时不虚报来源世界数。
  const 来源世界数 = new Set(阵容.map((角色) => 角色.作品标题)).size;
  return (
    <section className="hx-section hx-gallery" id="cast-gallery">
      <div className="hx-wrap">
        <区块标题
          align="center"
          description="他们分属不同的世界，各有职责、立场与不能越过的边界；等你在各自的故事里认识。"
          eyebrow="全平台人物"
          title={`${阵容.length} 位人物，来自 ${来源世界数} 个世界。`}
        />
        <div
          aria-label="全平台人物立绘，自动滚动展示；悬停或聚焦可暂停"
          className="marquee reveal"
          role="region"
          tabIndex={0}
        >
          <div className="marquee-track">
            {[...阵容, ...阵容].map((角色, 索引) => (
              <figure
                aria-hidden={索引 >= 阵容.length || undefined}
                className="hx-m-card"
                key={`${角色.portrait}-${索引}`}
              >
                <img
                  alt={索引 < 阵容.length ? `${角色.name}，《${角色.作品标题}》${角色.role}` : ''}
                  height="1536"
                  loading="lazy"
                  src={角色.portrait}
                  width="1024"
                />
                <figcaption>
                  {角色.name} ·《{角色.作品标题}》
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function 同行方式区({ 首页 }) {
  const 路线图标 = { private: UsersRound, alliance: ShieldCheck, solo: Compass };

  return (
    <section className="hx-section hx-routes" id="routes">
      <div className="hx-wrap">
        <区块标题
          align="center"
          description="三条路线拥有同等信息量、职业结果和结局资格。拒绝亲密，不会失去主线内容。"
          eyebrow={`《${首页.story.title}》 · 按你的方式同行`}
          title="你可以靠近一个人，也可以选择同盟或独自判断。"
        />
        <div className="hx-route-grid">
          {首页.routes.map(({ id, title, description, note }) => {
            const Icon = 路线图标[id] ?? Compass;
            return (
              <article className="hx-route-card reveal" key={id}>
                <Icon aria-hidden="true" size={24} strokeWidth={1.5} />
                <h3>{title}</h3>
                <p>{description}</p>
                <span>{note}</span>
              </article>
            );
          })}
        </div>
        <p className="hx-route-foot reveal">不选择恋爱，同样是完整选择。</p>
      </div>
    </section>
  );
}

// 三维关系机制卡：对标原版“命运长河/因果之网/循环之轮”三卡的角光 bento 形态，
// 内容换成女性向的心动 / 信任 / 边界（与运行时 spark/trust/boundary 一一对应）。
export function 关系机制区() {
  const 机制 = [
    ['心动', '靠近不是默认答案', '它由你们共同做过的事积累，也可以被你亲手停下；高心动永远盖不住低信任。', BookHeart, 'spark'],
    ['信任', '承诺需要被兑现', '角色记得你是否说到做到；可验证的共同工作，比任何甜言蜜语都更有分量。', ShieldCheck, 'trust'],
    ['边界', '拒绝始终会被尊重', '你说“不”的时刻会被记录；守住边界不会损失剧情，越界一定有代价。', Fingerprint, 'boundary'],
  ];
  return (
    <section className="hx-section hx-mechanics" id="mechanics">
      <div className="hx-wrap">
        <区块标题
          align="center"
          description="三个维度独立记录、互不折算；它们共同决定角色如何回应你，也决定哪些结局向你敞开。"
          eyebrow="三维关系机制"
          title="没有好感度条，只有心动、信任与边界。"
        />
        <div className="hx-bento">
          {机制.map(([名称, 副题, 详情, Icon, 键]) => (
            <article className={`hx-fate hx-fate--${键} reveal`} key={名称}>
              <span className="hx-fate-icon">
                <Icon aria-hidden="true" size={26} strokeWidth={1.5} />
              </span>
              <h3>{名称}</h3>
              <strong>{副题}</strong>
              <p>{详情}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// 小数字滚动：进入视口后 600ms 从 0 计到真实值；reduced-motion 与 SSR 直出终值。
function 滚动数字({ 值 }) {
  const [显示, set显示] = React.useState(值);
  React.useEffect(() => {
    if (值 <= 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      set显示(值);
      return undefined;
    }
    let 帧 = 0;
    const 起 = performance.now();
    const 步 = (时) => {
      const 比 = Math.min(1, (时 - 起) / 600);
      set显示(Math.round(值 * 比));
      if (比 < 1) 帧 = requestAnimationFrame(步);
    };
    帧 = requestAnimationFrame(步);
    return () => cancelAnimationFrame(帧);
  }, [值]);
  return <>{显示}</>;
}

export function 多结局区({ 首页 }) {
  const 已解锁数 = 首页.endings.filter((结局) => 结局.unlocked).length;
  return (
    <section className="hx-section hx-endings" id="endings">
      <div className="hx-wrap">
        <区块标题
          description="阶段结果同时记录事业、真相、团队、边界，以及你愿意承担的代价；关系路线不会替你决定职业答案。"
          eyebrow={`《${首页.story.title}》 · 多重阶段结果`}
          title="结局不只回答“和谁在一起”。"
        />
        <div className="hx-ending-summary reveal">
          <div>
            <Eye aria-hidden="true" size={19} />
            <span>结果会在你亲自抵达后公开</span>
          </div>
          <strong>
            {首页.progress.hasSave ? (
              <>
                已解锁 <滚动数字 值={已解锁数} />
              </>
            ) : (
              '尚未开始记录'
            )}
          </strong>
        </div>
        <div className="hx-ending-grid">
          {首页.endings.map((结局, 索引) => (
            <article className={`hx-ending-card reveal ${结局.unlocked ? 'is-unlocked' : ''}`} key={结局.id}>
              <span>{结局.unlocked ? <Sparkles aria-hidden="true" size={18} /> : <LockKeyhole aria-hidden="true" size={17} />}</span>
              <small>{结局.secret ? '隐藏阶段结果' : `阶段结果 ${String(索引 + 1).padStart(2, '0')}`}</small>
              <h3>{结局.unlocked ? 结局.title : '等待你的决定'}</h3>
              <p>{结局.unlocked ? 结局.subtitle : '它由证据、主导权、公开方式与边界共同收束。'}</p>
            </article>
          ))}
        </div>
        <div className="hx-ending-cta reveal">
          <p>页面不会提前剧透隐藏结果。女性同盟与独立复盘同样拥有完整的抵达资格。</p>
          <播放按钮 href={首页.playAction.href} secondary>
            {首页.playAction.mode === 'resume' ? '继续走向结果' : '亲自走向结果'}
          </播放按钮>
        </div>
      </div>
    </section>
  );
}

export function 创作者次入口() {
  return (
    <aside className="hx-creator-strip" aria-labelledby="creator-strip-title">
      <div className="hx-wrap hx-creator-strip-inner reveal">
        <BriefcaseBusiness aria-hidden="true" size={24} strokeWidth={1.5} />
        <div>
          <span>创作者专业入口</span>
          <h2 id="creator-strip-title">也想创造一个会记住玩家的世界？</h2>
          <p>故事结构、角色档案与素材工具仍在专业创作台；它们不再打断玩家首页。</p>
        </div>
        <a className="hx-button hx-button--quiet" href="/creators">
          查看创作者能力 <ArrowRight aria-hidden="true" size={16} />
        </a>
      </div>
    </aside>
  );
}

export function 玩家结尾CTA({ 首页 }) {
  const 是续玩 = 首页.playAction.mode === 'resume';
  const 作品名 = 首页.story?.title ?? 首页.catalogEntry?.title ?? '这段故事';
  return (
    <section className="hx-final" id="cta">
      {首页.preview?.backdrop && (
        <img
          alt=""
          aria-hidden="true"
          className="hx-kenburns"
          height="1024"
          loading="lazy"
          src={首页.preview.backdrop}
          width="1536"
        />
      )}
      <div className="hx-final-shade" aria-hidden="true" />
      <div className="hx-wrap hx-final-copy reveal">
        <span className="hx-eyebrow">{是续玩 ? '你的进度已被记住' : '决定权还在你手里'}</span>
        <h2>
          {是续玩
            ? `《${作品名}》正在等你继续。`
            : `从《${作品名}》开始，其余 ${Math.max((首页.worlds?.length ?? 1) - 1, 0)} 个世界也已亮灯。`}
        </h2>
        <p>{是续玩 ? '从上次保存的现场继续，你做过的选择仍然有效。' : '它下一句说什么，由你决定是否允许。'}</p>
        <播放按钮 href={首页.playAction.href}>{首页.playAction.label}</播放按钮>
      </div>
    </section>
  );
}
