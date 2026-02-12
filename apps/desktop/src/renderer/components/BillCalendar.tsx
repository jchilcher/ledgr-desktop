import React, { useState, useEffect, useMemo } from 'react';

interface CashFlowProjectionPoint {
  date: Date;
  balance: number;
  inflows: number;
  outflows: number;
  items: Array<{
    name: string;
    amount: number;
    type: 'income' | 'expense';
  }>;
}

interface LowBalanceWindow {
  startDate: Date;
  endDate: Date;
  lowestBalance: number;
  lowestDate: Date;
  daysAtRisk: number;
  severity: 'warning' | 'critical';
  triggeringItems: string[];
}

interface BillCluster {
  dayRange: [number, number];
  bills: Array<{
    id: string;
    name: string;
    amount: number;
    dayOfMonth: number;
  }>;
  totalAmount: number;
  percentOfMonthlyBills: number;
}

interface DueDateRecommendation {
  recurringItemId: string;
  recurringItemName: string;
  currentDayOfMonth: number | null;
  recommendedDayOfMonth: number;
  reason: string;
  projectedImpact: number;
}

interface TransferRecommendation {
  date: Date;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}

interface CashFlowOptimizationReport {
  projectionDays: number;
  projections: CashFlowProjectionPoint[];
  lowBalanceWindows: LowBalanceWindow[];
  billClusters: BillCluster[];
  recommendations: DueDateRecommendation[];
  transferRecommendations?: TransferRecommendation[];
  summary: {
    lowestProjectedBalance: number;
    lowestBalanceDate: Date | null;
    averageBalance: number;
    daysAtRisk: number;
    billClusteringScore: number;
    optimizationPotential: number;
  };
  insights: string[];
}

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  projection?: CashFlowProjectionPoint;
  isAtRisk: boolean;
  hasIncome: boolean;
  hasExpense: boolean;
  itemCount: number;
}

