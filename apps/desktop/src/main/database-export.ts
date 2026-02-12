import { dialog } from 'electron';
import BetterSqlite3 = require('better-sqlite3');

/**
 * Export the database to a user-selected file location.
 * Uses better-sqlite3's .backup() API which safely handles WAL mode.
 *
 * @param db - Raw BetterSqlite3 Database instance
 * @returns Result with success/error/filePath
 */
export async function exportDatabase(
  db: BetterSqlite3.Database
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // Show native save dialog
    const result = await dialog.showSaveDialog({
      title: 'Export Database',
      defaultPath: `ledgr-backup-${new Date().toISOString().split('T')[0]}.db`,
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    // User canceled
    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export canceled by user' };
    }

    // Use better-sqlite3's backup API (handles WAL mode safely, NOT fs.copyFile)
    await db.backup(result.filePath);

    console.log(`[Export] Database exported to: ${result.filePath}`);
    return { success: true, filePath: result.filePath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Export] Export failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
