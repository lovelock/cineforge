import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerIpc } from './ipc';

let mainWindow: BrowserWindow | null = null;

// The app only converts media with ffmpeg; disabling GPU keeps Electron stable on
// headless/VM/Wayland setups where the GPU process is unavailable.
app.disableHardwareAcceleration();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 800,
    minHeight: 520,
    title: '影匠',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow) {
      void showFirstRunPrompt(mainWindow);
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    void mainWindow.loadURL(devServer);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let shutdown: () => Promise<void> = async () => undefined;
let showFirstRunPrompt: (win: BrowserWindow | null) => Promise<void> = async () => undefined;
let quitting = false;

app.whenReady().then(() => {
  const services = registerIpc(() => mainWindow);
  shutdown = services.shutdown;
  showFirstRunPrompt = services.showFirstRunPrompt;
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', (event) => {
  if (quitting) {
    return;
  }
  event.preventDefault();
  quitting = true;
  void shutdown().finally(() => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
