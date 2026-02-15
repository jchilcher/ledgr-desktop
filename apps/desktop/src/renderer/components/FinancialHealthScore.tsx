import React, { useState, useEffect } from 'react';

interface FinancialHealthFactor {
  name: string;
  score: number;
  weight: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  recommendation?: string;
  metric?: { currentValue: string; targetValue: string; unit: string };
}

interface FinancialHealthScore {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: FinancialHealthFactor[];
  recommendations: string[];
  trend: 'improving' | 'stable' | 'declining';
  previousScore?: number;
}

interface HealthHistoryEntry {
  id: string;
  date: Date;
  overallScore: number;
  factorScores: string;
  createdAt: Date;
}

const FinancialHealthScoreComponent: React.FC = () => {
  const [score, setScore] = useState<FinancialHealthScore | null>(null);
  const [history, setHistory] = useState<HealthHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate current financial health
      const healthData = await window.api.financialHealthCalc.calculate();
      setScore(healthData);

      // Get history
      const historyData = await window.api.financialHealth.getHistory(12);
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate financial health');
    } finally {
      setLoading(false);
    }
  };

  const saveSnapshot = async () => {
    if (!score) return;

    try {
      await window.api.financialHealth.createSnapshot({
        overallScore: score.overallScore,
        factorScores: JSON.stringify(score.factors),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save snapshot');
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return '#22c55e';
      case 'B': return '#84cc16';
      case 'C': return '#f59e0b';
      case 'D': return '#f97316';
      case 'F': return '#ef4444';
      default: return 'var(--color-text)';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return '#22c55e';
      case 'good': return '#84cc16';
      case 'fair': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return 'var(--color-text-muted)';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↑';
      case 'declining': return '↓';
      default: return '→';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return '#22c55e';
      case 'declining': return '#ef4444';
      default: return 'var(--color-text-muted)';
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="financial-health financial-health--loading">
        <div className="spinner" />
        <span>Calculating financial health...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="financial-health financial-health--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="financial-health financial-health--empty">
        <p>Unable to calculate financial health score.</p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Add transactions and set up budget goals to enable health scoring.
        </p>
      </div>
    );
  }

  return (
    <div className="financial-health">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Financial Health Score</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn btn-secondary"
            style={{ fontSize: '13px' }}
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
          <button onClick={saveSnapshot} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            Save Snapshot
          </button>
          <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Main Score Display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: '32px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: `conic-gradient(${getGradeColor(score.grade)} ${score.overallScore * 3.6}deg, var(--color-border) 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '48px', fontWeight: 'bold', color: getGradeColor(score.grade) }}>
              {score.overallScore}
            </span>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: getGradeColor(score.grade) }}>
              {score.grade}
            </span>
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '18px',
              fontWeight: '500',
              color: getTrendColor(score.trend),
            }}
          >
            {getTrendIcon(score.trend)} {score.trend.charAt(0).toUpperCase() + score.trend.slice(1)}
          </span>
          {score.previousScore !== undefined && (
            <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
              (was {score.previousScore})
            </span>
          )}
        </div>
      </div>

      {/* Factor Breakdown */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0' }}>Score Breakdown</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {score.factors.map((factor, index) => (
            <div
              key={index}
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `4px solid ${getStatusColor(factor.status)}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontWeight: '500' }}>{factor.name}</span>
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    ({(factor.weight * 100).toFixed(0)}% weight)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      backgroundColor: getStatusColor(factor.status),
                      color: 'white',
                      textTransform: 'capitalize',
                    }}
                  >
                    {factor.status}
                  </span>
                  <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{factor.score}</span>
                </div>
              </div>

              {factor.metric && (
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px',
                  marginBottom: '8px',
                  fontSize: '13px',
                }}>
                  <span style={{ fontWeight: '600', color: getStatusColor(factor.status) }}>
                    {factor.metric.currentValue}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    / {factor.metric.targetValue} {factor.metric.unit}
                  </span>
                </div>
              )}

              {/* Progress Bar */}
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
                    width: `${factor.score}%`,
                    backgroundColor: getStatusColor(factor.status),
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {factor.recommendation && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {factor.recommendation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0' }}>Recommendations</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {score.recommendations.map((rec, index) => (
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

      {/* History */}
      {showHistory && history.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 16px 0' }}>Score History</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((entry) => {
              let factors: FinancialHealthFactor[] = [];
              try {
                factors = JSON.parse(entry.factorScores);
              } catch {
                // Invalid JSON, skip parsing
              }

              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '500' }}>{formatDate(entry.date)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {factors.length > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {factors.slice(0, 3).map((f, i) => (
                          <span key={i}>
                            {f.name}: {f.score}
                            {i < 2 && factors.length > i + 1 ? ' | ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    <span
                      style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: entry.overallScore >= 80 ? '#22c55e' : entry.overallScore >= 60 ? '#f59e0b' : '#ef4444',
                      }}
                    >
                      {entry.overallScore}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showHistory && history.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No history yet. Save snapshots to track your financial health over time.
        </div>
      )}
    </div>
  );
};

export default FinancialHealthScoreComponent;
