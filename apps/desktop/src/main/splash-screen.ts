import { BrowserWindow, app } from 'electron';
import path from 'path';

let splashWindow: BrowserWindow | null = null;
let splashTimeout: NodeJS.Timeout | null = null;

export function createSplashScreen(): BrowserWindow {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load splash HTML
  // In packaged apps, use app.isPackaged; in dev mode, check for --dev flag
  const isDev = process.argv.includes('--dev');
  const splashPath = isDev
    ? path.join(__dirname, '../../../src/renderer/splash.html')
    : path.join(__dirname, '../../renderer/splash.html');

  splashWindow.loadFile(splashPath);

  // Send version once loaded
  splashWindow.webContents.once('did-finish-load', () => {
    const version = app.getVersion();
    splashWindow?.webContents.executeJavaScript(
      `document.getElementById('version').textContent = 'v${version}';`
    );
  });

  // Safety timeout: force close splash after 15 seconds to prevent hang
  splashTimeout = setTimeout(() => {
    closeSplashScreen();
    console.warn('[Splash] Force-closed after timeout');
  }, 15000);

  return splashWindow;
}

export function updateSplashStatus(message: string): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(
      `document.getElementById('status').textContent = ${JSON.stringify(message)};`
    );
  }
}

export function closeSplashScreen(): void {
  if (splashTimeout) {
    clearTimeout(splashTimeout);
    splashTimeout = null;
  }
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}
