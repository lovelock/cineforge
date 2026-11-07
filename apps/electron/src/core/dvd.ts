import type { DvdProfile } from '@cineforge/shared';
import type { MediaInfo, Plan, VideoInfo } from './types';
import { PlanError } from './types';

export type DvdStandard = 'pal' | 'ntsc';

export interface DvdPlanInput {
  source: MediaInfo;
  profile: DvdProfile;
  outputPath: string;
  tempPath: string;
  standard?: DvdStandard;
}

function near(value: number, target: number, tolerance = 0.1): boolean {
  return Math.abs(value - target) <= tolerance;
}

export function detectStandard(info: MediaInfo): DvdStandard {
  const rate = info.video?.avgFrameRate;
  if (rate === null || rate === undefined) {
    return 'pal';
  }
  if (near(rate, 23.976) || near(rate, 24) || near(rate, 29.97) || near(rate, 30) ||
      near(rate, 59.94) || near(rate, 60)) {
    return 'ntsc';
  }
  if (near(rate, 25) || near(rate, 50)) {
    return 'pal';
  }
  return 'pal';
}

export function topFor(fieldOrder: VideoInfo['fieldOrder']): 0 | 1 {
  if (fieldOrder === 'bb' || fieldOrder === 'tb') {
    return 0;
  }
  return 1;
}

export function buildDvdPlan(input: DvdPlanInput): Plan {
  const { source, outputPath, tempPath } = input;
  const video = source.video;

  if (!video) {
    throw new PlanError('NO_VIDEO');
  }

  const detected = detectStandard(source);
  if (video.interlaced && input.standard && input.standard !== detected) {
    throw new PlanError(
      'INTERLACED_CROSS_STANDARD',
      'INTERLACED_CROSS_STANDARD: interlaced source cannot be converted across PAL/NTSC',
    );
  }

  const standard = input.standard ?? detected;
  const ntsc = standard === 'ntsc';
  const targetRate = ntsc ? 30000 / 1001 : 25;
  const targetHeight = ntsc ? 480 : 576;
  const gop = ntsc ? 18 : 15;

  let rateFilter: string | null = null;
  let outputInterlaced = video.interlaced;
  const rate = video.avgFrameRate;

  if (rate !== null) {
    if (video.interlaced && (near(rate, 50) || near(rate, 59.94) || near(rate, 60))) {
      // Some containers report the field rate for interlaced material; nothing to convert.
    } else if (near(rate, 24000 / 1001) || near(rate, 24)) {
      if (ntsc) {
        rateFilter = 'telecine';
        outputInterlaced = true;
      } else {
        rateFilter = `fps=${targetRate}`;
        outputInterlaced = false;
      }
    } else if (!video.interlaced && near(rate, 50)) {
      if (!ntsc) {
        rateFilter = 'tinterlace=interleave_top';
        outputInterlaced = true;
      } else {
        rateFilter = `fps=${targetRate}`;
        outputInterlaced = false;
      }
    } else if (!video.interlaced && (near(rate, 59.94) || near(rate, 60))) {
      if (ntsc) {
        rateFilter = 'tinterlace=interleave_top';
        outputInterlaced = true;
      } else {
        rateFilter = `fps=${targetRate}`;
        outputInterlaced = false;
      }
    } else if (!video.interlaced && ntsc && near(rate, 30)) {
      rateFilter = 'fps=30000/1001';
      outputInterlaced = false;
    } else if (!near(rate, targetRate)) {
      rateFilter = `fps=${targetRate}`;
      outputInterlaced = false;
    }
  }

  const aspect = (video.displayAspectRatio ?? (video.width / video.height)) >= 1.5 ? '16:9' : '4:3';
  const sar = aspect === '16:9'
    ? (ntsc ? '32/27' : '64/45')
    : (ntsc ? '8/9' : '16/15');

  const scale = `scale=720:${targetHeight}${outputInterlaced ? ':interl=1' : ''}`;
  const fieldFilter = outputInterlaced ? `setfield=${topFor(video.fieldOrder) === 1 ? 'tff' : 'bff'}` : null;
  const filterChain = [rateFilter, scale, `setsar=${sar}`, fieldFilter].filter(Boolean).join(',');

  const args: string[] = [
    '-hide_banner', '-nostdin', '-y', '-i', source.path,
    '-map', '0:v:0?', '-map', '0:a:0?',
    '-vf', filterChain,
    '-c:v', 'mpeg2video',
    '-pix_fmt', 'yuv420p',
    '-b:v', '6000k',
    '-maxrate', '9000k',
    '-bufsize', '1835008',
    '-g', String(gop),
    '-bf', '2',
    '-dc', '10',
    '-aspect', aspect,
  ];

  if (outputInterlaced) {
    args.push('-flags', '+ildct+ilme');
  }

  let audioCopied = false;
  if (source.audio) {
    if (source.audio.codec === 'ac3' && source.audio.sampleRate === 48000 && source.audio.channels <= 6) {
      audioCopied = true;
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', 'ac3', '-ar', '48000');
      if (source.audio.channels > 2) {
        args.push('-ac', '6', '-b:a', '448k');
      } else {
        args.push('-ac', '2', '-b:a', '384k');
      }
    }
  }

  args.push(
    '-map_metadata', '-1',
    '-sn', '-dn',
    '-progress', 'pipe:1', '-nostats',
    '-f', 'mpeg', tempPath,
  );

  return {
    args,
    mode: 'encode',
    finalPath: outputPath,
    tempPath,
    videoCopied: false,
    audioCopied,
  };
}
