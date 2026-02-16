import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import BetterSqlite3 = require('better-sqlite3')
import { extractDatabaseMetadata, performDatabaseImport } from '../database-import'

let tmpDir: string

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') {
        return tmpDir
      }
      return ''
    }),
  },
  dialog: {
    showOpenDialog: jest.fn(),
  },
}))

describe('Database Import', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledgr-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  describe('extractDatabaseMetadata', () => {
    it('should read correct counts and version from DB', () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.pragma('user_version = 42')
      db.exec(`
        CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE transactions (id TEXT PRIMARY KEY, date INTEGER);
        CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT);
      `)
      db.exec("INSERT INTO accounts (id, name) VALUES ('a1', 'Checking'), ('a2', 'Savings')")
      db.exec("INSERT INTO transactions (id, date) VALUES ('t1', 1704067200000), ('t2', 1706745600000), ('t3', 1709251200000)")
      db.close()

      const metadata = extractDatabaseMetadata(dbPath)

      expect(metadata.schemaVersion).toBe(42)
      expect(metadata.accountCount).toBe(2)
      expect(metadata.transactionCount).toBe(3)
      expect(metadata.fileSizeBytes).toBeGreaterThan(0)
    })

    it('should throw on corruption', () => {
      const dbPath = path.join(tmpDir, 'corrupt.db')
      fs.writeFileSync(dbPath, 'not a database')

      expect(() => {
        extractDatabaseMetadata(dbPath)
      }).toThrow()
    })

    it('should throw on missing required tables', () => {
      const dbPath = path.join(tmpDir, 'incomplete.db')
      const db = new BetterSqlite3(dbPath)
      db.exec('CREATE TABLE accounts (id TEXT PRIMARY KEY)')
      db.close()

      expect(() => {
        extractDatabaseMetadata(dbPath)
      }).toThrow('Missing required table')
    })

    it('should handle empty transaction table', () => {
      const dbPath = path.join(tmpDir, 'empty.db')
      const db = new BetterSqlite3(dbPath)
      db.exec(`
        CREATE TABLE accounts (id TEXT PRIMARY KEY);
        CREATE TABLE transactions (id TEXT PRIMARY KEY, date INTEGER);
        CREATE TABLE categories (id TEXT PRIMARY KEY);
      `)
      db.close()

      const metadata = extractDatabaseMetadata(dbPath)

      expect(metadata.transactionCount).toBe(0)
      expect(metadata.dateRange).toBeNull()
    })

    it('should extract date range from transactions', () => {
      const dbPath = path.join(tmpDir, 'dated.db')
      const db = new BetterSqlite3(dbPath)
      db.exec(`
        CREATE TABLE accounts (id TEXT PRIMARY KEY);
        CREATE TABLE transactions (id TEXT PRIMARY KEY, date INTEGER);
        CREATE TABLE categories (id TEXT PRIMARY KEY);
      `)
      db.exec(`
        INSERT INTO transactions (id, date) VALUES
          ('t1', ${new Date('2024-01-01').getTime()}),
          ('t2', ${new Date('2024-12-31').getTime()})
      `)
      db.close()

      const metadata = extractDatabaseMetadata(dbPath)

      expect(metadata.dateRange).not.toBeNull()
      expect(metadata.dateRange!.earliest).toBe('2024-01-01')
      expect(metadata.dateRange!.latest).toBe('2024-12-31')
    })
  })

  describe('performDatabaseImport', () => {
    it('should backup current database first', async () => {
      const currentDbPath = path.join(tmpDir, 'current.db')
      const currentDb = new BetterSqlite3(currentDbPath)
      currentDb.exec('CREATE TABLE test (id INTEGER)')

      const importPath = path.join(tmpDir, 'import.db')
      const importDb = new BetterSqlite3(importPath)
      importDb.exec('CREATE TABLE test (id INTEGER, value TEXT)')
      importDb.close()

      const result = await performDatabaseImport(importPath, currentDbPath, currentDb)

      expect(result.success).toBe(true)
      expect(result.backupPath).toBeDefined()
      expect(fs.existsSync(result.backupPath!)).toBe(true)
    })

    it('should copy import file to current location', async () => {
      const currentDbPath = path.join(tmpDir, 'current.db')
      const currentDb = new BetterSqlite3(currentDbPath)
      currentDb.exec('CREATE TABLE old (id INTEGER)')
      currentDb.close()

      const importPath = path.join(tmpDir, 'import.db')
      const importDb = new BetterSqlite3(importPath)
      importDb.exec('CREATE TABLE new (id INTEGER, value TEXT)')
      importDb.close()

      const currentDbReopen = new BetterSqlite3(currentDbPath)
      const result = await performDatabaseImport(importPath, currentDbPath, currentDbReopen)

      expect(result.success).toBe(true)

      const verifyDb = new BetterSqlite3(currentDbPath)
      const tables = verifyDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      const tableNames = tables.map(t => t.name)

      expect(tableNames).toContain('new')

      verifyDb.close()
    })

    it('should handle errors gracefully', async () => {
      const currentDbPath = path.join(tmpDir, 'current.db')
      const currentDb = new BetterSqlite3(currentDbPath)

      const importPath = path.join(tmpDir, 'nonexistent.db')

      const result = await performDatabaseImport(importPath, currentDbPath, currentDb)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
