// 这个文件是"开新档案的登记窗口"：填两格——项目标题和 slug(网址里用的英文小写代号)，
// 点"创建"就在当前浏览器里立一个新项目档案。slug 一边打字一边被清洗成合法格式。
import React from 'react';
import { X, Plus, LoaderCircle } from 'lucide-react';
import { 清洗slug } from './本机项目存储.js';

// 输入(标题/slug 及其 set 函数、提交回调、忙碌旗) → 拼出 creator-project-dialog 表单 → 吐出 JSX
export default function 新建项目弹窗({ 标题, 设标题, slug, 设slug, 创建中, 忙碌, on提交, on关闭 }) {
  return (
    <section aria-label="新建创作项目" aria-modal="true" className="creator-editor-overlay" onKeyDown={(事件) => { if (事件.key === 'Escape') on关闭(); }} role="dialog">
      <form className="creator-project-dialog" onSubmit={(事件) => on提交(事件)}>
        <div className="creator-editor-head">
          <div>
            <span>项目管理</span>
            <strong>新建项目</strong>
          </div>
          <button onClick={on关闭} title="关闭" type="button">
            <X size={18} />
          </button>
        </div>
        <div className="creator-project-dialog-body">
          <label>
            <span>故事名称</span>
            <input autoFocus onChange={(事件) => 设标题(事件.target.value)} value={标题} />
          </label>
          <p className="creator-project-hint">创建后会直接进入快速创作：先写角色目标与边界，再设计关系和章节节奏。</p>
          <details className="creator-project-advanced">
            <summary>高级设置 · 网址代号</summary>
            <label>
              <span>项目 slug</span>
              <input
                onChange={(事件) => 设slug(清洗slug(事件.target.value))}
                placeholder="lowercase-letters-numbers-hyphen"
                value={slug}
              />
              <small>仅用于试玩链接；默认值已自动生成，一般无需修改。</small>
            </label>
          </details>
        </div>
        <div className="creator-editor-actions">
          <button disabled={忙碌 || !标题.trim() || !slug.trim()} type="submit">
            {创建中 ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
            创建并开始快速创作
          </button>
          <button onClick={on关闭} type="button">
            取消
          </button>
        </div>
      </form>
    </section>
  );
}
