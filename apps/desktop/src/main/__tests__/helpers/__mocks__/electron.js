const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn().mockResolvedValue(undefined),
  loadFile: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  once: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  close: jest.fn(),
  destroy: jest.fn(),
  webContents: {
    send: jest.fn(),
    on: jest.fn(),
    session: {
      clearCache: jest.fn().mockResolvedValue(undefined),
      clearStorageData: jest.fn().mockResolvedValue(undefined),
    },
  },
  isDestroyed: jest.fn().mockReturnValue(false),
  setMenu: jest.fn(),
}));

mockBrowserWindow.getAllWindows = jest.fn().mockReturnValue([]);
mockBrowserWindow.getFocusedWindow = jest.fn().mockReturnValue(null);

module.exports = {
  app: {
    getPath: jest.fn().mockReturnValue('/tmp'),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
    getName: jest.fn().mockReturnValue('ledgr'),
    on: jest.fn(),
    once: jest.fn(),
    quit: jest.fn(),
    exit: jest.fn(),
    whenReady: jest.fn().mockResolvedValue(undefined),
    requestSingleInstanceLock: jest.fn().mockReturnValue(true),
    disableHardwareAcceleration: jest.fn(),
    isPackaged: false,
  },
  BrowserWindow: mockBrowserWindow,
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: jest.fn().mockResolvedValue({ canceled: true, filePath: undefined }),
    showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  },
  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined),
    openPath: jest.fn().mockResolvedValue(''),
  },
  session: {
    defaultSession: {
      clearCache: jest.fn().mockResolvedValue(undefined),
      clearStorageData: jest.fn().mockResolvedValue(undefined),
      webRequest: {
        onHeadersReceived: jest.fn(),
      },
    },
  },
  Menu: {
    buildFromTemplate: jest.fn().mockReturnValue({
      popup: jest.fn(),
    }),
    setApplicationMenu: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
    removeListener: jest.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn().mockReturnValue(false),
    encryptString: jest.fn().mockReturnValue(Buffer.from('encrypted')),
    decryptString: jest.fn().mockReturnValue('decrypted'),
  },
};
