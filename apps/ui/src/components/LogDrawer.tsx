import type { QueueItemView } from '@cineforge/shared';

export function LogDrawer({
  item,
  lines,
  onClose,
}: {
  item: QueueItemView | null;
  lines: string[];
  onClose: () => void;
}) {
  if (!item) {
    return null;
  }

  const text = lines.join('\n');

  return (
    <aside className="log-drawer">
      <header className="log-header">
        <span className="log-title" title={item.sourcePath}>日志 · {item.fileName}</span>
        <div className="log-actions">
          <button
            type="button"
            className="link"
            onClick={() => { void navigator.clipboard.writeText(text); }}
          >
            复制
          </button>
          <button
            type="button"
            className="link"
            onClick={() => { void window.api.saveLog(item.id, text); }}
          >
            导出
          </button>
          <button type="button" className="link" onClick={onClose}>关闭</button>
        </div>
      </header>
      <pre className="log-body">{lines.length > 0 ? text : '暂无日志'}</pre>
    </aside>
  );
}
