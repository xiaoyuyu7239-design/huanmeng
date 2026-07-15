// 这个文件是落地页的"样板间和布料墙"：创作台演示像售楼处的样板间——摆一个假的桌面窗口，
// 三栏数据全是硬编码的道具（AI对话、故事树、素材预览），只给人看不给人用；
// 风格跑马灯像裁缝店的布料墙，七种画风样卡滚动展示。
import React from 'react';

// 风格跑马灯数据：照原样抄自线上代码顶部常量
const 风格列表 = [
  { src: '/landing/style-vivi.webp', tag: 'Y2K · 杂志封面' },
  { src: '/landing/char-shen.webp', tag: '古风 · 工笔重彩' },
  { src: '/landing/style-teen.webp', tag: '千禧 · 海报拼贴' },
  { src: '/landing/char-jiang.webp', tag: '治愈 · 自然光' },
  { src: '/landing/style-next.webp', tag: '潮酷 · 全息质感' },
  { src: '/landing/char-wen.webp', tag: '梦幻 · 洛丽塔' },
  { src: '/landing/style-glow.webp', tag: '电子 · 霓虹光感' },
];

// 创作台演示区：输入无 → 渲染仿桌面窗口（标题栏 + 左中右三栏假数据） → 吐出 section#studio
export function 创作台演示区() {
  return (
    <section className="band show" id="studio">
      <div className="wrap">
        <div className="band-head reveal">
          <span className="eyebrow">互动电影创作台</span>
          <h2 className="title">
            智能体写剧本，
            <br />
            你在创作台里掌舵。
          </h2>
          <p className="lead">
            左侧 AI 助手协作生成，中间可视化故事结构与分支，右侧实时预览全景素材与生成状态。
          </p>
        </div>
        <div className="studio reveal">
          <div className="studio-bar">
            <div className="tl">
              <i />
              <i />
              <i />
            </div>
            <div className="ttl">
              <b>九尾狐的轮回</b> · 本地项目
            </div>
            <div className="save">● 自动保存 12:45:31</div>
          </div>
          <div className="studio-grid">
            <div className="col">
              <h5>AI 助手</h5>
              <div className="msg a">
                你好，我是你的创作助手。我可以优化剧情结构、检查连贯性与数值平衡。
              </div>
              <div className="msg u">帮我检查第一章的分支结构是否合理。</div>
              <div className="msg a">
                结构清晰，分支层级合理：4 个分支节点、2
                个结局。建议在「是否相信九尾狐」后增加一个信任值波动动画。
              </div>
            </div>
            <div className="col">
              <h5>故事结构 · 第一章</h5>
              <div className="node">
                <span className="s done">✓</span> 1-1 月光森林 初遇
              </div>
              <div className="node sel">
                <span className="s">◆</span> 1-2 是否相信九尾狐？ <small>2/2</small>
              </div>
              <div className="node">
                <span className="s done">✓</span> 1-3 相信她的话
              </div>
              <div className="node">
                <span className="s done">✓</span> 1-4 保持怀疑
              </div>
              <div className="node">
                <span className="s">○</span> 1-5 森林深处的低语 <small>0/3</small>
              </div>
              <div className="node">
                <span className="s">🔒</span> 1-6 夜的抉择
              </div>
            </div>
            <div className="col">
              <h5>视觉资产 · 1-2</h5>
              <div className="preview">
                <img src="/landing/char-shen.webp" alt="全景预览" />
                <div className="pl">全景图 16:9 · 8192×4096</div>
              </div>
              <div className="meta-row">
                <span>状态</span>
                <b style={{ color: '#8fb6e0' }}>生成完成</b>
              </div>
              <div className="meta-row">
                <span>模型</span>
                <b>Flux.1 Dev</b>
              </div>
              <div className="meta-row">
                <span>种子</span>
                <b>442871</b>
              </div>
              <div className="queue">
                <i className="on">
                  <img src="/landing/char-shen.webp" alt="" />
                </i>
                <i>
                  <img src="/landing/char-lin.webp" alt="" />
                </i>
                <i>
                  <img src="/landing/char-jiang.webp" alt="" />
                </i>
                <i>
                  <img src="/landing/char-wen.webp" alt="" />
                </i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 风格跑马灯区：输入无 → 渲染标题 + 全宽风格样卡传送带（跑马灯在 .wrap 之外才能通到屏幕边） → 吐出 section#styles
export function 风格跑马灯区() {
  return (
    <section className="band styles" id="styles">
      <div className="wrap">
        <div className="band-head reveal">
          <span className="eyebrow">风格不设限</span>
          <h2 className="title">从古风工笔到 Y2K 海报，一套引擎全包。</h2>
          <p className="lead">
            同一套素材生成链路，覆盖电影感、治愈系、千禧潮酷等多种画风，匹配每个故事的气质。
          </p>
        </div>
      </div>
      <div aria-label="视觉风格展示，聚焦可暂停滚动" className="style-marquee reveal" role="region" tabIndex={0}>
        <div className="style-track">
          {/* 和角色跑马灯同一招：复制一份实现无缝循环 */}
          {[...风格列表, ...风格列表].map((风格, 序) => (
            <div aria-hidden={序 >= 风格列表.length || undefined} className="s-card" key={序}>
              <img src={风格.src} alt={序 < 风格列表.length ? 风格.tag : ''} />
              <span>{风格.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
