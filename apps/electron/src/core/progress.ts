export interface ProgressUpdate {
  percent: number | null;
  timeSec: number;
  speed: string | null;
}

export function parseProgressLine(line: string): { key: string; value: string } | null {
  const match = /^([a-z_]+)=(.*)$/.exec(line.trim());
  return match ? { key: match[1], value: match[2] } : null;
}

export function progressFrom(
  key: string,
  value: string,
  durationSec: number | null,
): ProgressUpdate | null {
  if (key === 'out_time_us') {
    const microseconds = Number(value);
    if (!Number.isFinite(microseconds)) {
      return null;
    }
    const timeSec = microseconds / 1_000_000;
    const percent = durationSec !== null && durationSec > 0
      ? Math.min(100, (timeSec / durationSec) * 100)
      : null;
    return { percent, timeSec, speed: null };
  }

  if (key === 'speed') {
    return { percent: null, timeSec: 0, speed: value };
  }

  return null;
}
