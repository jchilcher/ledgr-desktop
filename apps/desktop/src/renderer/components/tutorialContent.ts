import type { AnalyticsToolId } from './AnalyticsLanding';

export interface TutorialInfo {
  title: string;
  icon: string;
  points: string[];
}

export const tutorialContent: Record<AnalyticsToolId, TutorialInfo> = {
  spending: {
    title: 'Spending by Category',
    icon: '🥧',
    points: [
      'The pie chart shows what percentage of spending goes to each category',
      'The bar chart compares spending amounts across categories',
      'Use date range presets to compare different periods',
      'Categories with budgets show progress toward your limit',
    ],
  },
  trends: {
    title: 'Category Trends',
    icon: '📈',
    points: [
      'Track how spending in selected categories changes over time',
      'Use the category selector to compare up to 5 categories',
      'Switch between daily, weekly, and monthly groupings',
      'Hover over data points to see exact amounts',
    ],
  },
  velocity: {
    title: 'Spending Velocity',
    icon: '⚡',
    points: [
      'See how fast you are spending relative to your budget pace',
      'Green means you are on track, yellow is a warning, red means over budget',
      'The projected total estimates your spending by the end of the period',
      'Burn rate shows your average daily spending per category',
    ],
  },
  seasonal: {
    title: 'Seasonal Patterns',
    icon: '📅',
    points: [
      'Discover how your spending changes through the year',
      'Holiday spikes highlight months with unusual spending',
      'Seasonal indices show which months are above or below average',
      'Use this to plan ahead for expensive months',
    ],
  },
  'income-vs-expenses': {
    title: 'Income vs Expenses',
    icon: '⚖️',
    points: [
      'Compare your total earnings against total spending over time',
      'The net line shows whether you are saving or losing money each period',
      'Switch between daily, weekly, monthly, or yearly views',
      'Green periods mean you earned more than you spent',
    ],
  },
  'income-analysis': {
    title: 'Income Analysis',
    icon: '📈',
    points: [
      'Identifies your recurring income streams and their reliability',
      'Shows income stability and diversification scores',
      'Smoothed income chart reveals your true earning trend',
      'Recommendations help improve income stability',
    ],
  },
  cashflow: {
    title: 'Cash Flow Forecast',
    icon: '📉',
    points: [
      'Projects your future account balance based on recurring items',
      'Warnings flag dates where your balance may go negative',
      'The confidence band widens for dates further in the future',
      'Select different accounts to see individual projections',
    ],
  },
  'category-forecast': {
    title: 'Category Forecast',
    icon: '🎯',
    points: [
      'Predicts spending by category for upcoming months',
      'Uses your historical patterns and seasonal trends',
      'Confidence levels indicate how reliable each prediction is',
      'Compare projected spending against your budget goals',
    ],
  },
  health: {
    title: 'Financial Health Score',
    icon: '💓',
    points: [
      'Your overall financial health scored from 0 to 100',
      'Individual factors show strengths and areas to improve',
      'Track your score over time to see progress',
      'Actionable recommendations are tailored to your data',
    ],
  },
  recovery: {
    title: 'Recovery Plan',
    icon: '🔧',
    points: [
      'Get a step-by-step plan to improve your financial situation',
      'Quick wins show easy actions with immediate impact',
      'The simulator lets you test changes before committing',
      'Emergency mode identifies essential vs pausable expenses',
    ],
  },
  simulator: {
    title: 'What-If Simulator',
    icon: '🔄',
    points: [
      'Test hypothetical changes to see their financial impact',
      'Cut categories, add income, or cancel subscriptions',
      'Side-by-side projections compare current vs modified scenarios',
      'See how many months of runway each change adds',
    ],
  },
  emergency: {
    title: 'Emergency Mode',
    icon: '🚨',
    points: [
      'Find ways to cut costs fast when money is tight',
      'Essential expenses are separated from pausable ones',
      'See your total monthly essential vs discretionary spending',
      'Recommendations prioritize actions by impact and urgency',
    ],
  },
  debt: {
    title: 'Debt Payoff',
    icon: '📉',
    points: [
      'Calculate the fastest way to pay off your debts',
      'Compare snowball, avalanche, and minimum payment strategies',
      'See how extra payments reduce total interest and time',
      'Payoff timeline shows when each debt will be eliminated',
    ],
  },
  'month-review': {
    title: 'Month in Review',
    icon: '🗓️',
    points: [
      'A complete summary of your financial activity this month',
      'See income, spending, savings rate, and top categories',
      'Compare against previous months to spot improvements',
      'Budget adherence shows how well you stuck to your plan',
    ],
  },
  'year-review': {
    title: 'Year in Review',
    icon: '🏆',
    points: [
      'Annual overview of your entire financial journey',
      'Monthly breakdown shows seasonal spending patterns',
      'Year-over-year comparisons highlight progress',
      'Key milestones and achievements are summarized',
    ],
  },
  anomalies: {
    title: 'Anomaly Detection',
    icon: '🔍',
    points: [
      'Spots unusual charges that do not match your patterns',
      'Detects missing recurring payments that were expected',
      'Flags potential duplicate charges within a time window',
      'Severity levels help you prioritize which to investigate',
    ],
  },
  subscriptions: {
    title: 'Subscription Audit',
    icon: '💳',
    points: [
      'Find all recurring charges across your accounts',
      'See total monthly and annual subscription costs',
      'Potentially unused subscriptions are flagged for review',
      'Calculate potential savings by canceling unused services',
    ],
  },
  migration: {
    title: 'Category Migration',
    icon: '🔀',
    points: [
      'See how spending shifts between categories over time',
      'Significant shifts are highlighted with their direction',
      'Trend indicators show growing, declining, or stable categories',
      'Useful for understanding long-term changes in your habits',
    ],
  },
};
