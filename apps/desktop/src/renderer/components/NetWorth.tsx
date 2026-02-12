import React, { useState, useEffect } from 'react';
import { Asset, AssetType, Liability, LiabilityType, NetWorthHistory } from '../../shared/types';

type TabType = 'overview' | 'assets' | 'liabilities' | 'history';

export default function NetWorth() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [history, setHistory] = useState<NetWorthHistory[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form state
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showLiabilityForm, setShowLiabilityForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);

  // Asset form
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('cash');
  const [assetValue, setAssetValue] = useState('');
  const [assetNotes, setAssetNotes] = useState('');

  // Liability form
  const [liabilityName, setLiabilityName] = useState('');
  const [liabilityType, setLiabilityType] = useState<LiabilityType>('credit_card');
  const [liabilityBalance, setLiabilityBalance] = useState('');
  const [liabilityRate, setLiabilityRate] = useState('');
  const [liabilityMinPayment, setLiabilityMinPayment] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allAssets, allLiabilities, assetTotal, liabilityTotal, netWorthHistory] = await Promise.all([
        window.api.assets.getAll(),
        window.api.liabilities.getAll(),
        window.api.assets.getTotal(),
        window.api.liabilities.getTotal(),
        window.api.netWorth.getHistory(12),
      ]);
      setAssets(allAssets);
      setLiabilities(allLiabilities);
      setTotalAssets(assetTotal);
      setTotalLiabilities(liabilityTotal);
      setHistory(netWorthHistory);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      setLoading(true);
      await window.api.netWorth.createHistory();
      await loadData();
    } catch (err) {
      console.error('Error creating snapshot:', err);
    } finally {
      setLoading(false);
    }
  };

  // Asset handlers
  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!assetName.trim()) {
      setError('Asset name is required');
      return;
    }

    const value = parseFloat(assetValue);
    if (isNaN(value) || value < 0) {
      setError('Please enter a valid value');
      return;
    }

    try {
      setLoading(true);
      if (editingAsset) {
        await window.api.assets.update(editingAsset.id, {
          name: assetName.trim(),
          type: assetType,
          value,
          notes: assetNotes || null,
          lastUpdated: new Date(),
        });
      } else {
        await window.api.assets.create({
          name: assetName.trim(),
          type: assetType,
          value,
          notes: assetNotes || null,
          lastUpdated: new Date(),
        });
      }
      resetAssetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save asset');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetName(asset.name);
    setAssetType(asset.type);
    setAssetValue(asset.value.toString());
    setAssetNotes(asset.notes || '');
    setShowAssetForm(true);
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (!confirm(`Delete asset "${asset.name}"?`)) return;
    try {
      await window.api.assets.delete(asset.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting asset:', err);
    }
  };

  const resetAssetForm = () => {
    setShowAssetForm(false);
    setEditingAsset(null);
    setAssetName('');
    setAssetType('cash');
    setAssetValue('');
    setAssetNotes('');
    setError('');
  };

  // Liability handlers
  const handleLiabilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!liabilityName.trim()) {
      setError('Liability name is required');
      return;
    }

    const balance = parseFloat(liabilityBalance);
    if (isNaN(balance) || balance < 0) {
      setError('Please enter a valid balance');
      return;
    }

    try {
      setLoading(true);
      if (editingLiability) {
        await window.api.liabilities.update(editingLiability.id, {
          name: liabilityName.trim(),
          type: liabilityType,
          balance,
          interestRate: liabilityRate ? parseFloat(liabilityRate) : null,
          minimumPayment: liabilityMinPayment ? parseFloat(liabilityMinPayment) : null,
          lastUpdated: new Date(),
        });
      } else {
        await window.api.liabilities.create({
          name: liabilityName.trim(),
          type: liabilityType,
          balance,
          interestRate: liabilityRate ? parseFloat(liabilityRate) : null,
          minimumPayment: liabilityMinPayment ? parseFloat(liabilityMinPayment) : null,
          lastUpdated: new Date(),
        });
      }
      resetLiabilityForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save liability');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLiability = (liability: Liability) => {
    setEditingLiability(liability);
    setLiabilityName(liability.name);
    setLiabilityType(liability.type);
    setLiabilityBalance(liability.balance.toString());
    setLiabilityRate(liability.interestRate?.toString() || '');
    setLiabilityMinPayment(liability.minimumPayment?.toString() || '');
    setShowLiabilityForm(true);
  };

  const handleDeleteLiability = async (liability: Liability) => {
    if (!confirm(`Delete liability "${liability.name}"?`)) return;
    try {
      await window.api.liabilities.delete(liability.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting liability:', err);
    }
  };

  const resetLiabilityForm = () => {
    setShowLiabilityForm(false);
    setEditingLiability(null);
    setLiabilityName('');
    setLiabilityType('credit_card');
    setLiabilityBalance('');
    setLiabilityRate('');
    setLiabilityMinPayment('');
    setError('');
  };

  const netWorth = totalAssets - totalLiabilities;

  const assetTypeLabels: Record<AssetType, string> = {
    cash: 'Cash & Savings',
    investment: 'Investments',
    property: 'Property',
    vehicle: 'Vehicles',
    other: 'Other',
  };

  const liabilityTypeLabels: Record<LiabilityType, string> = {
    mortgage: 'Mortgage',
    auto_loan: 'Auto Loan',
    student_loan: 'Student Loan',
    credit_card: 'Credit Card',
    personal_loan: 'Personal Loan',
    other: 'Other',
  };

  return (
    <div className="net-worth">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0 }}>Net Worth Tracking</h3>
        <button onClick={handleCreateSnapshot} className="btn btn-secondary" disabled={loading}>
          Take Snapshot
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Total Assets</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-success)' }}>
            ${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Total Liabilities</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-danger)' }}>
            ${totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Net Worth</div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: netWorth >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            ${netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
        {(['overview', 'assets', 'liabilities', 'history'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === tab ? 'var(--color-primary)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--color-text)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <h4>Assets by Type</h4>
            {Object.entries(assetTypeLabels).map(([type, label]) => {
              const typeAssets = assets.filter(a => a.type === type);
              const total = typeAssets.reduce((sum, a) => sum + a.value, 0);
              if (total === 0) return null;
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 500 }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              );
            })}
          </div>
          <div>
            <h4>Liabilities by Type</h4>
            {Object.entries(liabilityTypeLabels).map(([type, label]) => {
              const typeLiabilities = liabilities.filter(l => l.type === type);
              const total = typeLiabilities.reduce((sum, l) => sum + l.balance, 0);
              if (total === 0) return null;
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 500, color: 'var(--color-danger)' }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'assets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={() => setShowAssetForm(!showAssetForm)} className="btn btn-primary">
              {showAssetForm ? 'Cancel' : 'Add Asset'}
            </button>
          </div>

          {showAssetForm && (
            <form onSubmit={handleAssetSubmit} style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
              {error && <div style={{ color: 'var(--color-danger)', marginBottom: '12px' }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Name</label>
                  <input type="text" value={assetName} onChange={(e) => setAssetName(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Type</label>
                  <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)} style={{ width: '100%' }}>
                    {Object.entries(assetTypeLabels).map(([type, label]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Value</label>
                  <input type="number" value={assetValue} onChange={(e) => setAssetValue(e.target.value)} step="0.01" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Notes</label>
                <textarea value={assetNotes} onChange={(e) => setAssetNotes(e.target.value)} rows={2} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary">{editingAsset ? 'Update' : 'Add'}</button>
                <button type="button" onClick={resetAssetForm} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assets.map((asset) => (
              <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{asset.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{assetTypeLabels[asset.type]}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <button onClick={() => handleEditAsset(asset)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>Edit</button>
                  <button onClick={() => handleDeleteAsset(asset)} className="btn btn-outline-danger" style={{ padding: '4px 8px', fontSize: '12px' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'liabilities' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={() => setShowLiabilityForm(!showLiabilityForm)} className="btn btn-primary">
              {showLiabilityForm ? 'Cancel' : 'Add Liability'}
            </button>
          </div>

          {showLiabilityForm && (
            <form onSubmit={handleLiabilitySubmit} style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
              {error && <div style={{ color: 'var(--color-danger)', marginBottom: '12px' }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Name</label>
                  <input type="text" value={liabilityName} onChange={(e) => setLiabilityName(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Type</label>
                  <select value={liabilityType} onChange={(e) => setLiabilityType(e.target.value as LiabilityType)} style={{ width: '100%' }}>
                    {Object.entries(liabilityTypeLabels).map(([type, label]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Balance</label>
                  <input type="number" value={liabilityBalance} onChange={(e) => setLiabilityBalance(e.target.value)} step="0.01" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Interest Rate %</label>
                  <input type="number" value={liabilityRate} onChange={(e) => setLiabilityRate(e.target.value)} step="0.01" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Min Payment</label>
                  <input type="number" value={liabilityMinPayment} onChange={(e) => setLiabilityMinPayment(e.target.value)} step="0.01" style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary">{editingLiability ? 'Update' : 'Add'}</button>
                <button type="button" onClick={resetLiabilityForm} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {liabilities.map((liability) => (
              <div key={liability.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{liability.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {liabilityTypeLabels[liability.type]}
                    {liability.interestRate && ` - ${liability.interestRate}% APR`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>${liability.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <button onClick={() => handleEditLiability(liability)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>Edit</button>
                  <button onClick={() => handleDeleteLiability(liability)} className="btn btn-outline-danger" style={{ padding: '4px 8px', fontSize: '12px' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Net worth snapshots are taken manually. Click &quot;Take Snapshot&quot; to record your current net worth.
          </p>
          {history.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '32px' }}>
              No snapshots yet. Take your first snapshot to start tracking.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map((snapshot) => (
                <div key={snapshot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                    {new Date(snapshot.date).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-success)' }}>+${snapshot.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span style={{ color: 'var(--color-danger)' }}>-${snapshot.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span style={{ fontWeight: 600, color: snapshot.netWorth >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      = ${snapshot.netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
