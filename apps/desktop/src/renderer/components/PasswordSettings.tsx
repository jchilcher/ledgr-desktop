import React, { useState, useEffect } from 'react';
import { UserAuthStatus } from '../../shared/types';

interface PasswordSettingsProps {
  onToast: (message: string, type: 'success' | 'error') => void;
  currentUserId: string | null;
}

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '60 minutes' },
];

export default function PasswordSettings({ onToast, currentUserId }: PasswordSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(0);

  // Member auth state
  const [memberAuthStatus, setMemberAuthStatus] = useState<UserAuthStatus[]>([]);
  const [memberFormUserId, setMemberFormUserId] = useState<string | null>(null);
  const [memberFormType, setMemberFormType] = useState<'set' | 'change' | 'remove' | null>(null);
  const [memberPassword, setMemberPassword] = useState('');
  const [memberConfirmPassword, setMemberConfirmPassword] = useState('');
  const [memberCurrentPassword, setMemberCurrentPassword] = useState('');

  useEffect(() => {
    loadAutoLock();
    loadMemberAuthStatus();
  }, []);

  const loadAutoLock = async () => {
    try {
      const minutes = await window.api.security.getAutoLock();
      setAutoLockMinutes(minutes);
    } catch (err) {
      console.error('Error loading auto-lock settings:', err);
    }
  };

  const loadMemberAuthStatus = async () => {
    try {
      const members = await window.api.security.getMemberAuthStatus();
      setMemberAuthStatus(members);
    } catch {
      // May fail if no users exist yet
    }
  };

  const resetMemberForm = () => {
    setMemberFormUserId(null);
    setMemberFormType(null);
    setMemberPassword('');
    setMemberConfirmPassword('');
    setMemberCurrentPassword('');
  };

  const handleAutoLockChange = async (minutes: number) => {
    try {
      setLoading(true);
      await window.api.security.setAutoLock(minutes);
      setAutoLockMinutes(minutes);
      onToast('Auto-lock timeout updated', 'success');
    } catch (err) {
      console.error('Error updating auto-lock:', err);
      onToast('Failed to update auto-lock timeout', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLockNow = async () => {
    try {
      await window.api.security.lock();
    } catch (err) {
      console.error('Error locking:', err);
      onToast('Failed to lock', 'error');
    }
  };

  const handleSetMemberPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberFormUserId) return;

    if (memberPassword.length < 4) {
      onToast('Password must be at least 4 characters', 'error');
      return;
    }

    if (memberPassword !== memberConfirmPassword) {
      onToast('Passwords do not match', 'error');
      return;
    }

    try {
      setLoading(true);
      await window.api.security.enableMemberPassword(memberFormUserId, memberPassword);
      await loadMemberAuthStatus();
      resetMemberForm();
      onToast('Member password set', 'success');
    } catch (err) {
      console.error('Error setting member password:', err);
      onToast(err instanceof Error ? err.message : 'Failed to set member password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeMemberPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberFormUserId) return;

    if (memberPassword.length < 4) {
      onToast('New password must be at least 4 characters', 'error');
      return;
    }

    if (memberPassword !== memberConfirmPassword) {
      onToast('New passwords do not match', 'error');
      return;
    }

    try {
      setLoading(true);
      await window.api.security.changeMemberPassword(memberFormUserId, memberCurrentPassword, memberPassword);
      await loadMemberAuthStatus();
      resetMemberForm();
      onToast('Member password changed', 'success');
    } catch (err) {
      console.error('Error changing member password:', err);
      onToast(err instanceof Error ? err.message : 'Failed to change member password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMemberPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberFormUserId) return;

    try {
      setLoading(true);
      await window.api.security.disableMemberPassword(memberFormUserId, memberCurrentPassword);
      await loadMemberAuthStatus();
      resetMemberForm();
      onToast('Member password removed', 'success');
    } catch (err) {
      console.error('Error removing member password:', err);
      onToast(err instanceof Error ? err.message : 'Failed to remove member password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isOwnRow = (member: UserAuthStatus) => member.userId === currentUserId;

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Security Settings</h3>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Auto-lock Timeout
          </label>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '8px', marginTop: 0 }}>
            Automatically lock the app after a period of inactivity.
          </p>
          <select
            value={autoLockMinutes}
            onChange={(e) => handleAutoLockChange(Number(e.target.value))}
            disabled={loading}
            style={{ width: '100%', maxWidth: '300px' }}
          >
            {AUTO_LOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleLockNow}
          className="btn btn-secondary"
          style={{ alignSelf: 'flex-start' }}
          disabled={loading}
        >
          Lock Now
        </button>
      </div>

      {memberAuthStatus.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Member Passwords</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Set individual passwords for household members. When a member password is set, their
            financial data is encrypted and only accessible after authentication.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {memberAuthStatus.map(member => (
              <div key={member.userId} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: member.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  flexShrink: 0,
                }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontWeight: 500, flex: 1 }}>{member.name}</span>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: member.hasPassword ? 'var(--color-success, #27ae60)' : 'var(--color-bg)',
                  color: member.hasPassword ? 'white' : 'var(--color-text-muted)',
                  border: member.hasPassword ? 'none' : '1px solid var(--color-border)',
                }}>
                  {member.hasPassword ? 'Set' : 'Not Set'}
                </span>
                {isOwnRow(member) && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {!member.hasPassword ? (
                      <button
                        onClick={() => {
                          resetMemberForm();
                          setMemberFormUserId(member.userId);
                          setMemberFormType('set');
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                        disabled={loading}
                      >
                        Set Password
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            resetMemberForm();
                            setMemberFormUserId(member.userId);
                            setMemberFormType('change');
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                          disabled={loading}
                        >
                          Change
                        </button>
                        <button
                          onClick={() => {
                            resetMemberForm();
                            setMemberFormUserId(member.userId);
                            setMemberFormType('remove');
                          }}
                          className="btn btn-outline-danger"
                          style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {memberFormUserId && memberFormType === 'set' && (
            <form onSubmit={handleSetMemberPassword} style={{
              marginTop: '16px',
              backgroundColor: 'var(--color-bg-secondary)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}>
              <h4 style={{ marginTop: 0, marginBottom: '16px' }}>
                Set Password for {memberAuthStatus.find(m => m.userId === memberFormUserId)?.name}
              </h4>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Password</label>
                <input
                  type="password"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder="Enter password (min 4 characters)"
                  disabled={loading}
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Confirm Password</label>
                <input
                  type="password"
                  value={memberConfirmPassword}
                  onChange={(e) => setMemberConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Setting...' : 'Set Password'}
                </button>
                <button type="button" onClick={resetMemberForm} className="btn btn-secondary" disabled={loading}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {memberFormUserId && memberFormType === 'change' && (
            <form onSubmit={handleChangeMemberPassword} style={{
              marginTop: '16px',
              backgroundColor: 'var(--color-bg-secondary)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}>
              <h4 style={{ marginTop: 0, marginBottom: '16px' }}>
                Change Password for {memberAuthStatus.find(m => m.userId === memberFormUserId)?.name}
              </h4>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Current Password</label>
                <input
                  type="password"
                  value={memberCurrentPassword}
                  onChange={(e) => setMemberCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={loading}
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>New Password</label>
                <input
                  type="password"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Confirm New Password</label>
                <input
                  type="password"
                  value={memberConfirmPassword}
                  onChange={(e) => setMemberConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
                <button type="button" onClick={resetMemberForm} className="btn btn-secondary" disabled={loading}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {memberFormUserId && memberFormType === 'remove' && (
            <form onSubmit={handleRemoveMemberPassword} style={{
              marginTop: '16px',
              backgroundColor: 'var(--color-bg-secondary)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--color-error, #e74c3c)',
            }}>
              <h4 style={{ marginTop: 0, marginBottom: '16px' }}>
                Remove Password for {memberAuthStatus.find(m => m.userId === memberFormUserId)?.name}
              </h4>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Current Password</label>
                <input
                  type="password"
                  value={memberCurrentPassword}
                  onChange={(e) => setMemberCurrentPassword(e.target.value)}
                  placeholder="Enter current password to confirm"
                  disabled={loading}
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-danger" disabled={loading}>
                  {loading ? 'Removing...' : 'Remove Password'}
                </button>
                <button type="button" onClick={resetMemberForm} className="btn btn-secondary" disabled={loading}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
