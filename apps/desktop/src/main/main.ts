import { app, BrowserWindow, ipcMain, session, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import BetterSqlite3 = require('better-sqlite3');
import { BudgetDatabase } from './database';
import { IPCHandlers } from './ipc-handlers';
import { SecurityManager } from './security';
import { CategorizationEngine } from './categorization-engine';
import { initAutoUpdater } from './auto-updater';
import { createSplashScreen, updateSplashStatus, closeSplashScreen } from './splash-screen';

const windows: Map<number, BrowserWindow> = new Map();
let database: BudgetDatabase | null = null;
let ipcHandlers: IPCHandlers | null = null;
let securityManager: SecurityManager | null = null;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

const isDev = process.argv.includes('--dev');

// WSL2 lacks GPU support — disable hardware acceleration to avoid blank screens
if (isDev && process.platform === 'linux') {
  app.disableHardwareAcceleration();
}

// Security: Validate IPC sender origin
function validateSender(event: Electron.IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url || '';
  // Allow file:// protocol (packaged app) and http://localhost (dev mode)
  if (!senderUrl.startsWith('file://') && !senderUrl.startsWith('http://localhost')) {
    throw new Error('Unauthorized IPC request: invalid sender origin');
  }
}

// Single instance lock — prevent multiple instances to protect SQLite database
const gotTheLock = app.requestSingleInstanceLock();

function createWindow(initialView?: string): BrowserWindow {
  // Calculate offset based on existing windows for staggered positioning
  const offset = windows.size * 30;

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    x: 100 + offset,
    y: 100 + offset,
    show: false, // Don't show until content is loaded
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Show window when ready
  win.once('ready-to-show', () => {
    win.show();
  });

  // Load the app with optional view parameter
  const viewParam = initialView ? `?view=${initialView}` : '';
  if (isDev) {
    win.loadURL(`http://localhost:5173${viewParam}`);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      search: initialView ? `view=${initialView}` : '',
    });
  }

  windows.set(win.id, win);
  win.on('closed', () => {
    windows.delete(win.id);
  });

  return win;
}

function migrateFromLegacyDatabase(currentDbPath: string): void {
  // app.getPath('appData') gives the platform's app data root directly
  // e.g., ~/Library/Application Support on macOS, AppData/Roaming on Windows
  const appDataRoot = app.getPath('appData');

  // Known legacy database locations (newest first)
  const legacyPaths = [
    path.join(appDataRoot, '@ledgr', 'desktop', 'ledgr.db'),
  ];

  // Find the first legacy database that exists
  const legacyDbPath = legacyPaths.find(p => fs.existsSync(p));
  if (!legacyDbPath) {
    return; // No legacy database found
  }

  // Only migrate if current database has no accounts (i.e., is freshly created)
  const db = new BetterSqlite3(currentDbPath);
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    if (result.count > 0) {
      return; // Current database already has data, skip migration
    }

    console.log(`[Migration] Found legacy database at: ${legacyDbPath}`);
    console.log(`[Migration] Migrating data to: ${currentDbPath}`);

    // Attach the legacy database
    db.exec(`ATTACH DATABASE '${legacyDbPath.replace(/'/g, "''")}' AS legacy`);

    // Tables to migrate — order matters for foreign key relationships
    const tables = [
      'accounts',
      'categories',
      'transactions',
      'category_rules',
      'recurring_transactions',
      'tags',
      'transaction_tags',
      'transaction_splits',
      'budget_goals',
      'spending_alerts',
      'bills',
      'bill_payments',
      'category_corrections',
      'assets',
      'liabilities',
      'net_worth_history',
      'savings_goals',
      'savings_contributions',
      'investments',
      'investment_history',
      'receipts',
      'investment_accounts',
      'holdings',
      'cost_basis_lots',
      'investment_transactions',
      'investment_settings',
      'recurring_items',
      'recurring_payments',
      'seasonal_patterns',
      'financial_health_history',
      'bill_preferences',
      'manual_assets',
      'manual_liabilities',
      'net_worth_snapshots',
      'asset_value_history',
      'liability_value_history',
      'app_settings',
    ];

    let totalRows = 0;
    for (const table of tables) {
      try {
        // Check if the table exists in the legacy database
        const tableExists = db.prepare(
          `SELECT name FROM legacy.sqlite_master WHERE type='table' AND name=?`
        ).get(table);
        if (!tableExists) continue;

        const info = db.prepare(`INSERT OR IGNORE INTO main.${table} SELECT * FROM legacy.${table}`).run();
        if (info.changes > 0) {
          console.log(`[Migration] ${table}: ${info.changes} rows`);
          totalRows += info.changes;
        }
      } catch (err) {
        // Table schema mismatch between versions — skip and continue
        console.warn(`[Migration] Skipping ${table}: ${(err as Error).message}`);
      }
    }

    db.exec('DETACH DATABASE legacy');
    console.log(`[Migration] Complete — migrated ${totalRows} total rows`);
  } finally {
    db.close();
  }
}

