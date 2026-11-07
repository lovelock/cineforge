import { spawn } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { parseProgressLine, progressFrom, type ProgressUpdate } from './progress';

export interface RunOptions {
  ffmpegPath: string;
  args: string[];
  durationSec: number | null;
  tempPath: string;
  signal?: AbortSignal;
  onProgress?: (update: ProgressUpdate) => void;
  onLog?: (line: string) => void;
}

export interface RunResult {
  code: number;
  canceled: boolean;
  stderrTail: string[];
}

export function runFfmpeg(options: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(options.ffmpegPath, options.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stderrTail: string[] = [];
    let canceled = false;
    let settled = false;
    let killTimer: NodeJS.Timeout | null = null;

    const abort = () => {
      if (canceled) {
        return;
      }
      canceled = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        child.kill('SIGKILL');
      }, 3000);
    };

    if (options.signal?.aborted) {
      abort();
    } else {
      options.signal?.addEventListener('abort', abort, { once: true });
    }

    const stdout = child.stdout;
    stdout?.setEncoding('utf8');
    let stdoutBuffer = '';
    stdout?.on('data', (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const parsed = parseProgressLine(line);
        if (!parsed) {
          continue;
        }
        const update = progressFrom(parsed.key, parsed.value, options.durationSec);
        if (update) {
          options.onProgress?.(update);
        }
      }
    });

    const stderr = child.stderr;
    stderr?.setEncoding('utf8');
    let stderrBuffer = '';
    stderr?.on('data', (chunk: string) => {
      stderrBuffer += chunk;
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() ?? '';
      for (const line of lines) {
        stderrTail.push(line);
        if (stderrTail.length > 200) {
          stderrTail.shift();
        }
        options.onLog?.(line);
      }
    });

    const finish = async (code: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      if (canceled || code !== 0 || code === null) {
        await unlink(options.tempPath).catch(() => undefined);
      }
      resolve({ code: code ?? -1, canceled, stderrTail });
    };

    child.on('error', (error) => {
      const line = String(error);
      stderrTail.push(line);
      options.onLog?.(line);
      void finish(-1);
    });

    child.on('close', (code) => {
      void finish(code);
    });
  });
}
