import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { ExecText } from './types';

const execFileAsync = promisify(execFile);

const defaultExec: ExecText = async (cmd, args) => {
  const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
};

export interface Toolchain {
  ffmpeg: string;
  ffprobe: string;
  version: string;
  encoders: Set<string>;
}

export class ToolchainError extends Error {
  missing: string[];

  constructor(message: string, missing: string[] = []) {
    super(message);
    this.name = 'ToolchainError';
    this.missing = missing;
  }
}

export async function discover(
  opts: { override?: string | null; exec?: ExecText } = {},
): Promise<Toolchain> {
  const exec = opts.exec ?? defaultExec;
  const ffmpeg = opts.override?.trim() || 'ffmpeg';

  const versionOutput = await exec(ffmpeg, ['-version']);
  const versionMatch = /ffmpeg version\s+(?:n|v)?([0-9][^\s]*)/i.exec(versionOutput);
  const version = versionMatch?.[1] ?? 'unknown';

  const encodersOutput = await exec(ffmpeg, ['-hide_banner', '-encoders']);
  const encoders = new Set<string>();
  for (const line of encodersOutput.split('\n')) {
    const match = /\s([a-z0-9_]+)\s/.exec(line);
    if (match) {
      encoders.add(match[1]);
    }
  }

  const missing = ['mpeg2video', 'ac3'].filter((name) => !encoders.has(name));
  const major = Number(version.split('.')[0]);
  if (Number.isFinite(major) && major < 6) {
    throw new ToolchainError(`FFMPEG_TOO_OLD: ${version}`, missing);
  }
  if (missing.length > 0) {
    throw new ToolchainError(`缺少必需编码器: ${missing.join(', ')}`, missing);
  }

  const dir = dirname(ffmpeg);
  const ffprobe = dir === '.' || dir === '' ? 'ffprobe' : join(dir, 'ffprobe');

  return { ffmpeg, ffprobe, version, encoders };
}