if (!gotTheLock) {
  // Another instance is already running, quit immediately
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance — focus existing window
    const existingWindow = BrowserWindow.getAllWindows()[0];
    if (existingWindow) {
      if (existingWindow.isMinimized()) existingWindow.restore();
      existingWindow.focus();
    }
  });

  app.on('before-quit', () => {
    if (autoLockTimer) {
      clearTimeout(autoLockTimer);
      autoLockTimer = null;
    }

    const dbPath = database ? path.join(app.getPath('userData'), 'ledgr.db') : null;

    if (database) {
      try {
        database.close();
        console.log('[Shutdown] Database closed gracefully');
      } catch (error) {
        console.error('[Shutdown] Error closing database:', error);
      }
      database = null;
    }

    // Encrypt database on close if protection is enabled
    if (securityManager?.isEnabled() && dbPath) {
      try {
        securityManager.encryptDatabaseWithSessionKey(dbPath);
        securityManager.clearSessionKey();
        console.log('[Shutdown] Database encrypted');
      } catch (error) {
        console.error('[Shutdown] Error encrypting database:', error);
      }
    }
  });

  app.whenReady().then(() => {
  // Show splash screen immediately
  createSplashScreen();

  // Security: Set Content-Security-Policy headers
  const cspPolicy = isDev
    ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:* http://localhost:*; frame-src 'none'; object-src 'none'; base-uri 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://query1.finance.yahoo.com https://query2.finance.yahoo.com; frame-src 'none'; object-src 'none'; base-uri 'self'";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy]
      }
    });
  });

  // Initialize security manager
  updateSplashStatus('Checking security...');
  const dbPath = path.join(app.getPath('userData'), 'ledgr.db');
  securityManager = new SecurityManager(app.getPath('userData'));

  function resetAutoLockTimer(): void {
    if (autoLockTimer) {
      clearTimeout(autoLockTimer);
      autoLockTimer = null;
    }
    if (!securityManager?.isEnabled()) return;
    const minutes = securityManager.getAutoLockMinutes();
    if (minutes <= 0) return;
    autoLockTimer = setTimeout(() => {
      if (securityManager && securityManager.isEnabled() && !securityManager.getIsLocked()) {
        securityManager.setIsLocked(true);
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('app:lock');
        }
      }
    }, minutes * 60 * 1000);
  }

  function initializeApp(dbPathArg: string): void {
    // Initialize database
    updateSplashStatus('Loading database...');
    database = new BudgetDatabase(dbPathArg);

    // Migrate data from legacy database locations if current db is empty
    updateSplashStatus('Checking for data migration...');
    migrateFromLegacyDatabase(dbPathArg);

    // Install default categorization rules if none exist
    updateSplashStatus('Initializing rules...');
    const categorizationEngine = new CategorizationEngine(database);
    const existingRules = database.getCategoryRules();
    if (existingRules.length === 0) {
      categorizationEngine.installDefaultRules();
    }

    // Initialize IPC handlers
    updateSplashStatus('Setting up handlers...');
    ipcHandlers = new IPCHandlers(database, securityManager!);

    // Register security heartbeat handler for auto-lock
    ipcMain.removeHandler('security:heartbeat');
    ipcMain.handle('security:heartbeat', (event) => {
      validateSender(event);
      resetAutoLockTimer();
    });
  }

  // Register window:openNewWindow IPC handler
  ipcMain.handle('window:openNewWindow', (event, view: string) => {
    validateSender(event);
    const newWindow = createWindow(view);
    return newWindow.id;
  });

  if (securityManager.isEnabled()) {
    // Encrypted startup flow
    securityManager.handleCrashRecovery(dbPath);
    closeSplashScreen();

    // Register one-time startup unlock handler
    ipcMain.handle('security:unlockStartup', (event, password: string) => {
      validateSender(event);
      if (!securityManager!.verifyPassword(password)) {
        return false;
      }

      try {
        securityManager!.decryptDatabase(dbPath, password);
        securityManager!.setSessionKey(password);
        securityManager!.setIsLocked(false);

        initializeApp(dbPath);
        resetAutoLockTimer();
        return true;
      } catch (error) {
        console.error('[Security] Decryption failed:', error);
        return false;
      }
    });

    // Show lock window
    const lockWindow = createWindow('lock');
    lockWindow.webContents.once('did-finish-load', () => {
      // Lock window is now showing
    });
  } else {
    // Normal startup (no encryption)
    initializeApp(dbPath);
    resetAutoLockTimer();

    // Create main window (but don't show until ready)
    updateSplashStatus('Loading interface...');
    const mainWindow = createWindow();

    // Close splash when main window content is loaded
    mainWindow.webContents.once('did-finish-load', () => {
      closeSplashScreen();
    });
  }

  // ==================== Phase 10: Application Menu ====================
  const isMac = process.platform === 'darwin';

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Lock',
          accelerator: 'CmdOrCtrl+L',
          visible: securityManager?.isEnabled() ?? false,
          click: () => {
            if (securityManager?.isEnabled()) {
              securityManager.setIsLocked(true);
              for (const win of BrowserWindow.getAllWindows()) {
                win.webContents.send('app:lock');
              }
            }
          },
        },
        { type: 'separator' as const },
        {
          label: 'Export Database...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu:export-database');
            }
          },
        },
        {
          label: 'Import Database...',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu:import-database');
            }
          },
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
        { type: 'separator' as const },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('find:open');
            }
          },
        },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { role: 'resetZoom' as const },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Find in page IPC handlers
  ipcMain.handle('find:findInPage', (event, text: string, options?: { forward?: boolean; findNext?: boolean }) => {
    validateSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.webContents.findInPage(text, options);
    }
  });

  ipcMain.handle('find:stopFindInPage', (event) => {
    validateSender(event);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.webContents.stopFindInPage('clearSelection');
    }
  });

  // Relay found-in-page results back to renderer
  app.on('web-contents-created', (_createEvent, contents) => {
    contents.on('found-in-page', (_foundEvent, result) => {
      contents.send('find:result', {
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        finalUpdate: result.finalUpdate,
      });
    });
  });

  // Initialize auto-updater (after window creation and IPC handlers)
  initAutoUpdater(
    () => BrowserWindow.getAllWindows()[0] || null,
    () => database?.rawDb || null
  );

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  });

  app.on('window-all-closed', () => {
    if (autoLockTimer) {
      clearTimeout(autoLockTimer);
      autoLockTimer = null;
    }

    const closingDbPath = database ? path.join(app.getPath('userData'), 'ledgr.db') : null;

    // Clean up database and IPC handlers
    if (database) {
      database.close();
      database = null;
    }
    if (ipcHandlers) {
      ipcHandlers.removeHandlers();
      ipcHandlers = null;
    }

    // Encrypt database on close if protection is enabled
    if (securityManager?.isEnabled() && closingDbPath) {
      try {
        securityManager.encryptDatabaseWithSessionKey(closingDbPath);
        securityManager.clearSessionKey();
        console.log('[Shutdown] Database encrypted');
      } catch (error) {
        console.error('[Shutdown] Error encrypting database:', error);
      }
    }

    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
