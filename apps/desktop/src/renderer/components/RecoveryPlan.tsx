import React, { useState, useEffect } from 'react';

type QuickWinType = 'cancel_subscription' | 'move_bill_due_date' | 'reduce_budget' | 'optimize_debt_payment' | 'transfer_funds';
type QuickWinUrgency = 'immediate' | 'soon' | 'flexible';
type EmergencyLevel = 'none' | 'caution' | 'warning' | 'critical';

interface QuickWin {
  id: string;
  type: QuickWinType;
  title: string;
  description: string;
  potentialSavings: number;
  annualImpact: number;
  urgency: QuickWinUrgency;
  confidence: number;
  actionable: boolean;
  sourceEngine: string;
  metadata: Record<string, unknown>;
}

interface EmergencyStatus {
  level: EmergencyLevel;
  daysUntilNegative: number | null;
  projectedNegativeDate: Date | null;
  lowestProjectedBalance: number;
  triggeringExpenses: string[];
}

interface RecoveryPlanReport {
  emergencyStatus: EmergencyStatus;
  quickWins: QuickWin[];
  totalPotentialMonthlySavings: number;
  survivalMode: {
    totalEssentialMonthly: number;
    totalPausableMonthly: number;
    potentialSavingsIfAllPaused: number;
    recommendations: string[];
  } | null;
  insights: string[];
  generatedAt: Date;
}

interface RecoveryPlanProps {
  onNavigateToEmergency?: () => void;
  onNavigateToSimulator?: () => void;
}

