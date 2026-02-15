# Privacy Policy

**Effective Date:** February 2026
**Last Updated:** February 2026

Ledgr is a privacy-focused budget tracking application. This policy describes how your data is handled.

**Data Controller:** Johnathen Chilcher / Techloom.it LLC
**Contact:** [privacy@techloom.it](mailto:privacy@techloom.it)

## Data We Collect

### Local Financial Data

All financial data you enter (accounts, transactions, budgets, investments, etc.) is stored **locally on your device** in an encrypted SQLite database. This data never leaves your device unless you explicitly export it. Optional AES-256-GCM encryption is available to protect your database at rest.

### Yahoo Finance API (Price Data)

When you add investment holdings with ticker symbols, Ledgr sends those **ticker symbols only** to the Yahoo Finance API to retrieve current market prices. No personal or financial data is transmitted. Price data is cached locally for 15-60 minutes to minimize external requests. These requests are user-initiated only.

### OFX Direct Connect (Bank Sync)

If you use the bank sync feature, your banking credentials are sent **directly to your bank's OFX server**. Ledgr does not act as an intermediary and does not store, log, or transmit your banking credentials to any third party.

### Auto-Updater

Ledgr periodically makes an anonymous request to the GitHub Releases API to check for new versions. No personal or device-identifying information is sent with this request.

## Data We Do NOT Collect

- No analytics or telemetry
- No crash reporting
- No cloud sync or remote storage
- No user accounts or registration
- No advertising or tracking
- No cookies or web beacons

## Your Rights (GDPR)

Even though Ledgr stores all data locally, we respect your data rights:

- **Access:** You can view all your data directly in the app, or export it via Settings.
- **Erasure:** Delete your database file to permanently remove all data. Uninstalling the app also removes all data.
- **Portability:** Export your data in CSV or JSON format at any time via Settings > Data Export.
- **Rectification:** Edit any data directly within the app.

## Data Retention

- **Financial data:** Stored locally until you delete it or uninstall the app.
- **Price cache:** Automatically expires after 15-60 minutes.
- **No server-side retention:** Ledgr has no servers and retains no data remotely.

## Data Security

Your data is protected by your device's security. Optional database encryption (AES-256-GCM) and password protection are available within the app. You are responsible for:

- Keeping your device secure
- Managing your database password
- Maintaining backups of your data

## Children's Privacy

Ledgr is not directed at children under 13. We do not knowingly collect data from children.

## Third-Party Services

| Service | Data Sent | Purpose |
|---------|-----------|---------|
| Yahoo Finance API | Ticker symbols only | Market price lookup |
| Bank OFX servers | Banking credentials (direct) | Transaction sync |
| GitHub Releases API | Anonymous version check | Auto-update |

These services are subject to their own privacy policies.

## Changes to This Policy

We may update this policy from time to time. Changes will be posted to this file in the repository and noted in the changelog.

## Contact

- **Privacy inquiries:** [privacy@techloom.it](mailto:privacy@techloom.it)
- **General support:** [support@techloom.it](mailto:support@techloom.it)
- **GitHub Issues:** [github.com/jchilcher/ledgr-desktop/issues](https://github.com/jchilcher/ledgr-desktop/issues)
