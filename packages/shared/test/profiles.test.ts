import { describe, expect, it } from 'vitest';
import { getProfile, profiles, validateProfiles, type StandardProfile } from '../src';

const standard = (id: string) => getProfile(id) as StandardProfile | undefined;

describe('profiles', () => {
  it('按规格提供全部档案且校验通过', () => {
    expect(profiles.map((p) => p.id)).toEqual([
      'dvd', 'mp4', 'mkv', 'mov', 'avi', 'webm', 'mp3', 'm4a', 'flac', 'wav',
    ]);
    expect(validateProfiles()).toEqual([]);
  });

  it('DVD 档案使用 MPEG-PS 与 .mpg', () => {
    const dvd = getProfile('dvd');
    expect(dvd?.container).toBe('mpeg');
    expect(dvd?.extension).toBe('.mpg');
  });

  it('通用档案的默认编码器与规格一致', () => {
    expect(standard('mp4')?.video?.encoder).toBe('libx264');
    expect(standard('mp4')?.audio?.encoder).toBe('aac');
    expect(standard('avi')?.video?.encoder).toBe('mpeg4');
    expect(standard('webm')?.video?.encoder).toBe('libvpx-vp9');
    expect(standard('mp3')?.kind).toBe('audio');
  });
});
