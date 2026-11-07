import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  getProfile,
  type QueueItemView,
  type QueueSnapshot,
} from '@cineforge/shared';
import { detectStandard, type DvdStandard } from './dvd';
import type { JobInput, JobResult } from './job';
import { outputPathFor } from './naming';
import type { MediaInfo } from './types';

export type JobExecutor = (input: JobInput, signal: AbortSignal) => Promise<JobResult>;

export interface QueueOptions {
  runJob: JobExecutor;
  ffmpegPath: string;
  ffprobePath?: string;
  probeSource?: (ffprobePath: string, path: string) => Promise<MediaInfo>;
}

interface QueueItemInternal extends QueueItemView {
  tempPath: string;
  standard?: DvdStandard;
}

export class ConversionQueue extends EventEmitter {
  private readonly items: QueueItemInternal[] = [];
  private readonly reserved = new Set<string>();
  private readonly runJob: JobExecutor;
  private readonly ffmpegPath: string;
  private readonly ffprobePath?: string;
  private readonly probeSource?: (ffprobePath: string, path: string) => Promise<MediaInfo>;
  private running = false;
  private canceled = false;
  private controller: AbortController | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(options: QueueOptions) {
    super();
    this.runJob = options.runJob;
    this.ffmpegPath = options.ffmpegPath;
    this.ffprobePath = options.ffprobePath;
    this.probeSource = options.probeSource;
  }

  add(
    paths: string[],
    profileId: string,
    outDir: string | null,
    opts: { dvdStandard?: DvdStandard } = {},
  ): void {
    const profile = getProfile(profileId);
    if (!profile) {
      throw new Error(`未知格式档案: ${profileId}`);
    }

    for (const sourcePath of paths) {
      const id = randomUUID();
      const targetDir = outDir ?? dirname(sourcePath);
      const outputPath = outputPathFor(
        sourcePath,
        targetDir,
        profile.extension,
        (candidate) => existsSync(candidate) || this.reserved.has(candidate),
      );
      this.reserved.add(outputPath);

      let sizeBytes = 0;
      try {
        sizeBytes = statSync(sourcePath).size;
      } catch {
        sizeBytes = 0;
      }

      const item: QueueItemInternal = {
        id,
        sourcePath,
        fileName: basename(sourcePath),
        outputPath,
        profileId,
        status: 'pending',
        progress: null,
        speed: null,
        sizeBytes,
        durationSec: null,
        detectedStandard: null,
        interlaced: null,
        avgFrameRate: null,
        tempPath: join(targetDir, `.${basename(sourcePath)}.${id}.part`),
        standard: opts.dvdStandard,
      };
      this.items.push(item);
      void this.preflight(item);
    }

    this.emitState();
  }

  remove(id: string): void {
    if (this.running) {
      throw new Error('BUSY: 转换进行中，无法修改队列');
    }
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return;
    }
    this.reserved.delete(this.items[index].outputPath);
    this.items.splice(index, 1);
    this.emitState();
  }

  clear(): void {
    if (this.running) {
      throw new Error('BUSY: 转换进行中，无法清空队列');
    }
    this.items.length = 0;
    this.reserved.clear();
    this.emitState();
  }

  retry(id: string): void {
    if (this.running) {
      throw new Error('BUSY: 转换进行中，无法重试');
    }
    const item = this.items.find((entry) => entry.id === id);
    if (!item || (item.status !== 'failed' && item.status !== 'canceled')) {
      return;
    }
    item.status = 'pending';
    item.progress = null;
    item.speed = null;
    item.message = undefined;
    this.emitState();
  }

  snapshot(): QueueSnapshot {
    return {
      items: this.items.map(({ tempPath: _tempPath, standard: _standard, ...view }) => ({ ...view })),
      running: this.running,
      summary: this.summary(),
    };
  }

  start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = this.runLoop().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async waitForIdle(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
    }
  }

  cancel(): void {
    this.canceled = true;
    this.controller?.abort();
    for (const item of this.items) {
      if (item.status === 'pending') {
        item.status = 'canceled';
      }
    }
    this.emitState();
  }

  private async preflight(item: QueueItemInternal): Promise<void> {
    if (!this.probeSource || !this.ffprobePath) {
      return;
    }
    try {
      const info = await this.probeSource(this.ffprobePath, item.sourcePath);
      item.durationSec = info.durationSec;
      item.detectedStandard = info.video ? detectStandard(info) : null;
      item.interlaced = info.video?.interlaced ?? null;
      item.avgFrameRate = info.video?.avgFrameRate ?? null;
      this.emitState();
    } catch {
      // Preflight is best-effort; the job will probe again and report a real error.
    }
  }

  private async runLoop(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.canceled = false;
    this.emitState();

    try {
      for (const item of this.items) {
        if (item.status !== 'pending') {
          continue;
        }
        if (this.canceled) {
          item.status = 'canceled';
          this.emitState();
          continue;
        }

        this.controller = new AbortController();
        item.status = 'probing';
        item.progress = 0;
        this.emitState();

        const input: JobInput = {
          id: item.id,
          sourcePath: item.sourcePath,
          profileId: item.profileId,
          outputPath: item.outputPath,
          tempPath: item.tempPath,
          ffmpegPath: this.ffmpegPath,
          standard: item.standard,
          signal: this.controller.signal,
          onPhase: (phase) => {
            item.status = phase;
            this.emitState();
          },
          onProgress: (update) => {
            if (update.percent !== null) {
              item.progress = update.percent;
            }
            if (update.speed !== null) {
              item.speed = update.speed;
            }
            this.emit('progress', { id: item.id, percent: item.progress, speed: item.speed });
            this.emitState();
          },
          onLog: (line) => {
            this.emit('log', { id: item.id, line });
          },
          onSource: (info) => {
            item.durationSec = info.durationSec;
            item.detectedStandard = info.video ? detectStandard(info) : null;
            item.interlaced = info.video?.interlaced ?? null;
            item.avgFrameRate = info.video?.avgFrameRate ?? null;
            this.emitState();
          },
        };

        let result: JobResult;
        try {
          result = await this.runJob(input, this.controller.signal);
        } catch (error) {
          result = {
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
            log: [],
            usedFallback: false,
          };
        }

        item.status = result.status;
        item.message = result.message;
        if (result.status === 'done' || result.status === 'fallback') {
          item.progress = 100;
        }
        if (result.status === 'canceled') {
          this.canceled = true;
        }
        if (this.canceled) {
          for (const other of this.items) {
            if (other.status === 'pending') {
              other.status = 'canceled';
            }
          }
        }
        this.emitState();
      }
    } finally {
      this.running = false;
      this.controller = null;
      this.emitState();
    }
  }

  private summary(): QueueSnapshot['summary'] {
    const summary = { done: 0, fallback: 0, failed: 0, canceled: 0 };
    for (const item of this.items) {
      if (item.status === 'done' || item.status === 'fallback' ||
          item.status === 'failed' || item.status === 'canceled') {
        summary[item.status] += 1;
      }
    }
    return summary;
  }

  private emitState(): void {
    this.emit('state', this.snapshot());
  }
}
