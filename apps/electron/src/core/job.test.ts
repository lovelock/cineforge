import { describe, expect, it, vi } from 'vitest';
import { runJob } from './job';
import type { MediaInfo } from './types';

const source: MediaInfo = { path: '/in/a.mkv', durationSec: 10, formatName: 'matroska',
  video: { index: 0, codec: 'h264', width: 1920, height: 1080, avgFrameRate: 25,
    fieldOrder: 'progressive', displayAspectRatio: 16 / 9, interlaced: false },
  audio: { index: 1, codec: 'aac', sampleRate: 48000, channels: 2 } };

const deps = () => ({
  probe: vi.fn()
    .mockResolvedValueOnce(source)
    .mockResolvedValue({ ...source, path: '/out/x.mp4' }),
  buildPlan: vi.fn((x: any) => ({ args: ['-i', 'x'], mode: x.forceEncode ? 'encode' : 'remux',
    finalPath: '/out/x.mp4', tempPath: '/out/.tmp', videoCopied: !x.forceEncode, audioCopied: !x.forceEncode })),
  run: vi.fn(async () => ({ code: 0, canceled: false, stderrTail: [] as string[] })),
  verify: vi.fn().mockReturnValueOnce({ ok: false, reasons: ['bad'] }).mockReturnValue({ ok: true, reasons: [] }),
  statSize: vi.fn(async () => 100),
  remove: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
});

const input = { id: '1', sourcePath: '/in/a.mkv', profileId: 'mp4', ffmpegPath: 'ffmpeg',
  outputPath: '/out/x.mp4', tempPath: '/out/.tmp' };

describe('runJob', () => {
  it('remux 校验失败后回退全重编码', async () => {
    const d = deps();
    const r = await runJob(input, d as any);
    console.log('DEBUG', r);
    expect(r.status).toBe('fallback');
    expect(r.usedFallback).toBe(true);
    expect(d.buildPlan).toHaveBeenLastCalledWith(expect.objectContaining({ forceEncode: true }));
    expect(d.rename).toHaveBeenCalledTimes(1);
  });

  it('全重编码失败时不重试', async () => {
    const d = deps();
    d.buildPlan.mockImplementation(() => ({ args: [], mode: 'encode' as const,
      finalPath: '/out/x.mp4', tempPath: '/out/.tmp', videoCopied: false, audioCopied: false }));
    d.verify.mockReturnValue({ ok: false, reasons: ['bad'] });
    d.run.mockResolvedValue({ code: 1, canceled: false, stderrTail: ['boom'] });
    const r = await runJob(input, d as any);
    expect(r.status).toBe('failed');
    expect(d.buildPlan).toHaveBeenCalledTimes(1);
    expect(d.remove).toHaveBeenCalledWith('/out/.tmp');
  });

  it('取消时不重命名并清理临时文件', async () => {
    const d = deps();
    d.run.mockResolvedValue({ code: 1, canceled: true, stderrTail: [] });
    const r = await runJob(input, d as any);
    expect(r.status).toBe('canceled');
    expect(d.rename).not.toHaveBeenCalled();
    expect(d.remove).toHaveBeenCalledWith('/out/.tmp');
  });

  it('部分重编码校验失败也回退全重编码', async () => {
    const d = deps();
    d.buildPlan.mockImplementation((x: any) => ({
      args: [], mode: x.forceEncode ? 'encode' : 'partial',
      finalPath: '/out/x.mp4', tempPath: '/out/.tmp',
      videoCopied: !x.forceEncode, audioCopied: false,
    }));
    const r = await runJob(input, d as any);
    expect(r.status).toBe('fallback');
    expect(d.buildPlan).toHaveBeenLastCalledWith(expect.objectContaining({ forceEncode: true }));
  });

  it('输出文件为零字节时回退全重编码', async () => {
    const d = deps();
    d.statSize.mockResolvedValueOnce(0);
    d.verify.mockReset();
    d.verify.mockReturnValue({ ok: true, reasons: [] });
    const r = await runJob(input, d as any);
    expect(r.status).toBe('fallback');
    expect(d.rename).toHaveBeenCalledTimes(1);
  });

  it('产物无法 probe 时回退全重编码', async () => {
    const d = deps();
    d.probe.mockReset();
    d.probe
      .mockResolvedValueOnce(source)
      .mockRejectedValueOnce(new Error('probe failed'))
      .mockResolvedValue({ ...source, path: '/out/x.mp4' });
    d.verify.mockReset();
    d.verify.mockReturnValue({ ok: true, reasons: [] });
    const r = await runJob(input, d as any);
    expect(r.status).toBe('fallback');
    expect(d.rename).toHaveBeenCalledTimes(1);
  });
});
