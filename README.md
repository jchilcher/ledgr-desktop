# Ledgr

**Budget smarter, stress less.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![Latest Release](https://img.shields.io/github/v/release/jchilcher/ledgr-desktop)](https://github.com/jchilcher/ledgr-desktop/releases/latest)

A privacy-focused desktop application for budget tracking and forecasting. All your financial data stays on your machine — no cloud, no telemetry, no third-party data sharing.

**[Download the latest release](https://github.com/jchilcher/ledgr-desktop/releases/latest)**

## Features

- **Transaction tracking** — Record and manage income and expenses across multiple accounts
- **Smart categorization** — Organize transactions with customizable categories and rules
- **Budget forecasting** — Project future balances with the forecast engine
- **OFX & CSV import** — Import bank statements in standard formats

- **Net worth tracking** — Monitor assets and liabilities over time with brokerage statement parsing
- **Recurring detection** — Automatically identify recurring transactions and subscriptions
- **Encryption** — Protect sensitive data with local encryption
- **Multi-window support** — Work with multiple views side by side

## Privacy

Ledgr is built with privacy as a core principle:

- All data is stored locally in a SQLite database on your machine
- No cloud sync, no analytics, no telemetry
- No account registration required
- No third-party services or API keys required

## Tech Stack

- **Framework**: Electron
- **Frontend**: React + TypeScript
- **Database**: SQLite (better-sqlite3)
- **Charts**: Chart.js


## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

This will start both the Vite dev server and Electron.

### Testing

```bash
# Run unit and integration tests
npm test

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all

# Lint code
npm run lint
npm run lint:fix
```

### Build

```bash
npm run build
```

### Start Production Build

```bash
npm start
```

## Project Structure

```
ledgr/
├── apps/
│   └── desktop/          # Electron desktop application
│       └── src/
│           ├── main/     # Main process (database, IPC, services)
│           ├── renderer/ # React frontend (components, pages, hooks)
│           └── shared/   # Shared types and utilities
├── packages/
│   └── core/             # Shared business logic (engines, parsers, services)
├── tests/
│   ├── e2e/              # Playwright E2E tests
│   └── fixtures/         # Test data and fixtures
└── package.json          # Monorepo workspace configuration
```

## Support

If you find Ledgr useful, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/jchilcher)

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for guidelines on reporting bugs, suggesting features, and submitting pull requests.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). This means you are free to use, modify, and distribute this software, but any modified versions must also be made available under the same license. If you run a modified version on a server, you must make the source code available to users of that server.
