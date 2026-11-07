import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, reducer, type ViewState } from './state';

const empty: ViewState = { init: null, snapshot: null, logs: {}, error: null };

describe('reducer', () => {
  it('保存初始化数据与队列快照', () => {
    const s1 = reducer(empty, { type: 'init', payload: { profiles: [], settings: { ffmpegPath: null, outputMode: 'source', fixedOutputDir: null, firstRunPromptShown: false }, toolchain: null } as any });
    expect(s1.init?.profiles).toEqual([]);
    const s2 = reducer(s1, { type: 'state', payload: { items: [], running: false, summary: { done: 0, fallback: 0, failed: 0, canceled: 0 } } as any });
    expect(s2.snapshot?.running).toBe(false);
  });

  it('按任务累积日志', () => {
    const s = reducer(empty, { type: 'log', payload: { id: '1', line: 'a' } });
    const s2 = reducer(s, { type: 'log', payload: { id: '1', line: 'b' } });
    expect(s2.logs['1']).toEqual(['a', 'b']);
  });
});

describe('format', () => {
  it('格式化字节与时长', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(null)).toBe('--:--');
  });
});
