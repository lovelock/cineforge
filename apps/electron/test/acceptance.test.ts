import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runJob } from '../src/core/job';
import { probe } from '../src/core/probe';
import { buildPlan } from '../src/core/plan';
import { runFfmpeg } from '../src/core/runner';
import { verifyOutput } from '../src/core/verify';
import { safeFinalize } from '../src/core/finalize';
import { makeMtsFixture } from './make-fixture';

const deps = {
  probe, buildPlan, run: runFfmpeg, verify: verifyOutput,
  statSize: (p: string) => import('node:fs/promises').then((fs) => fs.stat(p)).then((s) => s.size).catch(() => 0),
  remove: (p: string) => import('node:fs/promises').then((fs) => fs.rm(p, { force: true })),
  rename: (a: string, b: string) => safeFinalize(a, b).then(() => undefined),
};

describe('验收', () => {
  it('中文名 MTS → DVD PAL，输出名与规格正确', async () => {
    const dir = await mkdtemp(join(tmpdir(), '验收 目录-'));
    const input = join(dir, '测试 视频（1）.MTS');
    const output = join(dir, '测试 视频（1）.mpg');
    await makeMtsFixture(input, { seconds: 2, interlaced: true, rate: 25 });
    const r = await runJob({
      id: 'e2e', sourcePath: input, profileId: 'dvd', ffmpegPath: 'ffmpeg', outputPath: output,
      tempPath: join(dir, '.part'), standard: 'pal',
    }, deps as any);
    expect(r.status).toBe('done');
    await access(output);
    const info = await probe('ffprobe', output);
    expect(info.video).toMatchObject({ codec: 'mpeg2video', width: 720, height: 576 });
    expect(info.video?.fieldOrder).toBe('tt');
    expect(info.audio?.codec).toBe('ac3');
    await rm(dir, { recursive: true, force: true });
  }, 120_000);

  it('AAC 音频 MTS → DVD PAL，音频转 AC-3 且保持 tt 场序', async () => {
    const dir = await mkdtemp(join(tmpdir(), '验收 aac-'));
    const input = join(dir, 'AAC 素材.MTS');
    const output = join(dir, 'AAC 素材.mpg');
    await makeMtsFixture(input, { seconds: 1, interlaced: true, rate: 25, audioCodec: 'aac' });
    const r = await runJob({
      id: 'aac', sourcePath: input, profileId: 'dvd', ffmpegPath: 'ffmpeg', outputPath: output,
      tempPath: join(dir, '.part'), standard: 'pal',
    }, deps as any);
    expect(r.status).toBe('done');
    const info = await probe('ffprobe', output);
    expect(info.video?.fieldOrder).toBe('tt');
    expect(info.audio?.codec).toBe('ac3');
    expect(info.audio?.sampleRate).toBe(48000);
    await rm(dir, { recursive: true, force: true });
  }, 120_000);

  it('H.264+AAC MKV → MP4 走 remux，视频编码不变', async () => {
    const dir = await mkdtemp(join(tmpdir(), '验收 remux-'));
    const input = join(dir, '片 段.mkv');
    const output = join(dir, '片 段.mp4');
    await makeMtsFixture(input, { seconds: 1, container: 'matroska' });
    const aacInput = input.replace('.mkv', '-aac.mkv');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    await promisify(execFile)('ffmpeg', ['-y', '-i', input, '-c:v', 'copy', '-c:a', 'aac', aacInput]);
    const r = await runJob({
      id: 'remux', sourcePath: aacInput, profileId: 'mp4', ffmpegPath: 'ffmpeg', outputPath: output,
      tempPath: join(dir, '.part'),
    }, deps as any);
    expect(r.status).toBe('done');
    const info = await probe('ffprobe', output);
    expect(info.video?.codec).toBe('h264');
    await rm(dir, { recursive: true, force: true });
  }, 120_000);

  it('文件名以 - 开头也能转换', async () => {
    const dir = await mkdtemp(join(tmpdir(), '验收 dash-'));
    const input = join(dir, '-片段.MTS');
    const output = join(dir, '-片段.mp4');
    await makeMtsFixture(input, { seconds: 1 });
    const r = await runJob({
      id: 'dash', sourcePath: input, profileId: 'mp4', ffmpegPath: 'ffmpeg', outputPath: output,
      tempPath: join(dir, '.part'),
    }, deps as any);
    expect(r.status).toBe('done');
    await access(output);
    await rm(dir, { recursive: true, force: true });
  }, 120_000);

  it('1080p50 → PAL 25i，保留运动且场序为 tt', async () => {
    const dir = await mkdtemp(join(tmpdir(), '验收 50p-'));
    const input = join(dir, '50p 素材.MTS');
    const output = join(dir, '50p 素材.mpg');
    await makeMtsFixture(input, { seconds: 1, rate: 50 });
    const r = await runJob({
      id: '50p', sourcePath: input, profileId: 'dvd', ffmpegPath: 'ffmpeg', outputPath: output,
      tempPath: join(dir, '.part'), standard: 'pal',
    }, deps as any);
    expect(r.status).toBe('done');
    const info = await probe('ffprobe', output);
    expect(info.video?.width).toBe(720);
    expect(info.video?.height).toBe(576);
    expect(info.video?.avgFrameRate).toBeCloseTo(25, 1);
    expect(info.video?.fieldOrder).toBe('tt');
    await rm(dir, { recursive: true, force: true });
  }, 120_000);
});
