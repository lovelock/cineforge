import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from './runner';

describe('runFfmpeg', () => {
  it('完成一个短任务并上报进度', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mc-'));
    const input = join(dir, '测试 输入.mp4');
    const temp = join(dir, '.输出.part');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    await promisify(execFile)('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', input]);
    const seen: number[] = [];
    const result = await runFfmpeg({
      ffmpegPath: 'ffmpeg', tempPath: temp, durationSec: 2,
      args: ['-y', '-i', input, '-c:v', 'libx264', '-progress', 'pipe:1', '-nostats', '-f', 'mp4', temp],
      onProgress: (p) => { if (p.percent !== null) seen.push(p.percent); },
    });
    expect(result.code).toBe(0);
    expect(seen.length).toBeGreaterThan(0);
    await rm(dir, { recursive: true, force: true });
  });

  it('取消后杀掉进程并删除临时文件', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mc-'));
    const temp = join(dir, '.慢任务.part');
    const controller = new AbortController();
    const result = await runFfmpeg({
      ffmpegPath: 'ffmpeg', tempPath: temp, durationSec: 60, signal: controller.signal,
      args: ['-y', '-re', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25', '-t', '60', '-c:v', 'libx264', '-progress', 'pipe:1', '-nostats', '-f', 'mp4', temp],
      onProgress: () => controller.abort(),
    });
    expect(result.canceled).toBe(true);
    expect(await import('node:fs/promises').then((fs) => fs.access(temp).then(() => true, () => false))).toBe(false);
    await rm(dir, { recursive: true, force: true });
  }, 20_000);
});
