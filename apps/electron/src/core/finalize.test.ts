import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeFinalize } from './finalize';

describe('safeFinalize', () => {
  it('目标已存在时追加序号且不覆盖', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mc-fin-'));
    const from = join(dir, '.part');
    const desired = join(dir, 'x.mpg');
    await writeFile(from, 'new');
    await writeFile(desired, 'old');

    const target = await safeFinalize(from, desired);

    expect(target).toBe(join(dir, 'x (1).mpg'));
    expect(await readFile(desired, 'utf8')).toBe('old');
    expect(await readFile(target, 'utf8')).toBe('new');
    await rm(dir, { recursive: true, force: true });
  });

  it('无冲突时使用原目标名', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mc-fin-'));
    const from = join(dir, '.part');
    const desired = join(dir, 'y.mpg');
    await writeFile(from, 'new');

    const target = await safeFinalize(from, desired);

    expect(target).toBe(desired);
    expect(await readFile(desired, 'utf8')).toBe('new');
    await rm(dir, { recursive: true, force: true });
  });
});
