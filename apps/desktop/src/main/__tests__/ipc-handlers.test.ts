import { BudgetDatabase } from '../database';
import { IPCHandlers } from '../ipc-handlers';
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Mock ipcMain for testing
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
}));

describe('IPC Handlers', () => {
  let db: BudgetDatabase;
  let ipcHandlers: IPCHandlers;
  const testDbPath = path.join(__dirname, 'test-ipc.db');
  const mockEvent = { senderFrame: { url: 'file:///test' } } as unknown as Electron.IpcMainInvokeEvent;

  beforeEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new BudgetDatabase(testDbPath);
    ipcHandlers = new IPCHandlers(db);
  });

  afterEach(() => {
    ipcHandlers.removeHandlers();
    db.close();

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    jest.clearAllMocks();
  });

  describe('Registration', () => {
    it('should register all IPC handlers', () => {
      const mockHandle = ipcMain.handle as jest.Mock;

      // Verify that handlers were registered
      expect(mockHandle).toHaveBeenCalledWith('accounts:getAll', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('accounts:getById', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('accounts:create', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('accounts:update', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('accounts:delete', expect.any(Function));

      expect(mockHandle).toHaveBeenCalledWith('transactions:getAll', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('transactions:getByAccount', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('transactions:create', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('transactions:update', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('transactions:delete', expect.any(Function));

      expect(mockHandle).toHaveBeenCalledWith('categories:getAll', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('categories:getById', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('categories:create', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('categories:update', expect.any(Function));
      expect(mockHandle).toHaveBeenCalledWith('categories:delete', expect.any(Function));
    });

    it('should remove all handlers when cleanup is called', () => {
      const mockRemoveHandler = ipcMain.removeHandler as jest.Mock;

      ipcHandlers.removeHandlers();

      expect(mockRemoveHandler).toHaveBeenCalledWith('accounts:getAll');
      expect(mockRemoveHandler).toHaveBeenCalledWith('accounts:getById');
      expect(mockRemoveHandler).toHaveBeenCalledWith('accounts:create');
      expect(mockRemoveHandler).toHaveBeenCalledWith('accounts:update');
      expect(mockRemoveHandler).toHaveBeenCalledWith('accounts:delete');

      expect(mockRemoveHandler).toHaveBeenCalledWith('transactions:getAll');
      expect(mockRemoveHandler).toHaveBeenCalledWith('transactions:getByAccount');
      expect(mockRemoveHandler).toHaveBeenCalledWith('transactions:create');
      expect(mockRemoveHandler).toHaveBeenCalledWith('transactions:update');
      expect(mockRemoveHandler).toHaveBeenCalledWith('transactions:delete');

      expect(mockRemoveHandler).toHaveBeenCalledWith('categories:getAll');
      expect(mockRemoveHandler).toHaveBeenCalledWith('categories:getById');
      expect(mockRemoveHandler).toHaveBeenCalledWith('categories:create');
      expect(mockRemoveHandler).toHaveBeenCalledWith('categories:update');
      expect(mockRemoveHandler).toHaveBeenCalledWith('categories:delete');
    });
  });

  describe('Handler Functionality', () => {
    // eslint-disable-next-line @typescript-eslint/ban-types
    let getHandler: (channel: string) => Function | undefined;

    beforeEach(() => {
      const mockHandle = ipcMain.handle as jest.Mock;

      // Helper to get a registered handler
      getHandler = (channel: string) => {
        const call = mockHandle.mock.calls.find((call) => call[0] === channel);
        return call ? call[1] : undefined;
      };
    });

    describe('Account Handlers', () => {
      it('should handle accounts:getAll', async () => {
        const handler = getHandler('accounts:getAll');
        expect(handler).toBeDefined();

        const result = await handler!(mockEvent);
        expect(Array.isArray(result)).toBe(true);
      });

      it('should handle accounts:create', async () => {
        const handler = getHandler('accounts:create');
        expect(handler).toBeDefined();

        const account = {
          name: 'Test Account',
          type: 'checking' as const,
          institution: 'Test Bank',
          balance: 1000,
          lastSynced: null,
        };

        const result = await handler!(mockEvent, account);
        expect(result.id).toBeDefined();
        expect(result.name).toBe('Test Account');
      });
    });

    describe('Transaction Handlers', () => {
      it('should handle transactions:getAll', async () => {
        const handler = getHandler('transactions:getAll');
        expect(handler).toBeDefined();

        const result = await handler!(mockEvent);
        expect(Array.isArray(result)).toBe(true);
      });

      it('should handle transactions:create', async () => {
        // First create an account
        const accountHandler = getHandler('accounts:create');
        const account = await accountHandler!(mockEvent, {
          name: 'Test Account',
          type: 'checking' as const,
          institution: 'Test Bank',
          balance: 1000,
          lastSynced: null,
        });

        const handler = getHandler('transactions:create');
        expect(handler).toBeDefined();

        const transaction = {
          accountId: account.id,
          date: new Date('2026-01-15'),
          description: 'Test Transaction',
          amount: -50.00,
          categoryId: null,
          isRecurring: false,
          importSource: 'file' as const,
        };

        const result = await handler!(mockEvent, transaction);
        expect(result.id).toBeDefined();
        expect(result.description).toBe('Test Transaction');
      });
    });

    describe('Category Handlers', () => {
      it('should handle categories:getAll', async () => {
        const handler = getHandler('categories:getAll');
        expect(handler).toBeDefined();

        const result = await handler!(mockEvent);
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0); // Should have default categories
      });

      it('should handle categories:create', async () => {
        const handler = getHandler('categories:create');
        expect(handler).toBeDefined();

        const category = {
          name: 'Custom Category',
          type: 'expense' as const,
          icon: '🎯',
          color: '#FF5733',
          isDefault: false,
          parentId: null,
        };

        const result = await handler!(mockEvent, category);
        expect(result.id).toBeDefined();
        expect(result.name).toBe('Custom Category');
      });
    });
  });
});
