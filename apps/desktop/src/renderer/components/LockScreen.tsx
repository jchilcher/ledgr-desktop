import React, { useState, useEffect, useRef } from 'react';
import { UserAuthStatus } from '../../shared/types';

interface LockScreenProps {
  isStartup: boolean;
  onUnlock: () => void;
  members?: UserAuthStatus[];
  onMemberUnlock?: (userId: string) => void;
}

export default function LockScreen({ isStartup, onUnlock, members, onMemberUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserAuthStatus | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allMembers = members ?? [];
  const showMemberPicker = allMembers.length >= 2 && !selectedMember;

  // Auto-select the single member if there's only one (they must have a password or we wouldn't be here)
  useEffect(() => {
    if (allMembers.length === 1 && !selectedMember) {
      setSelectedMember(allMembers[0]);
    }
  }, [allMembers, selectedMember]);

  useEffect(() => {
    if (!showMemberPicker && selectedMember?.hasPassword) {
      inputRef.current?.focus();
    }
  }, [showMemberPicker, selectedMember]);

  // Handle selecting a member — if they have no password, unlock immediately
  const handleSelectMember = async (member: UserAuthStatus) => {
    if (!member.hasPassword) {
      setIsLoading(true);
      setError('');
      try {
        const unlockFn = isStartup
          ? window.api.security.unlockMemberStartup
          : window.api.security.unlockMember;
        const success = await unlockFn(member.userId, null);
        if (success) {
          onMemberUnlock?.(member.userId);
          onUnlock();
        } else {
          setError('Failed to unlock. Please try again.');
        }
      } catch (err) {
        setError('An error occurred. Please try again.');
        console.error('Unlock error:', err);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    setSelectedMember(member);
  };

  const handlePasswordlessUnlock = async () => {
    if (!selectedMember) return;
    setIsLoading(true);
    setError('');
    try {
      const unlockFn = isStartup
        ? window.api.security.unlockMemberStartup
        : window.api.security.unlockMember;
      const success = await unlockFn(selectedMember.userId, null);
      if (success) {
        onMemberUnlock?.(selectedMember.userId);
        onUnlock();
      } else {
        setError('Failed to unlock. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Unlock error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError('Please enter a password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (!selectedMember) {
        setError('Please select a member');
        setIsLoading(false);
        return;
      }

      const unlockFn = isStartup
        ? window.api.security.unlockMemberStartup
        : window.api.security.unlockMember;
      const success = await unlockFn(selectedMember.userId, password);
      if (success) {
        onMemberUnlock?.(selectedMember.userId);
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

  const handleBackToMembers = () => {
    setSelectedMember(null);
    setPassword('');
    setError('');
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.lockIcon}>🔒</div>
          <h1 style={styles.title}>Ledgr</h1>
        </div>

        {showMemberPicker ? (
          <div>
            <p style={styles.memberPickerLabel}>Who is using Ledgr?</p>
            <div className="lock-member-picker">
              {allMembers.map(member => (
                <button
                  key={member.userId}
                  className="lock-member-avatar"
                  onClick={() => handleSelectMember(member)}
                  disabled={isLoading}
                >
                  <div
                    className="lock-member-avatar-circle"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="lock-member-avatar-name">
                    {member.name}
                    {member.hasPassword && <span style={styles.lockBadge}>🔒</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={selectedMember?.hasPassword ? handleSubmit : (e) => { e.preventDefault(); handlePasswordlessUnlock(); }} style={styles.form}>
            {selectedMember && (
              <div style={styles.selectedMemberHeader}>
                <div
                  style={{
                    ...styles.selectedMemberCircle,
                    backgroundColor: selectedMember.color,
                  }}
                >
                  {selectedMember.name.charAt(0).toUpperCase()}
                </div>
                <span style={styles.selectedMemberName}>{selectedMember.name}</span>
              </div>
            )}

            {selectedMember && !selectedMember.hasPassword ? (
              <>
                {error && <div style={styles.error}>{error}</div>}

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    ...styles.button,
                    ...(isLoading ? styles.buttonDisabled : {}),
                  }}
                >
                  {isLoading ? 'Unlocking...' : 'Unlock'}
                </button>
              </>
            ) : (
              <>
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

                {isStartup && !selectedMember && (
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
              </>
            )}

            {selectedMember && allMembers.length >= 2 && (
              <button
                type="button"
                onClick={handleBackToMembers}
                style={styles.backButton}
              >
                Back
              </button>
            )}
          </form>
        )}
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
  memberPickerLabel: {
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '0.95rem',
    marginBottom: '20px',
  },
  selectedMemberHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  selectedMemberCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1rem',
  },
  selectedMemberName: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  backButton: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-muted)',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  lockBadge: {
    fontSize: '0.7rem',
    marginLeft: '4px',
  },
};
