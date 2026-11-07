import { describe, expect, it, vi } from 'vitest';
import { discover } from './ffmpeg';

const exec = vi.fn(async (_cmd: string, args: string[]) => {
  if (args.includes('-version')) return 'ffmpeg version 9.0.2 Copyright';
  return ' V....D libx264 h264\n V.S..D mpeg2video MPEG-2\n A....D ac3 AC-3\n';
});

describe('discover', () => {
  it('解析版本与编码器，并推导 ffprobe 同级路径', async () => {
    const t = await discover({ override: '/opt/bin/ffmpeg', exec });
    expect(t.version).toContain('9.0.2');
    expect(t.ffprobe).toBe('/opt/bin/ffprobe');
    expect(t.encoders.has('mpeg2video')).toBe(true);
    expect(t.encoders.has('ac3')).toBe(true);
  });

  it('缺少必需编码器时报错并列出缺失项', async () => {
    const bad = vi.fn(async (_c: string, args: string[]) =>
      args.includes('-version') ? 'ffmpeg version 9.0.2' : ' V....D libx264 h264\n');
    await expect(discover({ exec: bad })).rejects.toThrow(/mpeg2video/);
  });

  it('解析带 n 前缀的版本号', async () => {
    const nExec = vi.fn(async (_c: string, args: string[]) =>
      args.includes('-version')
        ? 'ffmpeg version n9.0.2 Copyright'
        : ' V.S..D mpeg2video mpeg2video\n A....D ac3 ac3\n');
    const t = await discover({ exec: nExec });
    expect(t.version).toBe('9.0.2');
  });

  it('拒绝低于 6 的 ffmpeg', async () => {
    const old = vi.fn(async (_c: string, args: string[]) =>
      args.includes('-version')
        ? 'ffmpeg version n5.1.2'
        : ' V.S..D mpeg2video mpeg2video\n A....D ac3 ac3\n');
    await expect(discover({ exec: old })).rejects.toThrow(/FFMPEG_TOO_OLD/);
  });
});
