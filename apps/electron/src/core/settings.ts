import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Settings } from '@cineforge/shared';

export const DEFAULT_SETTINGS: Settings = {
  ffmpegPath: null,
  outputMode: 'source',
  fixedOutputDir: null,
  firstRunPromptShown: false,
};

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function loadSettings(file: string): Settings {
  try {
    const raw = readFileSync(file, 'utf8');
    const data = JSON.parse(raw) as Partial<Settings>;
    return {
      ffmpegPath: nonEmpty(data.ffmpegPath),
      outputMode: data.outputMode === 'fixed' ? 'fixed' : 'source',
      fixedOutputDir: nonEmpty(data.fixedOutputDir),
      firstRunPromptShown: data.firstRunPromptShown === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(file: string, settings: Settings): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(settings, null, 2), 'utf8');
  renameSync(temporary, file);
}
