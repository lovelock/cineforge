import { describe, expect, it, vi } from 'vitest';
import { ConversionQueue } from './queue';

const result = (status: any) => ({ status, log: [], usedFallback: status === 'fallback' });
const opts = (runJob: any) => ({ runJob, ffmpegPath: 'ffmpeg' });

describe('ConversionQueue', () => {
  it('串行执行并把失败隔离到单个文件', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce(result('done'))
      .mockResolvedValueOnce(result('failed'))
      .mockResolvedValueOnce(result('done'));
    const q = new ConversionQueue(opts(run));
    q.add(['/in/a.mkv', '/in/中文 2.mkv', '/in/c.mkv'], 'mp4', '/out');
    await q.start();
    const s = q.snapshot();
    expect(run).toHaveBeenCalledTimes(3);
    expect(s.items.map((i) => i.status)).toEqual(['done', 'failed', 'done']);
    expect(s.summary.done).toBe(2);
    expect(s.summary.failed).toBe(1);
  });

  it('取消会停止后续任务', async () => {
    let q: ConversionQueue;
    const run = vi.fn(async (input: any) => {
      if (input.sourcePath.endsWith('b.mkv')) { q.cancel(); return result('canceled'); }
      return result('done');
    });
    q = new ConversionQueue(opts(run));
    q.add(['/in/a.mkv', '/in/b.mkv', '/in/c.mkv'], 'mp4', '/out');
    await q.start();
    expect(q.snapshot().items.map((i) => i.status)).toEqual(['done', 'canceled', 'canceled']);
  });

  it('输出名由源文件名与档案扩展名决定', () => {
    const q = new ConversionQueue(opts(vi.fn()));
    q.add(['/in/测试 视频（1）.MTS'], 'dvd', '/导出');
    expect(q.snapshot().items[0].fileName).toBe('测试 视频（1）.MTS');
    expect((q as any).items[0].outputPath).toBe('/导出/测试 视频（1）.mpg');
  });

  it('同一批次内同名文件不会互相覆盖', () => {
    const q = new ConversionQueue(opts(vi.fn()));
    q.add(['/a/同名.mkv', '/b/同名.mkv'], 'mp4', '/out');
    expect(q.snapshot().items.map((i) => (i as any).outputPath)).toEqual(['/out/同名.mp4', '/out/同名 (1).mp4']);
  });

  it('outDir 为 null 时输出到源文件所在目录', () => {
    const q = new ConversionQueue(opts(vi.fn()));
    q.add(['/in/中文 素材.MTS'], 'dvd', null as any);
    expect((q as any).items[0].outputPath).toBe('/in/中文 素材.mpg');
  });

  it('探测后把源时长回填到队列项', async () => {
    const run = vi.fn(async (input: any) => {
      input.onSource?.({ durationSec: 12, path: input.sourcePath, formatName: 'matroska' });
      return result('done');
    });
    const q = new ConversionQueue(opts(run));
    q.add(['/in/a.mkv'], 'mp4', '/out');
    await q.start();
    expect(q.snapshot().items[0].durationSec).toBe(12);
  });

  it('remove 移除单项，clear 清空队列', () => {
    const q = new ConversionQueue(opts(vi.fn()));
    q.add(['/a/x.mkv', '/b/y.mkv'], 'mp4', '/out');
    const first = q.snapshot().items[0].id;
    q.remove(first);
    expect(q.snapshot().items.map((item) => item.fileName)).toEqual(['y.mkv']);
    q.clear();
    expect(q.snapshot().items).toEqual([]);
  });

  it('retry 把失败项重置为待转换并可再次执行', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce(result('failed'))
      .mockResolvedValueOnce(result('done'));
    const q = new ConversionQueue(opts(run));
    q.add(['/in/a.mkv'], 'mp4', '/out');
    await q.start();
    const id = q.snapshot().items[0].id;
    expect(q.snapshot().items[0].status).toBe('failed');
    q.retry(id);
    expect(q.snapshot().items[0].status).toBe('pending');
    await q.start();
    expect(q.snapshot().items[0].status).toBe('done');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('waitForIdle 等待当前批次结束', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const run = vi.fn(async () => {
      await gate;
      return result('done');
    });
    const q = new ConversionQueue(opts(run));
    q.add(['/in/a.mkv'], 'mp4', '/out');
    const started = q.start();
    let idle = false;
    const idlePromise = q.waitForIdle().then(() => { idle = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(idle).toBe(false);
    release();
    await started;
    await idlePromise;
    expect(idle).toBe(true);
  });

  it('add 后预检回填时长与 DVD 制式', async () => {
    const q = new ConversionQueue({
      runJob: vi.fn(),
      ffmpegPath: 'ffmpeg',
      ffprobePath: 'ffprobe',
      probeSource: vi.fn(async () => ({
        path: '/in/a.MTS',
        durationSec: 12,
        formatName: 'mpegts',
        video: {
          index: 0,
          codec: 'h264',
          width: 1920,
          height: 1080,
          avgFrameRate: 25,
          fieldOrder: 'tt' as const,
          displayAspectRatio: 16 / 9,
          interlaced: true,
        },
      })),
    } as any);
    q.add(['/in/a.MTS'], 'dvd', '/out');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const item = q.snapshot().items[0];
    expect(item.durationSec).toBe(12);
    expect(item.detectedStandard).toBe('pal');
    expect(item.interlaced).toBe(true);
  });

  it('运行中禁止 remove/clear/retry', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const run = vi.fn(async () => {
      await gate;
      return result('done');
    });
    const q = new ConversionQueue(opts(run));
    q.add(['/in/a.mkv'], 'mp4', '/out');
    const started = q.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const id = q.snapshot().items[0].id;
    expect(() => q.remove(id)).toThrow(/BUSY/);
    expect(() => q.clear()).toThrow(/BUSY/);
    expect(() => q.retry(id)).toThrow(/BUSY/);
    release();
    await started;
  });
});
