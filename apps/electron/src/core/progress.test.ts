import { describe, expect, it } from 'vitest';
import { parseProgressLine, progressFrom } from './progress';

describe('progress', () => {
  it('解析 out_time_us', () => {
    expect(parseProgressLine('out_time_us=5000000')).toEqual({ key: 'out_time_us', value: '5000000' });
    expect(parseProgressLine('progress=end')).toEqual({ key: 'progress', value: 'end' });
    expect(parseProgressLine('random log line')).toBeNull();
  });

  it('换算百分比并保留 speed', () => {
    expect(progressFrom('out_time_us', '5000000', 10)).toEqual({ percent: 50, timeSec: 5, speed: null });
    expect(progressFrom('speed', '1.5x', 10)).toEqual({ percent: null, timeSec: 0, speed: '1.5x' });
    expect(progressFrom('out_time_us', '5000000', null)?.percent).toBeNull();
  });
});
