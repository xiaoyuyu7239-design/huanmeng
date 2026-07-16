import React from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, ListChecks, LocateFixed, X } from 'lucide-react';
import { 解析QA明细 } from './校验规则.js';

function 提取节点id(文案, 项目) {
  if (typeof 文案 !== 'string') return '';
  const ids = Object.keys(项目?.story?.nodes ?? {}).sort((甲, 乙) => 乙.length - 甲.length);
  return ids.find((id) =>
    文案.includes(`node ${id}`) ||
    文案.includes(`节点 ${id}`) ||
    文案.includes(`story.nodes.${id}`)
  ) ?? '';
}

function 问题列表({ 标题, 类型, 问题们, 项目, on定位节点 }) {
  if (!问题们.length) return null;
  return (
    <section className={`creator-qa-section is-${类型}`}>
      <header><strong>{标题}</strong><span>{问题们.length}</span></header>
      <ol>
        {问题们.map((问题, 索引) => {
          const 节点id = 提取节点id(问题, 项目);
          return (
            <li key={`${类型}-${问题}-${索引}`}>
              {类型 === 'error' ? <AlertTriangle size={15} /> : <CircleAlert size={15} />}
              <span>{问题}</span>
              {节点id && (
                <button onClick={() => on定位节点(nodeId)} title={`在专业模式定位 ${节点id}`} type="button">
                  <LocateFixed size={14} /> 定位节点
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function QA结果面板({ 打开, 报告, 项目, on切换, on定位节点 }) {
  const 明细 = 解析QA明细(报告);
  if (!明细.recognized) return null;
  if (!打开) {
    return (
      <button className={明细.errorCount ? 'creator-qa-trigger has-errors' : 'creator-qa-trigger'} onClick={() => on切换(true)} type="button">
        <ListChecks size={16} /> QA：{明细.errorCount} 错误 / {明细.warningCount} 警告
      </button>
    );
  }
  return (
    <aside aria-label="完整 QA 校验结果" className="creator-qa-drawer" role="region">
      <header className="creator-qa-head">
        <div>
          <span>VALIDATION REPORT</span>
          <strong>发布校验明细</strong>
          <small>{明细.errorCount} 个错误 · {明细.warningCount} 个警告</small>
        </div>
        <button aria-label="收起 QA 校验结果" onClick={() => on切换(false)} title="收起" type="button"><X size={17} /></button>
      </header>
      <div className="creator-qa-body">
        {明细.errors.length || 明细.warnings.length ? (
          <>
            <问题列表 标题="阻塞发布" 类型="error" 问题们={明细.errors} 项目={项目} on定位节点={on定位节点} />
            <问题列表 标题="发布提醒" 类型="warning" 问题们={明细.warnings} 项目={项目} on定位节点={on定位节点} />
          </>
        ) : 明细.errorCount || 明细.warningCount ? (
          <div className="creator-qa-clear is-legacy"><CircleAlert size={20} /><strong>旧报告只有计数</strong><span>请重新运行校验，以生成可定位的完整问题明细。</span></div>
        ) : (
          <div className="creator-qa-clear"><CheckCircle2 size={20} /><strong>当前校验通过</strong><span>没有错误或警告。</span></div>
        )}
      </div>
    </aside>
  );
}
