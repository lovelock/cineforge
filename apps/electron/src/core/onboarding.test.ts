import { describe, expect, it } from 'vitest';
import type { Settings } from '@cineforge/shared';
import { buildInstallPrompt, shouldShowFirstRunPrompt } from './onboarding';

const settings = (over: Partial<Settings> = {}): Settings => ({
  ffmpegPath: null,
  outputMode: 'source',
  fixedOutputDir: null,
  firstRunPromptShown: false,
  ...over,
});

describe('buildInstallPrompt', () => {
  it('包含常见发行版的安装命令与设置入口', () => {
    const prompt = buildInstallPrompt([]);
    expect(prompt.detail).toContain('pacman -S ffmpeg');
    expect(prompt.detail).toContain('apt install ffmpeg');
    expect(prompt.detail).toContain('dnf install ffmpeg');
    expect(prompt.detail).toContain('zypper install ffmpeg');
    expect(prompt.detail).toContain('设置');
    expect(prompt.detail).toContain('mpeg2video');
  });

  it('列出缺失的编码器', () => {
    expect(buildInstallPrompt(['mpeg2video', 'ac3']).detail).toContain('mpeg2video、ac3');
  });
});

describe('shouldShowFirstRunPrompt', () => {
  it('未提示过时返回 true', () => {
    expect(shouldShowFirstRunPrompt(settings())).toBe(true);
  });

  it('提示过后返回 false', () => {
    expect(shouldShowFirstRunPrompt(settings({ firstRunPromptShown: true }))).toBe(false);
  });
});
