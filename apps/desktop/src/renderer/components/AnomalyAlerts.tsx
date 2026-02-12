import React, { useState, useEffect } from 'react';

interface Anomaly {
  id: string;
  type: 'unusual_amount' | 'missing_recurring' | 'duplicate_charge';
  severity: 'low' | 'medium' | 'high';
  transactionId?: string | null;
  recurringItemId?: string | null;
  description: string;
  amount?: number | null;
  expectedAmount?: number | null;
  zScore?: number | null;
  relatedTransactionIds?: string[];
  detectedAt: Date;
  acknowledged: boolean;
  dismissedAt?: Date | null;
}

interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  summary: {
    totalAnomalies: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

interface AnomalyAlertsProps {
  onAnomalyClick?: (anomaly: Anomaly) => void;
  compact?: boolean;
}

const AnomalyAlerts: React.FC<AnomalyAlertsProps> = ({ onAnomalyClick, compact = false }) => {
  const [result, setResult] = useState<AnomalyDetectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    loadAnomalies();
  }, []);

  const loadAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.anomalyDetection.detect();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect anomalies');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (anomalyId: string) => {
    setDismissedIds(prev => new Set([...prev, anomalyId]));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'unusual_amount':
        return '!';
      case 'missing_recurring':
        return '?';
      case 'duplicate_charge':
        return '2x';
      default:
        return '!';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'unusual_amount':
        return 'Unusual Amount';
      case 'missing_recurring':
        return 'Missing Recurring';
      case 'duplicate_charge':
        return 'Potential Duplicate';
      default:
        return type;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'var(--color-danger)';
      case 'medium':
        return 'var(--color-warning)';
      case 'low':
        return 'var(--color-info)';
      default:
        return 'var(--color-text-muted)';
    }
  };

  if (loading) {
    return (
      <div className="anomaly-alerts anomaly-alerts--loading">
        <div className="spinner" />
        <span>Analyzing transactions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="anomaly-alerts anomaly-alerts--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadAnomalies} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!result || result.anomalies.length === 0) {
    return (
      <div className="anomaly-alerts anomaly-alerts--empty">
        <span style={{ color: 'var(--color-success)' }}>No anomalies detected</span>
      </div>
    );
  }

  // Filter anomalies
  const filteredAnomalies = result.anomalies.filter(a => {
    if (dismissedIds.has(a.id)) return false;
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  const visibleCount = filteredAnomalies.length;
  const highCount = result.summary.bySeverity.high || 0;
  const mediumCount = result.summary.bySeverity.medium || 0;

  // Compact mode - just show a summary banner
  if (compact) {
    if (visibleCount === 0) return null;

    return (
      <div
        className="anomaly-alerts-banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: highCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${highCount > 0 ? 'var(--color-danger)' : 'var(--color-warning)'}`,
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: highCount > 0 ? 'var(--color-danger)' : 'var(--color-warning)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          {visibleCount}
        </span>
        <div style={{ flex: 1 }}>
          <strong>
            {visibleCount} anomal{visibleCount === 1 ? 'y' : 'ies'} detected
          </strong>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {highCount > 0 && <span style={{ color: 'var(--color-danger)' }}>{highCount} high priority</span>}
            {highCount > 0 && mediumCount > 0 && ' | '}
            {mediumCount > 0 && <span style={{ color: 'var(--color-warning)' }}>{mediumCount} medium</span>}
          </div>
        </div>
        <button
          onClick={() => onAnomalyClick?.(filteredAnomalies[0])}
          className="btn btn-secondary"
          style={{ fontSize: '13px' }}
        >
          Review
        </button>
      </div>
    );
  }

  // Full view
  return (
    <div className="anomaly-alerts">
      <div className="anomaly-alerts-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Anomaly Detection</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ fontSize: '13px' }}
          >
            <option value="all">All Types</option>
            <option value="unusual_amount">Unusual Amounts</option>
            <option value="missing_recurring">Missing Recurring</option>
            <option value="duplicate_charge">Duplicates</option>
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={{ fontSize: '13px' }}
          >
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={loadAnomalies} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{result.summary.totalAnomalies}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Total</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>By Type:</div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
            <span>{result.summary.byType.unusual_amount || 0} unusual</span>
            <span>{result.summary.byType.missing_recurring || 0} missing</span>
            <span>{result.summary.byType.duplicate_charge || 0} duplicates</span>
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>By Severity:</div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
            <span style={{ color: 'var(--color-danger)' }}>{result.summary.bySeverity.high || 0} high</span>
            <span style={{ color: 'var(--color-warning)' }}>{result.summary.bySeverity.medium || 0} medium</span>
            <span style={{ color: 'var(--color-info)' }}>{result.summary.bySeverity.low || 0} low</span>
          </div>
        </div>
      </div>

      {/* Anomaly list */}
      <div className="anomaly-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredAnomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            className="anomaly-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              borderLeft: `4px solid ${getSeverityColor(anomaly.severity)}`,
              cursor: onAnomalyClick ? 'pointer' : 'default',
            }}
            onClick={() => onAnomalyClick?.(anomaly)}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: getSeverityColor(anomaly.severity),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px',
              }}
            >
              {getTypeIcon(anomaly.type)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                {getTypeLabel(anomaly.type)}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {anomaly.description}
              </div>
              {anomaly.amount && (
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  Amount: <strong>${(anomaly.amount / 100).toFixed(2)}</strong>
                  {anomaly.expectedAmount && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {' '}(expected: ${(anomaly.expectedAmount / 100).toFixed(2)})
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: getSeverityColor(anomaly.severity),
                  color: 'white',
                  textTransform: 'uppercase',
                }}
              >
                {anomaly.severity}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(anomaly.id);
                }}
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}

        {filteredAnomalies.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No anomalies match your filters
          </div>
        )}
      </div>
    </div>
  );
};

export default AnomalyAlerts;
