# Changelog

All notable changes to Ledgr will be documented in this file.

## [1.0.2] - 2026-02-15

### Added

- **Safe to Spend** — New dashboard widget showing how much discretionary money remains after accounting for balances, upcoming bills, savings commitments, and budget spending, color-coded by health status.
- **Age of Money** — New dashboard widget displaying how many days old your spending money is, with month-over-month trend comparison.
- **What-If Mode for Cash Flow Forecast** — Toggle what-if mode directly from the forecast view to model scenario changes (pause expenses, cut category spending, add income) with a dashed overlay on the chart and an impact summary comparing original vs. modified projections.
- **Tax Lot Reports** — Generate capital gains reports by tax year with short-term vs. long-term classification, wash sale detection, and CSV export.
- **Paycheck budgeting** — New budgeting mode that allocates portions of each income stream to recurring bills, budget categories, and savings goals with an unallocated remainder view.
- **Enhanced automation rules** — Automation rules now support additional actions (auto-tag, hide from reports, mark as transfer) and new filter conditions (amount range, account, direction).
- **"All Types" sharing rules** — Sharing defaults now support an "All Types" option that applies to every entity type at once.
- **Edit sharing rules** — Existing sharing rules can now be edited in-place (entity type and permissions) instead of requiring remove and re-add.
- **Financial health score metrics** — Each health score factor now shows current vs. target values with units for a concrete view of where you stand.
- **Pre-migration database backup** — Automatically backs up the database (including WAL/SHM files) before schema or data migrations run on app update, preventing data loss from buggy migrations.

### Fixed

- **Encrypted data in analytics** — Spending, income, trends, and all engine-driven analytics now decrypt data before computing, producing correct results for encrypted households instead of operating on ciphertext.
- **Session state on startup** — Password change, sharing rules, and shared data visibility all failed until lock/unlock because the main process user session was not initialized during startup unlock.
- **Biweekly recurring dates off by one day** — Biweekly (and other recurring) payments displayed one day early in western-hemisphere timezones due to UTC midnight dates converting to the previous local day. Fixed the core date-advance function and date-only string parsing across forecast and recurring views.
- **NaN in currency displays** — Currency formatting now guards against null, undefined, and NaN values across Dashboard, Cash Flow Forecast, and Bill Calendar.
- **Lock screen user resolution** — Unlock flow now correctly resolves the authenticated user ID from the unlock result instead of always using the pre-selected member.
- **Decryption fallback safety** — Failed field decryptions now default to empty string or zero instead of silently leaving ciphertext in place, with warnings logged.
- **Seasonal pattern NaN safety** — Seasonal analysis guards against NaN/Infinity values before persisting to the database.

### Changed

- **Investments** — Tabbed interface with Holdings and Tax Reports tabs.
- **Legal documents** — Governing law jurisdiction updated from Oregon to Arizona; corrected GitHub Issues links.

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
