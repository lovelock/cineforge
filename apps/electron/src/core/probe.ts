import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AudioInfo, ExecText, MediaInfo, VideoInfo } from './types';

const execFileAsync = promisify(execFile);

const defaultExec: ExecText = async (cmd, args) => {
  const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
};

function parseRate(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0 || value === 'N/A') {
    return null;
  }
  const [numerator, denominator] = value.split('/').map(Number);
  if (!Number.isFinite(numerator)) {
    return null;
  }
  if (denominator === undefined) {
    return numerator;
  }
  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function parseAspectRatio(value: unknown, width: number, height: number): number | null {
  if (typeof value === 'string' && value.includes(':')) {
    const [left, right] = value.split(':').map(Number);
    if (Number.isFinite(left) && Number.isFinite(right) && right !== 0) {
      return left / right;
    }
  }
  if (width > 0 && height > 0) {
    return width / height;
  }
  return null;
}

function toVideoInfo(stream: Record<string, unknown>): VideoInfo {
  const fieldOrderRaw = typeof stream.field_order === 'string' ? stream.field_order : 'unknown';
  const fieldOrder =
    fieldOrderRaw === 'progressive' || fieldOrderRaw === 'tt' || fieldOrderRaw === 'bb' ||
    fieldOrderRaw === 'tb' || fieldOrderRaw === 'bt'
      ? fieldOrderRaw
      : 'unknown';

  const width = Number(stream.width ?? 0);
  const height = Number(stream.height ?? 0);

  return {
    index: Number(stream.index ?? 0),
    codec: String(stream.codec_name ?? ''),
    width,
    height,
    avgFrameRate: parseRate(stream.avg_frame_rate),
    fieldOrder,
    displayAspectRatio: parseAspectRatio(stream.display_aspect_ratio, width, height),
    interlaced: fieldOrder !== 'progressive' && fieldOrder !== 'unknown',
  };
}

function toAudioInfo(stream: Record<string, unknown>): AudioInfo {
  return {
    index: Number(stream.index ?? 0),
    codec: String(stream.codec_name ?? ''),
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
  };
}

export function parseProbeJson(json: string, file: string): MediaInfo {
  const data = JSON.parse(json) as {
    format?: { duration?: string; format_name?: string };
    streams?: Array<Record<string, unknown>>;
  };
  const streams = data.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const audioStream = streams.find((stream) => stream.codec_type === 'audio');

  const durationRaw = data.format?.duration;
  const durationSec =
    typeof durationRaw === 'string' && durationRaw !== 'N/A' ? Number(durationRaw) : null;

  return {
    path: file,
    durationSec: durationSec !== null && Number.isFinite(durationSec) ? durationSec : null,
    formatName: data.format?.format_name ?? '',
    video: videoStream ? toVideoInfo(videoStream) : undefined,
    audio: audioStream ? toAudioInfo(audioStream) : undefined,
  };
}

export async function probe(
  ffprobePath: string,
  file: string,
  exec: ExecText = defaultExec,
): Promise<MediaInfo> {
  const output = await exec(ffprobePath, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  return parseProbeJson(output, file);
}
