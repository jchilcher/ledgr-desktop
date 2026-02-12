import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import BetterSqlite3 = require('better-sqlite3');

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
  await fs.mkdir(backupDir, { recursive: true });

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
    const files = await fs.readdir(backupDir);

    // Filter to only .db files
    const dbFiles = files.filter(f => f.endsWith('.db'));

    if (dbFiles.length <= keepCount) {
      return; // Nothing to clean up
    }

    // Get file stats for sorting by modification time
    const filesWithStats = await Promise.all(
      dbFiles.map(async (file) => {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);
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
        return fs.unlink(filePath);
      })
    );

    console.log(`[Backup] Cleanup complete - kept ${keepCount} most recent backups`);
  } catch (error) {
    console.error('[Backup] Cleanup failed:', error);
    // Don't throw - cleanup failure shouldn't block updates
  }
}
