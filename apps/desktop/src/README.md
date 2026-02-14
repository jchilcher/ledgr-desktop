# Desktop Application Source

## Architecture

The application uses Electron's process isolation model with three layers:

- **Main process** (`main/`): Node.js process with full system access. Owns the SQLite database, file system operations, and all business logic engines.
- **Renderer process** (`renderer/`): Chromium-sandboxed React frontend. No direct access to Node.js APIs or the database.
- **Shared** (`shared/`): Type definitions and API declarations used by both processes.

All communication between renderer and main uses Electron IPC via `contextBridge`.

## IPC Contract (Three-File Invariant)

Adding or modifying an IPC channel requires updating three files in sync:

1. **`main/ipc-handlers.ts`** — Register the `ipcMain.handle()` handler
2. **`main/preload.ts`** — Expose the method to the renderer via `contextBridge.exposeInMainWorld`
3. **`shared/window.d.ts`** — Add the TypeScript declaration so the renderer can call `window.electron.<method>()`

If any of the three files diverge, the result is either a runtime error (method not found) or a TypeScript error (type mismatch). The renderer calls `window.electron.*` methods, which are typed by `window.d.ts` and implemented by the preload-to-IPC bridge.

## Design Decisions

- **No `nodeIntegration`**: The renderer has `contextIsolation: true` and `nodeIntegration: false`. All Node.js functionality is proxied through the preload script. This is a security boundary.
- **Single instance lock**: Only one app instance can run at a time because SQLite does not support concurrent write access from multiple processes.
- **WSL2 GPU workaround**: Hardware acceleration is disabled in dev mode on Linux to avoid blank screens under WSL2.
- **Build order**: `@ledgr/core` must build before `@ledgr/db`, which must build before `@ledgr/desktop`. The root `build` script enforces this order.
