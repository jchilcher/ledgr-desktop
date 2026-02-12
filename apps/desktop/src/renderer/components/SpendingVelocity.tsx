import React, { useState, useEffect } from 'react';

type VelocityStatus = 'safe' | 'warning' | 'danger';

interface SpendingVelocity {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  currentSpent: number;
  dailyBurnRate: number;
  projectedTotal: number;
  daysRemaining: number;
  depletionDate: Date | null;
  percentUsed: number;
  status: VelocityStatus;
  paceVsBudget: number;
}

interface SpendingVelocityReport {
  period: {
    startDate: Date;
    endDate: Date;
    daysElapsed: number;
    daysRemaining: number;
  };
  velocities: SpendingVelocity[];
  summary: {
    categoriesAtRisk: number;
    totalBudget: number;
    totalProjectedSpending: number;
    overallStatus: VelocityStatus;
  };
}

const SpendingVelocityComponent: React.FC = () => {
  const [report, setReport] = useState<SpendingVelocityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.spendingVelocity.calculate(period);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate spending velocity');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: VelocityStatus) => {
    switch (status) {
      case 'safe':
        return '#22c55e';
      case 'warning':
        return '#f59e0b';
      case 'danger':
        return '#ef4444';
    }
  };

  const getStatusLabel = (status: VelocityStatus) => {
    switch (status) {
      case 'safe':
        return 'On Track';
      case 'warning':
        return 'At Risk';
      case 'danger':
        return 'Over Budget';
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="spending-velocity spending-velocity--loading">
        <div className="spinner" />
        <span>Calculating spending velocity...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="spending-velocity spending-velocity--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!report || report.velocities.length === 0) {
    return (
      <div className="spending-velocity spending-velocity--empty">
        <p>No budget goals set for the current period.</p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Create budget goals in the Budgets tab to track spending velocity.
        </p>
      </div>
    );
  }

  return (
    <div className="spending-velocity">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Spending Velocity</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'weekly' | 'monthly' | 'yearly')}
            style={{ fontSize: '13px' }}
          >
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="yearly">This Year</option>
          </select>
          <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Period Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Days Elapsed</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{report.period.daysElapsed}</div>
        </div>
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Days Remaining</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{report.period.daysRemaining}</div>
        </div>
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Categories at Risk</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: report.summary.categoriesAtRisk > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {report.summary.categoriesAtRisk}
          </div>
        </div>
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Overall Status</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: getStatusColor(report.summary.overallStatus) }}>
            {getStatusLabel(report.summary.overallStatus)}
          </div>
        </div>
      </div>

      {/* Velocity Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {report.velocities.map((velocity) => (
          <div
            key={velocity.categoryId}
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              borderLeft: `4px solid ${getStatusColor(velocity.status)}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>{velocity.categoryName}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Budget: ${(velocity.budgetAmount / 100).toLocaleString()}
                </div>
              </div>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: getStatusColor(velocity.status),
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                {getStatusLabel(velocity.status)}
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  height: '8px',
                  backgroundColor: 'var(--color-border)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(velocity.percentUsed, 100)}%`,
                    backgroundColor: getStatusColor(velocity.status),
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <span>${(velocity.currentSpent / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} spent</span>
                <span>{velocity.percentUsed.toFixed(0)}% used</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '13px' }}>
              <div>
                <div style={{ color: 'var(--color-text-muted)' }}>Daily Rate</div>
                <div style={{ fontWeight: '500' }}>${(velocity.dailyBurnRate / 100).toFixed(0)}/day</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)' }}>Projected</div>
                <div style={{ fontWeight: '500', color: velocity.projectedTotal > velocity.budgetAmount ? 'var(--color-danger)' : 'inherit' }}>
                  ${(velocity.projectedTotal / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)' }}>Pace</div>
                <div style={{ fontWeight: '500', color: velocity.paceVsBudget > 1 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {velocity.paceVsBudget > 1 ? '+' : ''}{((velocity.paceVsBudget - 1) * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)' }}>Depletes</div>
                <div style={{ fontWeight: '500', color: velocity.depletionDate ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {velocity.depletionDate ? formatDate(velocity.depletionDate) : 'OK'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpendingVelocityComponent;
