import React, { useState, useEffect } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';

type PayoffStrategy = 'minimum' | 'snowball' | 'avalanche';

interface DebtData {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  type?: string;
}

interface StrategyResult {
  strategy: PayoffStrategy;
  label: string;
  totalInterestPaid: number;
  totalPaid: number;
  payoffDate: Date;
  monthsToPayoff: number;
  debtPayoffPlans: Array<{
    debtId: string;
    debtName: string;
    originalBalance: number;
    interestRate: number;
    minimumPayment: number;
    totalInterestPaid: number;
    totalPaid: number;
    payoffDate: Date;
    monthsToPayoff: number;
  }>;
  payoffOrder: string[];
}

interface ExtraPaymentImpact {
  extraMonthlyAmount: number;
  monthsSaved: number;
  interestSaved: number;
  newPayoffDate: Date;
  newTotalPaid: number;
}

interface DebtPayoffReport {
  debts: DebtData[];
  totalDebt: number;
  totalMinimumPayments: number;
  strategies: StrategyResult[];
  recommended: PayoffStrategy;
  recommendationReason: string;
  extraPaymentImpacts: ExtraPaymentImpact[];
}

const DebtPayoff: React.FC = () => {
  const { householdFilter } = useHousehold();
  const [report, setReport] = useState<DebtPayoffReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<PayoffStrategy>('avalanche');
  const [extraPayment, setExtraPayment] = useState(0);

  useEffect(() => {
    loadData();
  }, [householdFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.debtPayoff.generate({
        extraPaymentAmounts: [5000, 10000, 20000, 30000, 50000],
      });
      setReport(data);
      setSelectedStrategy(data.recommended);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate debt payoff report');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const getStrategyColor = (strategy: PayoffStrategy) => {
    switch (strategy) {
      case 'minimum': return 'var(--color-text-muted)';
      case 'snowball': return '#3b82f6';
      case 'avalanche': return '#22c55e';
    }
  };

  if (loading) {
    return (
      <div className="debt-payoff debt-payoff--loading">
        <div className="spinner" />
        <span>Calculating debt payoff strategies...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="debt-payoff debt-payoff--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!report || report.debts.length === 0) {
    return (
      <div className="debt-payoff debt-payoff--empty">
        <p>No interest-bearing debts found.</p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Add liabilities with interest rates in the Net Worth section to see payoff projections.
        </p>
      </div>
    );
  }

  const selectedStrategyResult = report.strategies.find(s => s.strategy === selectedStrategy);
  const minimumResult = report.strategies.find(s => s.strategy === 'minimum');

  return (
    <div className="debt-payoff">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Debt Payoff Planner</h3>
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
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Total Debt</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-danger)' }}>
            {formatCurrency(report.totalDebt)}
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Monthly Minimum</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {formatCurrency(report.totalMinimumPayments)}
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Number of Debts</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {report.debts.length}
          </div>
        </div>
        {selectedStrategyResult && (
          <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Debt-Free Date</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-success)' }}>
              {formatDate(selectedStrategyResult.payoffDate)}
            </div>
          </div>
        )}
      </div>

      {/* Strategy Selection */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Choose Your Strategy</h4>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {report.strategies.map((strategy) => (
            <button
              key={strategy.strategy}
              onClick={() => setSelectedStrategy(strategy.strategy)}
              style={{
                flex: '1 1 200px',
                padding: '16px',
                backgroundColor: selectedStrategy === strategy.strategy ? getStrategyColor(strategy.strategy) : 'var(--color-surface)',
                color: selectedStrategy === strategy.strategy ? 'white' : 'inherit',
                border: `2px solid ${getStrategyColor(strategy.strategy)}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                {strategy.label}
                {strategy.strategy === report.recommended && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: selectedStrategy === strategy.strategy ? 'rgba(255,255,255,0.2)' : getStrategyColor(strategy.strategy), color: 'white', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
                    Recommended
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>
                <div>Total Interest: {formatCurrency(strategy.totalInterestPaid)}</div>
                <div>Payoff: {formatDate(strategy.payoffDate)} ({strategy.monthsToPayoff} months)</div>
              </div>
            </button>
          ))}
        </div>
        <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {report.recommendationReason}
        </p>
      </div>

      {/* Strategy Comparison */}
      {selectedStrategyResult && minimumResult && selectedStrategy !== 'minimum' && (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontWeight: '500', marginBottom: '8px' }}>
            Savings vs. Minimum Payments
          </div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
            <div>
              <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
                {formatCurrency(minimumResult.totalInterestPaid - selectedStrategyResult.totalInterestPaid)}
              </span>
              {' '}less interest
            </div>
            <div>
              <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
                {minimumResult.monthsToPayoff - selectedStrategyResult.monthsToPayoff} months
              </span>
              {' '}faster payoff
            </div>
          </div>
        </div>
      )}

      {/* Extra Payment Impact */}
      {report.extraPaymentImpacts.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Extra Payment Impact</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Extra/Month</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Months Saved</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Interest Saved</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>New Payoff Date</th>
                </tr>
              </thead>
              <tbody>
                {report.extraPaymentImpacts.map((impact, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: extraPayment === impact.extraMonthlyAmount ? 'var(--color-surface)' : 'transparent',
                    }}
                    onClick={() => setExtraPayment(impact.extraMonthlyAmount)}
                  >
                    <td style={{ padding: '12px 8px', cursor: 'pointer' }}>
                      {formatCurrency(impact.extraMonthlyAmount)}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--color-success)' }}>
                      {impact.monthsSaved > 0 ? `-${impact.monthsSaved}` : '0'}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--color-success)' }}>
                      {formatCurrency(impact.interestSaved)}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      {formatDate(impact.newPayoffDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Debt List */}
      <div>
        <h4 style={{ margin: '0 0 12px 0' }}>Your Debts</h4>
        {selectedStrategyResult && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Payoff order ({selectedStrategyResult.label}): {selectedStrategyResult.payoffOrder.map(id => {
              const debt = report.debts.find(d => d.id === id);
              return debt?.name;
            }).filter(Boolean).join(' → ')}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {report.debts.map((debt, _index) => {
            const plan = selectedStrategyResult?.debtPayoffPlans.find(p => p.debtId === debt.id);
            const orderIndex = selectedStrategyResult?.payoffOrder.indexOf(debt.id) ?? -1;

            return (
              <div
                key={debt.id}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `4px solid ${getStrategyColor(selectedStrategy)}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {orderIndex >= 0 && (
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: getStrategyColor(selectedStrategy),
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                          }}
                        >
                          {orderIndex + 1}
                        </span>
                      )}
                      <span style={{ fontWeight: '500' }}>{debt.name}</span>
                      {debt.type && (
                        <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                          {debt.type}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {debt.interestRate}% APR | Min: {formatCurrency(debt.minimumPayment)}/mo
                    </div>
                    {plan && (
                      <div style={{ marginTop: '8px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Payoff: </span>
                        <span>{formatDate(plan.payoffDate)}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}> | Interest: </span>
                        <span style={{ color: 'var(--color-danger)' }}>{formatCurrency(plan.totalInterestPaid)}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                      {formatCurrency(debt.balance)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DebtPayoff;
