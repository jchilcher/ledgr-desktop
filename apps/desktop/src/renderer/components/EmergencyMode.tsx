import React, { useState, useEffect } from 'react';

interface PausableExpense {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  monthlyEquivalent: number;
  isEssential: boolean;
  categoryId?: string | null;
  categoryName?: string;
  canPause: boolean;
  pauseReason?: string;
}

interface SurvivalModeResult {
  essentialExpenses: PausableExpense[];
  pausableExpenses: PausableExpense[];
  totalEssentialMonthly: number;
  totalPausableMonthly: number;
  potentialSavingsIfAllPaused: number;
  recommendations: string[];
}

interface EmergencyStatus {
  level: 'none' | 'caution' | 'warning' | 'critical';
  daysUntilNegative: number | null;
  projectedNegativeDate: Date | null;
  lowestProjectedBalance: number;
  triggeringExpenses: string[];
}

const EmergencyMode: React.FC = () => {
  const [survivalMode, setSurvivalMode] = useState<SurvivalModeResult | null>(null);
  const [emergencyStatus, setEmergencyStatus] = useState<EmergencyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedToPause, setSelectedToPause] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [survival, status] = await Promise.all([
        window.api.recoveryPlan.getSurvivalMode(),
        window.api.recoveryPlan.getEmergencyStatus(),
      ]);
      setSurvivalMode(survival);
      setEmergencyStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emergency data');
    } finally {
      setLoading(false);
    }
  };

  const togglePause = (id: string) => {
    setSelectedToPause(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllPausable = () => {
    if (!survivalMode) return;
    setSelectedToPause(new Set(survivalMode.pausableExpenses.filter(e => e.canPause).map(e => e.id)));
  };

  const clearSelection = () => {
    setSelectedToPause(new Set());
  };

  const handleApplyPauses = async () => {
    if (selectedToPause.size === 0) return;

    try {
      setApplying(true);
      let count = 0;
      for (const id of selectedToPause) {
        await window.api.recurring.update(id, { isActive: false });
        count++;
      }
      setAppliedCount(count);
      setSelectedToPause(new Set());
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setApplying(false);
    }
  };

  const calculateSelectedSavings = (): number => {
    if (!survivalMode) return 0;
    return survivalMode.pausableExpenses
      .filter(e => selectedToPause.has(e.id))
      .reduce((sum, e) => sum + e.monthlyEquivalent, 0);
  };

  const getEmergencyBannerColor = () => {
    switch (emergencyStatus?.level) {
      case 'critical': return { bg: 'rgba(239, 68, 68, 0.15)', border: 'var(--color-danger)', text: 'var(--color-danger)' };
      case 'warning': return { bg: 'rgba(245, 158, 11, 0.15)', border: 'var(--color-warning)', text: 'var(--color-warning)' };
      case 'caution': return { bg: 'rgba(59, 130, 246, 0.1)', border: 'var(--color-info)', text: 'var(--color-info)' };
      default: return { bg: 'var(--color-success-bg)', border: 'var(--color-success)', text: 'var(--color-success)' };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" />
        <div style={{ marginTop: '16px', color: 'var(--color-text-muted)' }}>Loading emergency mode...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', backgroundColor: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)' }}>
        {error}
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>Retry</button>
      </div>
    );
  }

  if (!survivalMode || !emergencyStatus) return null;

  const bannerColors = getEmergencyBannerColor();
  const selectedSavings = calculateSelectedSavings();

  return (
    <div className="emergency-mode">
      <h3 style={{ marginBottom: '16px' }}>Emergency Mode</h3>

      {/* Emergency Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '20px',
          backgroundColor: bannerColors.bg,
          borderRadius: 'var(--radius-md)',
          border: `2px solid ${bannerColors.border}`,
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: bannerColors.border,
            color: 'white',
            fontWeight: 'bold',
            fontSize: '24px',
          }}
        >
          {emergencyStatus.daysUntilNegative !== null ? emergencyStatus.daysUntilNegative : '!'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: bannerColors.text }}>
            {emergencyStatus.level === 'critical' && 'Critical Alert'}
            {emergencyStatus.level === 'warning' && 'Warning'}
            {emergencyStatus.level === 'caution' && 'Caution'}
            {emergencyStatus.level === 'none' && 'Cash Flow OK'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {emergencyStatus.daysUntilNegative !== null ? (
              <>
                Your balance is projected to go negative in <strong>{emergencyStatus.daysUntilNegative} days</strong>
                {emergencyStatus.projectedNegativeDate && (
                  <> ({new Date(emergencyStatus.projectedNegativeDate).toLocaleDateString()})</>
                )}
              </>
            ) : (
              <>Lowest projected balance: ${(emergencyStatus.lowestProjectedBalance / 100).toFixed(0)}</>
            )}
          </div>
          {emergencyStatus.triggeringExpenses.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
              Key expenses: {emergencyStatus.triggeringExpenses.slice(0, 3).join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-danger)' }}>
            ${(survivalMode.totalEssentialMonthly / 100).toFixed(0)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Essential Monthly</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-warning)' }}>
            ${(survivalMode.totalPausableMonthly / 100).toFixed(0)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Pausable Monthly</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-success)' }}>
            ${(survivalMode.potentialSavingsIfAllPaused / 100).toFixed(0)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Max Savings If Paused</div>
        </div>
      </div>

      {/* Recommendations */}
      {survivalMode.recommendations.length > 0 && (
        <div style={{ marginBottom: '24px', padding: '12px 16px', backgroundColor: 'var(--color-info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-info)' }}>
          <div style={{ fontWeight: '500', marginBottom: '8px', color: 'var(--color-info)' }}>Recommendations</div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
            {survivalMode.recommendations.map((rec, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Essential Expenses */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, color: 'var(--color-danger)' }}>Essential Expenses ({survivalMode.essentialExpenses.length})</h4>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {survivalMode.essentialExpenses.map((expense) => (
              <div
                key={expense.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  borderLeft: '4px solid var(--color-danger)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500' }}>{expense.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {expense.categoryName || 'Uncategorized'} | {expense.frequency}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '600' }}>${(expense.monthlyEquivalent / 100).toFixed(0)}/mo</div>
                </div>
              </div>
            ))}
            {survivalMode.essentialExpenses.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No essential expenses identified
              </div>
            )}
          </div>
        </div>

        {/* Pausable Expenses */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, color: 'var(--color-success)' }}>Pausable Expenses ({survivalMode.pausableExpenses.length})</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={selectAllPausable} className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }}>
                Select All
              </button>
              <button onClick={clearSelection} className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }}>
                Clear
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {survivalMode.pausableExpenses.map((expense) => (
              <div
                key={expense.id}
                onClick={() => expense.canPause && togglePause(expense.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: selectedToPause.has(expense.id) ? 'var(--color-success-bg)' : 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selectedToPause.has(expense.id) ? 'var(--color-success)' : 'var(--color-border)'}`,
                  borderLeft: '4px solid var(--color-success)',
                  cursor: expense.canPause ? 'pointer' : 'default',
                  opacity: expense.canPause ? 1 : 0.6,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedToPause.has(expense.id)}
                  onChange={() => {}}
                  disabled={!expense.canPause}
                  style={{ width: '18px', height: '18px', cursor: expense.canPause ? 'pointer' : 'default' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500' }}>{expense.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {expense.categoryName || 'Uncategorized'} | {expense.frequency}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '600', color: 'var(--color-success)' }}>${(expense.monthlyEquivalent / 100).toFixed(0)}/mo</div>
                </div>
              </div>
            ))}
            {survivalMode.pausableExpenses.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No pausable expenses found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {selectedToPause.size > 0 && (
        <div
          style={{
            position: 'sticky',
            bottom: '20px',
            marginTop: '24px',
            padding: '16px 20px',
            backgroundColor: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div>
            <div style={{ fontWeight: '600' }}>
              {selectedToPause.size} expense(s) selected
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Potential savings: ${(selectedSavings / 100).toFixed(0)}/month
            </div>
          </div>
          <button
            onClick={handleApplyPauses}
            disabled={applying}
            style={{
              padding: '10px 24px',
              backgroundColor: 'white',
              color: 'var(--color-success)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {applying ? 'Applying...' : 'Pause Selected'}
          </button>
        </div>
      )}

      {/* Applied Confirmation */}
      {appliedCount > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-success)' }}>
          Successfully paused {appliedCount} expense(s)
        </div>
      )}
    </div>
  );
};

export default EmergencyMode;
