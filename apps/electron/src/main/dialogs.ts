import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron';

export async function pickFiles(win: BrowserWindow | null): Promise<string[]> {
  const options: OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    title: '选择要转换的文件',
  };
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  return result.canceled ? [] : result.filePaths;
}

export async function pickDir(win: BrowserWindow | null): Promise<string | null> {
  const options: OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择输出目录',
  };
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}
