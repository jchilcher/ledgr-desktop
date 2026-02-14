import crypto = require('crypto');

class SessionKeyStore {
  private sessions: Map<string, { uek: Buffer; privateKey: crypto.KeyObject }> = new Map();

  setSession(userId: string, uek: Buffer, privateKey: crypto.KeyObject): void {
    this.clearSession(userId);
    this.sessions.set(userId, { uek, privateKey });
  }

  getSession(userId: string): { uek: Buffer; privateKey: crypto.KeyObject } | null {
    return this.sessions.get(userId) ?? null;
  }

  hasSession(userId: string): boolean {
    return this.sessions.has(userId);
  }

  clearSession(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.uek.fill(0);
      this.sessions.delete(userId);
    }
  }

  clearAll(): void {
    for (const [userId] of this.sessions) {
      this.clearSession(userId);
    }
  }
}

export const sessionKeys = new SessionKeyStore();
