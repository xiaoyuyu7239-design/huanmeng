import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  LoaderCircle,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';

function 格式化导出时间(值) {
  const 时间 = new Date(值);
  if (!Number.isFinite(时间.getTime())) return 值 || '未知';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(时间);
}

export default function 创作包导入弹窗({ 文件名, 预检, 错误, 导入中, on确认, on关闭 }) {
  const 摘要 = 预检?.摘要;
  const 创作包 = 预检?.创作包;
  const 可以导入 = !!摘要 && !!创作包 && !错误;
  const 关闭 = () => {
    if (!导入中) on关闭();
  };

  return (
    <section
      aria-label="导入幻梦创作包"
      aria-modal="true"
      className="creator-editor-overlay"
      onKeyDown={(事件) => { if (事件.key === 'Escape') 关闭(); }}
      role="dialog"
    >
      <div className="creator-settings-dialog creator-package-dialog">
        <div className="creator-editor-head">
          <div>
            <span>创作包迁移</span>
            <strong>{可以导入 ? '确认覆盖当前浏览器创作仓' : '创作包预检未通过'}</strong>
          </div>
          <button autoFocus disabled={导入中} onClick={关闭} title="关闭" type="button">
            <X size={18} />
          </button>
        </div>

        <div className="creator-settings-body creator-package-body">
          <div className="creator-package-file">
            <FileArchive size={20} />
            <div>
              <span>待导入文件</span>
              <strong title={文件名}>{文件名 || '未命名创作包.json'}</strong>
            </div>
          </div>

          {错误 ? (
            <div aria-live="assertive" className="creator-package-error" role="alert">
              <AlertTriangle size={20} />
              <div>
                <strong>没有写入任何本机数据</strong>
                <p>{错误}</p>
                <small>请选择由当前版本「幻梦创作台」导出的完整 JSON 文件后重试。</small>
              </div>
            </div>
          ) : (
            <>
              <div className="creator-package-valid">
                <CheckCircle2 size={19} />
                <div>
                  <strong>JSON、产品版本、slug、时间与发布快照均已通过 dry-run</strong>
                  <span>v{创作包?.schemaVersion} · 导出于 {格式化导出时间(摘要?.exportedAt)}</span>
                </div>
              </div>

              <dl className="creator-package-summary">
                <div><dt>项目</dt><dd>{摘要?.projectCount ?? 0}</dd><small>完整本机项目条目</small></div>
                <div><dt>草稿</dt><dd>{摘要?.draftCount ?? 0}</dd><small>可继续编辑</small></div>
                <div><dt>玩家版本</dt><dd>{摘要?.publishedCount ?? 0}</dd><small>已发布冻结快照</small></div>
                <div><dt>首页精选</dt><dd>{摘要?.featuredCount ?? 0}</dd><small>含对应卡片配置</small></div>
              </dl>

              <div className="creator-package-selected">
                <span>导入后优先打开</span>
                <strong>{摘要?.selectedSlug || '自动选择可用项目'}</strong>
              </div>

              <div className="creator-package-warning">
                <AlertTriangle size={20} />
                <div>
                  <strong>确认后会整体覆盖当前浏览器中的项目、草稿、玩家版本、精选与选中项。</strong>
                  <p>写入开始前会先自动下载一份「导入前备份」。任一存储读写失败都会停止导入并补偿恢复原仓。</p>
                </div>
              </div>

              <div className="creator-package-local-note">
                <ShieldCheck size={18} />
                <span>文件只在当前浏览器解析和下载，不会上传到服务器。</span>
              </div>
            </>
          )}
        </div>

        <div className="creator-editor-actions creator-package-actions">
          {可以导入 && (
            <button className="creator-package-confirm" disabled={导入中} onClick={on确认} type="button">
              {导入中 ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
              {导入中 ? '正在备份并导入' : '先下载备份，再确认导入'}
            </button>
          )}
          <button disabled={导入中} onClick={关闭} type="button">
            {可以导入 ? '取消' : '关闭'}
          </button>
        </div>
      </div>
    </section>
  );
}
