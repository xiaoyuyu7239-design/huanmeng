import React from 'react';
import { Compass, SlidersHorizontal } from 'lucide-react';

export const 创作模式存储键 = 'creator:workspace-mode:v1';

function 规范模式(值) {
  return 值 === 'professional' ? 'professional' : 'quick';
}

export function 读创作模式(slug = '') {
  if (typeof window === 'undefined') return 'quick';
  try {
    const 表 = JSON.parse(window.localStorage.getItem(创作模式存储键) || '{}');
    return 规范模式(表?.[slug]);
  } catch {
    return 'quick';
  }
}

export function 写创作模式(slug, 模式) {
  if (typeof window === 'undefined' || !slug) return;
  try {
    const 原表 = JSON.parse(window.localStorage.getItem(创作模式存储键) || '{}');
    const 表 = 原表 && typeof 原表 === 'object' && !Array.isArray(原表) ? 原表 : {};
    window.localStorage.setItem(创作模式存储键, JSON.stringify({ ...表, [slug]: 规范模式(模式) }));
  } catch {
    // 模式只是工作区偏好。浏览器禁用存储时保持本次会话可用，不冒充项目保存失败。
  }
}

export default function 创作模式切换({ 模式, on切换, disabled = false }) {
  return (
    <div className="creator-mode-switch" aria-label="创作模式" role="group">
      <button
        aria-pressed={模式 === 'quick'}
        className={模式 === 'quick' ? 'is-active' : ''}
        disabled={disabled}
        onClick={() => on切换('quick')}
        type="button"
      >
        <Compass size={16} />
        <span>
          <strong>快速创作</strong>
          <small>按关系叙事步骤推进</small>
        </span>
      </button>
      <button
        aria-pressed={模式 === 'professional'}
        className={模式 === 'professional' ? 'is-active' : ''}
        disabled={disabled}
        onClick={() => on切换('professional')}
        type="button"
      >
        <SlidersHorizontal size={16} />
        <span>
          <strong>专业模式</strong>
          <small>节点、机制与资产精修</small>
        </span>
      </button>
    </div>
  );
}
