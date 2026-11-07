import type { Profile, StandardProfile } from '@cineforge/shared';
import type { MediaInfo, Plan, PlanMode } from './types';
import { PlanError } from './types';
import { buildDvdPlan, type DvdStandard } from './dvd';

export interface PlanInput {
  source: MediaInfo;
  profile: Profile;
  outputPath: string;
  tempPath: string;
  forceEncode?: boolean;
  standard?: DvdStandard;
}

export function classifyMode(videoCopied: boolean, audioCopied: boolean): PlanMode {
  if (videoCopied && audioCopied) {
    return 'remux';
  }
  if (!videoCopied && audioCopied) {
    return 'remux';
  }
  if (videoCopied || audioCopied) {
    return 'partial';
  }
  return 'encode';
}

function codecArgs(
  copied: boolean,
  target: { encoder: string; args: string[] } | undefined,
  kind: 'video' | 'audio',
): string[] {
  if (copied) {
    return [`-c:${kind[0]}`, 'copy'];
  }
  if (!target) {
    throw new PlanError(kind === 'video' ? 'NO_VIDEO_TARGET' : 'NO_AUDIO_TARGET');
  }
  return [`-c:${kind[0]}`, target.encoder, ...target.args];
}

export function buildPlan(input: PlanInput): Plan {
  const { source, profile, outputPath, tempPath, forceEncode = false } = input;

  if (profile.type === 'dvd') {
    return buildDvdPlan({
      source,
      profile,
      outputPath,
      tempPath,
      standard: input.standard,
    });
  }

  const standard = profile as StandardProfile;
  const args = ['-hide_banner', '-nostdin', '-y', '-i', source.path];

  let videoCopied = false;
  let audioCopied = false;

  if (standard.kind === 'audio') {
    if (!source.audio) {
      throw new PlanError('NO_AUDIO');
    }
    audioCopied = !forceEncode && !!standard.audio?.accept.includes(source.audio.codec);
    args.push('-map', '0:a:0', '-vn');
    args.push(...codecArgs(audioCopied, standard.audio, 'audio'));
  } else {
    if (!source.video) {
      throw new PlanError('NO_VIDEO');
    }
    if (!standard.video) {
      throw new PlanError('NO_VIDEO_TARGET');
    }
    videoCopied = !forceEncode && standard.video.accept.includes(source.video.codec);
    audioCopied = source.audio
      ? !forceEncode && !!standard.audio?.accept.includes(source.audio.codec)
      : true;

    args.push('-map', '0:v:0?', '-map', '0:a:0?');
    args.push(...codecArgs(videoCopied, standard.video, 'video'));
    if (!videoCopied) {
      args.push('-pix_fmt', 'yuv420p');
    }
    if (source.audio) {
      args.push(...codecArgs(audioCopied, standard.audio, 'audio'));
    }
  }

  args.push('-map_metadata', '-1', '-sn', '-dn');
  if (standard.faststart) {
    args.push('-movflags', '+faststart');
  }
  args.push('-progress', 'pipe:1', '-nostats', '-f', standard.container, tempPath);

  return {
    args,
    mode: classifyMode(videoCopied, audioCopied),
    finalPath: outputPath,
    tempPath,
    videoCopied,
    audioCopied,
  };
}
