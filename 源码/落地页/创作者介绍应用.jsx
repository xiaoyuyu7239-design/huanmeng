import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  BookOpenCheck,
  Bot,
  Braces,
  CheckCircle2,
  GitBranch,
  Images,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import '../样式/落地页-心界.css';
import '../样式/落地页可访问性.css';

const 创作能力 = [
  {
    icon: BookOpenCheck,
    title: '角色与关系底座',
    description: '用 story 级 cast 管理主角、关键人物、关系主题与视觉档案，播放器不再依赖源码里的固定姓名。',
  },
  {
    icon: GitBranch,
    title: '故事结构与分支',
    description: '编辑节点、选择、条件和状态效果，让每条关系路线都能回到可验证的主线结构。',
  },
  {
    icon: Images,
    title: '素材与实时预览',
    description: '为场景、角色表情与音频绑定本地资产，在发布前直接进入玩家端检查实际呈现。',
  },
  {
    icon: ShieldCheck,
    title: '校验、枚举与发布',
    description: 'schema、资源引用和结局可达性共同组成发布门禁，避免“结构能保存但玩家走不到”。',
  },
];

const 经验闭环 = [
  ['01', '规划前召回', '从已有创作事件里寻找可复用的结构信号与经验。'],
  ['02', '生成中约束', '把召回的经验写入生成上下文，约束分支、因果与素材需求。'],
  ['03', '生成后校验', '用 schema、资源检查和路线枚举验证草稿，而不是相信一次生成结果。'],
  ['04', '修正后沉淀', '把有效修正记录为新的 Skill、测试与 EvolutionEvent。'],
];

function 创作者品牌() {
  return (
    <a className="hx-brand" href="/" aria-label="返回衍境·心界玩家首页">
      <span className="hx-brand-mark" aria-hidden="true"><i /></span>
      <span>
        <b>衍境·心界</b>
        <small>创作者幕后工作间</small>
      </span>
    </a>
  );
}

export default function 创作者介绍应用() {
  React.useEffect(() => {
    document.body.classList.add('landing-body');
    const 原标题 = document.title;
    document.title = '创作者工作间｜衍境·心界';
    return () => {
      document.body.classList.remove('landing-body');
      document.title = 原标题;
    };
  }, []);

  return (
    <div className="lp lp-heartscape hx-creator-page">
      <a className="hx-skip-link" href="#creator-main">跳到主要内容</a>
      <nav className="hx-creator-nav" aria-label="创作者导航">
        <div className="hx-wrap hx-creator-nav-inner">
          <创作者品牌 />
          <div>
            <a href="/">
              <ArrowLeft aria-hidden="true" size={15} /> 玩家首页
            </a>
            <a className="hx-nav-cta" href="/creator">打开创作台</a>
          </div>
        </div>
      </nav>

      <main id="creator-main">
        <section className="hx-creator-hero">
          <div className="hx-wrap hx-creator-hero-grid">
            <div>
              <span className="hx-eyebrow">For creators · 快速创作 / 专业模式</span>
              <h1>把灵感变成一部<br /><em>真的走得通</em>的故事。</h1>
              <p>
                从角色目标、关系边界和情绪曲线开始，或进入完整节点、机制、素材和发布工作流。
                玩家首页负责进入故事，这里负责把故事做出来。
              </p>
              <div className="hx-actions">
                <a className="hx-button hx-button--primary" href="/creator">
                  开始快速创作 <ArrowRight aria-hidden="true" size={17} />
                </a>
                <a className="hx-text-link" href="#creator-capabilities">查看能力边界 ↓</a>
              </div>
            </div>
            <div className="hx-creator-system" aria-label="创作工作流示意">
              <div className="hx-creator-system-head">
                <Blocks aria-hidden="true" size={18} />
                <span>STORY WORKFLOW</span>
                <strong>结构先于生成</strong>
              </div>
              <div className="hx-creator-system-flow">
                <span><BookOpenCheck aria-hidden="true" />角色圣经</span>
                <i aria-hidden="true">→</i>
                <span><GitBranch aria-hidden="true" />故事分支</span>
                <i aria-hidden="true">→</i>
                <span><CheckCircle2 aria-hidden="true" />发布门禁</span>
              </div>
              <p><Braces aria-hidden="true" size={15} /> 所有状态变化仍由结构化白名单规则落账。</p>
            </div>
          </div>
        </section>

        <section className="hx-section hx-creator-capabilities" id="creator-capabilities">
          <div className="hx-wrap">
            <header className="hx-section-head">
              <span className="hx-eyebrow">创作台能力</span>
              <h2>从角色，到结局可达。</h2>
              <p>快速模式按角色、关系、节奏与一致性逐步推进；专业模式继续提供完整节点和资产能力，两者共用同一份项目数据。</p>
            </header>
            <div className="hx-creator-capability-grid">
              {创作能力.map(({ icon: Icon, title, description }) => (
                <article key={title}>
                  <Icon aria-hidden="true" size={22} strokeWidth={1.5} />
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="hx-section hx-creator-evo" id="evolve">
          <div className="hx-wrap hx-creator-evo-grid">
            <header className="hx-section-head">
              <span className="hx-eyebrow">EvoMap · 经验闭环</span>
              <h2>不是让模型替你决定，而是让系统少犯同一种错。</h2>
              <p>
                生成只是一环；召回、约束、校验和沉淀共同组成可回退的工作流。
                没有外部 token 时，本地检查仍然工作。
              </p>
              <div className="hx-creator-boundary">
                <Bot aria-hidden="true" size={18} />
                <p><strong>当前真实边界</strong> AI 不直接修改路线、数值或结局；本地 schema 与路线枚举始终是最终门禁。</p>
              </div>
            </header>
            <ol className="hx-creator-evo-list">
              {经验闭环.map(([序号, 标题, 描述]) => (
                <li key={序号}>
                  <span>{序号}</span>
                  <div>
                    <h3>{标题}</h3>
                    <p>{描述}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="hx-creator-final">
          <div className="hx-wrap">
            <Sparkles aria-hidden="true" size={24} />
            <span className="hx-eyebrow">准备好继续创作</span>
            <h2>专业工具在幕后，玩家选择在台前。</h2>
            <p>打开创作台，继续编辑、试玩与校验你的互动世界。</p>
            <a className="hx-button hx-button--primary" href="/creator">
              打开创作台 <ArrowRight aria-hidden="true" size={17} />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
