import React, { useState, useEffect, useRef } from 'react';

interface LockScreenProps {
  isStartup: boolean;
  onUnlock: () => void;
}

export default function LockScreen({ isStartup, onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError('Please enter a password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = isStartup
        ? await window.api.security.unlockStartup(password)
        : await window.api.security.unlock(password);

      if (success) {
        onUnlock();
      } else {
        setError('Incorrect password');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Unlock error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as React.FormEvent);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.lockIcon}>🔒</div>
          <h1 style={styles.title}>Ledgr</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter password"
            disabled={isLoading}
            style={styles.input}
          />

          {error && <div style={styles.error}>{error}</div>}

          {isStartup && (
            <div style={styles.warning}>
              If you&apos;ve forgotten your password, your data cannot be recovered.
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.button,
              ...(isLoading ? styles.buttonDisabled : {}),
            }}
          >
            {isLoading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--color-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  container: {
    maxWidth: '400px',
    width: '100%',
    padding: '40px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  lockIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 600,
    color: 'var(--color-text)',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    backgroundColor: 'var(--color-bg-secondary)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  error: {
    color: 'var(--color-error)',
    fontSize: '14px',
    textAlign: 'center',
  },
  warning: {
    color: 'var(--color-text-muted)',
    fontSize: '13px',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  button: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    fontWeight: 600,
    color: 'white',
    backgroundColor: 'var(--color-primary)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};
