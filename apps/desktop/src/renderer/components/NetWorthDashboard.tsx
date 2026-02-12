import { useNetWorthCalculation, useNetWorthChangeSummary } from '../hooks/useNetWorth';
import { NetWorthBreakdown } from './NetWorthBreakdown';

interface NetWorthDashboardProps {
  className?: string;
}

export function NetWorthDashboard({ className }: NetWorthDashboardProps) {
  const { calculation, loading, error, refetch } = useNetWorthCalculation();
  const { summary: monthSummary } = useNetWorthChangeSummary('month');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value / 100);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ height: '128px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-lg)' }}></div>
          <div style={{ height: '256px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-lg)' }}></div>
        </div>
      </div>
    );
  }

  if (error || !calculation) {
    return (
      <div className={className}>
        <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: 'var(--radius-lg)' }}>
          Error loading net worth: {error ?? 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className={className}>
      {/* Hero card - Net Worth headline */}
      <div
        style={{
          background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          padding: '24px',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#bfdbfe', margin: '0 0 4px 0' }}>
              Net Worth
            </h2>
            <div style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '4px' }}>
              {formatCurrency(calculation.netWorth)}
            </div>

            {/* Change indicator */}
            {calculation.changeFromPrevious != null && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '14px',
                    color: calculation.changeFromPrevious >= 0 ? '#86efac' : '#fca5a5',
                  }}
                >
                  {calculation.changeFromPrevious >= 0 ? '+' : ''}
                  {formatCurrency(calculation.changeFromPrevious)}
                </span>
                {calculation.changePercentFromPrevious != null && (
                  <span style={{ fontSize: '12px', color: '#bfdbfe' }}>
                    ({formatPercent(calculation.changePercentFromPrevious)})
                  </span>
                )}
                <span style={{ fontSize: '12px', color: '#bfdbfe' }}>from last snapshot</span>
              </div>
            )}
          </div>

          <button
            onClick={() => refetch(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
          >
            Refresh
          </button>
        </div>

        {/* Monthly change summary */}
        {monthSummary && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <div style={{ fontSize: '14px', color: '#bfdbfe' }}>This Month</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span
                style={{
                  fontWeight: 600,
                  color: monthSummary.change >= 0 ? '#86efac' : '#fca5a5',
                }}
              >
                {monthSummary.change >= 0 ? '+' : ''}
                {formatCurrency(monthSummary.change)}
              </span>
              <span style={{ fontSize: '14px', color: '#bfdbfe' }}>
                ({formatPercent(monthSummary.changePercent)})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div className="section" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Bank Accounts</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#059669', marginTop: '4px' }}>
            {formatCurrency(calculation.bankAccountsTotal)}
          </div>
        </div>
        <div className="section" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Investments</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#2563eb', marginTop: '4px' }}>
            {formatCurrency(calculation.investmentAccountsTotal)}
          </div>
        </div>
        <div className="section" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Other Assets</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#7c3aed', marginTop: '4px' }}>
            {formatCurrency(calculation.manualAssetsTotal)}
          </div>
        </div>
        <div className="section" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Liabilities</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#dc2626', marginTop: '4px' }}>
            {formatCurrency(calculation.totalLiabilities)}
          </div>
        </div>
      </div>

      {/* Breakdown component */}
      <NetWorthBreakdown calculation={calculation} />
    </div>
  );
}

export default NetWorthDashboard;
