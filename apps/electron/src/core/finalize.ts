import { link, rename, unlink } from 'node:fs/promises';
import { join, parse } from 'node:path';

const LINK_FALLBACK = new Set(['EXDEV', 'EPERM', 'ENOTSUP', 'EOPNOTSUPP']);

export async function safeFinalize(from: string, desired: string): Promise<string> {
  const { dir, name, ext } = parse(desired);

  for (let n = 0; n < 10_000; n += 1) {
    const target = n === 0 ? desired : join(dir, `${name} (${n})${ext}`);
    try {
      await link(from, target);
      await unlink(from);
      return target;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') {
        continue;
      }
      if (code && LINK_FALLBACK.has(code)) {
        await rename(from, target);
        return target;
      }
      throw error;
    }
  }

  throw new Error('无法生成不冲突的输出文件名');
}
