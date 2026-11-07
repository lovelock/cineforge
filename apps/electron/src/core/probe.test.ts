import { describe, expect, it } from 'vitest';
import { parseProbeJson } from './probe';

const mts = JSON.stringify({
  format: { duration: '12.345', format_name: 'mpegts' },
  streams: [
    { index: 0, codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080,
      avg_frame_rate: '25/1', field_order: 'tt', display_aspect_ratio: '16:9' },
    { index: 1, codec_type: 'audio', codec_name: 'ac3', sample_rate: '48000', channels: 6 },
  ],
});

describe('parseProbeJson', () => {
  it('解析 1080i50 MTS', () => {
    const info = parseProbeJson(mts, '/in/测试.MTS');
    expect(info.durationSec).toBeCloseTo(12.345);
    expect(info.video).toMatchObject({
      codec: 'h264', width: 1920, height: 1080, avgFrameRate: 25,
      fieldOrder: 'tt', interlaced: true,
    });
    expect(info.audio).toEqual({ index: 1, codec: 'ac3', sampleRate: 48000, channels: 6 });
  });

  it('解析 23.976 逐行与小数帧率', () => {
    const json = JSON.stringify({
      format: { duration: '5', format_name: 'mov' },
      streams: [{ index: 0, codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080,
        avg_frame_rate: '24000/1001', field_order: 'progressive', display_aspect_ratio: '16:9' }],
    });
    const info = parseProbeJson(json, '/in/film.mp4');
    expect(info.video?.avgFrameRate).toBeCloseTo(23.976, 3);
    expect(info.video?.interlaced).toBe(false);
  });

  it('纯音频没有 video', () => {
    const json = JSON.stringify({
      format: { duration: '60', format_name: 'mp3' },
      streams: [{ index: 0, codec_type: 'audio', codec_name: 'mp3', sample_rate: '44100', channels: 2 }],
    });
    expect(parseProbeJson(json, '/in/a.mp3').video).toBeUndefined();
  });
});
