import { useEffect, useState } from 'react';
import type { Settings } from '@cineforge/shared';

export function SettingsPanel({
  open,
  settings,
  onClose,
  onSaved,
}: {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [ffmpegPath, setFfmpegPath] = useState(settings.ffmpegPath ?? '');
  const [outputMode, setOutputMode] = useState<'source' | 'fixed'>(settings.outputMode);
  const [fixedDir, setFixedDir] = useState(settings.fixedOutputDir ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFfmpegPath(settings.ffmpegPath ?? '');
    setOutputMode(settings.outputMode);
    setFixedDir(settings.fixedOutputDir ?? '');
  }, [settings, open]);

  if (!open) {
    return null;
  }

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await window.api.setSettings({
        ffmpegPath: ffmpegPath.trim() || null,
        outputMode,
        fixedOutputDir: fixedDir.trim() || null,
        firstRunPromptShown: settings.firstRunPromptShown,
      });
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  async function chooseDir(): Promise<void> {
    const dir = await window.api.pickDir();
    if (dir) {
      setFixedDir(dir);
      setOutputMode('fixed');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>设置</h2>

        <label className="field">
          <span>ffmpeg 路径（留空则使用 PATH）</span>
          <input
            type="text"
            value={ffmpegPath}
            placeholder="例如 /usr/bin/ffmpeg"
            onChange={(event) => setFfmpegPath(event.target.value)}
          />
        </label>

        <fieldset className="fieldset">
          <legend>默认输出位置</legend>
          <label className="radio">
            <input
              type="radio"
              checked={outputMode === 'source'}
              onChange={() => setOutputMode('source')}
            />
            与源文件同目录
          </label>
          <label className="radio">
            <input
              type="radio"
              checked={outputMode === 'fixed'}
              onChange={() => setOutputMode('fixed')}
            />
            固定目录
          </label>
          <div className="dir-row">
            <input
              type="text"
              value={fixedDir}
              placeholder="选择或输入固定输出目录"
              onChange={(event) => setFixedDir(event.target.value)}
            />
            <button type="button" className="secondary" onClick={chooseDir}>选择…</button>
          </div>
        </fieldset>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="primary" onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </section>
    </div>
  );
}
