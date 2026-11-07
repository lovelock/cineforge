import type { Profile, ProfileGroup } from '@cineforge/shared';

const groups: Array<{ id: ProfileGroup; label: string }> = [
  { id: 'disc', label: '光盘' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
];

export interface ProfilePickerProps {
  profiles: Profile[];
  value: string;
  onChange: (id: string) => void;
  dvdStandard: 'auto' | 'pal' | 'ntsc';
  onDvdStandard: (standard: 'auto' | 'pal' | 'ntsc') => void;
  disabled?: boolean;
  detection?: { standard: 'pal' | 'ntsc'; interlaced: boolean; avgFrameRate: number | null } | null;
}

export function ProfilePicker({
  profiles,
  value,
  onChange,
  dvdStandard,
  onDvdStandard,
  disabled = false,
  detection = null,
}: ProfilePickerProps) {
  return (
    <section className="picker">
      <label className="field">
        <span>目标格式</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          {groups.map((group) => {
            const items = profiles.filter((profile) => profile.group === group.id);
            if (items.length === 0) {
              return null;
            }
            return (
              <optgroup key={group.id} label={group.label}>
                {items.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </label>

      {value === 'dvd' && (
        <div className="dvd-options">
          <label className="field">
            <span>制式</span>
            <select
              value={dvdStandard}
              onChange={(event) => onDvdStandard(event.target.value as 'auto' | 'pal' | 'ntsc')}
              disabled={disabled}
            >
              <option value="auto">自动（按源帧率）</option>
              <option
                value="pal"
                disabled={!!detection?.interlaced && detection.standard !== 'pal'}
              >
                PAL（720×576 / 25fps）
              </option>
              <option
                value="ntsc"
                disabled={!!detection?.interlaced && detection.standard !== 'ntsc'}
              >
                NTSC（720×480 / 29.97fps）
              </option>
            </select>
          </label>
          {detection && (
            <p className="hint detection">
              检测到 {detection.avgFrameRate?.toFixed(2) ?? '?'} fps
              {detection.interlaced ? ' 隔行' : ' 逐行'}素材 →{' '}
              {detection.standard === 'pal' ? 'PAL' : 'NTSC'} DVD
              （{detection.standard === 'pal' ? '720×576' : '720×480'}）
            </p>
          )}
          <p className="hint">
            将输出 MPEG-2 视频 + AC-3 音频的 DVD-Video 规格 .mpg（仅生成文件，不刻盘）。
            隔行素材不支持跨制式转换。
          </p>
        </div>
      )}
    </section>
  );
}
