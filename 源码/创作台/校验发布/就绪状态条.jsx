// 这个文件是创作台底部那条"仪表盘"：像汽车仪表一样五个表——
// 校验 / 结构 / 图片 / 语音 / 音乐，各自亮红灯(is-warn)还是绿灯(is-good)，
// 让作者一眼看出这部作品离"能发货"还差什么。
// 数据全部来自项目 summary 和 QA 报告文本，本组件自己不发请求。
import React from 'react';
import { Check, CircleAlert, LoaderCircle, Image, Volume2, Music } from 'lucide-react';
import { 解析QA报告 } from './校验规则.js';

// 输入一堆统计 props → 摆出 footer.studio-readiness 五段 → 吐出 JSX
export default function 就绪状态条({
  项目,
  qa报告,
  图片任务进行中,
  语音任务进行中,
}) {
  const 报告数字 = 解析QA报告(qa报告);
  const 有效报告 = !!qa报告 && 报告数字.recognized;
  const 摘要 = 项目?.summary;
  const 有错误 = 报告数字.errors > 0;
  const 有警告 = 报告数字.warnings > 0;
  const 提示词数 = 摘要?.promptCount ?? 0;
  const 场景数 = 摘要?.nodeCount ?? 0;
  const 分支数 = 摘要?.choiceCount ?? 0;
  const 结局数 = 摘要?.endingCount ?? 0;
  const 视觉场景总数 = 摘要?.visualSceneCount ?? 场景数;
  const 已覆盖场景数 = Math.min(摘要?.visualReadyCount ?? 0, 视觉场景总数);
  const 视觉缺口 = Math.max(视觉场景总数 - 已覆盖场景数, 0);
  const 图片未完整 = !!项目 && (视觉场景总数 === 0 || 视觉缺口 > 0);
  const 台词总数 = 摘要?.voiceLineCount ?? 0;
  const 语音就绪数 = 摘要?.voiceReadyCount ?? 0;
  const 语音失败数 = 摘要?.voiceFailedCount ?? 0;
  const 语音缺口 = Math.max(台词总数 - 语音就绪数, 0);
  const 音轨总数 = 摘要?.musicTrackCount ?? 0;
  const 音乐就绪数 = 摘要?.musicReadyCount ?? 0;
  const 音乐已选数 = 摘要?.musicSelectedCount ?? 0;
  const 结构警示 = 场景数 > 0 && 提示词数 < 场景数; // 有场景没提示词 = 生图流水线会断粮

  return (
    <footer className="studio-readiness">
      <section className={有错误 || 有警告 || !有效报告 ? 'is-attention' : ''}>
        <span>校验</span>
        <strong className={有错误 || 有警告 || !有效报告 ? 'is-warn' : 'is-good'}>
          {有错误 || 有警告 || !有效报告 ? <CircleAlert size={14} /> : <Check size={14} />}
          {项目
            ? 有效报告
              ? 有错误
                ? `${报告数字.errors} 错误`
                : 有警告
                  ? `${报告数字.warnings} 警告`
                  : '通过'
              : '待校验'
            : '未选择'}
        </strong>
        <small>{有效报告 ? `E${报告数字.errors} / W${报告数字.warnings}` : '运行校验后同步'}</small>
      </section>
      <section className={结构警示 ? 'is-attention' : ''}>
        <span>结构</span>
        <strong className={结构警示 ? 'is-warn' : 'is-good'}>
          {结构警示 ? <CircleAlert size={14} /> : <Check size={14} />}
          {场景数} 场景
        </strong>
        <small>
          {分支数} 分支 · {结局数} 结局 · 提示 {提示词数}/{场景数}
        </small>
      </section>
      <section className={图片未完整 || 图片任务进行中 ? 'is-attention' : ''}>
        <span>图片</span>
        <strong className={图片未完整 || 图片任务进行中 || !项目 ? 'is-warn' : 'is-good'}>
          {图片任务进行中 ? <LoaderCircle className="spin" size={14} /> : <Image size={14} />}
          {图片任务进行中
            ? '生成中'
            : !项目
              ? '未选择'
              : 视觉场景总数 === 0
                ? '未规划'
                : 视觉缺口 > 0
                  ? `缺 ${视觉缺口}`
                  : '完整'}
        </strong>
        <small>
          {已覆盖场景数}/{视觉场景总数} 场景覆盖
        </small>
      </section>
      <section className={语音缺口 > 0 || 语音失败数 > 0 || 语音任务进行中 ? 'is-attention' : ''}>
        <span>语音</span>
        <strong className={语音缺口 > 0 || 语音失败数 > 0 || 语音任务进行中 ? 'is-warn' : 'is-good'}>
          {语音任务进行中 ? <LoaderCircle className="spin" size={14} /> : <Volume2 size={14} />}
          {语音任务进行中 ? '生成中' : 语音失败数 > 0 ? `失败 ${语音失败数}` : 语音缺口 > 0 ? `缺 ${语音缺口}` : '完整'}
        </strong>
        <small>
          {语音就绪数}/{台词总数} 台词
        </small>
      </section>
      <section className={音轨总数 > 0 && 音乐已选数 === 0 ? 'is-attention' : ''}>
        <span>音乐</span>
        <strong className={音轨总数 > 0 && 音乐已选数 === 0 ? 'is-warn' : 'is-good'}>
          <Music size={14} />
          {音轨总数 === 0 ? '未规划' : 音乐已选数 > 0 ? `已选 ${音乐已选数}` : 音乐就绪数 > 0 ? '待选择' : '待生成'}
        </strong>
        <small>
          {音乐就绪数}/{音轨总数} 可用
        </small>
      </section>
    </footer>
  );
}
