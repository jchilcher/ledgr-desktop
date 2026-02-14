# Changelog

All notable changes to Ledgr will be documented in this file.

## [1.0.1] - 2026-02-13

### Fixed

- **Password protection** — App closed immediately after entering password on startup instead of opening the main window.
- **Lock screen** — Users without a password saw a password prompt they couldn't get past; now shows a direct Unlock button instead.

### Added

- **Sidebar navigation** — Collapsible sidebar replaces top navigation bar for cleaner layout and easier access to all sections.
- **Analytics hub** — New unified "Analytics" section replaces separate "Reports" and "Insights" pages, with a tool-picker landing and first-run tutorials.
- **Month in Review** — Monthly spending summary with top categories, income vs. expenses, and category breakdown.
- **Year in Review** — Annual financial summary with month-over-month trends.
- **Sankey diagram** — Income-to-expense flow visualization powered by d3-sankey.
- **Transaction review queue** — Card and list modes for quickly categorizing uncategorized transactions.
- **Transaction attachments** — Attach receipts, invoices, and documents (images, PDFs, spreadsheets) to transactions.
- **Chart export** — Export any SVG chart as PNG or copy to clipboard.
- **Bank export guide** — Step-by-step instructions for exporting data from popular banks.
- **Household & multi-user** — HouseholdContext, HouseholdSettings, OwnershipSelector, ShareDialog, and PrivacySettings for per-user encryption and selective data sharing.
- **Encryption engine** — Per-user AES-256-GCM encryption with PBKDF2-derived keys and RSA-2048-OAEP keypairs for household sharing (crypto-engine, session-keys, encryption-middleware).
- **Tutorial overlay** — Contextual first-run walkthroughs for analytics tools.

### Changed

- **Reports** — Merged "Cash Flow" and "Cash Flow Forecast" into a single "Cash Flow" tab with sub-tabs for Forecast and Flow Diagram.
- **Navigation** — Consolidated view types; legacy routes (`reports`, `insights`, `import`, `rules`) redirect to new locations.
- **Dashboard** — Enhanced layout and widget set.
- **Budget goals** — Expanded goal tracking UI with additional configuration options.
- **Bill calendar** — Improved calendar layout and interaction.
- **Category manager** — Extended category management features.
- **Password settings** — Rewritten for per-user encryption model.
- **Lock screen** — Updated to support multi-user authentication.

### Removed

- **InsightsLanding** — Replaced by AnalyticsLanding.
- **security.ts** — App-level password module replaced by per-user encryption engine.

## [1.0.0] - 2026-02-12

Initial public release.

### Features

- **Transaction management** — Import from CSV, OFX/QFX, or enter manually. Duplicate detection, bulk categorization, and split transactions.
- **Smart categorization** — 550+ built-in rules with pattern matching, priority system, and learning from corrections.
- **Budget goals** — Set per-category budgets (weekly/monthly/yearly) with rollover support, spending alerts, and income allocation tracking.
- **Cash flow forecasting** — Project balances up to 5 years with confidence intervals, category trend overlays, and seasonal adjustment.
- **Recurring detection** — Automatically identify subscriptions, bills, and recurring income with payment tracking and reminders.
- **Investment tracking** — Manage holdings with tax lot cost basis, buy/sell/dividend transactions, and brokerage CSV import (Fidelity, Schwab, Vanguard, E-Trade).
- **Live prices** — Real-time quotes via Yahoo Finance with offline fallback and manual override.
- **Performance analytics** — Time-weighted and money-weighted returns, S&P 500 benchmark comparison, realized/unrealized gain tracking.
- **Net worth** — Track bank accounts, investments, manual assets, and liabilities with historical snapshots, projections, and debt payoff calculators.
- **Savings goals** — Set targets with optional account pinning, contribution tracking, milestone alerts, and projection scenarios.
- **Reports & insights** — Spending velocity, seasonal patterns, anomaly detection, subscription audit, financial health score, income analysis, category migration, and month-over-month/year-over-year comparisons.
- **Privacy first** — All data stored locally in SQLite. No cloud, no telemetry, no account registration.
- **Password protection** — Optional AES-256-GCM database encryption with auto-lock.
- **Cross-platform** — Windows (NSIS + MSI), macOS (DMG), and Linux (AppImage + DEB) installers with auto-update via GitHub Releases.
