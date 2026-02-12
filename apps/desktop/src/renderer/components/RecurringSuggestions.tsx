import { useState, useEffect } from 'react';
import { RecurringSuggestion } from '../../shared/types';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Build a tooltip explaining the confidence score breakdown
 */
function buildConfidenceTooltip(suggestion: RecurringSuggestion): string {
  const factors = suggestion.confidenceFactors;
  if (!factors) {
    return `${suggestion.confidence}% confident based on ${suggestion.occurrences} transactions\n\nClick for details`;
  }

  const lines = [
    `${suggestion.confidence}% confident`,
    '',
    `• Pattern consistency: ${factors.intervalConsistency}%`,
    `• Matches ${FREQUENCY_LABELS[suggestion.frequency]?.toLowerCase() || suggestion.frequency} cycle: ${factors.intervalAccuracy}%`,
    `• Based on ${suggestion.occurrences} transactions`,
    `• Amount consistency: ${factors.amountVariance}%`,
  ];

  if (factors.missedPayments > 0) {
    lines.push(`• ⚠ ${factors.missedPayments} missed payment${factors.missedPayments > 1 ? 's' : ''} (-${factors.recencyPenalty} pts)`);
  }

  lines.push('', 'Click for details');

  return lines.join('\n');
}

/**
 * Get a qualitative label for a percentage score
 */
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Weak';
  return 'Poor';
}

/**
 * Get verbose explanation for interval consistency
 */
function getIntervalConsistencyExplanation(score: number, frequency: string): string {
  const freqLabel = FREQUENCY_LABELS[frequency]?.toLowerCase() || frequency;
  if (score >= 90) {
    return `The time between payments is highly consistent. Transactions occur at very regular ${freqLabel} intervals with minimal variation.`;
  }
  if (score >= 75) {
    return `The payment timing is fairly consistent. Most transactions follow a ${freqLabel} pattern with some minor variations.`;
  }
  if (score >= 60) {
    return `The payment timing shows a recognizable ${freqLabel} pattern, but there's noticeable variation between some transactions.`;
  }
  if (score >= 40) {
    return `The timing between payments varies considerably, though a rough ${freqLabel} pattern is detectable.`;
  }
  return `Payment timing is irregular. While grouped as ${freqLabel}, the actual intervals vary significantly.`;
}

/**
 * Get verbose explanation for interval accuracy
 */
function getIntervalAccuracyExplanation(score: number, frequency: string): string {
  const expectedDays: Record<string, number> = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 90,
    yearly: 365,
  };
  const days = expectedDays[frequency] || 30;
  const freqLabel = FREQUENCY_LABELS[frequency]?.toLowerCase() || frequency;

  if (score >= 90) {
    return `The average interval closely matches the expected ${days}-day ${freqLabel} cycle. This is a strong indicator of a ${freqLabel} payment.`;
  }
  if (score >= 75) {
    return `The average interval is close to the expected ${days}-day ${freqLabel} cycle, with slight deviation.`;
  }
  if (score >= 60) {
    return `The average interval reasonably matches a ${freqLabel} schedule, though it deviates somewhat from the ideal ${days}-day cycle.`;
  }
  if (score >= 40) {
    return `The pattern was classified as ${freqLabel}, but the average interval deviates noticeably from the expected ${days} days.`;
  }
  return `While classified as ${freqLabel}, the actual average interval differs significantly from the expected ${days}-day cycle.`;
}

/**
 * Get verbose explanation for occurrence boost
 */
function getOccurrenceBoostExplanation(boost: number, occurrences: number): string {
  if (boost >= 9) {
    return `With ${occurrences} transactions, there's substantial historical data to analyze. This significantly increases confidence in the detected pattern.`;
  }
  if (boost >= 7) {
    return `${occurrences} transactions provide a good sample size for pattern detection, adding moderate confidence to the analysis.`;
  }
  if (boost >= 5) {
    return `${occurrences} transactions give a reasonable basis for pattern detection, though more data would increase certainty.`;
  }
  if (boost >= 3) {
    return `With only ${occurrences} transactions, the sample size is limited. More transactions would help confirm this pattern.`;
  }
  return `Only ${occurrences} transactions were found. This is the minimum required for detection, so confidence is limited.`;
}

/**
 * Get verbose explanation for missed payments / recency
 */
function getRecencyExplanation(
  missedPayments: number,
  daysSince: number,
  frequency: string
): string {
  const freqLabel = FREQUENCY_LABELS[frequency]?.toLowerCase() || frequency;
  if (missedPayments === 0) {
    return `Last payment was ${daysSince} days ago, which is within the expected ${freqLabel} cycle.`;
  }
  if (missedPayments === 1) {
    return `One expected payment appears to be missing. This could indicate the subscription was recently cancelled, or there's a temporary gap.`;
  }
  return `${missedPayments} expected payments appear to be missing. This strongly suggests the subscription may have been cancelled.`;
}

