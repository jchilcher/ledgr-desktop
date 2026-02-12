# Changelog

All notable changes to Ledgr will be documented in this file.

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
