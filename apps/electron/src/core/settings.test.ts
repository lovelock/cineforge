import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

describe('settings', () => {
  it('不存在时返回默认值', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mc-set-'));
    expect(loadSettings(join(dir, 'settings.json'))).toEqual(DEFAULT_SETTINGS);
  });

  it('写入后可读回', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mc-set-'));
    const file = join(dir, 'settings.json');
    saveSettings(file, { ffmpegPath: '/opt/ffmpeg', outputMode: 'fixed', fixedOutputDir: '/导出', firstRunPromptShown: true });
    expect(loadSettings(file)).toEqual({ ffmpegPath: '/opt/ffmpeg', outputMode: 'fixed', fixedOutputDir: '/导出', firstRunPromptShown: true });
  });

  it('损坏的 JSON 回退默认值', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mc-set-'));
    const file = join(dir, 'settings.json');
    await writeFile(file, '{oops');
    expect(loadSettings(file)).toEqual(DEFAULT_SETTINGS);
  });
});
