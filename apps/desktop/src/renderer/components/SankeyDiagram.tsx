import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  sankey,
  sankeyLinkHorizontal,
  sankeyJustify,
  SankeyNode,
  SankeyLink,
  SankeyExtraProperties,
} from 'd3-sankey';

interface NodeExtra extends SankeyExtraProperties {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  amount: number;
}

interface LinkExtra extends SankeyExtraProperties {
  // no extra properties beyond what SankeyLinkMinimal provides
}

type SNode = SankeyNode<NodeExtra, LinkExtra>;
type SLink = SankeyLink<NodeExtra, LinkExtra>;

interface TooltipData {
  x: number;
  y: number;
  content: string;
}

const INCOME_COLOR = '#22c55e';
const MIN_HEIGHT = 400;
const NODE_WIDTH = 20;
const NODE_PADDING = 12;

function formatCurrency(cents: number): string {
  return `$${(Math.abs(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMonthRange(date: Date): { start: string; end: string; label: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const label = start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label,
  };
}

function getQuarterRange(date: Date): { start: string; end: string; label: string } {
  const y = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3);
  const start = new Date(y, q * 3, 1);
  const end = new Date(y, q * 3 + 3, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: `Q${q + 1} ${y}`,
  };
}

function getYearRange(date: Date): { start: string; end: string; label: string } {
  const y = date.getFullYear();
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    label: `${y}`,
  };
}

type Preset = 'this-month' | 'last-month' | 'this-quarter' | 'this-year';

function getPresetRange(preset: Preset): { start: string; end: string; label: string } {
  const now = new Date();
  switch (preset) {
    case 'this-month':
      return getMonthRange(now);
    case 'last-month': {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return getMonthRange(prev);
    }
    case 'this-quarter':
      return getQuarterRange(now);
    case 'this-year':
      return getYearRange(now);
  }
}

const SankeyDiagram: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [preset, setPreset] = useState<Preset>('this-month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkIndex, setHoveredLinkIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const [spendingData, setSpendingData] = useState<
    Array<{ categoryId: string; categoryName: string; total: number; count: number; color: string }>
  >([]);
  const [incomeData, setIncomeData] = useState<
    Array<{ period: string; income: number; expenses: number; net: number }>
  >([]);

  const range = useMemo(() => getPresetRange(preset), [preset]);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth);

    return () => observer.disconnect();
  }, []);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      window.api.analytics.getSpendingByCategory(range.start, range.end),
      window.api.analytics.getIncomeVsExpensesOverTime('month', range.start, range.end),
    ])
      .then(([spending, income]) => {
        if (cancelled) return;
        setSpendingData(spending);
        setIncomeData(income);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  // Build sankey data
  const sankeyResult = useMemo(() => {
    const totalIncome = incomeData.reduce((sum, d) => sum + d.income, 0);
    const expenseCategories = spendingData.filter((c) => c.total > 0);

    if (totalIncome <= 0 && expenseCategories.length === 0) return null;

    const nodes: NodeExtra[] = [];
    const links: Array<{ source: number; target: number; value: number }> = [];

    // Income node (left side)
    if (totalIncome > 0) {
      nodes.push({
        id: 'income',
        name: 'Income',
        type: 'income',
        color: INCOME_COLOR,
        amount: totalIncome,
      });
    }

    const totalExpenses = expenseCategories.reduce((s, c) => s + c.total, 0);

    // Expense nodes (right side)
    for (const cat of expenseCategories) {
      nodes.push({
        id: `expense-${cat.categoryId}`,
        name: cat.categoryName,
        type: 'expense',
        color: cat.color || '#78716c',
        amount: cat.total,
      });
    }

    // If income exceeds expenses, add a "Savings" node
    const hasSavings = totalIncome > totalExpenses && totalIncome > 0 && totalExpenses > 0;
    if (hasSavings) {
      nodes.push({
        id: 'savings',
        name: 'Savings',
        type: 'expense',
        color: '#3b82f6',
        amount: totalIncome - totalExpenses,
      });
    }

    // Build index map
    const nodeMap = new Map(nodes.map((n, i) => [n.id, i]));

    // Links: proportional allocation of income to each expense category
    if (totalIncome > 0 && totalExpenses > 0) {
      const incomeIdx = nodeMap.get('income')!;
      for (const cat of expenseCategories) {
        const flowAmount = Math.min(
          cat.total,
          (cat.total / totalExpenses) * totalIncome
        );
        if (flowAmount > 0) {
          links.push({
            source: incomeIdx,
            target: nodeMap.get(`expense-${cat.categoryId}`)!,
            value: flowAmount,
          });
        }
      }

      if (hasSavings) {
        links.push({
          source: incomeIdx,
          target: nodeMap.get('savings')!,
          value: totalIncome - totalExpenses,
        });
      }
    }

    if (nodes.length === 0 || links.length === 0) return null;

    const height = Math.max(MIN_HEIGHT, nodes.length * 40);
    const margin = { top: 16, right: 120, bottom: 16, left: 120 };
    const innerWidth = containerWidth - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const sankeyGenerator = sankey<NodeExtra, LinkExtra>()
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(sankeyJustify)
      .extent([
        [0, 0],
        [Math.max(innerWidth, 200), Math.max(innerHeight, 200)],
      ]);

    const graph = sankeyGenerator({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    });

    return { graph, height, margin };
  }, [spendingData, incomeData, containerWidth]);

  const handleNodeEnter = useCallback(
    (node: SNode, e: React.MouseEvent) => {
      setHoveredNodeId(node.id);
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        content: `${node.name}: ${formatCurrency(node.amount)}`,
      });
    },
    []
  );

  const handleNodeLeave = useCallback(() => {
    setHoveredNodeId(null);
    setTooltip(null);
  }, []);

  const handleLinkEnter = useCallback(
    (link: SLink, idx: number, e: React.MouseEvent) => {
      setHoveredLinkIndex(idx);
      const sourceNode = link.source as SNode;
      const targetNode = link.target as SNode;
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        content: `${sourceNode.name} -> ${targetNode.name}: ${formatCurrency(link.value)}`,
      });
    },
    []
  );

  const handleLinkLeave = useCallback(() => {
    setHoveredLinkIndex(null);
    setTooltip(null);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (tooltip) {
        setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      }
    },
    [tooltip]
  );

  // Determine which links connect to hovered node
  const getNodeConnectedLinks = useCallback(
    (nodeId: string | null, links: SLink[]): Set<number> => {
      if (!nodeId) return new Set();
      const connected = new Set<number>();
      links.forEach((link, i) => {
        const src = link.source as SNode;
        const tgt = link.target as SNode;
        if (src.id === nodeId || tgt.id === nodeId) {
          connected.add(i);
        }
      });
      return connected;
    },
    []
  );

  if (loading) {
    return (
      <div className="sankey-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: MIN_HEIGHT, gap: '12px' }}>
          <div className="spinner" />
          <span style={{ color: 'var(--color-text-muted)' }}>Loading cash flow data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sankey-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: MIN_HEIGHT, color: 'var(--color-danger)' }}>
          Error loading data: {error}
        </div>
      </div>
    );
  }

  const linkPathGenerator = sankeyLinkHorizontal();

  const connectedLinks = sankeyResult
    ? getNodeConnectedLinks(hoveredNodeId, sankeyResult.graph.links as SLink[])
    : new Set<number>();

  const hasHighlight = hoveredNodeId !== null || hoveredLinkIndex !== null;

  return (
    <div className="sankey-container" ref={containerRef}>
      <div className="sankey-toolbar">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(
            [
              ['this-month', 'This Month'],
              ['last-month', 'Last Month'],
              ['this-quarter', 'This Quarter'],
              ['this-year', 'This Year'],
            ] as [Preset, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPreset(id)}
              className={`btn ${preset === id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{range.label}</span>
      </div>

      {!sankeyResult ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: MIN_HEIGHT,
            color: 'var(--color-text-muted)',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '2rem' }}>No Data</span>
          <span>No income or expense data for {range.label}.</span>
        </div>
      ) : (
        <svg
          width={containerWidth}
          height={sankeyResult.height}
          style={{ display: 'block' }}
          onMouseMove={handleMouseMove}
        >
          <g
            transform={`translate(${sankeyResult.margin.left},${sankeyResult.margin.top})`}
          >
            {/* Links */}
            {(sankeyResult.graph.links as SLink[]).map((link, i) => {
              const sourceNode = link.source as SNode;
              const d = linkPathGenerator(link as never);
              if (!d) return null;

              const isHighlighted =
                hoveredLinkIndex === i || connectedLinks.has(i);
              const isDimmed = hasHighlight && !isHighlighted;

              return (
                <path
                  key={i}
                  className="sankey-link"
                  d={d}
                  fill="none"
                  stroke={sourceNode.color}
                  strokeWidth={Math.max(1, link.width ?? 1)}
                  strokeOpacity={isDimmed ? 0.1 : isHighlighted ? 0.6 : 0.35}
                  style={{ transition: 'stroke-opacity 0.2s ease' }}
                  onMouseEnter={(e) => handleLinkEnter(link, i, e)}
                  onMouseLeave={handleLinkLeave}
                />
              );
            })}

            {/* Nodes */}
            {(sankeyResult.graph.nodes as SNode[]).map((node) => {
              const x0 = node.x0 ?? 0;
              const y0 = node.y0 ?? 0;
              const x1 = node.x1 ?? 0;
              const y1 = node.y1 ?? 0;
              const nodeHeight = y1 - y0;
              const isHovered = hoveredNodeId === node.id;
              const isDimmed = hasHighlight && !isHovered && connectedLinks.size === 0;

              const labelX = node.type === 'income' ? x0 - 8 : x1 + 8;
              const textAnchor = node.type === 'income' ? 'end' : 'start';

              return (
                <g
                  key={node.id}
                  className="sankey-node"
                  onMouseEnter={(e) => handleNodeEnter(node, e)}
                  onMouseLeave={handleNodeLeave}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x0}
                    y={y0}
                    width={x1 - x0}
                    height={Math.max(nodeHeight, 2)}
                    fill={node.color}
                    opacity={isDimmed ? 0.3 : isHovered ? 1 : 0.85}
                    rx={2}
                    style={{ transition: 'opacity 0.2s ease' }}
                  />
                  <text
                    className="sankey-label"
                    x={labelX}
                    y={y0 + nodeHeight / 2}
                    dy="0.35em"
                    textAnchor={textAnchor}
                    fill="var(--color-text)"
                    fontSize={12}
                    fontWeight={500}
                  >
                    {node.name}
                  </text>
                  <text
                    x={labelX}
                    y={y0 + nodeHeight / 2 + 14}
                    dy="0.35em"
                    textAnchor={textAnchor}
                    fill="var(--color-text-muted)"
                    fontSize={11}
                  >
                    {formatCurrency(node.amount)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {tooltip && (
        <div
          className="sankey-tooltip"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 28,
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default SankeyDiagram;