const RecoveryPlan: React.FC<RecoveryPlanProps> = ({ onNavigateToEmergency, onNavigateToSimulator }) => {
  const [report, setReport] = useState<RecoveryPlanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.recoveryPlan.generate();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recovery plan');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyQuickWin = async (quickWin: QuickWin) => {
    try {
      setApplyingId(quickWin.id);
      const result = await window.api.recoveryPlan.applyQuickWin({
        id: quickWin.id,
        type: quickWin.type,
        metadata: quickWin.metadata,
      });
      if (result.success) {
        setAppliedIds(prev => new Set([...prev, quickWin.id]));
      }
    } catch (err) {
      console.error('Failed to apply quick win:', err);
    } finally {
      setApplyingId(null);
    }
  };

  const getTypeIcon = (type: QuickWinType): string => {
    switch (type) {
      case 'cancel_subscription': return 'X';
      case 'move_bill_due_date': return '>';
      case 'reduce_budget': return '-';
      case 'optimize_debt_payment': return '$';
      case 'transfer_funds': return '<>';
      default: return '!';
    }
  };

  const getUrgencyColor = (urgency: QuickWinUrgency): string => {
    switch (urgency) {
      case 'immediate': return 'var(--color-danger)';
      case 'soon': return 'var(--color-warning)';
      case 'flexible': return 'var(--color-info)';
      default: return 'var(--color-text-muted)';
    }
  };

  const getEmergencyBannerStyle = (level: EmergencyLevel) => {
    switch (level) {
      case 'critical':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'var(--color-danger)', color: 'var(--color-danger)' };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: 'var(--color-warning)', color: 'var(--color-warning)' };
      case 'caution':
        return { bg: 'rgba(59, 130, 246, 0.1)', border: 'var(--color-info)', color: 'var(--color-info)' };
      default:
        return { bg: 'var(--color-success-bg)', border: 'var(--color-success)', color: 'var(--color-success)' };
    }
  };

  if (loading) {
    return (
      <div className="recovery-plan recovery-plan--loading">
        <div className="spinner" />
        <span>Analyzing your finances...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recovery-plan recovery-plan--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadReport} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!report) return null;

  const filteredQuickWins = report.quickWins.filter(qw => {
    if (appliedIds.has(qw.id)) return false;
    if (filterType !== 'all' && qw.type !== filterType) return false;
    if (filterUrgency !== 'all' && qw.urgency !== filterUrgency) return false;
    return true;
  });

  const bannerStyle = getEmergencyBannerStyle(report.emergencyStatus.level);

  return (
    <div className="recovery-plan">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Recovery Plan</h3>
        <button onClick={loadReport} className="btn btn-secondary" style={{ fontSize: '13px' }}>
          Refresh
        </button>
      </div>

      {/* Emergency Banner */}
      {report.emergencyStatus.level !== 'none' && (
        <div
          className="emergency-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            backgroundColor: bannerStyle.bg,
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${bannerStyle.border}`,
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: bannerStyle.border,
              color: 'white',
              fontWeight: 'bold',
              fontSize: '20px',
            }}
          >
            {report.emergencyStatus.level === 'critical' ? '!' : report.emergencyStatus.level === 'warning' ? '!' : 'i'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: bannerStyle.color }}>
              {report.emergencyStatus.level === 'critical' && 'Critical: Balance goes negative soon!'}
              {report.emergencyStatus.level === 'warning' && 'Warning: Low balance approaching'}
              {report.emergencyStatus.level === 'caution' && 'Caution: Cash flow getting tight'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {report.emergencyStatus.daysUntilNegative !== null ? (
                <>
                  {report.emergencyStatus.daysUntilNegative} days until negative balance
                  {report.emergencyStatus.projectedNegativeDate && (
                    <> ({new Date(report.emergencyStatus.projectedNegativeDate).toLocaleDateString()})</>
                  )}
                </>
              ) : (
                <>Lowest projected balance: ${(report.emergencyStatus.lowestProjectedBalance / 100).toFixed(0)}</>
              )}
            </div>
          </div>
          {onNavigateToEmergency && (
            <button onClick={onNavigateToEmergency} className="btn btn-primary">
              View Emergency Mode
            </button>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-success)' }}>
            ${(report.totalPotentialMonthlySavings / 100).toFixed(0)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Monthly Savings Potential</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {report.quickWins.length}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Quick Wins Found</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-danger)' }}>
            {report.quickWins.filter(qw => qw.urgency === 'immediate').length}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Urgent Actions</div>
        </div>
      </div>

      {/* Insights */}
      {report.insights.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'var(--color-info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-info)' }}>
          <div style={{ fontWeight: '500', marginBottom: '8px', color: 'var(--color-info)' }}>Insights</div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
            {report.insights.map((insight, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ fontSize: '13px' }}
        >
          <option value="all">All Types</option>
          <option value="cancel_subscription">Cancel Subscription</option>
          <option value="move_bill_due_date">Move Due Date</option>
          <option value="reduce_budget">Reduce Budget</option>
          <option value="optimize_debt_payment">Optimize Debt</option>
          <option value="transfer_funds">Transfer Funds</option>
        </select>
        <select
          value={filterUrgency}
          onChange={(e) => setFilterUrgency(e.target.value)}
          style={{ fontSize: '13px' }}
        >
          <option value="all">All Urgencies</option>
          <option value="immediate">Immediate</option>
          <option value="soon">Soon</option>
          <option value="flexible">Flexible</option>
        </select>
        {onNavigateToSimulator && (
          <button onClick={onNavigateToSimulator} className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: '13px' }}>
            What-If Simulator
          </button>
        )}
      </div>

      {/* Quick Wins List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredQuickWins.map((qw) => (
          <div
            key={qw.id}
            className="quick-win-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              borderLeft: `4px solid ${getUrgencyColor(qw.urgency)}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg)',
                fontWeight: 'bold',
                fontSize: '14px',
                color: 'var(--color-text-muted)',
              }}
            >
              {getTypeIcon(qw.type)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '500', marginBottom: '2px' }}>{qw.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {qw.description}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: '80px' }}>
              {qw.potentialSavings > 0 && (
                <div style={{ fontWeight: '600', color: 'var(--color-success)' }}>
                  +${(qw.potentialSavings / 100).toFixed(0)}/mo
                </div>
              )}
              {qw.annualImpact > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  ${(qw.annualImpact / 100).toFixed(0)}/yr
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span
                className="urgency-badge"
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: getUrgencyColor(qw.urgency),
                  color: 'white',
                  textTransform: 'uppercase',
                }}
              >
                {qw.urgency}
              </span>
              {qw.actionable && (
                <button
                  onClick={() => handleApplyQuickWin(qw)}
                  disabled={applyingId === qw.id}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '4px 12px' }}
                >
                  {applyingId === qw.id ? '...' : 'Apply'}
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredQuickWins.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {appliedIds.size > 0 ? 'All quick wins applied!' : 'No quick wins match your filters'}
          </div>
        )}
      </div>

      {/* Applied count */}
      {appliedIds.size > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-success)' }}>
          {appliedIds.size} quick win(s) applied
        </div>
      )}
    </div>
  );
};

export default RecoveryPlan;
