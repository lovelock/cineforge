import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface FixtureOpts {
  seconds: number;
  rate?: number;
  interlaced?: boolean;
  container?: 'mpegts' | 'matroska';
  withAudio?: boolean;
  audioCodec?: 'ac3' | 'aac';
}

export async function makeMtsFixture(path: string, opts: FixtureOpts): Promise<void> {
  const rate = opts.rate ?? 25;
  const container = opts.container ?? 'mpegts';
  const withAudio = opts.withAudio ?? true;

  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `testsrc2=size=1920x1080:rate=${rate}`,
  ];

  if (withAudio) {
    args.push('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000');
  }

  args.push('-t', String(opts.seconds), '-c:v', 'libx264', '-pix_fmt', 'yuv420p');

  if (opts.interlaced) {
    args.push('-flags', '+ildct+ilme', '-x264opts', 'tff=1');
  }

  if (withAudio) {
    args.push('-c:a', opts.audioCodec ?? 'ac3', '-b:a', '192k');
  }

  args.push('-f', container, path);

  await execFileAsync('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024 });
}
