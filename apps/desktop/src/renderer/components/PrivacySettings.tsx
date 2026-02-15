import React, { useState, useEffect, useCallback } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import {
  UserAuthStatus,
  DataShare,
  SharingDefault,
  SharePermissions,
  SharingEntityType,
} from '../../shared/types';

interface PrivacySettingsProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const ENTITY_TYPE_OPTIONS: { value: SharingEntityType; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'account', label: 'Accounts' },
  { value: 'recurring_item', label: 'Recurring Items' },
  { value: 'savings_goal', label: 'Savings Goals' },
  { value: 'manual_asset', label: 'Manual Assets' },
  { value: 'manual_liability', label: 'Manual Liabilities' },
  { value: 'investment_account', label: 'Investment Accounts' },
];

function entityTypeLabel(type: SharingEntityType): string {
  return ENTITY_TYPE_OPTIONS.find(e => e.value === type)?.label ?? type;
}

function permissionsSummary(p: SharePermissions): string {
  const parts: string[] = [];
  if (p.view) parts.push('View');
  if (p.combine) parts.push('Combine');
  if (p.reports) parts.push('Reports');
  return parts.length > 0 ? parts.join(', ') : 'None';
}

export default function PrivacySettings({ onToast }: PrivacySettingsProps) {
  const { currentUserId, users } = useHousehold();
  const [memberAuthStatus, setMemberAuthStatus] = useState<UserAuthStatus[]>([]);
  const [defaults, setDefaults] = useState<SharingDefault[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<DataShare[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state (used for both add and edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formRecipientId, setFormRecipientId] = useState('');
  const [formEntityType, setFormEntityType] = useState<SharingEntityType>('all');
  const [formPermView, setFormPermView] = useState(true);
  const [formPermCombine, setFormPermCombine] = useState(false);
  const [formPermReports, setFormPermReports] = useState(false);

  const loadMemberAuthStatus = useCallback(async () => {
    try {
      const members = await window.api.security.getMemberAuthStatus();
      setMemberAuthStatus(members);
    } catch {
      // May fail if no users exist yet
    }
  }, []);

  const loadDefaults = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const result = await window.api.sharing.getDefaults(currentUserId);
      setDefaults(result);
    } catch {
      // Sharing API may not be available
    }
  }, [currentUserId]);

  const loadShares = useCallback(async () => {
    try {
      const shared = await window.api.sharing.getSharedWithMe();
      setSharedWithMe(shared);
    } catch {
      // Sharing API may not be available
    }
  }, []);

  useEffect(() => {
    loadMemberAuthStatus();
    loadDefaults();
    loadShares();
  }, [loadMemberAuthStatus, loadDefaults, loadShares]);

  const currentMember = memberAuthStatus.find(m => m.userId === currentUserId);
  const hasPassword = currentMember?.hasPassword ?? false;
  const otherMembers = users.filter(u => u.id !== currentUserId);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormRecipientId('');
    setFormEntityType('all');
    setFormPermView(true);
    setFormPermCombine(false);
    setFormPermReports(false);
  };

  const startAdd = () => {
    if (otherMembers.length > 0) {
      setFormRecipientId(otherMembers[0].id);
    }
    setEditingId(null);
    setFormEntityType('all');
    setFormPermView(true);
    setFormPermCombine(false);
    setFormPermReports(false);
    setShowForm(true);
  };

  const startEdit = (d: SharingDefault) => {
    setEditingId(d.id);
    setFormRecipientId(d.recipientId);
    setFormEntityType(d.entityType);
    setFormPermView(d.permissions.view);
    setFormPermCombine(d.permissions.combine);
    setFormPermReports(d.permissions.reports);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !formRecipientId) return;

    try {
      setLoading(true);
      const permissions = { view: formPermView, combine: formPermCombine, reports: formPermReports };

      if (editingId) {
        const existing = defaults.find(d => d.id === editingId);
        const updates: { entityType?: SharingEntityType; permissions?: SharePermissions } = {};
        if (existing && existing.entityType !== formEntityType) updates.entityType = formEntityType;
        if (existing && (
          existing.permissions.view !== permissions.view ||
          existing.permissions.combine !== permissions.combine ||
          existing.permissions.reports !== permissions.reports
        )) {
          updates.permissions = permissions;
        }
        if (Object.keys(updates).length > 0) {
          await window.api.sharing.updateDefault(editingId, updates);
        }
        onToast('Sharing rule updated', 'success');
      } else {
        await window.api.sharing.setDefault(
          currentUserId,
          formRecipientId,
          formEntityType,
          permissions,
        );
        onToast('Sharing rule added', 'success');
      }

      await loadDefaults();
      resetForm();
    } catch (err) {
      console.error('Error saving sharing default:', err);
      onToast(err instanceof Error ? err.message : 'Failed to save sharing rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDefault = async (defaultId: string) => {
    try {
      setLoading(true);
      await window.api.sharing.removeDefault(defaultId);
      await loadDefaults();
      onToast('Sharing rule removed', 'success');
    } catch (err) {
      console.error('Error removing sharing default:', err);
      onToast(err instanceof Error ? err.message : 'Failed to remove sharing rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    return user?.name ?? 'Unknown';
  };

  return (
    <div>
      {/* Section 1: Encryption Status */}
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Encryption Status</h3>
      <div style={{
        padding: '16px',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontWeight: 500 }}>Password Protection:</span>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: hasPassword ? 'var(--color-success, #27ae60)' : 'var(--color-bg)',
            color: hasPassword ? 'white' : 'var(--color-text-muted)',
            border: hasPassword ? 'none' : '1px solid var(--color-border)',
          }}>
            {hasPassword ? 'Enabled' : 'Not Set'}
          </span>
        </div>
        {!hasPassword && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            Set a password in the Security tab to enable encryption. Encryption is required
            before you can share data with other household members.
          </p>
        )}
        {hasPassword && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            Your data is encrypted with a password-derived key. Sharing with other
            household members uses end-to-end encryption.
          </p>
        )}
      </div>

      {/* Section 4: Data Loss Warning */}
      <div style={{
        padding: '16px',
        backgroundColor: 'var(--color-bg)',
        border: '2px solid var(--color-error, #e74c3c)',
        borderRadius: '8px',
        marginBottom: '24px',
      }}>
        <h4 style={{
          margin: '0 0 8px 0',
          color: 'var(--color-error, #e74c3c)',
          fontSize: '0.95rem',
        }}>
          Data Loss Warning
        </h4>
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: 'var(--color-error, #e74c3c)',
          fontWeight: 500,
          marginBottom: '8px',
        }}>
          If you forget your password, your encrypted data cannot be recovered.
        </p>
        <p style={{
          margin: 0,
          fontSize: '13px',
          color: 'var(--color-text-muted)',
        }}>
          There is no password reset mechanism. Encrypted data (account names, balances,
          transaction details) is only accessible with the correct password. Make sure
          to store your password in a safe place.
        </p>
      </div>

      {/* Section 2: Blanket Sharing Rules */}
      {otherMembers.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Default Sharing Rules</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Set default permissions that apply automatically when new items are created.
          </p>

          {defaults.length > 0 ? (
            <div style={{ marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Recipient</th>
                    <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Permissions</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {defaults.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px' }}>{entityTypeLabel(d.entityType)}</td>
                      <td style={{ padding: '8px' }}>{getUserName(d.recipientId)}</td>
                      <td style={{ padding: '8px' }}>{permissionsSummary(d.permissions)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => startEdit(d)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveDefault(d.id)}
                            className="btn btn-outline-danger"
                            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                            disabled={loading}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              No default sharing rules configured.
            </p>
          )}

          {!showForm ? (
            <button
              onClick={startAdd}
              className="btn btn-secondary"
              disabled={loading || !hasPassword}
              title={!hasPassword ? 'Enable password protection first' : undefined}
            >
              + Add Rule
            </button>
          ) : (
            <form onSubmit={handleSubmit} style={{
              backgroundColor: 'var(--color-bg-secondary)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}>
              <h4 style={{ marginTop: 0, marginBottom: '16px' }}>
                {editingId ? 'Edit Sharing Rule' : 'Add Sharing Rule'}
              </h4>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                  Recipient
                </label>
                <select
                  value={formRecipientId}
                  onChange={(e) => setFormRecipientId(e.target.value)}
                  disabled={loading || !!editingId}
                  style={{ width: '100%' }}
                >
                  {otherMembers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                  Entity Type
                </label>
                <select
                  value={formEntityType}
                  onChange={(e) => setFormEntityType(e.target.value as SharingEntityType)}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {ENTITY_TYPE_OPTIONS.map(et => (
                    <option key={et.value} value={et.value}>{et.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                  Permissions
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formPermView}
                      onChange={(e) => setFormPermView(e.target.checked)}
                      disabled={loading}
                    />
                    <span>View — see shared items</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formPermCombine}
                      onChange={(e) => setFormPermCombine(e.target.checked)}
                      disabled={loading}
                    />
                    <span>Combine — include in household totals</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formPermReports}
                      onChange={(e) => setFormPermReports(e.target.checked)}
                      disabled={loading}
                    />
                    <span>Reports — include in reports and analytics</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Rule'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Section 3: Active Shares */}
      {(sharedWithMe.length > 0) && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Shared With Me</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Items that other household members have shared with you.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Owner</th>
                <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600 }}>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {sharedWithMe.map(share => (
                <tr key={share.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px' }}>{entityTypeLabel(share.entityType)}</td>
                  <td style={{ padding: '8px' }}>{getUserName(share.ownerId)}</td>
                  <td style={{ padding: '8px' }}>{permissionsSummary(share.permissions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
