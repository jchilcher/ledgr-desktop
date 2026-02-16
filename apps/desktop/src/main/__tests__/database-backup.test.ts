import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import BetterSqlite3 = require('better-sqlite3')
import { backupDatabase, cleanupOldBackups, backupBeforeMigration, needsMigration } from '../database-backup'

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
}))

describe('Database Backup', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledgr-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  describe('backupDatabase', () => {
    it('should create file copy using better-sqlite3 backup API', async () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)')
      db.exec("INSERT INTO test (value) VALUES ('test data')")

      const backupPath = await backupDatabase(db)

      expect(fs.existsSync(backupPath)).toBe(true)
      expect(backupPath).toContain('ledgr-pre-update-')

      const backupDb = new BetterSqlite3(backupPath)
      const row = backupDb.prepare('SELECT value FROM test WHERE id = 1').get() as { value: string }
      expect(row.value).toBe('test data')

      backupDb.close()
      db.close()
    })

    it('should create backup directory if it does not exist', async () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)')

      const backupPath = await backupDatabase(db)

      const backupDir = path.dirname(backupPath)
      expect(fs.existsSync(backupDir)).toBe(true)

      db.close()
    })
  })

  describe('backupBeforeMigration', () => {
    it('should create synchronous file copy', () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)')
      db.exec("INSERT INTO test (value) VALUES ('migration test')")
      db.close()

      const backupPath = backupBeforeMigration(dbPath)

      expect(backupPath).not.toBeNull()
      expect(fs.existsSync(backupPath!)).toBe(true)
      expect(backupPath).toContain('ledgr-pre-migration-')

      const backupDb = new BetterSqlite3(backupPath!)
      const row = backupDb.prepare('SELECT value FROM test WHERE id = 1').get() as { value: string }
      expect(row.value).toBe('migration test')

      backupDb.close()
    })

    it('should return null if DB does not exist (fresh install)', () => {
      const dbPath = path.join(tmpDir, 'nonexistent.db')
      const result = backupBeforeMigration(dbPath)

      expect(result).toBeNull()
    })

    it('should copy WAL and SHM files if they exist', () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.pragma('journal_mode = WAL')
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)')
      db.exec("INSERT INTO test (id) VALUES (1)")
      db.close()

      const walPath = `${dbPath}-wal`

      if (fs.existsSync(walPath)) {
        const backupPath = backupBeforeMigration(dbPath)
        expect(backupPath).not.toBeNull()
        expect(fs.existsSync(`${backupPath}-wal`)).toBe(true)
      }
    })
  })

  describe('cleanupOldBackups', () => {
    it('should keep N most recent backups', async () => {
      const backupDir = path.join(tmpDir, 'backups')
      fs.mkdirSync(backupDir, { recursive: true })

      for (let i = 0; i < 7; i++) {
        const fileName = `ledgr-backup-${1000 + i}.db`
        const filePath = path.join(backupDir, fileName)
        fs.writeFileSync(filePath, 'test')
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      await cleanupOldBackups(backupDir, 3)

      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'))
      expect(files.length).toBe(3)
    })

    it('should ignore non-.db files', async () => {
      const backupDir = path.join(tmpDir, 'backups')
      fs.mkdirSync(backupDir, { recursive: true })

      fs.writeFileSync(path.join(backupDir, 'backup1.db'), 'test')
      fs.writeFileSync(path.join(backupDir, 'backup2.db'), 'test')
      fs.writeFileSync(path.join(backupDir, 'readme.txt'), 'test')

      await cleanupOldBackups(backupDir, 1)

      const files = fs.readdirSync(backupDir)
      expect(files).toContain('readme.txt')
      expect(files.filter(f => f.endsWith('.db')).length).toBe(1)
    })

    it('should handle empty directory', async () => {
      const backupDir = path.join(tmpDir, 'backups')
      fs.mkdirSync(backupDir, { recursive: true })

      await expect(cleanupOldBackups(backupDir, 5)).resolves.not.toThrow()

      const files = fs.readdirSync(backupDir)
      expect(files.length).toBe(0)
    })
  })

  describe('needsMigration', () => {
    it('should return false if DB does not exist', () => {
      const dbPath = path.join(tmpDir, 'nonexistent.db')
      const result = needsMigration(dbPath, '1.0.0')

      expect(result).toBe(false)
    })

    it('should return true if schema version is behind', () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.pragma('user_version = 1')
      db.close()

      const result = needsMigration(dbPath, '1.0.0')

      expect(result).toBe(true)
    })

    it('should return true if app version differs', () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.pragma('user_version = 100')
      db.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT)')
      db.exec("INSERT INTO app_settings (key, value) VALUES ('last_app_version', '0.9.0')")
      db.close()

      const result = needsMigration(dbPath, '1.0.0')

      expect(result).toBe(true)
    })

    it('should return false when up-to-date', () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.pragma('user_version = 100')
      db.exec('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT)')
      db.exec("INSERT INTO app_settings (key, value) VALUES ('last_app_version', '1.0.0')")
      db.close()

      const result = needsMigration(dbPath, '1.0.0')

      expect(result).toBe(false)
    })

    it('should return true if app_settings table does not exist', () => {
      const dbPath = path.join(tmpDir, 'test.db')
      const db = new BetterSqlite3(dbPath)
      db.pragma('user_version = 100')
      db.close()

      const result = needsMigration(dbPath, '1.0.0')

      expect(result).toBe(true)
    })
  })
})
