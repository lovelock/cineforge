import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  profiles,
  type AppInit,
  type QueueSnapshot,
  type Settings,
} from '@cineforge/shared';
import { discover, type Toolchain } from '../core/ffmpeg';
import { safeFinalize } from '../core/finalize';
import { runJob } from '../core/job';
import { buildInstallPrompt, shouldShowFirstRunPrompt } from '../core/onboarding';
import { buildPlan } from '../core/plan';
import { probe } from '../core/probe';
import { ConversionQueue } from '../core/queue';
import { runFfmpeg } from '../core/runner';
import { loadSettings, saveSettings } from '../core/settings';
import { verifyOutput } from '../core/verify';
import { pickDir, pickFiles } from './dialogs';

export interface AddOptions {
  profileId: string;
  outDir: string | null;
  dvdStandard?: 'pal' | 'ntsc';
}

export function registerIpc(
  getWindow: () => BrowserWindow | null,
): { shutdown: () => Promise<void>; showFirstRunPrompt: (win: BrowserWindow | null) => Promise<void> } {
  const settingsFile = join(app.getPath('userData'), 'settings.json');
  const logDir = join(app.getPath('userData'), 'logs');

  let settings: Settings = loadSettings(settingsFile);
  let toolchain: Toolchain | null = null;
  let toolchainMissing: string[] = [];
  let queue: ConversionQueue | null = null;

  const deps = {
    probe,
    buildPlan,
    run: runFfmpeg,
    verify: verifyOutput,
    statSize: (path: string) => stat(path).then((info) => info.size).catch(() => 0),
    remove: (path: string) => rm(path, { force: true }),
    rename: async (from: string, to: string) => {
      await safeFinalize(from, to);
    },
  };

  async function refreshToolchain(): Promise<void> {
    try {
      toolchain = await discover({ override: settings.ffmpegPath });
      toolchainMissing = [];
    } catch (error) {
      toolchain = null;
      toolchainMissing = (error as { missing?: string[] }).missing ?? [];
    }
    queue = null;
  }

  function ensureQueue(): ConversionQueue {
    if (!toolchain) {
      throw new Error('FFMPEG_UNAVAILABLE');
    }
    if (!queue) {
      const active = toolchain;
      queue = new ConversionQueue({
        ffmpegPath: active.ffmpeg,
        ffprobePath: active.ffprobe,
        probeSource: probe,
        runJob: (input, signal) => runJob(
          { ...input, signal, ffprobePath: active.ffprobe },
          deps,
        ),
      });
      queue.on('state', (snapshot: QueueSnapshot) => {
        getWindow()?.webContents.send('queue:state', snapshot);
      });
      queue.on('log', (event: { id: string; line: string }) => {
        getWindow()?.webContents.send('queue:log', event);
      });
    }
    return queue;
  }

  let toolchainReady: Promise<void> = refreshToolchain();

  async function showFirstRunPrompt(win: BrowserWindow | null): Promise<void> {
    await toolchainReady;
    if (!shouldShowFirstRunPrompt(settings)) {
      return;
    }
    settings = { ...settings, firstRunPromptShown: true };
    saveSettings(settingsFile, settings);
    if (toolchain) {
      return;
    }

    const prompt = buildInstallPrompt(toolchainMissing);
    const options = {
      type: 'warning' as const,
      title: prompt.title,
      message: prompt.message,
      detail: prompt.detail,
      buttons: ['打开设置', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    };
    const result = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options);
    if (result.response === 0) {
      win?.webContents.send('app:open-settings');
    }
  }

  ipcMain.handle('app:init', async (): Promise<AppInit> => {
    await toolchainReady;
    return {
      profiles,
      settings,
      toolchain: toolchain ? { version: toolchain.version, missing: toolchainMissing } : null,
    };
  });

  ipcMain.handle('dialog:pick-files', () => pickFiles(getWindow()));
  ipcMain.handle('dialog:pick-dir', () => pickDir(getWindow()));

  ipcMain.handle('queue:add', async (_event, paths: string[], opts: AddOptions) => {
    await toolchainReady;
    ensureQueue().add(paths, opts.profileId, opts.outDir, { dvdStandard: opts.dvdStandard });
  });

  ipcMain.handle('queue:start', async () => {
    await toolchainReady;
    await ensureQueue().start();
  });

  ipcMain.handle('queue:cancel', () => {
    queue?.cancel();
  });

  ipcMain.handle('queue:remove', async (_event, id: string) => {
    await toolchainReady;
    ensureQueue().remove(id);
  });

  ipcMain.handle('queue:clear', async () => {
    await toolchainReady;
    ensureQueue().clear();
  });

  ipcMain.handle('queue:retry', async (_event, id: string) => {
    await toolchainReady;
    ensureQueue().retry(id);
  });

  ipcMain.handle('settings:get', () => settings);

  ipcMain.handle('settings:set', async (_event, next: Settings) => {
    if (queue?.snapshot().running) {
      throw new Error('BUSY: 转换进行中，无法修改设置');
    }
    saveSettings(settingsFile, next);
    settings = loadSettings(settingsFile);
    toolchainReady = refreshToolchain();
    await toolchainReady;
  });

  ipcMain.handle('app:open-path', (_event, path: string) => shell.openPath(path));

  ipcMain.handle('app:save-log', async (_event, id: string, text: string) => {
    await mkdir(logDir, { recursive: true });
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    await writeFile(join(logDir, `${safeId}.log`), text, 'utf8');
  });

  return {
    shutdown: async () => {
      queue?.cancel();
      await queue?.waitForIdle();
    },
    showFirstRunPrompt,
  };
}
