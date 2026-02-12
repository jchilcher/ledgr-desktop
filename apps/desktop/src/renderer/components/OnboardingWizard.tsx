import React, { useState } from 'react';

interface OnboardingWizardProps {
  onComplete: (options?: { navigateTo?: string }) => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [accountName, setAccountName] = useState('');
  const [accountInstitution, setAccountInstitution] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings' | 'credit'>('checking');
  const [accountBalance, setAccountBalance] = useState('');
  const [createdAccount, setCreatedAccount] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSkip = () => {
    onComplete();
  };

  const handleCreateAccount = async () => {
    if (!accountName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await window.api.accounts.create({
        name: accountName.trim(),
        type: accountType,
        institution: accountInstitution.trim(),
        balance: Math.round((parseFloat(accountBalance) || 0) * 100),
        lastSynced: null,
      });
      setCreatedAccount(true);
      setStep(2);
    } catch (err) {
      setError(`Failed to create account: ${err}`);
    } finally {
      setCreating(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px',
    maxWidth: '520px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: 'var(--shadow-lg)',
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '24px',
  };

  const stepIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '24px',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '28px',
  };

  const renderStepDots = () => (
    <div style={stepIndicatorStyle}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: i === step ? 'var(--color-primary)' : 'var(--color-border)',
          transition: 'background-color 0.2s',
        }} />
      ))}
    </div>
  );

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          {renderStepDots()}
          <div style={headerStyle}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{'🔒'}</div>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5rem' }}>Welcome to Ledgr</h2>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
              Your data stays on your computer — no cloud, no third parties.
              Track spending, set budgets, and understand your finances with complete privacy.
            </p>
          </div>
          <div style={footerStyle}>
            <button onClick={handleSkip} className="btn-link" style={{ fontSize: '0.85rem' }}>
              Skip setup
            </button>
            <button onClick={() => setStep(1)} className="btn btn-primary">
              Get Started
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Create Account
  if (step === 1) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          {renderStepDots()}
          <div style={headerStyle}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem' }}>Add Your First Account</h2>
            <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.9rem' }}>
              This is the bank account or card you want to track. You can add more later.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>
                Account Name
              </label>
              <input
                type="text"
                placeholder="e.g. Main Checking"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                disabled={creating}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>
                Institution
              </label>
              <input
                type="text"
                placeholder="e.g. Chase, Bank of America"
                value={accountInstitution}
                onChange={(e) => setAccountInstitution(e.target.value)}
                disabled={creating}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>
                Account Type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'checking' | 'savings' | 'credit')}
                disabled={creating}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit Card</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>
                Current Balance
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
                disabled={creating}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '8px' }}>{error}</p>
          )}

          <div style={footerStyle}>
            <button onClick={() => { setStep(2); }} className="btn-link" style={{ fontSize: '0.85rem' }}>
              Skip this step
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep(0)} className="btn btn-secondary">
                Back
              </button>
              <button
                onClick={handleCreateAccount}
                className="btn btn-primary"
                disabled={creating || !accountName.trim()}
              >
                {creating ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Next Steps
  if (step === 2) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          {renderStepDots()}
          <div style={headerStyle}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem' }}>
              {createdAccount ? 'Account Created!' : 'Next Steps'}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.9rem' }}>
              Here&apos;s how to get the most out of Ledgr:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              padding: '12px',
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '24px', lineHeight: 1 }}>{'📥'}</span>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Import Transactions</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                  Upload a CSV or OFX file from your bank, or connect directly via OFX.
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              padding: '12px',
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '24px', lineHeight: 1 }}>{'📊'}</span>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Explore Your Dashboard</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                  See spending breakdowns, account balances, and recent activity at a glance.
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              padding: '12px',
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '24px', lineHeight: 1 }}>{'💡'}</span>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Get Insights</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: 'var(--color-text-muted)' }}>
                  Set budgets, track savings goals, and use 12 analysis tools in the Insights tab.
                </p>
              </div>
            </div>
          </div>

          <div style={footerStyle}>
            <div />
            <button onClick={() => setStep(3)} className="btn btn-primary">
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Done
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {renderStepDots()}
        <div style={headerStyle}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>{'✅'}</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem' }}>You&apos;re All Set!</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.9rem' }}>
            You can always find all features in the navigation tabs above.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={() => onComplete({ navigateTo: 'import' })}
            className="btn btn-primary"
          >
            Go to Import
          </button>
          <button
            onClick={() => onComplete({ navigateTo: 'dashboard' })}
            className="btn btn-secondary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
