import { describe, expect, it } from 'vitest';
import { outputPathFor } from './naming';

describe('outputPathFor', () => {
  it('保留中文、空格与全角括号', () => {
    const out = outputPathFor('/in/测试 视频（1）.MTS', '/out', '.mpg', () => false);
    expect(out).toBe('/out/测试 视频（1）.mpg');
  });

  it('冲突时追加序号且不覆盖', () => {
    const taken = new Set(['/out/a.mp4', '/out/a (1).mp4']);
    const out = outputPathFor('/in/a.mkv', '/out', '.mp4', (p) => taken.has(p));
    expect(out).toBe('/out/a (2).mp4');
  });

  it('输入以 - 开头也按普通文件名处理', () => {
    const out = outputPathFor('/tmp/-素材.MTS', '/out', 'mpg', () => false);
    expect(out).toBe('/out/-素材.mpg');
  });

  it('无扩展名的文件也能正确命名', () => {
    const out = outputPathFor('/in/片段', '/out', '.mkv', () => false);
    expect(out).toBe('/out/片段.mkv');
  });
});
