import { dirname, join } from 'node:path';
import { getProfile, type JobStatus, type Profile } from '@cineforge/shared';
import type { DvdStandard } from './dvd';
import type { ProgressUpdate } from './progress';
import { buildPlan, type PlanInput } from './plan';
import { probe } from './probe';
import { runFfmpeg } from './runner';
import type { MediaInfo, Plan } from './types';
import { verifyOutput } from './verify';

export interface JobInput {
  id: string;
  sourcePath: string;
  profileId: string;
  outputPath: string;
  tempPath: string;
  ffmpegPath: string;
  ffprobePath?: string;
  standard?: DvdStandard;
  signal?: AbortSignal;
  onProgress?: (update: ProgressUpdate) => void;
  onLog?: (line: string) => void;
  onPhase?: (phase: 'probing' | 'running' | 'verifying') => void;
  onSource?: (info: MediaInfo) => void;
}

export interface JobDeps {
  probe: typeof probe;
  buildPlan: typeof buildPlan;
  run: typeof runFfmpeg;
  verify: typeof verifyOutput;
  statSize: (path: string) => Promise<number>;
  remove: (path: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
}

export interface JobResult {
  status: JobStatus;
  message?: string;
  log: string[];
  usedFallback: boolean;
}

function siblingFfprobe(ffmpegPath: string): string {
  const dir = dirname(ffmpegPath);
  return dir === '.' || dir === '' ? 'ffprobe' : join(dir, 'ffprobe');
}

export async function runJob(input: JobInput, deps: JobDeps): Promise<JobResult> {
  const log: string[] = [];
  const onLog = (line: string) => {
    log.push(line);
    input.onLog?.(line);
  };
  const ffprobe = input.ffprobePath ?? siblingFfprobe(input.ffmpegPath);

  const cleanup = async () => {
    try {
      await deps.remove(input.tempPath);
    } catch {
      // best effort: the temp file may already be gone
    }
  };

  const fail = async (message: string): Promise<JobResult> => {
    await cleanup();
    return { status: 'failed', message, log, usedFallback: false };
  };

  try {
    input.onPhase?.('probing');
    const profile: Profile | undefined = getProfile(input.profileId);
    if (!profile) {
      return await fail(`未知格式档案: ${input.profileId}`);
    }

    const source = await deps.probe(ffprobe, input.sourcePath);
    input.onSource?.(source);

    const runOnce = async (plan: Plan): Promise<{ ok: boolean; canceled: boolean; message?: string }> => {
      input.onPhase?.('running');
      const runResult = await deps.run({
        ffmpegPath: input.ffmpegPath,
        args: plan.args,
        durationSec: source.durationSec,
        tempPath: input.tempPath,
        signal: input.signal,
        onProgress: input.onProgress,
        onLog,
      });

      if (runResult.canceled) {
        return { ok: false, canceled: true };
      }
      if (runResult.code !== 0) {
        return {
          ok: false,
          canceled: false,
          message: `ffmpeg 退出码 ${runResult.code}: ${runResult.stderrTail.join('\n')}`,
        };
      }

      const size = await deps.statSize(input.tempPath).catch(() => 0);
      if (size <= 0) {
        return { ok: false, canceled: false, message: '输出文件为空或不存在' };
      }

      try {
        input.onPhase?.('verifying');
        const output = await deps.probe(ffprobe, input.tempPath);
        const verdict = deps.verify(output, {
          profile,
          source,
          plan,
          standard: input.standard,
        });
        if (!verdict.ok) {
          return { ok: false, canceled: false, message: `校验失败: ${verdict.reasons.join('; ')}` };
        }
        return { ok: true, canceled: false };
      } catch (error) {
        return {
          ok: false,
          canceled: false,
          message: `校验失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    };

    const planInput: PlanInput = {
      source,
      profile,
      outputPath: input.outputPath,
      tempPath: input.tempPath,
      standard: input.standard,
    };

    let plan = deps.buildPlan(planInput);
    let result = await runOnce(plan);

    if (result.canceled) {
      await cleanup();
      return { status: 'canceled', log, usedFallback: false };
    }

    if (!result.ok && plan.mode !== 'encode') {
      plan = deps.buildPlan({ ...planInput, forceEncode: true });
      result = await runOnce(plan);

      if (result.canceled) {
        await cleanup();
        return { status: 'canceled', log, usedFallback: true };
      }

      if (result.ok) {
        await deps.rename(input.tempPath, plan.finalPath);
        return { status: 'fallback', log, usedFallback: true };
      }

      const failed = await fail(result.message ?? '回退重编码失败');
      return { ...failed, usedFallback: true };
    }

    if (!result.ok) {
      return await fail(result.message ?? '转换失败');
    }

    await deps.rename(input.tempPath, plan.finalPath);
    return { status: 'done', log, usedFallback: false };
  } catch (error) {
    return await fail(error instanceof Error ? error.message : String(error));
  }
}
