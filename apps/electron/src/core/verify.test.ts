import { describe, expect, it } from 'vitest';
import { getProfile } from '@cineforge/shared';
import { verifyOutput } from './verify';
import type { MediaInfo } from './types';

const source: MediaInfo = { path: '/in/a.MTS', durationSec: 60, formatName: 'mpegts',
  video: { index: 0, codec: 'h264', width: 1920, height: 1080, avgFrameRate: 25,
    fieldOrder: 'tt', displayAspectRatio: 16 / 9, interlaced: true },
  audio: { index: 1, codec: 'ac3', sampleRate: 48000, channels: 2 } };

const out = (over: Partial<MediaInfo> = {}): MediaInfo => ({ ...source, path: '/out/x.mpg', ...over });

const plan = (over: Record<string, unknown> = {}) => ({
  args: [], mode: 'encode' as const, finalPath: '/out/x.mpg', tempPath: '/out/.tmp',
  videoCopied: false, audioCopied: true, ...over,
});

describe('verifyOutput', () => {
  it('DVD 规格正确时通过', () => {
    const info = out({ video: { ...source.video!, codec: 'mpeg2video', width: 720, height: 576, avgFrameRate: 25 } });
    expect(verifyOutput(info, { profile: getProfile('dvd') as any, source, plan: plan() as any, standard: 'pal' }).ok).toBe(true);
  });

  it('DVD 分辨率错误时失败并说明原因', () => {
    const info = out({ video: { ...source.video!, codec: 'mpeg2video', width: 1280, height: 720 } });
    const r = verifyOutput(info, { profile: getProfile('dvd') as any, source, plan: plan() as any, standard: 'pal' });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/720x576/);
  });

  it('时长偏差超过 max(2s, 1%) 时失败', () => {
    const info = out({ durationSec: 70, video: { ...source.video!, codec: 'mpeg2video', width: 720, height: 576 } });
    expect(verifyOutput(info, { profile: getProfile('dvd') as any, source, plan: plan() as any, standard: 'pal' }).ok).toBe(false);
  });

  it('通用档案要求输出流存在', () => {
    const noAudio = out({ audio: undefined, video: { ...source.video!, codec: 'h264' } });
    const p = plan({ mode: 'remux', videoCopied: true, audioCopied: true });
    const r = verifyOutput(noAudio, { profile: getProfile('mp4') as any, source, plan: p as any });
    expect(r.ok).toBe(false);
  });

  it('无音源时 DVD 不要求音频流', () => {
    const silentSource: MediaInfo = { ...source, audio: undefined };
    const info = out({
      audio: undefined,
      video: { ...source.video!, codec: 'mpeg2video', width: 720, height: 576, avgFrameRate: 25 },
    });
    const r = verifyOutput(info, {
      profile: getProfile('dvd') as any,
      source: silentSource,
      plan: plan() as any,
      standard: 'pal',
    });
    expect(r.ok).toBe(true);
  });
});
