import { describe, expect, it } from 'vitest';
import { getProfile } from '@cineforge/shared';
import { buildDvdPlan, detectStandard, topFor } from './dvd';
import type { MediaInfo, VideoInfo } from './types';

const src = (v: Partial<VideoInfo>, a = { codec: 'ac3', sampleRate: 48000, channels: 2 }): MediaInfo => ({
  path: '/in/素材.MTS', durationSec: 60, formatName: 'mpegts',
  video: { index: 0, codec: 'h264', width: 1920, height: 1080, avgFrameRate: 25,
    fieldOrder: 'tt', displayAspectRatio: 16 / 9, interlaced: true, ...v },
  audio: { index: 1, ...a },
});

const plan = (source: MediaInfo, standard?: 'pal' | 'ntsc') =>
  buildDvdPlan({ source, standard, tempPath: '/out/.tmp', outputPath: '/out/x.mpg',
    profile: getProfile('dvd') as any });

describe('DVD 规格', () => {
  it('1080i50 tt → PAL，保留隔行与场序', () => {
    const p = plan(src({}));
    const s = p.args.join(' ');
    expect(detectStandard(src({}))).toBe('pal');
    expect(s).toContain('scale=720:576:interl=1');
    expect(s).toContain('setsar=64/45');
    expect(s).toContain('-c:v mpeg2video');
    expect(s).toContain('-g 15');
    expect(s).toContain('setfield=tff');
    expect(s).toContain('-flags +ildct+ilme');
    expect(s).toContain('-b:v 6000k');
    expect(s).toContain('-maxrate 9000k');
  });

  it('1080i60 bb → NTSC，bottom first', () => {
    const p = plan(src({ avgFrameRate: 29.97, fieldOrder: 'bb' }));
    const s = p.args.join(' ');
    expect(detectStandard(src({ avgFrameRate: 29.97 }))).toBe('ntsc');
    expect(s).toContain('scale=720:480');
    expect(s).toContain('-g 18');
    expect(s).toContain('setfield=bff');
  });

  it('tb/bt 场序映射', () => {
    expect(topFor('tt')).toBe(1);
    expect(topFor('bb')).toBe(0);
    expect(topFor('tb')).toBe(0);
    expect(topFor('bt')).toBe(1);
    expect(plan(src({ fieldOrder: 'tb' })).args.join(' ')).toContain('setfield=bff');
    expect(plan(src({ fieldOrder: 'bt' })).args.join(' ')).toContain('setfield=tff');
  });

  it('23.976p → NTSC 使用 telecine', () => {
    const p = plan(src({ avgFrameRate: 24000 / 1001, fieldOrder: 'progressive', interlaced: false }), 'ntsc');
    expect(p.args.join(' ')).toContain('telecine');
  });

  it('50p → PAL 使用 tinterlace 保留运动', () => {
    const p = plan(src({ avgFrameRate: 50, fieldOrder: 'progressive', interlaced: false }));
    const s = p.args.join(' ');
    expect(s).toContain('tinterlace=interleave_top');
    expect(s).toContain('setfield=tff');
  });

  it('4:3 源写 4:3 并设置正确 SAR', () => {
    const p = plan(src({ displayAspectRatio: 4 / 3 }));
    expect(p.args.join(' ')).toContain('-aspect 4:3');
    expect(p.args.join(' ')).toContain('setsar=16/15');
  });

  it('隔行素材跨制式覆盖被拒绝', () => {
    expect(() => plan(src({}), 'ntsc')).toThrowError(/INTERLACED_CROSS_STANDARD/);
  });

  it('5.1 AC-3 copy；立体声转 384k', () => {
    const copy = plan(src({}, { codec: 'ac3', sampleRate: 48000, channels: 6 }));
    expect(copy.args.join(' ')).toContain('-c:a copy');
    const enc = plan(src({}, { codec: 'aac', sampleRate: 48000, channels: 2 }));
    expect(enc.args.join(' ')).toContain('-c:a ac3');
    expect(enc.args.join(' ')).toContain('-b:a 384k');
    expect(enc.args.join(' ')).toContain('-ar 48000');
  });
});
