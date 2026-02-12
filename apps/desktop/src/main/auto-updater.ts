import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import BetterSqlite3 = require('better-sqlite3');
import { backupDatabase, cleanupOldBackups } from './database-backup';

/**
 * Initializes the auto-updater service.
 * Configures update behavior, registers IPC handlers, and sets up event forwarding.
 *
 * @param getMainWindow - Function to retrieve the main BrowserWindow (for event forwarding)
 * @param getDatabase - Function to retrieve the database instance (for pre-update backup)
 */
export function initAutoUpdater(
  getMainWindow: () => BrowserWindow | null,
  getDatabase: () => BetterSqlite3.Database | null
): void {
  // Configuration
  autoUpdater.autoDownload = false; // LOCKED DECISION: User must explicitly click Download
  autoUpdater.autoInstallOnAppQuit = true; // If downloaded but dismissed, apply on quit

  // Register version handler for both dev and production
  ipcMain.handle('app:getVersion', (event) => {
    validateSender(event);
    return {
      app: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
    };
  });

  // Only check for updates in production builds
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Skipped in development mode');
    return;
  }

  // ==================== Event Forwarding to Renderer ====================

  autoUpdater.on('checking-for-update', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('updater:checking');
    }
    console.log('[AutoUpdater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('updater:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    }
    console.log(`[AutoUpdater] Update available: v${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('updater:not-available');
    }
    console.log('[AutoUpdater] No updates available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('updater:progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    }
    console.log(`[AutoUpdater] Download progress: ${Math.round(progressObj.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('updater:downloaded', {
        version: info.version,
      });
    }
    console.log(`[AutoUpdater] Update downloaded: v${info.version}`);
  });

  autoUpdater.on('error', (error) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('updater:error', {
        message: error.message,
      });
    }
    console.error('[AutoUpdater] Error:', error);
  });

  // ==================== IPC Handlers ====================

  function validateSender(event: Electron.IpcMainInvokeEvent): void {
    const senderUrl = event.senderFrame?.url || '';
    if (!senderUrl.startsWith('file://') && !senderUrl.startsWith('http://localhost')) {
      throw new Error('Unauthorized IPC request: invalid sender origin');
    }
  }

  ipcMain.handle('updater:checkForUpdates', async (event) => {
    validateSender(event);
    if (process.platform === 'darwin') {
      // macOS unsigned apps cannot auto-update via electron-updater
      // Check for updates to show version info, but return manual flag
      try {
        await autoUpdater.checkForUpdates();
      } catch (error) {
        console.error('[AutoUpdater] macOS check failed:', error);
      }
      return { manual: true };
    }

    // Windows/Linux: normal auto-update flow
    await autoUpdater.checkForUpdates();
    return {};
  });

  ipcMain.handle('updater:downloadUpdate', async (event) => {
    validateSender(event);
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('updater:installUpdate', async (event) => {
    validateSender(event);
    const db = getDatabase();

    // Backup database before installing update
    if (db) {
      try {
        const backupPath = await backupDatabase(db);
        console.log(`[AutoUpdater] Database backed up: ${backupPath}`);

        // Clean up old backups (keep last 5)
        const backupDir = path.join(app.getPath('userData'), 'backups');
        await cleanupOldBackups(backupDir, 5);
      } catch (error) {
        console.error('[AutoUpdater] Backup failed - blocking update:', error);
        throw new Error('Database backup failed. Update aborted for data safety.');
      }
    }

    // Quit and install update
    // false = don't run installer silently
    // true = force quit without asking
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('updater:openReleasesPage', async (event) => {
    validateSender(event);
    await shell.openExternal('https://github.com/jchilcher/ledgr/releases/latest');
  });

  // ==================== Auto-Check on Launch ====================

  if (process.platform !== 'darwin') {
    // Auto-check for updates on launch (Windows/Linux only)
    autoUpdater.checkForUpdates().catch((error) => {
      console.error('[AutoUpdater] Auto-check failed:', error);
      // Silently fail - don't block app launch if update check fails
    });
  } else {
    console.log('[AutoUpdater] macOS detected - auto-check disabled (unsigned app limitation)');
  }
}
