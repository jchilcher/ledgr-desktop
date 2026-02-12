import React, { useState, useEffect } from 'react';

interface IncomeStream {
  id: string;
  description: string;
  normalizedDescription: string;
  averageAmount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  lastReceived: Date;
  occurrences: number;
  transactionIds: string[];
  varianceCoefficient: number;
  reliabilityScore: number;
}

// Simplified type for primary income stream in summary (matches IPC response)
interface PrimaryIncomeStreamSummary {
  id: string;
  description: string;
  averageAmount: number;
  frequency: string;
  reliabilityScore: number;
}

interface IncomeAnalysisResult {
  streams: IncomeStream[];
  summary: {
    totalMonthlyIncome: number;
    totalAnnualIncome: number;
    primaryIncomeStream?: PrimaryIncomeStreamSummary;
    incomeStabilityScore: number;
    diversificationScore: number;
  };
  recommendations: string[];
}

interface SmoothedIncomeData {
  month: string;
  actual: number;
  smoothed: number;
}

const IncomeAnalysis: React.FC = () => {
  const [result, setResult] = useState<IncomeAnalysisResult | null>(null);
  const [smoothedData, setSmoothedData] = useState<SmoothedIncomeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'streams' | 'chart'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [analysisData, smoothedIncomeData] = await Promise.all([
        window.api.incomeAnalysis.analyze(),
        window.api.incomeAnalysis.getSmoothedIncome(3),
      ]);
      setResult(analysisData);
      setSmoothedData(smoothedIncomeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze income');
    } finally {
      setLoading(false);
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly':
        return 'Weekly';
      case 'biweekly':
        return 'Bi-weekly';
      case 'monthly':
        return 'Monthly';
      case 'irregular':
        return 'Irregular';
      default:
        return frequency;
    }
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'monthly':
        return '#22c55e';
      case 'biweekly':
        return '#3b82f6';
      case 'weekly':
        return '#8b5cf6';
      case 'irregular':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#84cc16';
    if (score >= 40) return '#f59e0b';
    if (score >= 20) return '#f97316';
    return '#ef4444';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Very Poor';
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  if (loading) {
    return (
      <div className="income-analysis income-analysis--loading">
        <div className="spinner" />
        <span>Analyzing income patterns...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="income-analysis income-analysis--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!result || result.streams.length === 0) {
    return (
      <div className="income-analysis income-analysis--empty">
        <p>No income streams detected.</p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Income transactions are identified by positive amounts.
          At least 2 occurrences of the same income source are needed.
        </p>
      </div>
    );
  }

  const maxChartValue = Math.max(...smoothedData.map(d => Math.max(d.actual, d.smoothed)));

  return (
    <div className="income-analysis">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Income Stability Analysis</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setViewMode('overview')}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                border: 'none',
                background: viewMode === 'overview' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'overview' ? 'white' : 'inherit',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('streams')}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                border: 'none',
                borderLeft: '1px solid var(--color-border)',
                background: viewMode === 'streams' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'streams' ? 'white' : 'inherit',
                cursor: 'pointer',
              }}
            >
              Streams
            </button>
            <button
              onClick={() => setViewMode('chart')}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                border: 'none',
                borderLeft: '1px solid var(--color-border)',
                background: viewMode === 'chart' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'chart' ? 'white' : 'inherit',
                cursor: 'pointer',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              }}
            >
              Chart
            </button>
          </div>
          <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            Refresh
          </button>
        </div>
      </div>

      {viewMode === 'overview' && (
        <div className="overview-view">
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Monthly Income
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                ${(result.summary.totalMonthlyIncome / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                ${(result.summary.totalAnnualIncome / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/year
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Income Stability
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 'bold', color: getScoreColor(result.summary.incomeStabilityScore) }}>
                  {result.summary.incomeStabilityScore}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>/100</span>
              </div>
              <div style={{ fontSize: '12px', color: getScoreColor(result.summary.incomeStabilityScore) }}>
                {getScoreLabel(result.summary.incomeStabilityScore)}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Diversification
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 'bold', color: getScoreColor(result.summary.diversificationScore) }}>
                  {result.summary.diversificationScore}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>/100</span>
              </div>
              <div style={{ fontSize: '12px', color: getScoreColor(result.summary.diversificationScore) }}>
                {result.streams.length} income source{result.streams.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Primary Income
              </div>
              <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                {result.summary.primaryIncomeStream?.description.substring(0, 25) || 'N/A'}
                {(result.summary.primaryIncomeStream?.description.length || 0) > 25 && '...'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                ${((result.summary.primaryIncomeStream?.averageAmount ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} avg
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 12px 0' }}>Recommendations</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {result.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      borderLeft: '4px solid var(--color-info)',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>i</span>
                    <span style={{ fontSize: '14px' }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'streams' && (
        <div className="streams-view">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {result.streams.map((stream) => (
              <div
                key={stream.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `4px solid ${getFrequencyColor(stream.frequency)}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                    {stream.description}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    <span>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: getFrequencyColor(stream.frequency),
                          marginRight: '4px',
                        }}
                      />
                      {getFrequencyLabel(stream.frequency)}
                    </span>
                    <span>{stream.occurrences} occurrences</span>
                    <span>Last: {formatDate(stream.lastReceived)}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    ${(stream.averageAmount / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    avg per occurrence
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '80px' }}>
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      border: `3px solid ${getScoreColor(stream.reliabilityScore)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 4px',
                    }}
                  >
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: getScoreColor(stream.reliabilityScore) }}>
                      {stream.reliabilityScore}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Reliability
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'chart' && (
        <div className="chart-view">
          <h4 style={{ margin: '0 0 16px 0' }}>Income Over Time (Smoothed vs Actual)</h4>
          {smoothedData.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Not enough data for chart.</p>
          ) : (
            <>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '3px', backgroundColor: 'var(--color-primary)' }} />
                  Actual Income
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '16px', height: '3px', backgroundColor: '#22c55e', borderStyle: 'dashed' }} />
                  3-Month Average
                </span>
              </div>

              {/* Simple bar chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px', paddingBottom: '24px', position: 'relative' }}>
                {smoothedData.map((data, index) => (
                  <div
                    key={index}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      position: 'relative',
                    }}
                  >
                    {/* Actual bar */}
                    <div
                      style={{
                        width: '60%',
                        height: `${(data.actual / maxChartValue) * 100}%`,
                        minHeight: data.actual > 0 ? '4px' : '0',
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: '2px 2px 0 0',
                        position: 'relative',
                      }}
                      title={`Actual: $${(data.actual / 100).toLocaleString()}`}
                    />
                    {/* Smoothed indicator line */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: `${(data.smoothed / maxChartValue) * 100}%`,
                        width: '100%',
                        borderTop: '2px dashed #22c55e',
                      }}
                    />
                    {/* Month label */}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-24px',
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatMonth(data.month)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Summary stats */}
              <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Highest: </span>
                  <strong>${(Math.max(...smoothedData.map(d => d.actual)) / 100).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Lowest: </span>
                  <strong>${(Math.min(...smoothedData.map(d => d.actual)) / 100).toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Average: </span>
                  <strong>
                    ${(smoothedData.reduce((sum, d) => sum + d.actual, 0) / smoothedData.length / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </strong>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default IncomeAnalysis;
