import React, { useEffect } from 'react';

export type AnalyticsToolId =
  | 'spending' | 'trends' | 'velocity' | 'seasonal'
  | 'income-vs-expenses' | 'income-analysis'
  | 'cashflow' | 'category-forecast'
  | 'health' | 'recovery' | 'simulator' | 'emergency' | 'debt'
  | 'month-review' | 'year-review'
  | 'anomalies' | 'subscriptions' | 'migration';

interface AnalyticsLandingProps {
  onSelectTool: (tool: AnalyticsToolId | null) => void;
  activeToolId: AnalyticsToolId | null;
}

interface ToolDef {
  id: AnalyticsToolId;
  icon: string;
  name: string;
  description: string;
}

interface ToolGroup {
  name: string;
  icon: string;
  tools: ToolDef[];
}

const groups: ToolGroup[] = [
  {
    name: 'Spending',
    icon: '\uD83D\uDCCA',
    tools: [
      { id: 'spending', icon: '\uD83E\uDD67', name: 'Spending', description: 'See where your money goes with category breakdowns' },
      { id: 'trends', icon: '\uD83D\uDCC8', name: 'Trends', description: 'Track how spending patterns change over time' },
      { id: 'velocity', icon: '\u26A1', name: 'Velocity', description: 'Track how fast you spend relative to your budget' },
      { id: 'seasonal', icon: '\uD83D\uDCC5', name: 'Seasonal', description: 'See how your spending changes through the year' },
    ],
  },
  {
    name: 'Income',
    icon: '\uD83D\uDCB5',
    tools: [
      { id: 'income-vs-expenses', icon: '\u2696\uFE0F', name: 'vs Expenses', description: 'Compare your earnings against your spending' },
      { id: 'income-analysis', icon: '\uD83D\uDCC8', name: 'Analysis', description: 'Understand where your money comes from' },
    ],
  },
  {
    name: 'Forecasting',
    icon: '\uD83D\uDD2E',
    tools: [
      { id: 'cashflow', icon: '\uD83D\uDCC9', name: 'Cash Flow', description: 'Project future cash flow based on your patterns' },
      { id: 'category-forecast', icon: '\uD83C\uDFAF', name: 'Categories', description: 'Predict spending by category for upcoming months' },
    ],
  },
  {
    name: 'Health & Recovery',
    icon: '\u2764\uFE0F',
    tools: [
      { id: 'health', icon: '\uD83D\uDC93', name: 'Health', description: 'Get an overall score for your financial wellbeing' },
      { id: 'recovery', icon: '\uD83D\uDD27', name: 'Recovery', description: 'Get a step-by-step plan to improve your finances' },
      { id: 'simulator', icon: '\uD83D\uDD04', name: 'What-If', description: 'See what happens if you change your spending habits' },
      { id: 'emergency', icon: '\uD83D\uDEA8', name: 'Emergency', description: 'Find ways to cut costs fast when money is tight' },
      { id: 'debt', icon: '\uD83D\uDCC9', name: 'Debt', description: 'Calculate the fastest way to pay off debt' },
    ],
  },
  {
    name: 'Reviews',
    icon: '\uD83D\uDCCB',
    tools: [
      { id: 'month-review', icon: '\uD83D\uDDD3\uFE0F', name: 'Month', description: 'Monthly summary of your financial activity' },
      { id: 'year-review', icon: '\uD83C\uDFC6', name: 'Year', description: 'Annual overview of your financial journey' },
    ],
  },
  {
    name: 'Management',
    icon: '\u2699\uFE0F',
    tools: [
      { id: 'anomalies', icon: '\uD83D\uDD0D', name: 'Anomalies', description: 'Spot unusual charges that don\'t match your patterns' },
      { id: 'subscriptions', icon: '\uD83D\uDCB3', name: 'Subscriptions', description: 'Find recurring charges you might want to cancel' },
      { id: 'migration', icon: '\uD83D\uDD00', name: 'Migration', description: 'See how spending shifts between categories over time' },
    ],
  },
];

const AnalyticsLanding: React.FC<AnalyticsLandingProps> = ({ onSelectTool, activeToolId }) => {
  useEffect(() => {
    if (activeToolId === null) {
      onSelectTool('spending');
    }
  }, [activeToolId, onSelectTool]);

  return (
    <nav className="analytics-nav">
      {groups.map((group) => (
        <div key={group.name} className="analytics-nav-group">
          <div className="analytics-nav-group-label">{group.name}</div>
          <div className="analytics-nav-tools">
            {group.tools.map((tool) => (
              <button
                key={tool.id}
                className={`analytics-nav-tool ${activeToolId === tool.id ? 'active' : ''}`}
                onClick={() => onSelectTool(tool.id)}
                data-tooltip={tool.description}
              >
                <span className="analytics-nav-tool-icon">{tool.icon}</span>
                <span className="analytics-nav-tool-name">{tool.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
};

export default AnalyticsLanding;
