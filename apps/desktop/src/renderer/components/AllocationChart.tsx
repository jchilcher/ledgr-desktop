/* eslint-disable react/prop-types */
import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Investment } from '../../shared/types';

interface AllocationChartProps {
  investments: Investment[];
  onDrillDown?: (groupKey: string) => void;
}

type GroupingLevel = 'asset_class' | 'sector' | 'holding';

// Asset class mapping based on investment type
const assetClassMap: Record<string, string> = {
  stock: 'Equities',
  etf: 'Equities',
  mutual_fund: 'Equities',
  bond: 'Fixed Income',
  crypto: 'Crypto',
  other: 'Other',
};

// Color palette for chart segments
const COLORS = [
  '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4',
  '#F44336', '#3F51B5', '#CDDC39', '#FF5722', '#607D8B',
  '#E91E63', '#009688', '#795548', '#FFC107', '#673AB7',
];

interface AllocationData {
  name: string;
  value: number;
  percentage: number;
  holdings?: Investment[];
}

export function AllocationChart({ investments, onDrillDown }: AllocationChartProps) {
  const [groupingLevel, setGroupingLevel] = useState<GroupingLevel>('asset_class');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totalValue = useMemo(() => {
    return investments.reduce((sum, inv) => sum + (inv.shares * inv.currentPrice), 0);
  }, [investments]);

  const allocationData: AllocationData[] = useMemo(() => {
    if (totalValue === 0) return [];

    const groupMap = new Map<string, { value: number; holdings: Investment[] }>();

    investments.forEach(inv => {
      const value = inv.shares * inv.currentPrice;
      let groupKey: string;

      switch (groupingLevel) {
        case 'asset_class':
          groupKey = assetClassMap[inv.type] || 'Other';
          break;
        case 'sector':
          // Use investment's sector field, or 'Uncategorized' if not set
          // For now, we'll use a simple mapping based on type
          // In production, this would use actual sector data from holdings
          groupKey = (inv as unknown as { sector?: string }).sector || 'Uncategorized';
          break;
        case 'holding':
          groupKey = inv.ticker || inv.name;
          break;
        default:
          groupKey = 'Other';
      }

      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.value += value;
        existing.holdings.push(inv);
      } else {
        groupMap.set(groupKey, { value, holdings: [inv] });
      }
    });

    return Array.from(groupMap.entries())
      .map(([name, data]) => ({
        name,
        value: data.value,
        percentage: (data.value / totalValue) * 100,
        holdings: data.holdings,
      }))
      .sort((a, b) => b.value - a.value);
  }, [investments, groupingLevel, totalValue]);

  const formatValue = (value: number) => {
    const dollars = value / 100;
    return dollars.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  interface TooltipPayload {
    payload: AllocationData;
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div className="allocation-tooltip">
        <div className="tooltip-name">{data.name}</div>
        <div className="tooltip-value">{formatValue(data.value)}</div>
        <div className="tooltip-percentage">{data.percentage.toFixed(1)}%</div>
        {groupingLevel !== 'holding' && data.holdings && (
          <div className="tooltip-holdings">
            {data.holdings.length} holding{data.holdings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  };

  const handleSegmentClick = (data: AllocationData) => {
    if (groupingLevel !== 'holding' && onDrillDown) {
      onDrillDown(data.name);
    }
  };

  if (investments.length === 0) {
    return (
      <div className="allocation-chart-container">
        <div className="empty-state">
          No holdings to display. Add investments to see allocation breakdown.
        </div>
      </div>
    );
  }

  return (
    <div className="allocation-chart-container">
      <div className="allocation-header">
        <h4>Portfolio Allocation</h4>
        <div className="grouping-selector">
          <button
            className={groupingLevel === 'asset_class' ? 'active' : ''}
            onClick={() => setGroupingLevel('asset_class')}
          >
            Asset Class
          </button>
          <button
            className={groupingLevel === 'sector' ? 'active' : ''}
            onClick={() => setGroupingLevel('sector')}
          >
            Sector
          </button>
          <button
            className={groupingLevel === 'holding' ? 'active' : ''}
            onClick={() => setGroupingLevel('holding')}
          >
            Holdings
          </button>
        </div>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={allocationData as unknown as Array<{ name: string; value: number }>}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(data) => handleSegmentClick(data as AllocationData)}
            >
              {allocationData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke={activeIndex === index ? '#fff' : 'none'}
                  strokeWidth={activeIndex === index ? 2 : 0}
                  style={{ cursor: groupingLevel !== 'holding' ? 'pointer' : 'default' }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center total display */}
        <div className="chart-center">
          <div className="total-label">Total Value</div>
          <div className="total-value">{formatValue(totalValue)}</div>
        </div>
      </div>

      {/* Legend */}
      <div className="allocation-legend">
        {allocationData.map((entry, index) => (
          <div
            key={entry.name}
            className="legend-item"
            onClick={() => handleSegmentClick(entry)}
          >
            <span
              className="legend-color"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="legend-name">{entry.name}</span>
            <span className="legend-percentage">{entry.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
