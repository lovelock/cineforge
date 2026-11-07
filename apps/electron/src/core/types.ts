export interface VideoInfo {
  index: number;
  codec: string;
  width: number;
  height: number;
  avgFrameRate: number | null;
  fieldOrder: 'progressive' | 'tt' | 'bb' | 'tb' | 'bt' | 'unknown';
  displayAspectRatio: number | null;
  interlaced: boolean;
}

export interface AudioInfo {
  index: number;
  codec: string;
  sampleRate: number;
  channels: number;
}

export interface MediaInfo {
  path: string;
  durationSec: number | null;
  formatName: string;
  video?: VideoInfo;
  audio?: AudioInfo;
}

export type ExecText = (cmd: string, args: string[]) => Promise<string>;

export type PlanMode = 'remux' | 'partial' | 'encode';

export interface Plan {
  args: string[];
  mode: PlanMode;
  finalPath: string;
  tempPath: string;
  videoCopied: boolean;
  audioCopied: boolean;
}

export class PlanError extends Error {
  code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = 'PlanError';
    this.code = code;
  }
}
