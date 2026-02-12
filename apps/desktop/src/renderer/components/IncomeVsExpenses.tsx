import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface IncomeVsExpensesData {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

type ChartType = 'line' | 'bar';
type Grouping = 'day' | 'week' | 'month' | 'year';
type DatePreset = 'this-month' | 'last-3-months' | 'this-year' | 'custom';

const IncomeVsExpenses: React.FC = () => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [grouping, setGrouping] = useState<Grouping>('month');
  const [data, setData] = useState<IncomeVsExpensesData[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('this-year');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Helper to get date range based on preset
  const getDateRange = (preset: DatePreset): { start: string; end: string } | null => {
    const start = new Date();
    const end = new Date();

    switch (preset) {
      case 'this-month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last-3-months':
        start.setMonth(start.getMonth() - 2);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'this-year':
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return null;
        }
        return { start: startDate, end: endDate };
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  // Load income vs expenses data
  const loadData = async () => {
    setLoading(true);
    try {
      const range = getDateRange(datePreset);
      if (!range) {
        setLoading(false);
        return;
      }

      const result = await window.api.analytics.getIncomeVsExpensesOverTime(
        grouping,
        range.start,
        range.end
      );
      setData(result);
    } catch (error) {
      console.error('Failed to load income vs expenses data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, grouping, startDate, endDate]);

  // Calculate totals
  const totals = data.reduce(
    (acc, item) => ({
      income: acc.income + item.income,
      expenses: acc.expenses + item.expenses,
      net: acc.net + item.net,
    }),
    { income: 0, expenses: 0, net: 0 }
  );

  // Format currency (values are in cents)
  const formatCurrency = (valueInCents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(valueInCents / 100);
  };

  // Custom tooltip
  interface TooltipPayloadItem {
    payload: IncomeVsExpensesData;
  }

  interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
  }

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'var(--color-chart-tooltip-bg)',
          padding: '10px',
          border: '1px solid var(--color-chart-tooltip-border)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].payload.period}</p>
          <p style={{ margin: '5px 0 0 0', color: 'var(--color-success)' }}>
            Income: {formatCurrency(payload[0].payload.income)}
          </p>
          <p style={{ margin: '5px 0 0 0', color: 'var(--color-danger)' }}>
            Expenses: {formatCurrency(payload[0].payload.expenses)}
          </p>
          <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>
            Net: {formatCurrency(payload[0].payload.net)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Income vs Expenses Over Time</h2>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        {/* Chart Type */}
        <div>
          <label style={{ marginRight: '8px' }}>Chart Type:</label>
          <select
            data-testid="chart-type-select"
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            style={{ padding: '5px' }}
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
          </select>
        </div>

        {/* Grouping */}
        <div>
          <label style={{ marginRight: '8px' }}>Group By:</label>
          <select
            data-testid="grouping-select"
            value={grouping}
            onChange={(e) => setGrouping(e.target.value as Grouping)}
            style={{ padding: '5px' }}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>

        {/* Date Preset */}
        <div>
          <label style={{ marginRight: '8px' }}>Period:</label>
          <select
            data-testid="period-select"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            style={{ padding: '5px' }}
          >
            <option value="this-month">This Month</option>
            <option value="last-3-months">Last 3 Months</option>
            <option value="this-year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Custom Date Range */}
        {datePreset === 'custom' && (
          <>
            <div>
              <label style={{ marginRight: '8px' }}>Start:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '5px' }}
              />
            </div>
            <div>
              <label style={{ marginRight: '8px' }}>End:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '5px' }}
              />
            </div>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '30px' }}>
        <div className="card">
          <div className="card-title">Total Income</div>
          <div className="card-value" style={{ fontSize: '24px', color: 'var(--color-success)' }}>
            {formatCurrency(totals.income)}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Total Expenses</div>
          <div className="card-value" style={{ fontSize: '24px', color: 'var(--color-danger)' }}>
            {formatCurrency(totals.expenses)}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Net</div>
          <div className="card-value" style={{ fontSize: '24px', color: totals.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(totals.net)}
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading...
        </div>
      ) : data.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'var(--color-text-muted)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}>
          No transaction data available for the selected period.
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'bar' ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 100).toLocaleString()}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `$${(value / 100).toLocaleString()}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} name="Income" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" name="Net" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Data Table */}
      {data.length > 0 && (
        <div className="card" style={{ marginTop: '30px' }}>
          <h3>Period Breakdown</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th style={{ textAlign: 'right' }}>Income</th>
                  <th style={{ textAlign: 'right' }}>Expenses</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={index}>
                    <td>{item.period}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                      {formatCurrency(item.income)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>
                      {formatCurrency(item.expenses)}
                    </td>
                    <td style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: item.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                    }}>
                      {formatCurrency(item.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncomeVsExpenses;
