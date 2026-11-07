import type { QueueSnapshot } from '@cineforge/shared';

export interface OutputBarProps {
  outputMode: 'source' | 'fixed';
  fixedDir: string;
  onModeChange: (mode: 'source' | 'fixed') => void;
  onPickDir: () => void;
  running: boolean;
  itemCount: number;
  summary: QueueSnapshot['summary'];
  onStart: () => void;
  onCancel: () => void;
  onOpenDir: () => void;
}

export function OutputBar({
  outputMode,
  fixedDir,
  onModeChange,
  onPickDir,
  running,
  itemCount,
  summary,
  onStart,
  onCancel,
  onOpenDir,
}: OutputBarProps) {
  const finished = summary.done + summary.fallback + summary.failed + summary.canceled;

  return (
    <footer className="output-bar">
      <div className="output-settings">
        <span className="label">输出位置</span>
        <label className="radio">
          <input
            type="radio"
            checked={outputMode === 'source'}
            disabled={running || itemCount > 0}
            onChange={() => onModeChange('source')}
          />
          与源文件同目录
        </label>
        <label className="radio">
          <input
            type="radio"
            checked={outputMode === 'fixed'}
            disabled={running || itemCount > 0}
            onChange={() => onModeChange('fixed')}
          />
          固定目录
        </label>
        {outputMode === 'fixed' && (
          <button type="button" className="link" onClick={onPickDir} disabled={running || itemCount > 0}>
            {fixedDir || '选择目录…'}
          </button>
        )}
      </div>

      <div className="output-actions">
        {finished > 0 && !running && (
          <span className="summary">
            成功 {summary.done + summary.fallback} · 失败 {summary.failed} · 取消 {summary.canceled}
          </span>
        )}
        <button type="button" className="secondary" onClick={onOpenDir} disabled={itemCount === 0}>
          打开输出目录
        </button>
        {running ? (
          <button type="button" className="danger" onClick={onCancel}>
            取消
          </button>
        ) : (
          <button type="button" className="primary" onClick={onStart} disabled={itemCount === 0}>
            开始转换
          </button>
        )}
      </div>
    </footer>
  );
}
