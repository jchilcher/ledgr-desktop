import { useState, useEffect, useMemo, useCallback } from 'react';
import type { TaxLotReport as TaxLotReportType } from '../../shared/types';

type SortField = 'ticker' | 'purchaseDate' | 'sellDate' | 'shares' | 'proceeds' | 'costBasis' | 'gain' | 'holdingPeriodDays';
type SortDir = 'asc' | 'desc';

export default function TaxLotReport() {
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(currentYear);
  const [report, setReport] = useState<TaxLotReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('sellDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    window.api.taxLotReport.generate(taxYear)
      .then(setReport)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [taxYear]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const allEntries = useMemo(() => {
    if (!report) return [];
    const entries = [
      ...report.shortTermGains.entries.map(e => ({ ...e, termType: 'Short-Term' as const })),
      ...report.longTermGains.entries.map(e => ({ ...e, termType: 'Long-Term' as const })),
    ];

    entries.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'ticker': cmp = a.ticker.localeCompare(b.ticker); break;
        case 'purchaseDate': cmp = new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime(); break;
        case 'sellDate': cmp = new Date(a.sellDate).getTime() - new Date(b.sellDate).getTime(); break;
        case 'shares': cmp = a.shares - b.shares; break;
        case 'proceeds': cmp = a.proceeds - b.proceeds; break;
        case 'costBasis': cmp = a.costBasis - b.costBasis; break;
        case 'gain': cmp = a.gain - b.gain; break;
        case 'holdingPeriodDays': cmp = a.holdingPeriodDays - b.holdingPeriodDays; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return entries;
  }, [report, sortField, sortDir]);

  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      await window.api.taxLotReport.exportCSV(taxYear);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [taxYear]);

  const fmt = (cents: number) => (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: Date | string) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString();
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Tax Lot Report</h2>
          <select
            value={taxYear}
            onChange={e => setTaxYear(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting || !report || (report.shortTermGains.entries.length === 0 && report.longTermGains.entries.length === 0)}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading report...</div>}
      {error && <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>Error: {error}</div>}

      {report && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Short-Term Gains</div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: report.summary.netShortTermGain >= 0 ? '#4ade80' : '#f87171' }}>
                ${fmt(report.summary.netShortTermGain)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {report.shortTermGains.entries.length} transactions
              </div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Long-Term Gains</div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: report.summary.netLongTermGain >= 0 ? '#4ade80' : '#f87171' }}>
                ${fmt(report.summary.netLongTermGain)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {report.longTermGains.entries.length} transactions
              </div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Dividends</div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#4ade80' }}>
                ${fmt(report.summary.totalDividends)}
              </div>
            </div>
          </div>

          {report.washSaleFlags.length > 0 && (
            <div style={{ padding: '12px 16px', background: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.3)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#facc15' }}>
              ⚠ {report.washSaleFlags.length} potential wash sale(s) detected. Consult a tax professional.
            </div>
          )}

          {allEntries.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {[
                      { field: 'ticker' as SortField, label: 'Ticker' },
                      { field: 'purchaseDate' as SortField, label: 'Purchase' },
                      { field: 'sellDate' as SortField, label: 'Sell' },
                      { field: 'shares' as SortField, label: 'Shares' },
                      { field: 'proceeds' as SortField, label: 'Proceeds' },
                      { field: 'costBasis' as SortField, label: 'Cost Basis' },
                      { field: 'gain' as SortField, label: 'Gain/Loss' },
                      { field: 'holdingPeriodDays' as SortField, label: 'Days Held' },
                    ].map(col => (
                      <th
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
                      >
                        {col.label}{sortIndicator(col.field)}
                      </th>
                    ))}
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>Type</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 500 }}>Wash Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: entry.hasWashSale ? 'rgba(250, 204, 21, 0.05)' : undefined,
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{entry.ticker}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtDate(entry.purchaseDate)}</td>
                      <td style={{ padding: '8px 12px' }}>{fmtDate(entry.sellDate)}</td>
                      <td style={{ padding: '8px 12px' }}>{entry.shares.toFixed(4)}</td>
                      <td style={{ padding: '8px 12px' }}>${fmt(entry.proceeds)}</td>
                      <td style={{ padding: '8px 12px' }}>${fmt(entry.costBasis)}</td>
                      <td style={{ padding: '8px 12px', color: entry.gain >= 0 ? '#4ade80' : '#f87171' }}>
                        ${fmt(entry.gain)}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{entry.holdingPeriodDays}</td>
                      <td style={{ padding: '8px 12px' }}>{entry.termType}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {entry.hasWashSale && <span title="Potential wash sale">⚠</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              No realized gains for {taxYear}
            </div>
          )}
        </>
      )}
    </div>
  );
}
