import React, { useState, useEffect } from 'react';

type ScenarioType = 'current_pace' | 'aggressive' | 'conservative';

interface SavingsScenario {
  type: ScenarioType;
  label: string;
  monthlyContribution: number;
  projectedCompletionDate: Date | null;
  monthsToCompletion: number | null;
  totalContributions: number;
  onTrack: boolean;
}

interface SavingsProjection {
  goalId: string;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentComplete: number;
  targetDate: Date | null;
  currentMonthlyRate: number;
  averageContribution: number;
  projectedCompletionDate: Date | null;
  monthsToCompletion: number | null;
  requiredMonthlyToHitTarget: number | null;
  onTrack: boolean;
  scenarios: SavingsScenario[];
  contributionHistory: Array<{
    month: string;
    amount: number;
  }>;
}

interface SavingsProjectionReport {
  projections: SavingsProjection[];
  summary: {
    totalTargetAmount: number;
    totalCurrentAmount: number;
    totalRemainingAmount: number;
    goalsOnTrack: number;
    goalsAtRisk: number;
    averagePercentComplete: number;
    estimatedTotalMonthlyNeeded: number;
  };
  recommendations: string[];
}

const SavingsProjections: React.FC = () => {
  const [report, setReport] = useState<SavingsProjectionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.savingsProjection.generate();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate savings projections');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    let d: Date;
    if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, day] = date.split('-').map(Number);
      d = new Date(y, m - 1, day);
    } else {
      d = new Date(date);
    }
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amountInCents / 100);
  };

  const getScenarioColor = (type: ScenarioType) => {
    switch (type) {
      case 'current_pace': return 'var(--color-primary)';
      case 'aggressive': return '#22c55e';
      case 'conservative': return '#f59e0b';
    }
  };

  if (loading) {
    return (
      <div className="savings-projections savings-projections--loading">
        <div className="spinner" />
        <span>Generating savings projections...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="savings-projections savings-projections--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!report || report.projections.length === 0) {
    return (
      <div className="savings-projections savings-projections--empty">
        <p>No savings goals to project.</p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Create savings goals above to see projections and scenarios.
        </p>
      </div>
    );
  }

  return (
    <div className="savings-projections">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Savings Projections</h3>
        <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: '13px' }}>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Total Target</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {formatCurrency(report.summary.totalTargetAmount)}
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Total Saved</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-success)' }}>
            {formatCurrency(report.summary.totalCurrentAmount)}
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Avg Progress</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {report.summary.averagePercentComplete.toFixed(0)}%
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: report.summary.goalsAtRisk > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: report.summary.goalsAtRisk > 0 ? '1px solid var(--color-danger)' : 'none' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Goals Status</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            <span style={{ color: 'var(--color-success)' }}>{report.summary.goalsOnTrack} on track</span>
            {report.summary.goalsAtRisk > 0 && (
              <span style={{ color: 'var(--color-danger)' }}> / {report.summary.goalsAtRisk} at risk</span>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Recommendations</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.recommendations.map((rec, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '4px solid var(--color-info)',
                  fontSize: '14px',
                }}
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Projections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {report.projections.map((projection) => (
          <div
            key={projection.goalId}
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              borderLeft: `4px solid ${projection.onTrack ? 'var(--color-success)' : 'var(--color-warning)'}`,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedGoal(expandedGoal === projection.goalId ? null : projection.goalId)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500', fontSize: '16px' }}>{projection.goalName}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: projection.onTrack ? 'var(--color-success)' : 'var(--color-warning)',
                        color: 'white',
                      }}
                    >
                      {projection.onTrack ? 'On Track' : 'At Risk'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {formatCurrency(projection.currentAmount)} of {formatCurrency(projection.targetAmount)} ({projection.percentComplete.toFixed(0)}%)
                    {projection.targetDate && (
                      <span> | Target: {formatDate(projection.targetDate)}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    Est. Completion
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: projection.onTrack ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {formatDate(projection.projectedCompletionDate)}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginTop: '12px' }}>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'var(--color-border)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(projection.percentComplete, 100)}%`,
                      backgroundColor: projection.onTrack ? 'var(--color-success)' : 'var(--color-warning)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedGoal === projection.goalId && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--color-border)' }}>
                {/* Key Stats */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '16px',
                    marginTop: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Remaining</div>
                    <div style={{ fontWeight: '500' }}>{formatCurrency(projection.remainingAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Current Rate</div>
                    <div style={{ fontWeight: '500' }}>{formatCurrency(projection.currentMonthlyRate)}/mo</div>
                  </div>
                  {projection.requiredMonthlyToHitTarget && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Required Rate</div>
                      <div style={{ fontWeight: '500', color: projection.currentMonthlyRate >= projection.requiredMonthlyToHitTarget ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatCurrency(projection.requiredMonthlyToHitTarget)}/mo
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Months to Go</div>
                    <div style={{ fontWeight: '500' }}>
                      {projection.monthsToCompletion !== null ? projection.monthsToCompletion : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Scenarios */}
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ margin: '0 0 12px 0' }}>Scenarios</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {projection.scenarios.map((scenario) => (
                      <div
                        key={scenario.type}
                        style={{
                          padding: '12px',
                          backgroundColor: 'var(--color-surface-alt)',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: `3px solid ${getScenarioColor(scenario.type)}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: '500' }}>{scenario.label}</span>
                            <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                              ({formatCurrency(scenario.monthlyContribution)}/mo)
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '14px' }}>
                              {formatDate(scenario.projectedCompletionDate)}
                            </span>
                            {scenario.onTrack && (
                              <span style={{ color: 'var(--color-success)', fontSize: '12px' }}>On Track</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contribution History */}
                {projection.contributionHistory.length > 0 && (
                  <div>
                    <h5 style={{ margin: '0 0 12px 0' }}>Contribution History (Last 6 months)</h5>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {projection.contributionHistory.slice(-6).map((entry) => (
                        <div
                          key={entry.month}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: 'var(--color-surface-alt)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '13px',
                          }}
                        >
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{entry.month}</div>
                          <div style={{ fontWeight: '500', color: 'var(--color-success)' }}>
                            {formatCurrency(entry.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavingsProjections;
