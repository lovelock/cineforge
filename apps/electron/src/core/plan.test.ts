import { describe, expect, it } from 'vitest';
import { getProfile } from '@cineforge/shared';
import { buildPlan } from './plan';
import type { MediaInfo } from './types';

const base = (over: Partial<MediaInfo> = {}): MediaInfo => ({
  path: '/in/测试 视频.mkv', durationSec: 10, formatName: 'matroska',
  video: { index: 0, codec: 'h264', width: 1920, height: 1080, avgFrameRate: 25,
    fieldOrder: 'progressive', displayAspectRatio: 16 / 9, interlaced: false },
  audio: { index: 1, codec: 'aac', sampleRate: 48000, channels: 2 },
  ...over,
});

const make = (profileId: string, source = base(), forceEncode = false) =>
  buildPlan({
    source, forceEncode, tempPath: '/out/.tmp-1', outputPath: '/out/测试 视频.mp4',
    profile: getProfile(profileId) as any,
  });

describe('buildPlan', () => {
  it('MKV(H.264+AAC) → MP4 全部 copy，并加 faststart', () => {
    const p = make('mp4');
    expect(p.mode).toBe('remux');
    expect(p.args).toContain('copy');
    expect(p.args).toContain('-movflags');
    expect(p.args).toContain('+faststart');
    expect(p.args).toContain('-f');
    expect(p.args).toContain('mp4');
    expect(p.args).not.toContain('-pix_fmt');
  });

  it('MTS(H.264+AC-3) → MP4 视频 copy、音频转 AAC', () => {
    const src = base({ video: { ...base().video!, codec: 'h264' }, audio: { index: 1, codec: 'ac3', sampleRate: 48000, channels: 2 } });
    const p = make('mp4', src);
    expect(p.mode).toBe('partial');
    expect(p.args.join(' ')).toContain('-c:v copy');
    expect(p.args.join(' ')).toContain('-c:a aac');
  });

  it('H.264 → AVI 全部重编码', () => {
    const p = make('avi');
    expect(p.mode).toBe('encode');
    expect(p.args.join(' ')).toContain('-c:v mpeg4');
    expect(p.args.join(' ')).toContain('-c:a libmp3lame');
    expect(p.args.join(' ')).toContain('-pix_fmt yuv420p');
  });

  it('视频转纯音频时丢弃视频', () => {
    const p = make('mp3');
    expect(p.args).toContain('-vn');
    expect(p.args).toContain('-map');
    expect(p.args).toContain('0:a:0');
    expect(p.mode).toBe('encode');
  });

  it('forceEncode 会忽略可 copy 的编码', () => {
    const p = make('mp4', base(), true);
    expect(p.mode).toBe('encode');
    expect(p.args.join(' ')).toContain('-c:v libx264');
  });

  it('丢弃字幕与元数据，并写入临时文件', () => {
    const p = make('mp4');
    expect(p.args).toContain('-sn');
    expect(p.args).toContain('-dn');
    expect(p.args).toContain('-map_metadata');
    expect(p.args).toContain('/out/.tmp-1');
  });
});
