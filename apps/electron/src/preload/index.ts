import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppInit, QueueSnapshot, Settings } from '@cineforge/shared';

interface AddOptions {
  profileId: string;
  outDir: string | null;
  dvdStandard?: 'pal' | 'ntsc';
}

const api = {
  init: (): Promise<AppInit> => ipcRenderer.invoke('app:init'),
  pickFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:pick-files'),
  pickDir: (): Promise<string | null> => ipcRenderer.invoke('dialog:pick-dir'),
  addFiles: (paths: string[], opts: AddOptions): Promise<void> =>
    ipcRenderer.invoke('queue:add', paths, opts),
  start: (): Promise<void> => ipcRenderer.invoke('queue:start'),
  cancel: (): Promise<void> => ipcRenderer.invoke('queue:cancel'),
  removeFile: (id: string): Promise<void> => ipcRenderer.invoke('queue:remove', id),
  clear: (): Promise<void> => ipcRenderer.invoke('queue:clear'),
  retry: (id: string): Promise<void> => ipcRenderer.invoke('queue:retry', id),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Settings): Promise<void> =>
    ipcRenderer.invoke('settings:set', settings),
  openPath: (path: string): Promise<void> => ipcRenderer.invoke('app:open-path', path),
  saveLog: (id: string, text: string): Promise<void> =>
    ipcRenderer.invoke('app:save-log', id, text),
  onState: (callback: (snapshot: QueueSnapshot) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: QueueSnapshot) => callback(snapshot);
    ipcRenderer.on('queue:state', listener);
    return () => {
      ipcRenderer.removeListener('queue:state', listener);
    };
  },
  onLog: (callback: (event: { id: string; line: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; line: string }) => callback(payload);
    ipcRenderer.on('queue:log', listener);
    return () => {
      ipcRenderer.removeListener('queue:log', listener);
    };
  },
  onOpenSettings: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:open-settings', listener);
    return () => {
      ipcRenderer.removeListener('app:open-settings', listener);
    };
  },
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('api', api);
