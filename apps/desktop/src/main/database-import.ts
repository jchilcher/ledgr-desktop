import { dialog } from 'electron';
import fs from 'fs';
import BetterSqlite3 = require('better-sqlite3');
import { backupDatabase } from './database-backup';

export interface DatabaseMetadata {
  schemaVersion: number;
  accountCount: number;
  transactionCount: number;
  dateRange: { earliest: string; latest: string } | null;
  fileSizeBytes: number;
}

/**
 * Extract metadata from a database file for comparison before import.
 * Opens the database in read-only mode and runs validation checks.
 *
 * @param dbPath - Path to the database file to inspect
 * @returns Database metadata with counts and validation results
 * @throws Error if database is invalid (integrity check fails, missing tables, etc.)
 */
export function extractDatabaseMetadata(dbPath: string): DatabaseMetadata {
  let db: BetterSqlite3.Database | null = null;

  try {
    // Open database in read-only mode
    db = new BetterSqlite3(dbPath, { readonly: true });

    // 1. Get schema version
    const versionRow = db.prepare('PRAGMA user_version').get() as { user_version: number };
    const schemaVersion = versionRow.user_version;

    // 2. Run integrity check
    const integrityRow = db.prepare('PRAGMA quick_check').get() as { quick_check: string };
    if (integrityRow.quick_check !== 'ok') {
      throw new Error(`Database integrity check failed: ${integrityRow.quick_check}`);
    }

    // 3. Validate required tables exist
    const requiredTables = ['accounts', 'transactions', 'categories'];
    const existingTables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    const existingTableNames = existingTables.map(t => t.name);

    for (const tableName of requiredTables) {
      if (!existingTableNames.includes(tableName)) {
        throw new Error(`Missing required table: ${tableName}`);
      }
    }

    // 4. Count accounts
    const accountRow = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    const accountCount = accountRow.count;

    // 5. Count transactions
    const transactionRow = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
    const transactionCount = transactionRow.count;

    // 6. Get date range from transactions
    let dateRange: { earliest: string; latest: string } | null = null;
    if (transactionCount > 0) {
      const dateRow = db.prepare(
        'SELECT MIN(date) as earliest, MAX(date) as latest FROM transactions'
      ).get() as { earliest: number; latest: number };

      dateRange = {
        earliest: new Date(dateRow.earliest).toISOString().split('T')[0],
        latest: new Date(dateRow.latest).toISOString().split('T')[0],
      };
    }

    // 7. Get file size
    const stats = fs.statSync(dbPath);
    const fileSizeBytes = stats.size;

    return {
      schemaVersion,
      accountCount,
      transactionCount,
      dateRange,
      fileSizeBytes,
    };
  } finally {
    if (db) {
      db.close();
    }
  }
}

/**
 * Show native file picker for selecting an import file.
 *
 * @returns Result with canceled flag and optional filePath
 */
export async function selectImportFile(): Promise<{ canceled: boolean; filePath?: string }> {
  const result = await dialog.showOpenDialog({
    title: 'Import Database',
    filters: [
      { name: 'Database Files', extensions: ['db'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePaths[0] };
}

/**
 * Perform database import by:
 * 1. Backing up current database
 * 2. Closing current database connection
 * 3. Copying import file to current database location
 *
 * @param importPath - Path to the database file to import
 * @param currentDbPath - Path to the current database file
 * @param currentDb - Current database connection (will be closed)
 * @returns Result with success/error/backupPath
 */
export async function performDatabaseImport(
  importPath: string,
  currentDbPath: string,
  currentDb: BetterSqlite3.Database
): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  try {
    // 1. Backup current database
    const backupPath = await backupDatabase(currentDb);
    console.log(`[Import] Current database backed up to: ${backupPath}`);

    // 2. Close current database connection
    currentDb.close();
    console.log('[Import] Current database connection closed');

    // 3. Copy import file to current database location
    // (Using copyFile instead of rename to preserve the import file)
    fs.copyFileSync(importPath, currentDbPath);
    console.log(`[Import] Import file copied to: ${currentDbPath}`);

    return { success: true, backupPath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Import] Import failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
