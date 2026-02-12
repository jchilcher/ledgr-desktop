import React, { useState, useEffect } from 'react';
import { SecurityStatus } from '../../shared/types';

interface PasswordSettingsProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '60 minutes' },
];

export default function PasswordSettings({ onToast }: PasswordSettingsProps) {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const [showEnableForm, setShowEnableForm] = useState(false);
  const [enablePassword, setEnablePassword] = useState('');
  const [enableConfirmPassword, setEnableConfirmPassword] = useState('');
  const [enableAutoLock, setEnableAutoLock] = useState(0);

  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const securityStatus = await window.api.security.getStatus();
      setStatus(securityStatus);
    } catch (err) {
      console.error('Error loading security status:', err);
    }
  };

  const resetEnableForm = () => {
    setShowEnableForm(false);
    setEnablePassword('');
    setEnableConfirmPassword('');
    setEnableAutoLock(0);
  };

  const resetChangePasswordForm = () => {
    setShowChangePasswordForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const resetDisableForm = () => {
    setShowDisableForm(false);
    setDisablePassword('');
  };

  const handleEnableProtection = async (e: React.FormEvent) => {
    e.preventDefault();

    if (enablePassword.length < 8) {
      onToast('Password must be at least 8 characters', 'error');
      return;
    }

    if (enablePassword !== enableConfirmPassword) {
      onToast('Passwords do not match', 'error');
      return;
    }

    try {
      setLoading(true);
      await window.api.security.enable(enablePassword, enableAutoLock);
      await loadStatus();
      resetEnableForm();
      onToast('Password protection enabled', 'success');
    } catch (err) {
      console.error('Error enabling protection:', err);
      onToast(err instanceof Error ? err.message : 'Failed to enable protection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      onToast('New password must be at least 8 characters', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      onToast('New passwords do not match', 'error');
      return;
    }

    try {
      setLoading(true);
      await window.api.security.changePassword(currentPassword, newPassword);
      resetChangePasswordForm();
      onToast('Password changed successfully', 'success');
    } catch (err) {
      console.error('Error changing password:', err);
      onToast(err instanceof Error ? err.message : 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableProtection = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      await window.api.security.disable(disablePassword);
      await loadStatus();
      resetDisableForm();
      onToast('Password protection disabled', 'success');
    } catch (err) {
      console.error('Error disabling protection:', err);
      onToast(err instanceof Error ? err.message : 'Failed to disable protection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoLockChange = async (minutes: number) => {
    try {
      setLoading(true);
      await window.api.security.updateAutoLock(minutes);
      await loadStatus();
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

  if (!status) {
    return <p>Loading security settings...</p>;
  }

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Password Protection</h3>

      {!status.enabled ? (
        <div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Protect your financial data with a password. Your database will be encrypted at rest.
          </p>

          {!showEnableForm ? (
            <button
              onClick={() => setShowEnableForm(true)}
              className="btn btn-primary"
              disabled={loading}
            >
              Enable Password Protection
            </button>
          ) : (
            <form onSubmit={handleEnableProtection} style={{
              backgroundColor: 'var(--color-bg-secondary)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                  Password
                </label>
                <input
                  type="password"
                  value={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.value)}
                  placeholder="Enter password (min 8 characters)"
                  disabled={loading}
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={enableConfirmPassword}
                  onChange={(e) => setEnableConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                  Auto-lock Timeout
                </label>
                <select
                  value={enableAutoLock}
                  onChange={(e) => setEnableAutoLock(Number(e.target.value))}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {AUTO_LOCK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                padding: '12px',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-error, #e74c3c)',
                borderRadius: '4px',
                marginBottom: '16px',
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: 'var(--color-error, #e74c3c)',
                  fontWeight: 500,
                }}>
                  If you forget your password, your data cannot be recovered.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Enabling...' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={resetEnableForm}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  backgroundColor: 'var(--color-success, #27ae60)',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Enabled
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Auto-lock Timeout
              </label>
              <select
                value={status.autoLockMinutes}
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
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!showChangePasswordForm ? (
              <button
                onClick={() => setShowChangePasswordForm(true)}
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-start' }}
              >
                Change Password
              </button>
            ) : (
              <form onSubmit={handleChangePassword} style={{
                backgroundColor: 'var(--color-bg-secondary)',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Change Password</h4>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={loading}
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8 characters)"
                    disabled={loading}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={loading}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                  <button
                    type="button"
                    onClick={resetChangePasswordForm}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={handleLockNow}
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-start' }}
              disabled={loading}
            >
              Lock Now
            </button>

            {!showDisableForm ? (
              <button
                onClick={() => setShowDisableForm(true)}
                className="btn btn-danger"
                style={{ alignSelf: 'flex-start' }}
              >
                Disable Protection
              </button>
            ) : (
              <form onSubmit={handleDisableProtection} style={{
                backgroundColor: 'var(--color-bg-secondary)',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid var(--color-error, #e74c3c)',
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Disable Password Protection</h4>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={loading}
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </div>

                <div style={{
                  padding: '12px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-error, #e74c3c)',
                  borderRadius: '4px',
                  marginBottom: '16px',
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'var(--color-error, #e74c3c)',
                    fontWeight: 500,
                  }}>
                    Your database will be decrypted and accessible without a password.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-danger" disabled={loading}>
                    {loading ? 'Disabling...' : 'Disable'}
                  </button>
                  <button
                    type="button"
                    onClick={resetDisableForm}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
