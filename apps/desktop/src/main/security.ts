import crypto = require('crypto');
import fs = require('fs');
import path = require('path');

interface SecurityConfig {
  enabled: boolean;
  passwordHash: string;
  hashSalt: string;
  encryptionSalt: string;
  iterations: number;
  autoLockMinutes: number;
}

export class SecurityManager {
  private configPath: string;
  private config: SecurityConfig | null = null;
  private isLocked: boolean = false;
  private sessionKey: Buffer | null = null;

  constructor(configDir: string) {
    this.configPath = path.join(configDir, 'security.json');
    this.config = this.loadConfig();
    this.isLocked = false;
    this.sessionKey = null;
  }

  private loadConfig(): SecurityConfig | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }
      const data = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  private saveConfig(config: SecurityConfig): void {
    const tmpPath = this.configPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.configPath);
  }

  private hashPassword(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha512');
  }

  private deriveEncryptionKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha512');
  }

  isEnabled(): boolean {
    return this.config !== null && this.config.enabled;
  }

  getAutoLockMinutes(): number {
    if (!this.config) {
      return 0;
    }
    return this.config.autoLockMinutes;
  }

  verifyPassword(password: string): boolean {
    if (!this.isEnabled() || !this.config) {
      return false;
    }

    const salt = Buffer.from(this.config.hashSalt, 'hex');
    const hash = this.hashPassword(password, salt);
    const storedHash = Buffer.from(this.config.passwordHash, 'hex');

    return crypto.timingSafeEqual(hash, storedHash);
  }

  enableProtection(password: string, autoLockMinutes: number = 0): void {
    const hashSalt = crypto.randomBytes(32);
    const encryptionSalt = crypto.randomBytes(32);
    const passwordHash = this.hashPassword(password, hashSalt);

    const config: SecurityConfig = {
      enabled: true,
      passwordHash: passwordHash.toString('hex'),
      hashSalt: hashSalt.toString('hex'),
      encryptionSalt: encryptionSalt.toString('hex'),
      iterations: 600000,
      autoLockMinutes,
    };

    this.saveConfig(config);
    this.config = config;
  }

  disableProtection(password: string): void {
    if (!this.verifyPassword(password)) {
      throw new Error('Invalid password');
    }

    this.clearSessionKey();

    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }

    this.config = null;
  }

  changePassword(currentPassword: string, newPassword: string): void {
    if (!this.verifyPassword(currentPassword)) {
      throw new Error('Invalid current password');
    }

    if (!this.config) {
      throw new Error('Protection not enabled');
    }

    const hashSalt = crypto.randomBytes(32);
    const encryptionSalt = crypto.randomBytes(32);
    const passwordHash = this.hashPassword(newPassword, hashSalt);

    this.config.passwordHash = passwordHash.toString('hex');
    this.config.hashSalt = hashSalt.toString('hex');
    this.config.encryptionSalt = encryptionSalt.toString('hex');

    this.saveConfig(this.config);
    this.clearSessionKey();
  }

  updateAutoLockMinutes(minutes: number): void {
    if (!this.config) {
      throw new Error('Protection not enabled');
    }

    this.config.autoLockMinutes = minutes;
    this.saveConfig(this.config);
  }

  setSessionKey(password: string): void {
    if (!this.config) {
      throw new Error('Protection not enabled');
    }

    const encryptionSalt = Buffer.from(this.config.encryptionSalt, 'hex');
    this.sessionKey = this.deriveEncryptionKey(password, encryptionSalt);
  }

  clearSessionKey(): void {
    if (this.sessionKey) {
      this.sessionKey.fill(0);
      this.sessionKey = null;
    }
  }

  encryptDatabase(dbPath: string, password: string): void {
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found');
    }

    if (!this.config) {
      throw new Error('Protection not enabled');
    }

    const encryptionSalt = Buffer.from(this.config.encryptionSalt, 'hex');
    const key = this.deriveEncryptionKey(password, encryptionSalt);

    const plaintext = fs.readFileSync(dbPath);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const encryptedPath = dbPath + '.enc';
    const tmpPath = encryptedPath + '.tmp';

    const output = Buffer.concat([encryptionSalt, iv, authTag, ciphertext]);
    fs.writeFileSync(tmpPath, output);
    fs.renameSync(tmpPath, encryptedPath);

    fs.unlinkSync(dbPath);
  }

  decryptDatabase(dbPath: string, password: string): void {
    const encryptedPath = dbPath + '.enc';

    if (!fs.existsSync(encryptedPath)) {
      throw new Error('Encrypted database file not found');
    }

    if (!this.config) {
      throw new Error('Protection not enabled');
    }

    const encrypted = fs.readFileSync(encryptedPath);

    const salt = encrypted.subarray(0, 32);
    const iv = encrypted.subarray(32, 48);
    const authTag = encrypted.subarray(48, 64);
    const ciphertext = encrypted.subarray(64);

    const key = this.deriveEncryptionKey(password, salt);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const tmpPath = dbPath + '.tmp';
    fs.writeFileSync(tmpPath, plaintext);
    fs.renameSync(tmpPath, dbPath);

    fs.unlinkSync(encryptedPath);
  }

  encryptDatabaseWithSessionKey(dbPath: string): void {
    if (!this.sessionKey) {
      throw new Error('Session key not set');
    }

    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found');
    }

    if (!this.config) {
      throw new Error('Protection not enabled');
    }

    const plaintext = fs.readFileSync(dbPath);
    const encryptionSalt = Buffer.from(this.config.encryptionSalt, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.sessionKey, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const encryptedPath = dbPath + '.enc';
    const tmpPath = encryptedPath + '.tmp';

    const output = Buffer.concat([encryptionSalt, iv, authTag, ciphertext]);
    fs.writeFileSync(tmpPath, output);
    fs.renameSync(tmpPath, encryptedPath);

    fs.unlinkSync(dbPath);
  }

  handleCrashRecovery(dbPath: string): void {
    const encryptedPath = dbPath + '.enc';

    if (fs.existsSync(dbPath) && fs.existsSync(encryptedPath)) {
      fs.unlinkSync(dbPath);
    }
  }

  getIsLocked(): boolean {
    return this.isLocked;
  }

  setIsLocked(locked: boolean): void {
    this.isLocked = locked;
  }
}
