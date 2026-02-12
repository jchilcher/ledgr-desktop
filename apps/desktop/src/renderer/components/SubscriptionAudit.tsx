import React, { useState, useEffect } from 'react';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  monthlyEquivalent: number;
  annualCost: number;
  lastCharged: Date;
  categoryId?: string | null;
  daysSinceLastCharge: number;
  isActive: boolean;
  isPotentiallyUnused: boolean;
  unusedIndicators: string[];
}

interface SubscriptionAuditReport {
  subscriptions: Subscription[];
  summary: {
    totalMonthly: number;
    totalAnnual: number;
    activeCount: number;
    potentiallyUnusedCount: number;
    potentialSavings: number;
  };
  recommendations: string[];
}

const SubscriptionAudit: React.FC = () => {
  const [report, setReport] = useState<SubscriptionAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [filterUnused, setFilterUnused] = useState(false);

  useEffect(() => {
    loadData();
  }, [showInactive]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.subscriptionAudit.audit({ includeInactive: showInactive });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to audit subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      default: return frequency;
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="subscription-audit subscription-audit--loading">
        <div className="spinner" />
        <span>Auditing subscriptions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-audit subscription-audit--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!report || report.subscriptions.length === 0) {
    return (
      <div className="subscription-audit subscription-audit--empty">
        <p>No recurring subscriptions found.</p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Recurring items will appear here after you add them in the Recurring tab.
        </p>
      </div>
    );
  }

  const filteredSubscriptions = filterUnused
    ? report.subscriptions.filter(s => s.isPotentiallyUnused)
    : report.subscriptions;

  return (
    <div className="subscription-audit">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Subscription Audit</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={filterUnused}
              onChange={(e) => setFilterUnused(e.target.checked)}
            />
            Show only flagged
          </label>
          <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Include inactive
          </label>
          <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            Refresh
          </button>
        </div>
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
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Monthly Total</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
            ${(report.summary.totalMonthly / 100).toFixed(0)}
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Annual Total</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
            ${(report.summary.totalAnnual / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Active Subscriptions</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
            {report.summary.activeCount}
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: report.summary.potentiallyUnusedCount > 0 ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: report.summary.potentiallyUnusedCount > 0 ? '1px solid var(--color-warning)' : 'none' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Flagged for Review</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: report.summary.potentiallyUnusedCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {report.summary.potentiallyUnusedCount}
          </div>
          {report.summary.potentialSavings > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--color-warning)' }}>
              ${(report.summary.potentialSavings / 100).toFixed(0)}/yr potential savings
            </div>
          )}
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

      {/* Subscription List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredSubscriptions.map((sub) => (
          <div
            key={sub.id}
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              borderLeft: `4px solid ${sub.isPotentiallyUnused ? 'var(--color-warning)' : 'var(--color-border)'}`,
              opacity: sub.isActive ? 1 : 0.6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500' }}>{sub.name}</span>
                  {!sub.isActive && (
                    <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: 'var(--color-text-muted)', color: 'white', borderRadius: 'var(--radius-sm)' }}>
                      Inactive
                    </span>
                  )}
                  {sub.isPotentiallyUnused && (
                    <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: 'var(--color-warning)', color: 'white', borderRadius: 'var(--radius-sm)' }}>
                      Review
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  ${(sub.amount / 100).toFixed(2)} {getFrequencyLabel(sub.frequency).toLowerCase()}
                  {' | '}Last charged: {formatDate(sub.lastCharged)}
                </div>
                {sub.isPotentiallyUnused && sub.unusedIndicators.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '13px' }}>
                    {sub.unusedIndicators.map((indicator, i) => (
                      <div key={i} style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>!</span> {indicator}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  ${(sub.monthlyEquivalent / 100).toFixed(0)}
                  <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>/mo</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  ${(sub.annualCost / 100).toFixed(0)}/year
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredSubscriptions.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No subscriptions match your filters
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionAudit;