// Extended forecast periods
const PROJECTION_PERIODS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
  { value: 1825, label: '5 years' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BillCalendar: React.FC = () => {
  const [report, setReport] = useState<CashFlowOptimizationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectionDays, setProjectionDays] = useState(90);
  const [currentMonth, setCurrentMonth] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }));
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  useEffect(() => {
    loadData();
  }, [projectionDays]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.cashFlowOptimization.optimize({ projectionDays });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize cash flow');
    } finally {
      setLoading(false);
    }
  };

  // Create Map for O(1) lookups by date string "YYYY-MM-DD"
  const projectionMap = useMemo(() => {
    const map = new Map<string, CashFlowProjectionPoint>();
    report?.projections.forEach(p => {
      const key = new Date(p.date).toISOString().split('T')[0];
      map.set(key, p);
    });
    return map;
  }, [report]);

  // Create a set of at-risk dates for O(1) lookups
  const atRiskDates = useMemo(() => {
    const set = new Set<string>();
    report?.lowBalanceWindows.forEach(w => {
      const start = new Date(w.startDate);
      const end = new Date(w.endDate);
      const current = new Date(start);
      while (current <= end) {
        set.add(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });
    return set;
  }, [report]);

  // Generate calendar weeks for a given month
  const generateMonthCalendar = (year: number, month: number): CalendarDay[][] => {
    const weeks: CalendarDay[][] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // First day of the month
    const firstOfMonth = new Date(year, month, 1);
    // Last day of the month
    const lastOfMonth = new Date(year, month + 1, 0);

    // Start from Sunday of the week containing the first day
    const calendarStart = new Date(firstOfMonth);
    calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());

    // End on Saturday of the week containing the last day
    const calendarEnd = new Date(lastOfMonth);
    calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()));

    const currentDate = new Date(calendarStart);
    let currentWeek: CalendarDay[] = [];

    while (currentDate <= calendarEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const projection = projectionMap.get(dateStr);
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = dateStr === todayStr;
      const isAtRisk = atRiskDates.has(dateStr);

      const hasIncome = projection?.items.some(i => i.type === 'income') ?? false;
      const hasExpense = projection?.items.some(i => i.type === 'expense') ?? false;
      const itemCount = projection?.items.length ?? 0;

      currentWeek.push({
        date: new Date(currentDate),
        dayOfMonth: currentDate.getDate(),
        isCurrentMonth,
        isToday,
        projection,
        isAtRisk,
        hasIncome,
        hasExpense,
        itemCount,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return weeks;
  };

  const calendarWeeks = useMemo(() => {
    return generateMonthCalendar(currentMonth.year, currentMonth.month);
  }, [currentMonth, projectionMap, atRiskDates]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      let newMonth = prev.month + (direction === 'next' ? 1 : -1);
      let newYear = prev.year;

      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      } else if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }

      return { year: newYear, month: newMonth };
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth({
      year: today.getFullYear(),
      month: today.getMonth(),
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getMonthYearLabel = () => {
    return new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getBalanceColor = (balance: number) => {
    if (balance < 10000) return '#ef4444';
    if (balance < 50000) return '#f59e0b';
    return '#22c55e';
  };

  const handleDayClick = (day: CalendarDay) => {
    if (selectedDay?.date.toDateString() === day.date.toDateString()) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
  };

  const closeModal = () => {
    setSelectedDay(null);
  };

  if (loading) {
    return (
      <div className="bill-calendar bill-calendar--loading">
        <div className="spinner" />
        <span>Analyzing cash flow...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bill-calendar bill-calendar--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bill-calendar bill-calendar--empty">
        <p>Unable to generate cash flow projections.</p>
      </div>
    );
  }

  return (
    <div className="bill-calendar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Bill Calendar & Cash Flow</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={projectionDays}
            onChange={(e) => setProjectionDays(parseInt(e.target.value))}
            style={{ fontSize: '13px' }}
          >
            {PROJECTION_PERIODS.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
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
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Lowest Balance</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: getBalanceColor(report.summary.lowestProjectedBalance) }}>
            {formatCurrency(report.summary.lowestProjectedBalance)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            on {formatDate(report.summary.lowestBalanceDate)}
          </div>
        </div>
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Average Balance</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {formatCurrency(report.summary.averageBalance)}
          </div>
        </div>
        <div style={{ padding: '12px', backgroundColor: report.summary.daysAtRisk > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: report.summary.daysAtRisk > 0 ? '1px solid var(--color-danger)' : 'none' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Days at Risk</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: report.summary.daysAtRisk > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {report.summary.daysAtRisk}
          </div>
        </div>
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Bill Clustering</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: report.summary.billClusteringScore > 50 ? 'var(--color-warning)' : 'var(--color-success)' }}>
            {report.summary.billClusteringScore.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Insights */}
      {report.insights.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {report.insights.map((insight, i) => (
            <div
              key={i}
              style={{
                padding: '12px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `4px solid ${report.lowBalanceWindows.length > 0 ? 'var(--color-warning)' : 'var(--color-info)'}`,
                fontSize: '14px',
                marginBottom: '8px',
              }}
            >
              {insight}
            </div>
          ))}
        </div>
      )}

      {/* Monthly Calendar */}
      <div className="calendar-container" style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '24px' }}>
        {/* Month Navigation Header */}
        <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => navigateMonth('prev')}
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '14px' }}
            >
              &lt;
            </button>
            <h4 style={{ margin: 0, minWidth: '160px', textAlign: 'center', fontSize: '16px', fontWeight: 600 }}>
              {getMonthYearLabel()}
            </h4>
            <button
              onClick={() => navigateMonth('next')}
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '14px' }}
            >
              &gt;
            </button>
          </div>
          <button
            onClick={goToToday}
            className="btn btn-secondary"
            style={{ fontSize: '13px' }}
          >
            Today
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="calendar-dot calendar-dot--expense" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
            Expense
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="calendar-dot calendar-dot--income" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }}></span>
            Income
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '16px', height: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '2px', display: 'inline-block' }}></span>
            At-risk day
          </span>
        </div>

        {/* Weekday Headers */}
        <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
          {WEEKDAYS.map(day => (
            <div key={day} className="calendar-weekday" style={{ textAlign: 'center', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', padding: '8px 0' }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {calendarWeeks.flat().map((day, index) => (
            <div
              key={index}
              className={`calendar-day ${day.isToday ? 'calendar-day--today' : ''} ${day.isAtRisk ? 'calendar-day--at-risk' : ''} ${!day.isCurrentMonth ? 'calendar-day--outside-month' : ''}`}
              onClick={() => handleDayClick(day)}
              style={{
                minHeight: '64px',
                padding: '6px',
                backgroundColor: day.isAtRisk ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg)',
                border: day.isToday ? '2px solid var(--color-info)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                opacity: day.isCurrentMonth ? 1 : 0.4,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (day.isCurrentMonth) {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = day.isToday ? 'var(--color-info)' : 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Day Number */}
              <div style={{
                fontSize: '13px',
                fontWeight: day.isToday ? 'bold' : 'normal',
                color: day.isToday ? 'var(--color-info)' : day.isCurrentMonth ? 'var(--color-text)' : 'var(--color-text-muted)',
                marginBottom: '4px',
              }}>
                {day.dayOfMonth}
              </div>

              {/* Indicator Dots */}
              {(day.hasExpense || day.hasIncome) && (
                <div style={{ display: 'flex', gap: '3px', marginBottom: '2px' }}>
                  {day.hasExpense && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
                  )}
                  {day.hasIncome && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }}></span>
                  )}
                </div>
              )}

              {/* Item count badge */}
              {day.itemCount > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {day.itemCount} item{day.itemCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={closeModal}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: 'var(--color-surface)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              maxWidth: '400px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
              {formatFullDate(selectedDay.date)}
            </h4>

            {/* Projected Balance */}
            {selectedDay.projection ? (
              <>
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Projected Balance</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: getBalanceColor(selectedDay.projection.balance) }}>
                    {formatCurrency(selectedDay.projection.balance)}
                  </div>
                </div>

                {/* Scheduled Items */}
                {selectedDay.projection.items.length > 0 ? (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Scheduled Items</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedDay.projection.items.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            backgroundColor: 'var(--color-bg)',
                            borderRadius: 'var(--radius-sm)',
                            borderLeft: `3px solid ${item.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                          }}
                        >
                          <span style={{ fontSize: '14px' }}>{item.name}</span>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: item.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
                          }}>
                            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    No scheduled items for this day.
                  </div>
                )}

                {/* Inflows / Outflows Summary */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                  {selectedDay.projection.inflows > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Total Inflows</span>
                      <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>+{formatCurrency(selectedDay.projection.inflows)}</span>
                    </div>
                  )}
                  {selectedDay.projection.outflows > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Total Outflows</span>
                      <span style={{ color: 'var(--color-danger)', fontWeight: 500 }}>-{formatCurrency(selectedDay.projection.outflows)}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '12px', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                No projection data available for this date.
              </div>
            )}

            {/* At-risk Warning */}
            {selectedDay.isAtRisk && (
              <div style={{
                marginTop: '12px',
                padding: '10px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 'var(--radius-sm)',
                borderLeft: '3px solid var(--color-danger)',
                fontSize: '13px',
                color: 'var(--color-danger)',
              }}>
                This day falls within a low balance period.
              </div>
            )}

            {/* Close Button */}
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button onClick={closeModal} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Due Date Recommendations</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.recommendations.map((rec, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '4px solid var(--color-info)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500' }}>{rec.recurringItemName}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Day {rec.currentDayOfMonth} → Day {rec.recommendedDayOfMonth}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {rec.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer Recommendations */}
      {report.transferRecommendations && report.transferRecommendations.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Suggested Transfers</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.transferRecommendations.map((transfer, i) => {
              const urgencyColors = {
                high: 'var(--color-danger)',
                medium: 'var(--color-warning)',
                low: 'var(--color-info)',
              };
              const urgencyBg = {
                high: 'rgba(239, 68, 68, 0.1)',
                medium: 'rgba(245, 158, 11, 0.1)',
                low: 'var(--color-surface)',
              };
              return (
                <div
                  key={i}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: urgencyBg[transfer.urgency],
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `4px solid ${urgencyColors[transfer.urgency]}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500' }}>
                      Transfer {formatCurrency(transfer.amount)}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: urgencyColors[transfer.urgency],
                      color: 'white',
                      textTransform: 'uppercase',
                    }}>
                      {transfer.urgency}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>From:</span>{' '}
                    <span style={{ fontWeight: '500' }}>{transfer.fromAccountName}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}> → To: </span>
                    <span style={{ fontWeight: '500' }}>{transfer.toAccountName}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    By {formatDate(transfer.date)} · {transfer.reason}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bill Clusters */}
      {report.billClusters.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Bill Distribution</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {report.billClusters.map((cluster, i) => (
              <div
                key={i}
                style={{
                  flex: '1 1 200px',
                  padding: '12px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `4px solid ${cluster.percentOfMonthlyBills > 40 ? 'var(--color-warning)' : 'var(--color-border)'}`,
                }}
              >
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                  Days {cluster.dayRange[0]}-{cluster.dayRange[1]}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                  {formatCurrency(cluster.totalAmount)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {cluster.percentOfMonthlyBills.toFixed(0)}% of monthly bills
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px' }}>
                  {cluster.bills.slice(0, 3).map(b => b.name).join(', ')}
                  {cluster.bills.length > 3 && ` +${cluster.bills.length - 3} more`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillCalendar;
