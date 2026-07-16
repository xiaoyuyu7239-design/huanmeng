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

function 内容提示({ notes }) {
  if (!notes?.length) return null;
  return (
    <p className="hx-content-note">
      <ShieldCheck aria-hidden="true" size={15} />
      内容提示：{notes.join('、')}。
    </p>
  );
}

export function 玩家主视觉({ 首页 }) {
  if (!首页.storyReady) {
    return (
      <section className="hx-hero hx-hero--fallback" id="top">
        <div className="hx-wrap">
          <span className="hx-eyebrow">衍境·心界</span>
          <h1>故事正在准备进入心界。</h1>
          <p>你仍然可以从世界列表选择一部已发布的互动故事。</p>
          <播放按钮 href={首页.playHref}>查看可玩世界</播放按钮>
        </div>
      </section>
    );
  }

  const { catalogEntry, protagonist, preview, story } = 首页;
  const 主角台词 = preview?.lines.find((行) => 行.speaker === protagonist?.id)?.text;
  return (
    <section className="hx-hero" id="top">
      <div className="hx-hero-aurora" aria-hidden="true" />
      <div className="hx-wrap hx-hero-grid">
        <div className="hx-hero-copy">
          <span className="hx-eyebrow">女性向互动悬疑 · {story.chapter || '第一章已开放'}</span>
          <h1>
            这一次，故事会记住
            <em>你如何选择。</em>
          </h1>
          <p className="hx-hero-lead">{catalogEntry.tagline}</p>
          <p className="hx-hero-promise">
            故事不是问你选谁，而是记住你保全了什么、拒绝了什么，以及决定权最终留在谁手里。
          </p>
          <div className="hx-actions">
            <播放按钮 href={首页.playHref}>进入《{story.title}》</播放按钮>
            <a className="hx-text-link" href="#characters">
              先认识他们 <span aria-hidden="true">↓</span>
            </a>
          </div>
          <ul className="hx-hero-facts" aria-label="故事信息">
            {story.estimatedMinutes && <li>{story.estimatedMinutes} 分钟</li>}
            <li>多重阶段结局</li>
            <li>恋爱不是通关条件</li>
          </ul>
          <内容提示 notes={story.contentNotes} />
        </div>

        <figure className="hx-hero-art">
          {catalogEntry.cover ? (
            <img
              alt={`${story.title}封面，${protagonist?.name ?? '主角'}在直播主控台前作出决定`}
              decoding="async"
              fetchPriority="high"
              height="1080"
              src={catalogEntry.cover}
              width="864"
            />
          ) : (
            <div className="hx-image-placeholder" aria-hidden="true" />
          )}
          <figcaption>
            <span>{protagonist?.name}</span>
            <strong>{protagonist?.role}</strong>
          </figcaption>
          <div className="hx-art-status hx-art-status--time">
            <small>直播倒计时</small>
            <strong>23:40 · 距零点二十分钟</strong>
          </div>
          <div className="hx-art-status hx-art-status--veto">
            <small>人类否决权</small>
            <strong>等待你恢复</strong>
          </div>
          {主角台词 && <blockquote>“{主角台词}”</blockquote>}
        </figure>
      </div>
      <a className="hx-scroll-cue" href="#story">
        从第一项决定开始 <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}

function 说话人名称(首页, id) {
  if (id === 首页.protagonist?.id) return 首页.protagonist.name;
  if (id === 'narrator') return '现场';
  if (id === 'system') return '系统';
  return 首页.characters.find((角色) => 角色.id === id)?.name ?? '现场人物';
}

export function 真实选择区({ 首页 }) {
  const 预览 = 首页.preview;
  if (!预览) return null;
  return (
    <section className="hx-section hx-story" id="story">
      <div className="hx-wrap">
        <区块标题
          description="调查线索、听完不同专业意见，再选择你愿意承担的代价。每个选项在点击前都会说明意图。"
          eyebrow="你的第一项决定"
          title="零点前二十分钟，先决定什么不能被系统替你决定。"
        />
        <div className="hx-story-stage reveal">
          <img
            alt=""
            aria-hidden="true"
            height="1024"
            loading="lazy"
            src={预览.backdrop}
            width="1536"
          />
          <div className="hx-stage-shade" aria-hidden="true" />
          <div className="hx-stage-meta">
            <span>{预览.chapter}</span>
            <strong>{预览.title}</strong>
            <small>{预览.location}</small>
          </div>
          <div className="hx-stage-dialogue">
            {预览.lines.slice(1, 4).map((行, 索引) => (
              <blockquote key={`${行.speaker}-${索引}`}>
                <span>{说话人名称(首页, 行.speaker)}</span>
                <p>“{行.text}”</p>
              </blockquote>
            ))}
          </div>
        </div>

        <div className="hx-choice-grid" aria-label="开场真实选项">
          {预览.choices.map((选择, 索引) => (
            <a className="hx-choice-card reveal" href={首页.playHref} key={选择.id}>
              <span className="hx-choice-index">0{索引 + 1}</span>
              <strong>{选择.intent}</strong>
              <p>{选择.caption}</p>
              <span className="hx-choice-open">
                从这里进入故事 <ArrowRight aria-hidden="true" size={15} />
              </span>
            </a>
          ))}
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
            eyebrow="不是好感度"
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
                <i aria-hidden="true" />
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
          eyebrow="现场关键人物"
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

export function 同行方式区({ 首页 }) {
  const 路线图标 = { private: UsersRound, alliance: ShieldCheck, solo: Compass };

  return (
    <section className="hx-section hx-routes" id="routes">
      <div className="hx-wrap">
        <区块标题
          align="center"
          description="三条路线拥有同等信息量、职业结果和结局资格。拒绝亲密，不会失去主线内容。"
          eyebrow="按你的方式同行"
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

export function 多结局区({ 首页 }) {
  const 已解锁数 = 首页.endings.filter((结局) => 结局.unlocked).length;
  return (
    <section className="hx-section hx-endings" id="endings">
      <div className="hx-wrap">
        <区块标题
          description="阶段结果同时记录事业、真相、团队、边界，以及你愿意承担的代价；关系路线不会替你决定职业答案。"
          eyebrow="多重阶段结果"
          title="结局不只回答“和谁在一起”。"
        />
        <div className="hx-ending-summary reveal">
          <div>
            <Eye aria-hidden="true" size={19} />
            <span>结果会在你亲自抵达后公开</span>
          </div>
          <strong>{首页.progress.hasSave ? `已解锁 ${已解锁数}` : '尚未开始记录'}</strong>
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
          <播放按钮 href={首页.playHref} secondary>亲自走向结果</播放按钮>
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
  return (
    <section className="hx-final" id="cta">
      {首页.preview?.backdrop && (
        <img
          alt=""
          aria-hidden="true"
          height="1024"
          loading="lazy"
          src={首页.preview.backdrop}
          width="1536"
        />
      )}
      <div className="hx-final-shade" aria-hidden="true" />
      <div className="hx-wrap hx-final-copy reveal">
        <span className="hx-eyebrow">决定权还在你手里</span>
        <h2>《{首页.story?.title ?? 首页.catalogEntry?.title ?? '这段故事'}》将在零点亮起。</h2>
        <p>它下一句说什么，由你决定是否允许。</p>
        <播放按钮 href={首页.playHref}>开始第一章</播放按钮>
      </div>
    </section>
  );
}
