import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { NetWorthCalculation } from '@ledgr/core';

type BreakdownView = 'account_type' | 'liquidity';

interface NetWorthBreakdownProps {
  calculation: NetWorthCalculation;
  className?: string;
}

const COLORS = {
  bankAccounts: '#10b981',
  investments: '#3b82f6',
  manualAssets: '#8b5cf6',
  liabilities: '#ef4444',
  liquid: '#10b981',
  illiquid: '#f59e0b',
};

export function NetWorthBreakdown({ calculation, className }: NetWorthBreakdownProps) {
  const [view, setView] = useState<BreakdownView>('account_type');

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  // Prepare data based on view
  const assetData = useMemo(() => {
    if (view === 'account_type') {
      return [
        { name: 'Bank Accounts', value: calculation.bankAccountsTotal, color: COLORS.bankAccounts },
        { name: 'Investments', value: calculation.investmentAccountsTotal, color: COLORS.investments },
        { name: 'Other Assets', value: calculation.manualAssetsTotal, color: COLORS.manualAssets },
      ].filter(item => item.value > 0);
    } else {
      // For liquidity view, calculate liquid (bank accounts + investments) vs illiquid (manual assets)
      const liquidTotal = calculation.bankAccountsTotal + calculation.investmentAccountsTotal;
      const illiquidTotal = calculation.manualAssetsTotal;
      return [
        { name: 'Liquid Assets', value: liquidTotal, color: COLORS.liquid },
        { name: 'Illiquid Assets', value: illiquidTotal, color: COLORS.illiquid },
      ].filter(item => item.value > 0);
    }
  }, [calculation, view]);

  const liabilityData = useMemo(() => {
    return [
      { name: 'Liabilities', value: calculation.totalLiabilities, color: COLORS.liabilities },
    ].filter(item => item.value > 0);
  }, [calculation]);

  // Calculate percentages
  const totalAssets = calculation.totalAssets;
  const getPercentage = (value: number) => {
    if (totalAssets === 0) return '0%';
    return `${((value / totalAssets) * 100).toFixed(1)}%`;
  };

  return (
    <div className={`section ${className}`}>
      {/* Header with toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Breakdown</h3>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setView('account_type')}
            className={view === 'account_type' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '4px 12px', fontSize: '14px' }}
          >
            By Type
          </button>
          <button
            onClick={() => setView('liquidity')}
            className={view === 'liquidity' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '4px 12px', fontSize: '14px' }}
          >
            By Liquidity
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Assets chart */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '8px', textAlign: 'center' }}>
            Assets
          </h4>
          {assetData.length === 0 ? (
            <div style={{ height: '192px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              No assets
            </div>
          ) : (
            <div style={{ height: '192px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {assetData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Asset legend */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assetData.map(item => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: item.color,
                    }}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{item.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{formatCurrency(item.value)}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                    {getPercentage(item.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Liabilities section */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '8px', textAlign: 'center' }}>
            Liabilities
          </h4>
          {liabilityData.length === 0 ? (
            <div style={{ height: '192px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              No liabilities
            </div>
          ) : (
            <>
              <div style={{ height: '192px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                    {formatCurrency(calculation.totalLiabilities)}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Total Liabilities
                  </div>
                </div>
              </div>

              {/* Individual liabilities */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {calculation.liabilities.map(liability => (
                  <div key={liability.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS.liabilities }} />
                      <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{liability.name}</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{formatCurrency(liability.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Total Assets</span>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-success)' }}>
              {formatCurrency(calculation.totalAssets)}
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>-</div>
          <div>
            <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Total Liabilities</span>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-danger)' }}>
              {formatCurrency(calculation.totalLiabilities)}
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>=</div>
          <div>
            <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Net Worth</span>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: calculation.netWorth >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
              }}
            >
              {formatCurrency(calculation.netWorth)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetWorthBreakdown;
