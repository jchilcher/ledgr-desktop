import { useState, useEffect } from 'react';
import { Investment, InvestmentType, InvestmentSettings } from '../../shared/types';
import { AllocationChart } from './AllocationChart';
import { ConcentrationWarning, ConcentrationBadge, ConcentrationSettings } from './ConcentrationWarning';

const investmentTypeLabels: Record<InvestmentType, string> = {
  stock: 'Stock',
  bond: 'Bond',
  mutual_fund: 'Mutual Fund',
  etf: 'ETF',
  crypto: 'Cryptocurrency',
  other: 'Other',
};

export function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAllocation, setShowAllocation] = useState(false);
  const [showConcentrationSettings, setShowConcentrationSettings] = useState(false);
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    type: 'stock' as InvestmentType,
    shares: 0,
    costBasis: 0,
    currentPrice: 0,
    accountId: '',
  });

  useEffect(() => {
    loadInvestments();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await window.api.investmentSettings.get();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load investment settings:', error);
    }
  };

  const handleSettingsSaved = () => {
    loadSettings();
  };

  const loadInvestments = async () => {
    try {
      const data = await window.api.investments.getAll();
      setInvestments(data);
    } catch (error) {
      console.error('Failed to load investments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await window.api.investments.update(editingId, {
          ...formData,
          lastUpdated: new Date(),
        });
      } else {
        await window.api.investments.create({
          ...formData,
          lastUpdated: new Date(),
        });
      }
      resetForm();
      loadInvestments();
    } catch (error) {
      console.error('Failed to save investment:', error);
    }
  };

  const handleEdit = (investment: Investment) => {
    setFormData({
      name: investment.name,
      ticker: investment.ticker || '',
      type: investment.type,
      shares: investment.shares,
      costBasis: investment.costBasis,
      currentPrice: investment.currentPrice,
      accountId: investment.accountId || '',
    });
    setEditingId(investment.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this investment?')) {
      try {
        await window.api.investments.delete(id);
        loadInvestments();
      } catch (error) {
        console.error('Failed to delete investment:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ticker: '',
      type: 'stock',
      shares: 0,
      costBasis: 0,
      currentPrice: 0,
      accountId: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const calculateValue = (inv: Investment) => inv.shares * inv.currentPrice;
  const calculateGain = (inv: Investment) => (inv.currentPrice - inv.costBasis) * inv.shares;
  const calculateGainPercent = (inv: Investment) =>
    inv.costBasis > 0 ? ((inv.currentPrice - inv.costBasis) / inv.costBasis) * 100 : 0;

  const totalValue = investments.reduce((sum, inv) => sum + calculateValue(inv), 0);

  const getPositionPercentage = (inv: Investment) => {
    if (totalValue === 0) return 0;
    return (calculateValue(inv) / totalValue) * 100;
  };
  const totalCost = investments.reduce((sum, inv) => sum + (inv.costBasis * inv.shares), 0);
  const totalGain = totalValue - totalCost;

  return (
    <div className="investments">
      <div className="investments-header">
        <h3>Investments</h3>
        <div className="header-actions">
          <button
            onClick={() => setShowAllocation(!showAllocation)}
            className={`allocation-btn ${showAllocation ? 'active' : ''}`}
          >
            {showAllocation ? 'Hide Allocation' : 'Show Allocation'}
          </button>
          <button onClick={() => setShowForm(true)} className="add-btn">
            Add Investment
          </button>
        </div>
      </div>

      <div className="investments-summary">
        <div className="summary-item">
          <span className="label">Total Value</span>
          <span className="value">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="summary-item">
          <span className="label">Total Gain/Loss</span>
          <span className={`value ${totalGain >= 0 ? 'positive' : 'negative'}`}>
            {totalGain >= 0 ? '+' : ''}${totalGain.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <ConcentrationWarning
        investments={investments}
        onSettingsClick={() => setShowConcentrationSettings(true)}
      />

      {showAllocation && (
        <AllocationChart
          investments={investments}
          onDrillDown={() => {
            // Could filter investments list or show detail view
          }}
        />
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="investment-form">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Ticker Symbol</label>
            <input
              type="text"
              placeholder="ticker"
              value={formData.ticker}
              onChange={e => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as InvestmentType })}
            >
              {Object.entries(investmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Shares</label>
              <input
                type="number"
                placeholder="shares"
                value={formData.shares || ''}
                onChange={e => setFormData({ ...formData, shares: parseFloat(e.target.value) || 0 })}
                step="0.0001"
                required
              />
            </div>

            <div className="form-group">
              <label>Cost Basis (per share)</label>
              <input
                type="number"
                placeholder="cost"
                value={formData.costBasis || ''}
                onChange={e => setFormData({ ...formData, costBasis: parseFloat(e.target.value) || 0 })}
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Current Price</label>
              <input
                type="number"
                placeholder="price"
                value={formData.currentPrice || ''}
                onChange={e => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit">{editingId ? 'Update' : 'Create'}</button>
            <button type="button" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      )}

      <div className="investments-list">
        {investments.length === 0 ? (
          <p className="empty-state">No investments yet. Add your first investment to start tracking.</p>
        ) : (
          investments.map(inv => {
            const value = calculateValue(inv);
            const gain = calculateGain(inv);
            const gainPercent = calculateGainPercent(inv);

            return (
              <div key={inv.id} className="investment-card">
                <div className="investment-header">
                  <div className="investment-name">
                    <strong>{inv.name}</strong>
                    {inv.ticker && <span className="ticker">{inv.ticker}</span>}
                  </div>
                  <span className="investment-type">{investmentTypeLabels[inv.type]}</span>
                </div>

                <div className="investment-details">
                  <div className="detail">
                    <span className="label">Shares</span>
                    <span className="value">{inv.shares.toLocaleString()}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Current Price</span>
                    <span className="value">${inv.currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Value</span>
                    <div className="value-with-badge">
                      <span className="value">${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <ConcentrationBadge
                        percentage={getPositionPercentage(inv)}
                        threshold={settings?.concentrationThreshold ?? 25}
                      />
                    </div>
                  </div>
                  <div className="detail">
                    <span className="label">Gain/Loss</span>
                    <span className={`value ${gain >= 0 ? 'positive' : 'negative'}`}>
                      {gain >= 0 ? '+' : ''}${gain.toFixed(2)} ({gainPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                <div className="investment-actions">
                  <button onClick={() => handleEdit(inv)}>Edit</button>
                  <button onClick={() => handleDelete(inv.id)} className="delete-btn">Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConcentrationSettings
        isOpen={showConcentrationSettings}
        onClose={() => setShowConcentrationSettings(false)}
        onSave={handleSettingsSaved}
        currentThreshold={settings?.concentrationThreshold ?? 25}
      />
    </div>
  );
}
