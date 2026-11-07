import type { AppInit, QueueSnapshot, Settings } from '@cineforge/shared';

export interface AddOptions {
  profileId: string;
  outDir: string | null;
  dvdStandard?: 'pal' | 'ntsc';
}

export interface Api {
  init(): Promise<AppInit>;
  pickFiles(): Promise<string[]>;
  pickDir(): Promise<string | null>;
  addFiles(paths: string[], opts: AddOptions): Promise<void>;
  start(): Promise<void>;
  cancel(): Promise<void>;
  removeFile(id: string): Promise<void>;
  clear(): Promise<void>;
  retry(id: string): Promise<void>;
  getSettings(): Promise<Settings>;
  setSettings(settings: Settings): Promise<void>;
  openPath(path: string): Promise<void>;
  saveLog(id: string, text: string): Promise<void>;
  onState(callback: (snapshot: QueueSnapshot) => void): () => void;
  onLog(callback: (event: { id: string; line: string }) => void): () => void;
  onOpenSettings(callback: () => void): () => void;
  pathForFile(file: File): string;
}

declare global {
  interface Window {
    api: Api;
  }
}

export {};
