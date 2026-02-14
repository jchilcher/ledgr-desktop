import { useState, useEffect } from 'react';
import type { ManualAsset, ManualLiability, UserAuthStatus, EncryptableEntityType } from '../../shared/types';
import { ManualAssetForm } from './ManualAssetForm';
import { ManualLiabilityForm } from './ManualLiabilityForm';
import ShareDialog from './ShareDialog';
import { useHousehold } from '../contexts/HouseholdContext';

interface AssetLiabilityListProps {
  assets: ManualAsset[];
  liabilities: ManualLiability[];
  onCreateAsset: (asset: Omit<ManualAsset, 'id' | 'createdAt' | 'lastUpdated'>) => Promise<void>;
  onUpdateAsset: (id: string, updates: Partial<Omit<ManualAsset, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteAsset: (id: string) => Promise<void>;
  onCreateLiability: (liability: Omit<ManualLiability, 'id' | 'createdAt' | 'lastUpdated'>) => Promise<void>;
  onUpdateLiability: (id: string, updates: Partial<Omit<ManualLiability, 'id' | 'createdAt'>>) => Promise<void>;
  onDeleteLiability: (id: string) => Promise<void>;
  className?: string;
}

type ModalState =
  | { type: 'none' }
  | { type: 'add-asset' }
  | { type: 'edit-asset'; asset: ManualAsset }
  | { type: 'add-liability' }
  | { type: 'edit-liability'; liability: ManualLiability };

export function AssetLiabilityList({
  assets,
  liabilities,
  onCreateAsset,
  onUpdateAsset,
  onDeleteAsset,
  onCreateLiability,
  onUpdateLiability,
  onDeleteLiability,
  className,
}: AssetLiabilityListProps) {
  const { currentUserId } = useHousehold();
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'asset' | 'liability'; id: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; entityType: EncryptableEntityType } | null>(null);
  const [memberAuthStatus, setMemberAuthStatus] = useState<UserAuthStatus[]>([]);

  useEffect(() => {
    window.api.security.getMemberAuthStatus()
      .then(setMemberAuthStatus)
      .catch(() => {});
  }, []);

  const canShare = (ownerId: string | null | undefined): boolean => {
    if (!currentUserId) return false;
    if (ownerId && ownerId !== currentUserId) return false;
    const currentUserAuth = memberAuthStatus.find(m => m.userId === currentUserId);
    if (!currentUserAuth?.hasPassword) return false;
    const othersWithPassword = memberAuthStatus.filter(m => m.userId !== currentUserId && m.hasPassword);
    return othersWithPassword.length > 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value / 100);
  };

  const handleDeleteAsset = async (id: string) => {
    await onDeleteAsset(id);
    setDeleteConfirm(null);
  };

  const handleDeleteLiability = async (id: string) => {
    await onDeleteLiability(id);
    setDeleteConfirm(null);
  };

  return (
    <div className={`section ${className}`}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Assets & Liabilities</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setModalState({ type: 'add-asset' })}
            className="btn btn-success"
            style={{ padding: '6px 12px', fontSize: '14px' }}
          >
            + Asset
          </button>
          <button
            onClick={() => setModalState({ type: 'add-liability' })}
            className="btn btn-danger"
            style={{ padding: '6px 12px', fontSize: '14px' }}
          >
            + Liability
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Assets section */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
            Assets
          </h4>
          {assets.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', padding: '8px 0' }}>
              No manual assets added
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {assets.map(asset => (
                <div
                  key={asset.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--color-success-bg)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{asset.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {asset.category} | {asset.liquidity}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                      {formatCurrency(asset.value)}
                    </span>
                    {canShare(asset.ownerId) && (
                      <button
                        onClick={() => setShareTarget({ id: asset.id, name: asset.name, entityType: 'manual_asset' })}
                        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '14px' }}
                      >
                        Share
                      </button>
                    )}
                    <button
                      onClick={() => setModalState({ type: 'edit-asset', asset })}
                      style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '14px' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'asset', id: asset.id })}
                      style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '14px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liabilities section */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
            Liabilities
          </h4>
          {liabilities.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', padding: '8px 0' }}>
              No liabilities added
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {liabilities.map(liability => (
                <div
                  key={liability.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--color-danger-bg)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{liability.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {liability.type} | {(liability.interestRate * 100).toFixed(2)}% APR
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                      {formatCurrency(liability.balance)}
                    </span>
                    {canShare(liability.ownerId) && (
                      <button
                        onClick={() => setShareTarget({ id: liability.id, name: liability.name, entityType: 'manual_liability' })}
                        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '14px' }}
                      >
                        Share
                      </button>
                    )}
                    <button
                      onClick={() => setModalState({ type: 'edit-liability', liability })}
                      style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '14px' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'liability', id: liability.id })}
                      style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '14px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for add/edit forms */}
      {modalState.type !== 'none' && (
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
          onClick={() => setModalState({ type: 'none' })}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              width: '100%',
              maxWidth: '512px',
              margin: '0 16px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0' }}>
                {modalState.type === 'add-asset' && 'Add Asset'}
                {modalState.type === 'edit-asset' && 'Edit Asset'}
                {modalState.type === 'add-liability' && 'Add Liability'}
                {modalState.type === 'edit-liability' && 'Edit Liability'}
              </h3>

              {(modalState.type === 'add-asset' || modalState.type === 'edit-asset') && (
                <ManualAssetForm
                  asset={modalState.type === 'edit-asset' ? modalState.asset : undefined}
                  onSubmit={async asset => {
                    if (modalState.type === 'edit-asset') {
                      await onUpdateAsset(modalState.asset.id, asset);
                    } else {
                      await onCreateAsset(asset);
                    }
                    setModalState({ type: 'none' });
                  }}
                  onCancel={() => setModalState({ type: 'none' })}
                />
              )}

              {(modalState.type === 'add-liability' || modalState.type === 'edit-liability') && (
                <ManualLiabilityForm
                  liability={modalState.type === 'edit-liability' ? modalState.liability : undefined}
                  onSubmit={async liability => {
                    if (modalState.type === 'edit-liability') {
                      await onUpdateLiability(modalState.liability.id, liability);
                    } else {
                      await onCreateLiability(liability);
                    }
                    setModalState({ type: 'none' });
                  }}
                  onCancel={() => setModalState({ type: 'none' })}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
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
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: '24px',
              maxWidth: '420px',
              margin: '0 16px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0' }}>Confirm Delete</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              Are you sure you want to delete this {deleteConfirm.type}?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteConfirm.type === 'asset'
                    ? handleDeleteAsset(deleteConfirm.id)
                    : handleDeleteLiability(deleteConfirm.id)
                }
                className="btn btn-danger"
                style={{ padding: '8px 16px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {shareTarget && (
        <ShareDialog
          entityId={shareTarget.id}
          entityType={shareTarget.entityType}
          entityName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

export default AssetLiabilityList;
