import BetterSqlite3 = require('better-sqlite3');
import { LedgrDatabase } from '@ledgr/db';
import { BetterSqlite3Driver } from '@ledgr/db/drivers/better-sqlite3';

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
}
