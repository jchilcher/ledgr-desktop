import { useState, useEffect } from 'react';

interface BankInfo {
  id: string;
  name: string;
  ofxUrl: string;
  org: string;
  fid: string;
}

interface OFXAccount {
  accountId: string;
  accountType: string;
}

interface OFXConnectWizardProps {
  onSuccess: (accounts: { name: string; accountId: string; type: string }[]) => void;
  onCancel: () => void;
}

type WizardStep = 'select-bank' | 'credentials' | 'select-accounts' | 'connecting' | 'success' | 'error' | 'security-info';

export function OFXConnectWizard({ onSuccess, onCancel }: OFXConnectWizardProps) {
  const [step, setStep] = useState<WizardStep>('select-bank');
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accounts, setAccounts] = useState<OFXAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [previousStep, setPreviousStep] = useState<WizardStep>('select-bank');
  const [manualBank, setManualBank] = useState({
    name: '',
    ofxUrl: '',
    org: '',
    fid: '',
  });

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      const allBanks = await window.api.ofx.getBanks();
      setBanks(allBanks);
    } catch (err) {
      console.error('Failed to load banks:', err);
    }
  };

  const filteredBanks = searchQuery
    ? banks.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : banks;

  const handleBankSelect = (bank: BankInfo) => {
    setSelectedBank(bank);
    setStep('credentials');
  };

  const handleManualBankSubmit = () => {
    if (!manualBank.name || !manualBank.ofxUrl || !manualBank.org || !manualBank.fid) {
      setError('Please fill in all fields');
      return;
    }
    setSelectedBank({
      id: 'custom',
      ...manualBank,
    });
    setStep('credentials');
  };

  const handleConnect = async () => {
    if (!selectedBank || !username || !password) return;

    setStep('connecting');
    setError(null);

    try {
      const result = await window.api.ofx.testConnection(selectedBank.id, username, password);

      if (!result.success) {
        setError(result.error || 'Connection failed');
        setStep('error');
        return;
      }

      if (result.accounts && result.accounts.length > 0) {
        setAccounts(result.accounts);
        setSelectedAccounts(new Set(result.accounts.map(a => a.accountId)));
        setStep('select-accounts');
      } else {
        setError('No accounts found. Please check your credentials.');
        setStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStep('error');
    }
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleFinish = async () => {
    if (!selectedBank || selectedAccounts.size === 0) return;

    setStep('connecting');

    try {
      const accountsToCreate = accounts
        .filter(a => selectedAccounts.has(a.accountId))
        .map(a => ({
          name: `${selectedBank.name} - ${a.accountType} (${a.accountId.slice(-4)})`,
          accountId: a.accountId,
          type: a.accountType.toLowerCase(),
        }));

      // Save connection info and create accounts
      for (const acct of accountsToCreate) {
        await window.api.ofx.saveConnection({
          bankId: selectedBank.id,
          bankName: selectedBank.name,
          ofxUrl: selectedBank.ofxUrl,
          org: selectedBank.org,
          fid: selectedBank.fid,
          username,
          accountId: acct.accountId,
          accountType: acct.type,
        });
      }

      setStep('success');
      setTimeout(() => {
        onSuccess(accountsToCreate);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save accounts');
      setStep('error');
    }
  };

  const accountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CHECKING: 'Checking Account',
      SAVINGS: 'Savings Account',
      CREDITCARD: 'Credit Card',
      MONEYMRKT: 'Money Market',
      CREDITLINE: 'Line of Credit',
    };
    return labels[type] || type;
  };

  return (
    <div className="ofx-wizard-overlay" onClick={onCancel}>
      <div className="ofx-wizard" onClick={e => e.stopPropagation()}>
        <div className="ofx-wizard-header">
          <h2>Connect Your Bank</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="ofx-wizard-content">
          {/* Step 1: Select Bank */}
          {step === 'select-bank' && (
            <div className="wizard-step">
              <p className="step-description">
                OFX Direct Connect lets you securely download transactions directly from your bank.
                Your credentials are sent directly to your bank - never stored on any third-party servers.
                {' '}
                <button
                  type="button"
                  className="security-link"
                  onClick={() => { setPreviousStep('select-bank'); setStep('security-info'); }}
                >
                  Learn how your data is protected
                </button>
              </p>

              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search for your bank..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="bank-list">
                {filteredBanks.map(bank => (
                  <button
                    key={bank.id}
                    className="bank-item"
                    onClick={() => handleBankSelect(bank)}
                  >
                    <span className="bank-name">{bank.name}</span>
                    <span className="bank-arrow">→</span>
                  </button>
                ))}
                {filteredBanks.length === 0 && searchQuery && (
                  <p className="no-results">No banks found matching &quot;{searchQuery}&quot;</p>
                )}
              </div>

              <div className="manual-entry-section">
                <button
                  className="link-btn"
                  onClick={() => setShowManualEntry(!showManualEntry)}
                >
                  {showManualEntry ? 'Hide manual entry' : "Can&apos;t find your bank? Enter details manually"}
                </button>

                {showManualEntry && (
                  <div className="manual-entry-form">
                    <p className="help-text">
                      Find your bank&apos;s OFX settings at{' '}
                      <a href="https://www.ofxhome.com/" target="_blank" rel="noopener noreferrer">
                        ofxhome.com
                      </a>
                    </p>
                    <div className="form-group">
                      <label>Bank Name</label>
                      <input
                        type="text"
                        placeholder="My Bank"
                        value={manualBank.name}
                        onChange={e => setManualBank({ ...manualBank, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>OFX URL</label>
                      <input
                        type="text"
                        placeholder="https://ofx.mybank.com/ofx"
                        value={manualBank.ofxUrl}
                        onChange={e => setManualBank({ ...manualBank, ofxUrl: e.target.value })}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>ORG</label>
                        <input
                          type="text"
                          placeholder="MyBank"
                          value={manualBank.org}
                          onChange={e => setManualBank({ ...manualBank, org: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>FID</label>
                        <input
                          type="text"
                          placeholder="12345"
                          value={manualBank.fid}
                          onChange={e => setManualBank({ ...manualBank, fid: e.target.value })}
                        />
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleManualBankSubmit}>
                      Continue
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Enter Credentials */}
          {step === 'credentials' && selectedBank && (
            <div className="wizard-step">
              <button className="back-btn" onClick={() => setStep('select-bank')}>
                ← Back
              </button>

              <h3>{selectedBank.name}</h3>
              <p className="step-description">
                Enter your online banking credentials. These are sent directly to {selectedBank.name}&apos;s
                servers via HTTPS - no third parties involved.
              </p>

              <div className="credentials-form">
                <div className="form-group">
                  <label>Username / User ID</label>
                  <input
                    type="text"
                    placeholder="Your online banking username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Your online banking password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>

                <div className="security-note">
                  <span className="icon">🔒</span>
                  <div className="security-note-content">
                    <strong>Your password is never stored.</strong> You&apos;ll enter it each time you sync.
                    <br />
                    <button
                      type="button"
                      className="security-link"
                      onClick={() => { setPreviousStep('credentials'); setStep('security-info'); }}
                    >
                      How is my data protected?
                    </button>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleConnect}
                  disabled={!username || !password}
                >
                  Connect to {selectedBank.name}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Select Accounts */}
          {step === 'select-accounts' && (
            <div className="wizard-step">
              <h3>Select Accounts</h3>
              <p className="step-description">
                Choose which accounts you want to track in Ledgr.
              </p>

              <div className="account-list">
                {accounts.map(account => (
                  <label key={account.accountId} className="account-item">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.has(account.accountId)}
                      onChange={() => handleAccountToggle(account.accountId)}
                    />
                    <div className="account-info">
                      <span className="account-type">{accountTypeLabel(account.accountType)}</span>
                      <span className="account-id">···{account.accountId.slice(-4)}</span>
                    </div>
                  </label>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={handleFinish}
                disabled={selectedAccounts.size === 0}
              >
                Add {selectedAccounts.size} Account{selectedAccounts.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}

          {/* Connecting State */}
          {step === 'connecting' && (
            <div className="wizard-step centered">
              <div className="spinner"></div>
              <p>Connecting to your bank...</p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <div className="wizard-step centered">
              <div className="success-icon">✓</div>
              <h3>Connected!</h3>
              <p>Your accounts have been added successfully.</p>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="wizard-step">
              <div className="error-icon">✕</div>
              <h3>Connection Failed</h3>
              <p className="error-message">{error}</p>

              <div className="enable-ofx-notice">
                <h4>OFX/Direct Connect May Need to Be Enabled</h4>
                <p>
                  Most banks require you to <strong>enable Direct Connect</strong> before it will work.
                  This is a one-time setup in your online banking account.
                </p>
                <div className="enable-steps">
                  <div className="enable-step">
                    <span className="step-number">1</span>
                    <span>Log into your bank&apos;s website</span>
                  </div>
                  <div className="enable-step">
                    <span className="step-number">2</span>
                    <span>Find &quot;Direct Connect&quot;, &quot;Quicken&quot;, or &quot;Account Services&quot; settings</span>
                  </div>
                  <div className="enable-step">
                    <span className="step-number">3</span>
                    <span>Enable Direct Connect and create a Direct Connect password if prompted</span>
                  </div>
                  <div className="enable-step">
                    <span className="step-number">4</span>
                    <span>Or call your bank and ask them to enable &quot;Direct Connect&quot; or &quot;Quicken access&quot;</span>
                  </div>
                </div>
              </div>

              <details className="troubleshooting">
                <summary>More Troubleshooting Tips</summary>
                <ul>
                  <li>Verify your username and password are correct</li>
                  <li>Some banks use a <strong>separate password</strong> for Direct Connect (not your web login password)</li>
                  <li>Make sure you&apos;re using your online banking credentials (not ATM PIN)</li>
                  <li>Try logging into your bank&apos;s website to ensure your account isn&apos;t locked</li>
                  <li>Some banks have discontinued OFX support - check with your bank</li>
                  <li><strong>Alternative:</strong> Download transactions as QFX/OFX file from your bank&apos;s website and import manually</li>
                </ul>
              </details>

              <div className="error-actions">
                <button className="btn btn-secondary" onClick={() => setStep('credentials')}>
                  Try Again
                </button>
                <button className="btn btn-secondary" onClick={() => setStep('select-bank')}>
                  Choose Different Bank
                </button>
              </div>
            </div>
          )}

          {/* Security Info */}
          {step === 'security-info' && (
            <div className="wizard-step">
              <button className="back-btn" onClick={() => setStep(previousStep)}>
                ← Back
              </button>

              <h3>Security & Privacy</h3>

              <div className="security-info-section">
                <h4>How OFX Direct Connect Works</h4>
                <p>
                  OFX (Open Financial Exchange) is a standard protocol used by banks for secure data transfer.
                  When you connect, your credentials are sent <strong>directly to your bank&apos;s servers</strong> over
                  an encrypted HTTPS connection - the same security used when you log into your bank&apos;s website.
                </p>

                <div className="security-diagram">
                  <div className="diagram-item">
                    <span className="diagram-icon">💻</span>
                    <span>Your Computer</span>
                  </div>
                  <div className="diagram-arrow">→ HTTPS →</div>
                  <div className="diagram-item">
                    <span className="diagram-icon">🏦</span>
                    <span>Your Bank</span>
                  </div>
                </div>
                <p className="diagram-caption">
                  No third-party servers. No data aggregators. Direct connection only.
                </p>
              </div>

              <div className="security-info-section">
                <h4>What We Store</h4>
                <table className="security-table">
                  <tbody>
                    <tr>
                      <td><strong>Username</strong></td>
                      <td>Stored locally on your device only</td>
                    </tr>
                    <tr>
                      <td><strong>Password</strong></td>
                      <td className="highlight-safe">NEVER stored - you enter it each sync</td>
                    </tr>
                    <tr>
                      <td><strong>Transactions</strong></td>
                      <td>Stored locally in encrypted SQLite database</td>
                    </tr>
                    <tr>
                      <td><strong>Bank Connection Info</strong></td>
                      <td>OFX URL, bank identifiers (non-sensitive)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="security-info-section">
                <h4>What We Never Do</h4>
                <ul className="never-list">
                  <li>Send your data to third-party servers</li>
                  <li>Store your banking password anywhere</li>
                  <li>Share your financial data with anyone</li>
                  <li>Use data aggregators like Plaid, Yodlee, or Finicity</li>
                </ul>
              </div>

              <div className="security-info-section">
                <h4>Verify This Yourself</h4>
                <p>
                  Ledgr is open source. You can inspect exactly what the code does:
                </p>
                <ul className="verify-list">
                  <li>
                    <a href="https://github.com/your-repo/ledgr/blob/main/apps/desktop/src/main/ofx-direct-connect.ts" target="_blank" rel="noopener noreferrer">
                      OFX Connection Code
                    </a>
                    {' '}- See how credentials are sent to banks
                  </li>
                  <li>
                    <a href="https://github.com/your-repo/ledgr/blob/main/apps/desktop/src/main/ipc-handlers.ts" target="_blank" rel="noopener noreferrer">
                      IPC Handlers
                    </a>
                    {' '}- See that passwords are never persisted
                  </li>
                  <li>
                    <a href="https://github.com/your-repo/ledgr/blob/main/apps/desktop/src/main/database.ts" target="_blank" rel="noopener noreferrer">
                      Database Schema
                    </a>
                    {' '}- See exactly what fields are stored
                  </li>
                </ul>
              </div>

              <div className="security-info-section">
                <h4>Learn More About OFX</h4>
                <ul className="resource-list">
                  <li>
                    <a href="https://www.ofx.net/" target="_blank" rel="noopener noreferrer">
                      OFX.net
                    </a>
                    {' '}- Official OFX specification
                  </li>
                  <li>
                    <a href="https://www.ofxhome.com/" target="_blank" rel="noopener noreferrer">
                      OFXHome.com
                    </a>
                    {' '}- Community database of bank OFX settings
                  </li>
                  <li>
                    <a href="https://en.wikipedia.org/wiki/Open_Financial_Exchange" target="_blank" rel="noopener noreferrer">
                      Wikipedia: Open Financial Exchange
                    </a>
                  </li>
                </ul>
              </div>

              <button className="btn btn-primary" onClick={() => setStep(previousStep)}>
                {previousStep === 'credentials' ? 'Continue with Login' : 'Back to Bank Selection'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ofx-wizard-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .ofx-wizard {
          background: var(--color-surface, #fff);
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .ofx-wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border, #e0e0e0);
        }

        .ofx-wizard-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--color-text-muted, #666);
        }

        .ofx-wizard-content {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .wizard-step {
          animation: fadeIn 0.2s ease;
        }

        .wizard-step.centered {
          text-align: center;
          padding: 40px 20px;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .step-description {
          color: var(--color-text-muted, #666);
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .search-box {
          margin-bottom: 16px;
        }

        .search-box input {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--color-border, #e0e0e0);
          border-radius: 8px;
          font-size: 16px;
        }

        .bank-list {
          max-height: 250px;
          overflow-y: auto;
          border: 1px solid var(--color-border, #e0e0e0);
          border-radius: 8px;
        }

        .bank-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: 12px 16px;
          border: none;
          border-bottom: 1px solid var(--color-border, #e0e0e0);
          background: none;
          cursor: pointer;
          text-align: left;
        }

        .bank-item:last-child {
          border-bottom: none;
        }

        .bank-item:hover {
          background: var(--color-hover, #f5f5f5);
        }

        .bank-arrow {
          color: var(--color-text-muted, #666);
        }

        .no-results {
          padding: 20px;
          text-align: center;
          color: var(--color-text-muted, #666);
        }

        .manual-entry-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--color-border, #e0e0e0);
        }

        .link-btn {
          background: none;
          border: none;
          color: var(--color-primary, #007bff);
          cursor: pointer;
          padding: 0;
          font-size: 14px;
        }

        .link-btn:hover {
          text-decoration: underline;
        }

        .manual-entry-form {
          margin-top: 16px;
        }

        .help-text {
          font-size: 13px;
          color: var(--color-text-muted, #666);
          margin-bottom: 16px;
        }

        .help-text a {
          color: var(--color-primary, #007bff);
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
        }

        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--color-border, #e0e0e0);
          border-radius: 6px;
          font-size: 14px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .back-btn {
          background: none;
          border: none;
          color: var(--color-primary, #007bff);
          cursor: pointer;
          padding: 0;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .credentials-form h3 {
          margin-top: 0;
        }

        .security-note {
          display: flex;
          gap: 10px;
          padding: 12px;
          background: var(--color-success-bg, #e8f5e9);
          border-radius: 8px;
          margin: 20px 0;
          font-size: 13px;
          color: var(--color-success, #2e7d32);
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          width: 100%;
        }

        .btn-primary {
          background: var(--color-primary, #007bff);
          color: white;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--color-border, #e0e0e0);
          color: var(--color-text, #333);
        }

        .account-list {
          margin: 20px 0;
        }

        .account-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--color-border, #e0e0e0);
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
        }

        .account-item:hover {
          background: var(--color-hover, #f5f5f5);
        }

        .account-info {
          display: flex;
          flex-direction: column;
        }

        .account-type {
          font-weight: 500;
        }

        .account-id {
          font-size: 13px;
          color: var(--color-text-muted, #666);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--color-border, #e0e0e0);
          border-top-color: var(--color-primary, #007bff);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .success-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--color-success, #4caf50);
          color: white;
          font-size: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .error-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--color-danger, #f44336);
          color: white;
          font-size: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .error-message {
          color: var(--color-danger, #f44336);
          margin-bottom: 20px;
        }

        .enable-ofx-notice {
          background: #fff8e1;
          border: 1px solid #ffb300;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .enable-ofx-notice h4 {
          margin: 0 0 8px 0;
          color: #e65100;
          font-size: 14px;
        }

        .enable-ofx-notice p {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: #5d4037;
          line-height: 1.5;
        }

        .enable-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .enable-step {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #5d4037;
        }

        .step-number {
          width: 22px;
          height: 22px;
          background: #ff9800;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .troubleshooting {
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          margin-bottom: 20px;
          color: #333;
        }

        .troubleshooting summary {
          padding: 12px 16px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          color: #333;
        }

        .troubleshooting summary:hover {
          background: #eeeeee;
        }

        .troubleshooting[open] summary {
          border-bottom: 1px solid #e0e0e0;
        }

        .troubleshooting ul {
          margin: 0;
          padding: 16px 16px 16px 36px;
        }

        .troubleshooting li {
          margin-bottom: 8px;
          font-size: 13px;
          color: #555;
          line-height: 1.5;
        }

        .troubleshooting li:last-child {
          margin-bottom: 0;
        }

        .error-actions {
          display: flex;
          gap: 12px;
        }

        .error-actions .btn {
          flex: 1;
        }

        .security-link {
          background: none;
          border: none;
          color: var(--color-primary, #007bff);
          cursor: pointer;
          padding: 0;
          font-size: 13px;
          text-decoration: underline;
        }

        .security-note-content {
          line-height: 1.6;
        }

        .security-info-section {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--color-border, #e0e0e0);
        }

        .security-info-section:last-of-type {
          border-bottom: none;
        }

        .security-info-section h4 {
          margin: 0 0 12px 0;
          font-size: 15px;
          color: var(--color-text, #333);
        }

        .security-info-section p {
          margin: 0 0 12px 0;
          font-size: 13px;
          line-height: 1.6;
          color: var(--color-text-muted, #666);
        }

        .security-diagram {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 20px;
          background: var(--color-surface-alt, #f8f9fa);
          border-radius: 8px;
          margin: 16px 0;
        }

        .diagram-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
        }

        .diagram-icon {
          font-size: 32px;
        }

        .diagram-arrow {
          font-size: 12px;
          color: var(--color-success, #2e7d32);
          font-weight: 600;
        }

        .diagram-caption {
          text-align: center;
          font-style: italic;
          color: var(--color-success, #2e7d32) !important;
        }

        .security-table {
          width: 100%;
          font-size: 13px;
          border-collapse: collapse;
        }

        .security-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--color-border, #e0e0e0);
        }

        .security-table tr:last-child td {
          border-bottom: none;
        }

        .security-table td:first-child {
          width: 140px;
          color: var(--color-text-muted, #666);
        }

        .highlight-safe {
          color: var(--color-success, #2e7d32) !important;
          font-weight: 500;
        }

        .never-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .never-list li {
          position: relative;
          padding-left: 24px;
          margin-bottom: 8px;
          font-size: 13px;
          color: var(--color-text-muted, #666);
        }

        .never-list li::before {
          content: '✕';
          position: absolute;
          left: 0;
          color: var(--color-danger, #dc3545);
          font-weight: bold;
        }

        .verify-list, .resource-list {
          margin: 8px 0 0 0;
          padding: 0;
          list-style: none;
        }

        .verify-list li, .resource-list li {
          margin-bottom: 8px;
          font-size: 13px;
        }

        .verify-list a, .resource-list a {
          color: var(--color-primary, #007bff);
        }
      `}</style>
    </div>
  );
}
