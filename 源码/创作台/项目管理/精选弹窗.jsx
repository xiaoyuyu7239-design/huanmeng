// 这个文件是"首页橱窗的布展间"：勾选哪些作品摆进落地页橱窗(精选 Demo)、
// 谁站 C 位(默认 Demo)。保存后写进浏览器的精选柜(creator:browser-showcase:v1)，
// 落地页刷新时读同一把钥匙，本机精选就会顶掉线上默认橱窗。
import React from 'react';
import { X, Save, LoaderCircle } from 'lucide-react';

// 输入(候选项目、勾选集、默认slug、加载/保存状态和回调) → 拼出精选设置弹窗 → 吐出 JSX
export default function 精选弹窗({
  加载中,
  候选项目,   // [{slug, title, nodeCount}]
  精选slugs,  // 已勾选的 slug 数组
  默认slug,
  保存中,
  on勾选,     // (slug) → 切换勾选状态
  on设默认,   // (slug) → 设为默认 Demo
  on保存,
  on关闭,
}) {
  return (
    <section aria-modal="true" className="creator-editor-overlay" role="dialog">
      <div className="creator-settings-dialog">
        <div className="creator-editor-head">
          <div>
            <span>落地页精选 Demo</span>
            <strong>挑选作品推送到首页</strong>
          </div>
          <button onClick={on关闭} title="关闭" type="button">
            <X size={18} />
          </button>
        </div>
        <div className="creator-settings-body">
          {加载中 ? (
            <div className="creator-settings-loading">正在读取精选配置</div>
          ) : (
            <>
              <div className="creator-settings-note">
                <span>勾选作品加入首页精选</span>
                <strong>选中的作品会复制为可游玩 Demo（/play?game=slug）</strong>
                <small>
                  设一个为「默认 Demo」，落地页的「观看演示」与 /play 会优先打开它。保存后刷新首页即可看到。
                </small>
              </div>
              <div className="creator-showcase-list">
                {候选项目.length === 0 && <p className="creator-showcase-empty">还没有可发布的项目。</p>}
                {候选项目.map((项) => {
                  const 已勾选 = 精选slugs.includes(项.slug);
                  return (
                    <label className={已勾选 ? 'creator-showcase-row is-on' : 'creator-showcase-row'} key={项.slug}>
                      <input checked={已勾选} onChange={() => on勾选(项.slug)} type="checkbox" />
                      <div className="creator-showcase-meta">
                        <strong>{项.title}</strong>
                        <span>
                          {项.slug}
                          {项.nodeCount ? ` · ${项.nodeCount} 个节点` : ''}
                        </span>
                      </div>
                      <button
                        className={默认slug === 项.slug ? 'creator-showcase-default is-on' : 'creator-showcase-default'}
                        disabled={!已勾选}
                        onClick={(事件) => {
                          事件.preventDefault(); // 别让点按钮顺带触发 label 的勾选
                          on设默认(项.slug);
                        }}
                        type="button"
                      >
                        {默认slug === 项.slug ? '默认 Demo' : '设为默认'}
                      </button>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="creator-editor-actions">
          <button disabled={保存中 || 加载中} onClick={on保存} type="button">
            {保存中 ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
            保存并推送到首页
          </button>
          <button onClick={on关闭} type="button">
            关闭
          </button>
        </div>
      </div>
    </section>
  );
}