/**
 * Get verbose explanation for amount variance
 */
function getAmountVarianceExplanation(score: number, avgAmountInCents: number): string {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(avgAmountInCents / 100);

  if (score >= 95) {
    return `Payment amounts are virtually identical at ${formatted}. This is typical of fixed-rate subscriptions or bills.`;
  }
  if (score >= 85) {
    return `Payment amounts are very consistent, averaging ${formatted} with minimal variation. This suggests a fixed or nearly-fixed payment.`;
  }
  if (score >= 70) {
    return `Payment amounts are reasonably consistent around ${formatted}, with some variation. This could indicate a metered service or occasional price changes.`;
  }
  if (score >= 50) {
    return `Payment amounts vary moderately around ${formatted}. This might be a usage-based service or a payment that fluctuates.`;
  }
  return `Payment amounts vary significantly around ${formatted}. This could be a variable expense like groceries or utilities.`;
}

interface ConfidenceModalProps {
  suggestion: RecurringSuggestion;
  onClose: () => void;
}

function ConfidenceModal({ suggestion, onClose }: ConfidenceModalProps) {
  const factors = suggestion.confidenceFactors;
  const formatCurrency = (amountInCents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountInCents / 100);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'var(--color-success)';
    if (confidence >= 60) return 'var(--color-warning)';
    return 'var(--color-text-muted)';
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'var(--color-success)';
    if (score >= 50) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div
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
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          maxWidth: '560px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Confidence Analysis</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '14px' }}>
              {suggestion.description}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: '4px 8px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Overall Score */}
        <div
          style={{
            backgroundColor: 'var(--color-surface-alt)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '36px',
              fontWeight: 700,
              color: getConfidenceColor(suggestion.confidence),
            }}
          >
            {suggestion.confidence}%
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Overall Confidence Score
          </div>
          <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Detected as <strong>{FREQUENCY_LABELS[suggestion.frequency] || suggestion.frequency}</strong> {suggestion.type === 'income' ? 'income' : 'payment'} of <strong>{formatCurrency(suggestion.averageAmount)}</strong>
          </div>
        </div>

        {factors ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Missed Payments Warning */}
            {factors.missedPayments > 0 && (
              <div
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgb(234, 179, 8)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px' }}>&#9888;</span>
                  <span style={{ fontWeight: 500 }}>Possible Cancelled Subscription</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--color-danger)', fontWeight: 600 }}>
                    -{factors.recencyPenalty} pts
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {getRecencyExplanation(factors.missedPayments, factors.daysSinceLastPayment, suggestion.frequency)}
                </p>
              </div>
            )}

            {/* Pattern Consistency */}
            <FactorSection
              title="Pattern Consistency"
              score={factors.intervalConsistency}
              explanation={getIntervalConsistencyExplanation(factors.intervalConsistency, suggestion.frequency)}
              getScoreColor={getScoreColor}
            />

            {/* Frequency Match */}
            <FactorSection
              title={`${FREQUENCY_LABELS[suggestion.frequency] || suggestion.frequency} Cycle Match`}
              score={factors.intervalAccuracy}
              explanation={getIntervalAccuracyExplanation(factors.intervalAccuracy, suggestion.frequency)}
              getScoreColor={getScoreColor}
            />

            {/* Data Points */}
            <div
              style={{
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 500 }}>Data Points</span>
                <span style={{ fontWeight: 600, color: factors.occurrenceBoost >= 7 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {suggestion.occurrences} transactions (+{factors.occurrenceBoost} pts)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {getOccurrenceBoostExplanation(factors.occurrenceBoost, suggestion.occurrences)}
              </p>
            </div>

            {/* Amount Consistency */}
            <FactorSection
              title="Amount Consistency"
              score={factors.amountVariance}
              explanation={getAmountVarianceExplanation(factors.amountVariance, suggestion.averageAmount)}
              getScoreColor={getScoreColor}
            />

            {/* How it's calculated */}
            <div
              style={{
                backgroundColor: 'var(--color-surface-alt)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
              }}
            >
              <strong>How the score is calculated:</strong> The overall confidence combines pattern consistency (60%) and cycle match (40%), plus a bonus of up to 10 points for having more transaction history.{factors.missedPayments > 0 ? ' A recency penalty is applied when expected payments are missing, which may indicate a cancelled subscription.' : ''} Amount consistency helps determine if payment tracking should be suggested.
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Detailed confidence factors are not available for this suggestion.
            The {suggestion.confidence}% confidence is based on analyzing {suggestion.occurrences} transactions.
          </p>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 16px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface FactorSectionProps {
  title: string;
  score: number;
  explanation: string;
  getScoreColor: (score: number) => string;
}

function FactorSection({ title, score, explanation, getScoreColor }: FactorSectionProps) {
  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {getScoreLabel(score)}
          </span>
          <span style={{ fontWeight: 600, color: getScoreColor(score) }}>
            {score}%
          </span>
        </div>
      </div>
      <div
        style={{
          height: '4px',
          backgroundColor: 'var(--color-border)',
          borderRadius: '2px',
          marginBottom: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            backgroundColor: getScoreColor(score),
            borderRadius: '2px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        {explanation}
      </p>
    </div>
  );
}

export default function RecurringSuggestions() {
  const [suggestions, setSuggestions] = useState<RecurringSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Track checkbox state for each suggestion (whether to enable reminders)
  const [reminderState, setReminderState] = useState<Record<string, boolean>>({});
  // Modal state for showing detailed confidence explanation
  const [selectedSuggestion, setSelectedSuggestion] = useState<RecurringSuggestion | null>(null);

  useEffect(() => {
    analyzeSuggestions();
  }, []);

  const analyzeSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const detected = await window.api.recurringDetection.analyze();
      setSuggestions(detected);
      // Initialize reminder state based on suggestions' suggestReminders flag
      const initialReminderState: Record<string, boolean> = {};
      detected.forEach(s => {
        initialReminderState[s.id] = s.suggestReminders;
      });
      setReminderState(initialReminderState);
    } catch (err) {
      setError('Failed to analyze transactions for recurring patterns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestion: RecurringSuggestion) => {
    setProcessing(suggestion.id);
    setError(null);
    const enableReminders = reminderState[suggestion.id] ?? suggestion.suggestReminders;
    const itemType = enableReminders ? 'bill' : 'cashflow';
    try {
      await window.api.recurringDetection.approve(suggestion, enableReminders, itemType);
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      setSuccessMessage(`Added "${suggestion.description}" to recurring${enableReminders ? ' with payment tracking' : ''}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to create recurring item');
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  const toggleReminders = (suggestionId: string) => {
    setReminderState(prev => ({
      ...prev,
      [suggestionId]: !prev[suggestionId],
    }));
  };

  const handleDismiss = (suggestion: RecurringSuggestion) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountInCents / 100);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'var(--color-success)';
    if (confidence >= 60) return 'var(--color-warning)';
    return 'var(--color-text-muted)';
  };

  return (
    <div className="recurring-suggestions">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0 }}>Detected Recurring Transactions</h3>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--color-text-muted)' }}>
            Review and add detected recurring payments and income to track cash flow
          </p>
        </div>
        <button
          onClick={analyzeSuggestions}
          className="btn btn-secondary"
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: '12px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
          {successMessage}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          <p>Analyzing your transactions for recurring patterns...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>No recurring transactions detected</p>
          <p style={{ fontSize: '14px' }}>
            As you add more transactions, the app will detect recurring payments and income and suggest them here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                opacity: processing === suggestion.id ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '16px' }}>{suggestion.description}</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: suggestion.type === 'income' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      color: suggestion.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {suggestion.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                    {suggestion.type === 'income' ? '+' : ''}{formatCurrency(suggestion.averageAmount)} • {FREQUENCY_LABELS[suggestion.frequency] || suggestion.frequency}
                    {suggestion.frequency === 'monthly' && suggestion.dayOfMonth && ` (day ${suggestion.dayOfMonth})`}
                    {suggestion.frequency === 'weekly' && suggestion.dayOfWeek !== undefined && ` (${DAY_NAMES[suggestion.dayOfWeek]})`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    title={buildConfidenceTooltip(suggestion)}
                    onClick={() => setSelectedSuggestion(suggestion)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: getConfidenceColor(suggestion.confidence),
                      border: `1px solid ${getConfidenceColor(suggestion.confidence)}`,
                      cursor: 'pointer',
                    }}
                  >
                    {suggestion.confidence}% confident
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                <span>{suggestion.occurrences} occurrences</span>
                <span>Last: {formatDate(suggestion.lastOccurrence)}</span>
                <span>Next expected: {formatDate(suggestion.nextExpected)}</span>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={() => handleApprove(suggestion)}
                  className="btn btn-primary"
                  disabled={processing === suggestion.id}
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                >
                  Add to Recurring
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={reminderState[suggestion.id] ?? suggestion.suggestReminders}
                    onChange={() => toggleReminders(suggestion.id)}
                    disabled={processing === suggestion.id}
                  />
                  Track payments & reminders
                </label>
                <button
                  onClick={() => handleDismiss(suggestion)}
                  disabled={processing === suggestion.id}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSuggestion && (
        <ConfidenceModal
          suggestion={selectedSuggestion}
          onClose={() => setSelectedSuggestion(null)}
        />
      )}
    </div>
  );
}
