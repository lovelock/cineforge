import type { Profile, StandardProfile } from '@cineforge/shared';
import type { MediaInfo, Plan } from './types';
import { detectStandard, type DvdStandard } from './dvd';

export interface VerifyExpectation {
  profile: Profile;
  source: MediaInfo;
  plan: Plan;
  standard?: DvdStandard;
}

const encoderCodec: Record<string, string> = {
  libx264: 'h264',
  aac: 'aac',
  libmp3lame: 'mp3',
  'libvpx-vp9': 'vp9',
  libopus: 'opus',
  mpeg4: 'mpeg4',
  mpeg2video: 'mpeg2video',
  flac: 'flac',
  pcm_s16le: 'pcm_s16le',
};

function expectedCodec(encoder: string): string {
  return encoderCodec[encoder] ?? encoder;
}

export function verifyOutput(
  info: MediaInfo,
  expected: VerifyExpectation,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const { profile, source, plan } = expected;

  if (source.durationSec !== null && info.durationSec !== null) {
    const tolerance = Math.max(2, source.durationSec * 0.01);
    const diff = Math.abs(info.durationSec - source.durationSec);
    if (diff > tolerance) {
      reasons.push(`时长偏差 ${diff.toFixed(2)}s 超过容许值 ${tolerance.toFixed(2)}s`);
    }
  }

  if (profile.type === 'dvd') {
    const standard = expected.standard ?? detectStandard(source);
    const expectedHeight = standard === 'pal' ? 576 : 480;
    const expectedRate = standard === 'pal' ? 25 : 30000 / 1001;

    if (!info.video) {
      reasons.push('缺少视频流');
    } else {
      if (info.video.codec !== 'mpeg2video') {
        reasons.push(`视频编码应为 mpeg2video，实际 ${info.video.codec}`);
      }
      if (info.video.width !== 720 || info.video.height !== expectedHeight) {
        reasons.push(`分辨率应为 720x${expectedHeight}，实际 ${info.video.width}x${info.video.height}`);
      }
      if (info.video.avgFrameRate === null ||
          Math.abs(info.video.avgFrameRate - expectedRate) > 0.1) {
        reasons.push(`帧率应为 ${expectedRate.toFixed(3)}，实际 ${info.video.avgFrameRate ?? '未知'}`);
      }
    }

    if (source.audio) {
      if (!info.audio) {
        reasons.push('缺少音频流');
      } else if (info.audio.codec !== 'ac3' || info.audio.sampleRate !== 48000) {
        reasons.push(`音频应为 ac3 48kHz，实际 ${info.audio.codec} ${info.audio.sampleRate}Hz`);
      }
    }

    return { ok: reasons.length === 0, reasons };
  }

  const standard = profile as StandardProfile;

  if (standard.kind === 'audio') {
    if (!info.audio) {
      reasons.push('缺少音频流');
    }
    if (info.video) {
      reasons.push('音频档案不应包含视频流');
    }
  } else if (!info.video) {
    reasons.push('缺少视频流');
  }

  if (info.video && standard.video) {
    const want = plan.videoCopied
      ? source.video?.codec
      : expectedCodec(standard.video.encoder);
    if (want && info.video.codec !== want) {
      reasons.push(`视频编码应为 ${want}，实际 ${info.video.codec}`);
    }
  }

  if (source.audio) {
    if (!info.audio) {
      reasons.push('缺少音频流');
    } else if (standard.audio) {
      const want = plan.audioCopied
        ? source.audio.codec
        : expectedCodec(standard.audio.encoder);
      if (info.audio.codec !== want) {
        reasons.push(`音频编码应为 ${want}，实际 ${info.audio.codec}`);
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}
