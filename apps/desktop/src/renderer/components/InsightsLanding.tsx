import React from 'react';

type InsightType = 'recovery' | 'simulator' | 'emergency' | 'anomalies' | 'seasonal' | 'income' | 'velocity' | 'subscriptions' | 'health' | 'debt' | 'migration' | 'cashflow';

interface InsightsLandingProps {
  onSelectTool: (tool: InsightType) => void;
  activeToolId: InsightType;
}

const tools: { id: InsightType; icon: string; name: string; description: string }[] = [
  { id: 'recovery', icon: '🛠️', name: 'Recovery Plan', description: 'Get a step-by-step plan to improve your finances' },
  { id: 'simulator', icon: '🔄', name: 'What-If Simulator', description: 'See what happens if you change your spending habits' },
  { id: 'emergency', icon: '🚨', name: 'Emergency Mode', description: 'Find ways to cut costs fast when money is tight' },
  { id: 'anomalies', icon: '🔍', name: 'Anomaly Detection', description: 'Spot unusual charges that don\'t match your patterns' },
  { id: 'seasonal', icon: '📅', name: 'Seasonal Patterns', description: 'See how your spending changes through the year' },
  { id: 'income', icon: '💵', name: 'Income Analysis', description: 'Understand where your money comes from' },
  { id: 'velocity', icon: '⚡', name: 'Spending Velocity', description: 'Track how fast you\'re spending relative to your budget' },
  { id: 'subscriptions', icon: '💳', name: 'Subscription Audit', description: 'Find recurring charges you might want to cancel' },
  { id: 'health', icon: '❤️', name: 'Financial Health', description: 'Get an overall score for your financial wellbeing' },
  { id: 'debt', icon: '📉', name: 'Debt Payoff', description: 'Calculate the fastest way to pay off debt' },
  { id: 'migration', icon: '🔀', name: 'Category Migration', description: 'See how your spending shifts between categories over time' },
  { id: 'cashflow', icon: '📆', name: 'Bill Calendar', description: 'See upcoming bills on a calendar view' },
];

const InsightsLanding: React.FC<InsightsLandingProps> = ({ onSelectTool, activeToolId }) => {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 4px 0' }}>Insights</h2>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.9rem' }}>
          12 tools to help you understand and improve your finances. Click any card to get started.
        </p>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '12px',
      }}>
        {tools.map(tool => {
          const isActive = tool.id === activeToolId;
          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '16px',
                backgroundColor: 'var(--color-surface)',
                border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                width: '100%',
                boxSizing: 'border-box',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isActive ? 'var(--color-primary)' : 'var(--color-border)';
                e.currentTarget.style.boxShadow = isActive ? 'var(--shadow-sm)' : 'none';
              }}
            >
              <span style={{ fontSize: '24px', lineHeight: 1 }}>{tool.icon}</span>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>{tool.name}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{tool.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default InsightsLanding;
