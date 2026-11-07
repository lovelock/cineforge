import type { QueueItemView } from '@cineforge/shared';
import { formatBytes, formatDuration } from '../state';

const statusLabel: Record<QueueItemView['status'], string> = {
  pending: '待转换',
  probing: '预检中',
  running: '转换中',
  verifying: '校验中',
  done: '完成',
  fallback: '已回退重编码',
  failed: '失败',
  canceled: '已取消',
};

function isActive(status: QueueItemView['status']): boolean {
  return status === 'probing' || status === 'running' || status === 'verifying';
}

export function QueueTable({
  items,
  selectedId,
  onSelect,
}: {
  items: QueueItemView[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">＋</div>
        <p>把视频或音频文件拖进来，或点击上方按钮选择文件</p>
        <p className="muted">支持 MTS、MP4、MKV、MOV、AVI、WebM、MP3、FLAC 等常见格式</p>
      </div>
    );
  }

  return (
    <div className="queue">
      <table>
        <thead>
          <tr>
            <th className="name">文件</th>
            <th className="size">大小</th>
            <th className="duration">时长</th>
            <th className="status">状态</th>
            <th className="progress-cell">进度</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={`row-${item.status}${selectedId === item.id ? ' selected' : ''}`}
              onClick={() => onSelect?.(item.id)}
            >
              <td className="name">
                <div className="file-name" title={item.sourcePath}>{item.fileName}</div>
                {item.message && <div className="file-error" title={item.message}>{item.message}</div>}
              </td>
              <td className="size">{formatBytes(item.sizeBytes)}</td>
              <td className="duration">{formatDuration(item.durationSec)}</td>
              <td className="status">
                <span className={`badge badge-${item.status}`}>{statusLabel[item.status]}</span>
              </td>
              <td className="progress-cell">
                <div className={`progress ${isActive(item.status) && item.progress === null ? 'indeterminate' : ''}`}>
                  <div
                    className="progress-bar"
                    style={{ width: `${item.progress ?? (isActive(item.status) ? 100 : 0)}%` }}
                  />
                </div>
                <span className="progress-text">
                  {item.progress === null ? '' : `${Math.round(item.progress)}%`}
                  {item.speed ? ` · ${item.speed}` : ''}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
