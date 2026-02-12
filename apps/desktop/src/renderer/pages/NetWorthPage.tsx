import { useState } from 'react';
import { NetWorthDashboard } from '../components/NetWorthDashboard';
import { NetWorthChart } from '../components/NetWorthChart';
import { NetWorthProjections } from '../components/NetWorthProjections';
import { AssetLiabilityList } from '../components/AssetLiabilityList';
import { useManualAssets, useManualLiabilities, useNetWorthCalculation } from '../hooks/useNetWorth';

type Tab = 'dashboard' | 'history' | 'projections' | 'manage';

export function NetWorthPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { refetch: refetchNetWorth } = useNetWorthCalculation();
  const {
    assets,
    createAsset,
    updateAsset,
    deleteAsset,
  } = useManualAssets();
  const {
    liabilities,
    createLiability,
    updateLiability,
    deleteLiability,
  } = useManualLiabilities();

  // Wrapper functions to refresh net worth after changes
  const handleCreateAsset = async (asset: Parameters<typeof createAsset>[0]) => {
    await createAsset(asset);
    await refetchNetWorth(true);
  };

  const handleUpdateAsset = async (id: string, updates: Parameters<typeof updateAsset>[1]) => {
    await updateAsset(id, updates);
    await refetchNetWorth(true);
  };

  const handleDeleteAsset = async (id: string) => {
    await deleteAsset(id);
    await refetchNetWorth(true);
  };

  const handleCreateLiability = async (liability: Parameters<typeof createLiability>[0]) => {
    await createLiability(liability);
    await refetchNetWorth(true);
  };

  const handleUpdateLiability = async (id: string, updates: Parameters<typeof updateLiability>[1]) => {
    await updateLiability(id, updates);
    await refetchNetWorth(true);
  };

  const handleDeleteLiability = async (id: string) => {
    await deleteLiability(id);
    await refetchNetWorth(true);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'history', label: 'History' },
    { id: 'projections', label: 'Projections' },
    { id: 'manage', label: 'Manage' },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text)', margin: 0 }}>
          Net Worth
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
          Your complete financial picture
        </p>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === tab.id ? '#2563eb' : 'var(--color-text-muted)',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--color-text)';
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--color-text-muted)';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard' && <NetWorthDashboard />}

      {activeTab === 'history' && <NetWorthChart />}

      {activeTab === 'projections' && <NetWorthProjections />}

      {activeTab === 'manage' && (
        <AssetLiabilityList
          assets={assets}
          liabilities={liabilities}
          onCreateAsset={handleCreateAsset}
          onUpdateAsset={handleUpdateAsset}
          onDeleteAsset={handleDeleteAsset}
          onCreateLiability={handleCreateLiability}
          onUpdateLiability={handleUpdateLiability}
          onDeleteLiability={handleDeleteLiability}
        />
      )}
    </div>
  );
}

export default NetWorthPage;
