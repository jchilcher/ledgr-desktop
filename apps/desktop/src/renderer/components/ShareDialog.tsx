import { useState, useEffect, useCallback } from 'react';
import type { DataShare, SharePermissions, UserAuthStatus, EncryptableEntityType } from '../../shared/types';

interface ShareDialogProps {
  entityId: string;
  entityType: EncryptableEntityType;
  entityName: string;
  onClose: () => void;
  onToast?: (message: string) => void;
}

export default function ShareDialog({ entityId, entityType, entityName, onClose, onToast }: ShareDialogProps) {
  const [shares, setShares] = useState<DataShare[]>([]);
  const [members, setMembers] = useState<UserAuthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add share form state
  const [recipientId, setRecipientId] = useState('');
  const [permissions, setPermissions] = useState<SharePermissions>({
    view: true,
    combine: false,
    reports: false,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [entityShares, authStatuses] = await Promise.all([
        window.api.sharing.getSharesForEntity(entityId, entityType),
        window.api.security.getMemberAuthStatus(),
      ]);
      setShares(entityShares);
      setMembers(authStatuses);
    } catch (err) {
      console.error('Error loading share data:', err);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sharedRecipientIds = new Set(shares.map(s => s.recipientId));
  const availableRecipients = members.filter(
    m => m.hasPassword && !sharedRecipientIds.has(m.userId)
  );

  const getMemberName = (userId: string): string => {
    const member = members.find(m => m.userId === userId);
    return member?.name || 'Unknown';
  };

  const getMemberColor = (userId: string): string => {
    const member = members.find(m => m.userId === userId);
    return member?.color || '#888';
  };

  const handleCreateShare = async () => {
    if (!recipientId) return;

    try {
      setSaving(true);
      await window.api.sharing.createShare(entityId, entityType, recipientId, permissions);
      setRecipientId('');
      setPermissions({ view: true, combine: false, reports: false });
      await loadData();
      onToast?.(`Shared "${entityName}" successfully`);
    } catch (err) {
      console.error('Error creating share:', err);
      onToast?.(`Failed to share: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePermissions = async (shareId: string, newPermissions: SharePermissions) => {
    try {
      setSaving(true);
      await window.api.sharing.updatePermissions(shareId, newPermissions);
      await loadData();
    } catch (err) {
      console.error('Error updating permissions:', err);
      onToast?.('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (shareId: string, recipientName: string) => {
    if (!confirm(`Revoke ${recipientName}'s access to "${entityName}"?`)) return;

    try {
      setSaving(true);
      await window.api.sharing.revokeShare(shareId);
      await loadData();
      onToast?.(`Revoked ${recipientName}'s access`);
    } catch (err) {
      console.error('Error revoking share:', err);
      onToast?.('Failed to revoke access');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '520px',
          margin: '0 16px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Share "{entityName}"</h3>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                padding: '4px',
              }}
            >
              X
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>
              Loading...
            </p>
          ) : (
            <>
              {/* Current shares */}
              {shares.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    Shared with
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {shares.map(share => {
                      const name = getMemberName(share.recipientId);
                      const color = getMemberColor(share.recipientId);
                      return (
                        <div
                          key={share.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            backgroundColor: 'var(--color-surface-alt, var(--color-bg))',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          {/* User indicator */}
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 500, flex: 1 }}>{name}</span>

                          {/* Permission checkboxes */}
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={share.permissions.view}
                                onChange={e => handleUpdatePermissions(share.id, {
                                  ...share.permissions,
                                  view: e.target.checked,
                                })}
                                disabled={saving}
                              />
                              View
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={share.permissions.combine}
                                onChange={e => handleUpdatePermissions(share.id, {
                                  ...share.permissions,
                                  combine: e.target.checked,
                                })}
                                disabled={saving}
                              />
                              Combine
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={share.permissions.reports}
                                onChange={e => handleUpdatePermissions(share.id, {
                                  ...share.permissions,
                                  reports: e.target.checked,
                                })}
                                disabled={saving}
                              />
                              Reports
                            </label>
                          </div>

                          {/* Revoke button */}
                          <button
                            onClick={() => handleRevoke(share.id, name)}
                            disabled={saving}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-danger)',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              fontSize: '13px',
                              flexShrink: 0,
                            }}
                          >
                            Revoke
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add share form */}
              {availableRecipients.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                    Add person
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <select
                      value={recipientId}
                      onChange={e => setRecipientId(e.target.value)}
                      disabled={saving}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <option value="">Select a person...</option>
                      {availableRecipients.map(r => (
                        <option key={r.userId} value={r.userId}>{r.name}</option>
                      ))}
                    </select>

                    {recipientId && (
                      <>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={permissions.view}
                              onChange={e => setPermissions(p => ({ ...p, view: e.target.checked }))}
                              disabled={saving}
                            />
                            View
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={permissions.combine}
                              onChange={e => setPermissions(p => ({ ...p, combine: e.target.checked }))}
                              disabled={saving}
                            />
                            Combine in totals
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={permissions.reports}
                              onChange={e => setPermissions(p => ({ ...p, reports: e.target.checked }))}
                              disabled={saving}
                            />
                            Include in reports
                          </label>
                        </div>

                        <button
                          onClick={handleCreateShare}
                          disabled={saving || !recipientId}
                          className="btn btn-primary"
                          style={{ alignSelf: 'flex-start' }}
                        >
                          {saving ? 'Sharing...' : 'Share'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* No recipients available */}
              {availableRecipients.length === 0 && shares.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                  No other household members with encryption enabled to share with.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
