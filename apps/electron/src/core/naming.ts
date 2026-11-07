import { join, parse } from 'node:path';

export function outputPathFor(
  sourcePath: string,
  outDir: string,
  extension: string,
  exists: (path: string) => boolean,
): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const base = parse(sourcePath).name;

  let candidate = join(outDir, `${base}${ext}`);
  let n = 0;
  while (exists(candidate)) {
    n += 1;
    candidate = join(outDir, `${base} (${n})${ext}`);
  }
  return candidate;
}
