import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function globalSetup(_config: FullConfig) {
  // Clean up Electron userData directory before tests
  // This ensures each test run starts with a fresh database

  // Electron stores data in different locations per platform
  const platform = os.platform();
  let userDataPath: string;

  if (platform === 'darwin') {
    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', '@ledgr', 'desktop');
  } else if (platform === 'win32') {
    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', '@ledgr', 'desktop');
  } else {
    // Linux
    userDataPath = path.join(os.homedir(), '.config', '@ledgr', 'desktop');
  }

  // Remove the database file if it exists
  const dbPath = path.join(userDataPath, 'ledgr.db');

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

export default globalSetup;
