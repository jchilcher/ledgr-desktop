import { app } from 'electron';
import * as fsAsync from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import BetterSqlite3 = require('better-sqlite3');
import { CURRENT_SCHEMA_VERSION } from '@ledgr/db';

/**
 * Creates a backup of the database before auto-update installation.
 * Uses better-sqlite3's built-in .backup() API which handles WAL mode safely.
 *
 * @param db - Raw BetterSqlite3 Database instance
 * @returns Path to the created backup file
 * @throws Error if backup fails (caller must handle to block update)
 */
export async function backupDatabase(db: BetterSqlite3.Database): Promise<string> {
  const backupDir = path.join(app.getPath('userData'), 'backups');

  // Ensure backup directory exists
  await fsAsync.mkdir(backupDir, { recursive: true });

  // Generate timestamped backup filename
  const backupFileName = `ledgr-pre-update-${Date.now()}.db`;
  const backupPath = path.join(backupDir, backupFileName);

  // Use better-sqlite3's built-in backup API (handles concurrent access and WAL mode)
  await db.backup(backupPath);

  console.log(`[Backup] Database backed up to: ${backupPath}`);
  return backupPath;
}

/**
 * Removes old backup files, keeping only the most recent ones.
 * Prevents backups directory from growing indefinitely.
 *
 * @param backupDir - Directory containing backup files
 * @param keepCount - Number of recent backups to retain (default: 5)
 */
export async function cleanupOldBackups(backupDir: string, keepCount: number = 5): Promise<void> {
  try {
    const files = await fsAsync.readdir(backupDir);

    // Filter to only .db files
    const dbFiles = files.filter(f => f.endsWith('.db'));

    if (dbFiles.length <= keepCount) {
      return; // Nothing to clean up
    }

    // Get file stats for sorting by modification time
    const filesWithStats = await Promise.all(
      dbFiles.map(async (file) => {
        const filePath = path.join(backupDir, file);
        const stats = await fsAsync.stat(filePath);
        return { file, path: filePath, mtime: stats.mtime };
      })
    );

    // Sort by modification time (newest first)
    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Delete files beyond keepCount
    const filesToDelete = filesWithStats.slice(keepCount);
    await Promise.all(
      filesToDelete.map(({ path: filePath, file }) => {
        console.log(`[Backup] Deleting old backup: ${file}`);
        return fsAsync.unlink(filePath);
      })
    );

    console.log(`[Backup] Cleanup complete - kept ${keepCount} most recent backups`);
  } catch (error) {
    console.error('[Backup] Cleanup failed:', error);
    // Don't throw - cleanup failure shouldn't block updates
  }
}

/**
 * Creates a synchronous file-copy backup of the database before migrations run.
 * Works before the database is opened (no BetterSqlite3.Database instance needed).
 *
 * @param dbPath - Path to the database file
 * @returns Path to the created backup file, or null if DB doesn't exist (fresh install)
 */
export function backupBeforeMigration(dbPath: string): string | null {
  if (!fsSync.existsSync(dbPath)) {
    return null;
  }

  const backupDir = path.join(path.dirname(dbPath), 'backups');
  fsSync.mkdirSync(backupDir, { recursive: true });

  const backupFileName = `ledgr-pre-migration-${Date.now()}.db`;
  const backupPath = path.join(backupDir, backupFileName);

  fsSync.copyFileSync(dbPath, backupPath);

  // Also copy WAL and SHM journal files if they exist
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  if (fsSync.existsSync(walPath)) {
    fsSync.copyFileSync(walPath, `${backupPath}-wal`);
  }
  if (fsSync.existsSync(shmPath)) {
    fsSync.copyFileSync(shmPath, `${backupPath}-shm`);
  }

  console.log(`[Backup] Pre-migration backup created: ${backupPath}`);

  // Clean up old backups asynchronously (don't block startup)
  cleanupOldBackups(backupDir, 10).catch(() => {});

  return backupPath;
}

/**
 * Checks whether the database needs migrations by peeking at the schema version
 * and the last recorded app version.
 *
 * @param dbPath - Path to the database file
 * @param currentAppVersion - The running app's version string
 * @returns true if schema version is behind or app version differs
 */
export function needsMigration(dbPath: string, currentAppVersion: string): boolean {
  if (!fsSync.existsSync(dbPath)) {
    return false;
  }

  let db: BetterSqlite3.Database | null = null;
  try {
    db = new BetterSqlite3(dbPath, { readonly: true });

    const versionRow = db.pragma('user_version', { simple: true }) as number;
    if (versionRow < CURRENT_SCHEMA_VERSION) {
      return true;
    }

    // Check if app_settings table exists before querying it
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'"
    ).get();
    if (!tableExists) {
      return true;
    }

    const row = db.prepare(
      "SELECT value FROM app_settings WHERE key = 'last_app_version'"
    ).get() as { value: string } | undefined;
    if (!row || row.value !== currentAppVersion) {
      return true;
    }

    return false;
  } finally {
    db?.close();
  }
}
