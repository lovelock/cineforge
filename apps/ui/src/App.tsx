import { useEffect, useReducer, useState, type DragEvent } from 'react';
import type { QueueSnapshot, Settings } from '@cineforge/shared';
import { Banner } from './components/Banner';
import { LogDrawer } from './components/LogDrawer';
import { OutputBar } from './components/OutputBar';
import { ProfilePicker } from './components/ProfilePicker';
import { QueueTable } from './components/QueueTable';
import { SettingsPanel } from './components/SettingsPanel';
import { initialState, reducer } from './state';

const defaultSettings: Settings = {
  ffmpegPath: null,
  outputMode: 'source',
  fixedOutputDir: null,
  firstRunPromptShown: false,
};

function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes('FFMPEG_UNAVAILABLE')) {
    return '未找到可用的 ffmpeg，请确认已安装，或在设置中指定正确路径。';
  }
  if (text.includes('BUSY')) {
    return '转换进行中，请先取消或等待完成。';
  }
  return text;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [profileId, setProfileId] = useState('mp4');
  const [dvdStandard, setDvdStandard] = useState<'auto' | 'pal' | 'ntsc'>('auto');
  const [outputMode, setOutputMode] = useState<'source' | 'fixed'>('source');
  const [fixedDir, setFixedDir] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;

    window.api.init()
      .then((init) => {
        if (alive) {
          dispatch({ type: 'init', payload: init });
        }
      })
      .catch((error) => {
        if (alive) {
          dispatch({ type: 'error', payload: errorMessage(error) });
        }
      });

    const offState = window.api.onState((snapshot) => {
      dispatch({ type: 'state', payload: snapshot });
    });
    const offLog = window.api.onLog((event) => {
      dispatch({ type: 'log', payload: event });
    });
    const offSettings = window.api.onOpenSettings(() => {
      setSettingsOpen(true);
    });

    return () => {
      alive = false;
      offState();
      offLog();
      offSettings();
    };
  }, []);

  useEffect(() => {
    if (state.init) {
      setOutputMode(state.init.settings.outputMode);
      setFixedDir(state.init.settings.fixedOutputDir ?? '');
    }
  }, [state.init]);

  const items = state.snapshot?.items ?? [];
  const running = state.snapshot?.running ?? false;
  const summary = state.snapshot?.summary ?? { done: 0, fallback: 0, failed: 0, canceled: 0 };
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const selectedLogs = selectedId ? state.logs[selectedId] ?? [] : [];
  const toolchain = state.init?.toolchain ?? null;
  const missing = toolchain?.missing ?? [];
  const detectedItem = items.find((item) => item.detectedStandard !== null);
  const detection = detectedItem && detectedItem.detectedStandard
    ? {
        standard: detectedItem.detectedStandard,
        interlaced: detectedItem.interlaced ?? false,
        avgFrameRate: detectedItem.avgFrameRate,
      }
    : null;

  useEffect(() => {
    if (!detection?.interlaced || dvdStandard === 'auto') {
      return;
    }
    if (detection.standard !== dvdStandard) {
      setDvdStandard('auto');
    }
  }, [detection?.interlaced, detection?.standard, dvdStandard]);

  async function reloadInit(): Promise<void> {
    const init = await window.api.init();
    dispatch({ type: 'init', payload: init });
  }

  async function addPaths(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    if (outputMode === 'fixed' && !fixedDir) {
      dispatch({ type: 'error', payload: '请先选择固定输出目录。' });
      return;
    }
    try {
      await window.api.addFiles(paths, {
        profileId,
        outDir: outputMode === 'source' ? null : fixedDir,
        dvdStandard: dvdStandard === 'auto' ? undefined : dvdStandard,
      });
    } catch (error) {
      dispatch({ type: 'error', payload: errorMessage(error) });
    }
  }

  async function pickFiles(): Promise<void> {
    try {
      await addPaths(await window.api.pickFiles());
    } catch (error) {
      dispatch({ type: 'error', payload: errorMessage(error) });
    }
  }

  async function pickDir(): Promise<void> {
    try {
      const dir = await window.api.pickDir();
      if (dir) {
        setFixedDir(dir);
        setOutputMode('fixed');
      }
    } catch (error) {
      dispatch({ type: 'error', payload: errorMessage(error) });
    }
  }

  async function start(): Promise<void> {
    try {
      await window.api.start();
    } catch (error) {
      dispatch({ type: 'error', payload: errorMessage(error) });
    }
  }

  async function removeSelected(): Promise<void> {
    if (!selectedId) {
      return;
    }
    try {
      await window.api.removeFile(selectedId);
      setSelectedId(null);
    } catch (error) {
      dispatch({ type: 'error', payload: errorMessage(error) });
    }
  }

  async function clearQueue(): Promise<void> {
    try {
      await window.api.clear();
      setSelectedId(null);
    } catch (error) {
      dispatch({ type: 'error', payload: errorMessage(error) });
    }
  }

  async function retrySelected(): Promise<void> {
    if (!selectedId) {
      return;
    }
    try {
      await window.api.retry(selectedId);
    } catch (error) {
      dispatch({ type: 'error', payload: errorMessage(error) });
    }
  }

  function openOutputDir(): void {
    const first = items[0];
    if (!first) {
      return;
    }
    const dir = outputMode === 'fixed' && fixedDir
      ? fixedDir
      : first.outputPath.slice(0, first.outputPath.lastIndexOf('/'));
    void window.api.openPath(dir);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragging(false);
    }
  }

  async function onDrop(event: DragEvent<HTMLDivElement>): Promise<void> {
    event.preventDefault();
    setDragging(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => {
        try {
          return window.api.pathForFile(file);
        } catch {
          return '';
        }
      })
      .filter(Boolean);
    await addPaths(paths);
  }

  return (
    <div
      className="app"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(event) => { void onDrop(event); }}
    >
      <header className="topbar">
        <div>
          <h1>影匠</h1>
          <p className="subtitle">影音格式工坊 · 调用本机 ffmpeg · 只换格式，不调参数</p>
        </div>
        <div className="topbar-actions">
          <span className={`ffmpeg-status ${toolchain ? 'ok' : 'bad'}`}>
            {toolchain ? `ffmpeg ${toolchain.version}` : '未检测到 ffmpeg'}
          </span>
          <button type="button" className="secondary" onClick={() => setSettingsOpen(true)} disabled={running}>
            设置
          </button>
        </div>
      </header>

      {!toolchain && (
        <Banner
          action={<button type="button" className="link" onClick={() => setSettingsOpen(true)}>打开设置</button>}
        >
          无法使用 ffmpeg。请确认系统已安装 ffmpeg ≥ 6.0，并包含 mpeg2video、ac3 编码器。
          {missing.length > 0 && ` 缺少：${missing.join('、')}`}
        </Banner>
      )}

      {state.error && (
        <Banner
          action={<button type="button" className="link" onClick={() => dispatch({ type: 'clear-error' })}>知道了</button>}
        >
          {state.error}
        </Banner>
      )}

      <main className="content">
        <ProfilePicker
          profiles={state.init?.profiles ?? []}
          value={profileId}
          onChange={setProfileId}
          dvdStandard={dvdStandard}
          onDvdStandard={setDvdStandard}
          disabled={items.length > 0}
          detection={profileId === 'dvd' ? detection : null}
        />

        <div className="add-row">
          <button type="button" className="primary" onClick={pickFiles}>
            添加文件…
          </button>
          <button
            type="button"
            className="secondary"
            onClick={removeSelected}
            disabled={!selectedId || running}
          >
            移除选中
          </button>
          <button
            type="button"
            className="secondary"
            onClick={clearQueue}
            disabled={items.length === 0 || running}
          >
            清空
          </button>
          <button
            type="button"
            className="secondary"
            onClick={retrySelected}
            disabled={!selectedItem || running ||
              (selectedItem.status !== 'failed' && selectedItem.status !== 'canceled')}
          >
            重试
          </button>
          <span className="muted">
            {items.length > 0
              ? '队列非空时目标格式与输出位置已锁定；清空后可改。'
              : '也可以把文件拖进窗口；一次可添加多个。'}
          </span>
        </div>

        <QueueTable items={items} selectedId={selectedId} onSelect={setSelectedId} />
      </main>

      <LogDrawer item={selectedItem} lines={selectedLogs} onClose={() => setSelectedId(null)} />

      <OutputBar
        outputMode={outputMode}
        fixedDir={fixedDir}
        onModeChange={setOutputMode}
        onPickDir={pickDir}
        running={running}
        itemCount={items.length}
        summary={summary as QueueSnapshot['summary']}
        onStart={start}
        onCancel={() => { void window.api.cancel(); }}
        onOpenDir={openOutputDir}
      />

      <SettingsPanel
        open={settingsOpen}
        settings={state.init?.settings ?? defaultSettings}
        onClose={() => setSettingsOpen(false)}
        onSaved={reloadInit}
      />

      {dragging && <div className="drop-overlay">松开以添加文件</div>}
    </div>
  );
}
