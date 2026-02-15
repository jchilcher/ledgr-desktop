import BetterSqlite3 = require('better-sqlite3');
import { LedgrDatabase } from '@ledgr/db';
import { BetterSqlite3Driver } from '@ledgr/db/drivers/better-sqlite3';
import { needsMigration, backupBeforeMigration } from './database-backup';

export class BudgetDatabase extends LedgrDatabase {
  private _rawDb: BetterSqlite3.Database;

  constructor(dbPath: string) {
    const raw = new BetterSqlite3(dbPath);
    const driver = new BetterSqlite3Driver(raw);
    super(driver);
    this._rawDb = raw;
  }

  get rawDb(): BetterSqlite3.Database {
    return this._rawDb;
  }

  static createWithSafetyNet(dbPath: string, appVersion: string): BudgetDatabase {
    if (needsMigration(dbPath, appVersion)) {
      const backupPath = backupBeforeMigration(dbPath);
      if (backupPath) {
        console.log(`[SafetyNet] Backup created at ${backupPath} before migration`);
      }
    }

    const db = new BudgetDatabase(dbPath);
    db.setSetting('last_app_version', appVersion);
    return db;
  }
}
