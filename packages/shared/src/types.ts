export type ProfileGroup = 'disc' | 'video' | 'audio';

export interface Target {
  encoder: string;
  args: string[];
  accept: string[];
}

export interface StandardProfile {
  id: string;
  type: 'standard';
  label: string;
  group: ProfileGroup;
  container: string;
  extension: string;
  kind: 'video' | 'audio';
  faststart?: boolean;
  video?: Target;
  audio?: Target;
}

export interface DvdProfile {
  id: 'dvd';
  type: 'dvd';
  label: string;
  group: 'disc';
  container: 'mpeg';
  extension: '.mpg';
  kind: 'video';
}

export type Profile = StandardProfile | DvdProfile;

export interface Settings {
  ffmpegPath: string | null;
  outputMode: 'source' | 'fixed';
  fixedOutputDir: string | null;
  firstRunPromptShown: boolean;
}

export type JobStatus = 'done' | 'fallback' | 'failed' | 'canceled';

export type QueueStatus = JobStatus | 'pending' | 'probing' | 'running' | 'verifying';

export interface QueueItemView {
  id: string;
  sourcePath: string;
  fileName: string;
  outputPath: string;
  profileId: string;
  status: QueueStatus;
  progress: number | null;
  speed: string | null;
  sizeBytes: number;
  durationSec: number | null;
  detectedStandard: 'pal' | 'ntsc' | null;
  interlaced: boolean | null;
  avgFrameRate: number | null;
  message?: string;
}

export interface QueueSnapshot {
  items: QueueItemView[];
  running: boolean;
  summary: {
    done: number;
    fallback: number;
    failed: number;
    canceled: number;
  };
}

export interface AppInit {
  profiles: Profile[];
  settings: Settings;
  toolchain: { version: string; missing: string[] } | null;
}
