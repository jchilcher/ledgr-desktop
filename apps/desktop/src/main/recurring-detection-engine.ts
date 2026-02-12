import { randomUUID } from 'crypto';
import { Transaction, RecurringSuggestion, DetectedFrequency } from '../shared/types';

interface TransactionGroup {
  normalizedDescription: string;
  transactions: Transaction[];
}

interface ConfidenceFactorsInternal {
  intervalConsistency: number;
  intervalAccuracy: number;
  occurrenceBoost: number;
}

interface RecencyAnalysis {
  missedPayments: number;
  recencyPenalty: number;
  daysSinceLastPayment: number;
}

// Expected interval in days for each frequency
const EXPECTED_INTERVAL: Record<DetectedFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

// Grace period before considering a payment "missed"
const GRACE_PERIOD: Record<DetectedFrequency, number> = {
  weekly: 10,      // ~1.4 cycles (accounts for weekends)
  biweekly: 18,    // ~1.3 cycles
  monthly: 35,     // ~1.2 cycles (accounts for 31-day months)
  quarterly: 100,  // ~1.1 cycles
  yearly: 380,     // ~1.04 cycles
};

// Multiplier for penalty based on frequency (higher frequency = less penalty per miss)
const FREQUENCY_MULTIPLIER: Record<DetectedFrequency, number> = {
  weekly: 0.5,     // More forgiving - could be vacation
  biweekly: 0.7,   // Payroll timing varies
  monthly: 1.0,    // Baseline
  quarterly: 1.3,  // Stronger signal
  yearly: 1.5,     // Very strong signal
};

/**
 * Calculate recency penalty for potentially cancelled subscriptions
 */
function calculateRecencyPenalty(
  lastOccurrence: Date,
  frequency: DetectedFrequency,
  occurrences: number,
  referenceDate: Date = new Date()
): RecencyAnalysis {
  const lastDate = new Date(lastOccurrence);
  const daysSinceLastPayment = Math.floor(
    (referenceDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const gracePeriod = GRACE_PERIOD[frequency];
  const expectedInterval = EXPECTED_INTERVAL[frequency];
  const frequencyMultiplier = FREQUENCY_MULTIPLIER[frequency];

  // Calculate how many days overdue (beyond grace period)
  const overdueDays = Math.max(0, daysSinceLastPayment - gracePeriod);

  // Calculate missed payments
  const missedPayments = Math.floor(overdueDays / expectedInterval);

  if (missedPayments === 0) {
    return {
      missedPayments: 0,
      recencyPenalty: 0,
      daysSinceLastPayment,
    };
  }

  // Base penalty: 15 points per missed payment
  const basePenalty = missedPayments * 15;

  // Apply frequency multiplier
  const adjustedPenalty = basePenalty * frequencyMultiplier;

  // Reduce penalty for items with longer history (up to 40% reduction)
  const occurrenceReduction = Math.min(occurrences / 12, 0.4);
  const finalPenalty = Math.min(50, adjustedPenalty * (1 - occurrenceReduction));

  return {
    missedPayments,
    recencyPenalty: Math.round(finalPenalty),
    daysSinceLastPayment,
  };
}

interface IntervalAnalysis {
  frequency: DetectedFrequency;
  confidence: number;
  averageInterval: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  confidenceFactors: ConfidenceFactorsInternal;
}

/**
 * Normalize transaction description for grouping
 */
function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[#\d]+/g, '') // Remove numbers (account numbers, dates, etc.)
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Calculate the average of an array of numbers
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(numbers: number[]): number {
  if (numbers.length < 2) return 0;
  const avg = average(numbers);
  const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Analyze intervals between transactions to detect frequency
 */
function analyzeIntervals(transactions: Transaction[]): IntervalAnalysis | null {
  if (transactions.length < 3) return null;

  // Sort by date
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate intervals in days
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = Math.round(
      (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    intervals.push(days);
  }

  const avgInterval = average(intervals);
  const stdDev = standardDeviation(intervals);

  // Coefficient of variation - lower is more consistent
  const cv = avgInterval > 0 ? stdDev / avgInterval : 1;

  // Determine frequency based on average interval
  let frequency: DetectedFrequency;
  let expectedInterval: number;

  if (avgInterval <= 10) {
    frequency = 'weekly';
    expectedInterval = 7;
  } else if (avgInterval <= 18) {
    frequency = 'biweekly';
    expectedInterval = 14;
  } else if (avgInterval <= 45) {
    frequency = 'monthly';
    expectedInterval = 30;
  } else if (avgInterval <= 120) {
    frequency = 'quarterly';
    expectedInterval = 90;
  } else {
    frequency = 'yearly';
    expectedInterval = 365;
  }

  // Calculate confidence based on consistency
  // Lower CV = higher confidence
  const intervalConsistency = Math.max(0, 100 - cv * 100);

  // Adjust confidence based on how close avg is to expected interval
  const intervalAccuracyRaw = 1 - Math.abs(avgInterval - expectedInterval) / expectedInterval;
  const intervalAccuracyScore = Math.max(0, Math.min(100, intervalAccuracyRaw * 100));

  // Combine consistency and accuracy for base confidence
  let confidence = intervalConsistency * 0.6 + intervalAccuracyScore * 0.4;

  // Boost confidence for more occurrences
  const occurrenceBoost = Math.min(transactions.length / 6, 1) * 10;
  confidence = Math.min(100, confidence + occurrenceBoost);

  // Calculate typical day of month/week
  const dates = sorted.map(t => new Date(t.date));
  const daysOfMonth = dates.map(d => d.getDate());
  const daysOfWeek = dates.map(d => d.getDay());

  // Find most common day of month (for monthly)
  const dayOfMonthCounts: Record<number, number> = {};
  daysOfMonth.forEach(d => {
    dayOfMonthCounts[d] = (dayOfMonthCounts[d] || 0) + 1;
  });
  const mostCommonDayOfMonth = Object.entries(dayOfMonthCounts)
    .sort((a, b) => b[1] - a[1])[0];

  // Find most common day of week (for weekly)
  const dayOfWeekCounts: Record<number, number> = {};
  daysOfWeek.forEach(d => {
    dayOfWeekCounts[d] = (dayOfWeekCounts[d] || 0) + 1;
  });
  const mostCommonDayOfWeek = Object.entries(dayOfWeekCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    frequency,
    confidence: Math.round(confidence),
    averageInterval: avgInterval,
    dayOfMonth: mostCommonDayOfMonth ? parseInt(mostCommonDayOfMonth[0]) : undefined,
    dayOfWeek: mostCommonDayOfWeek ? parseInt(mostCommonDayOfWeek[0]) : undefined,
    confidenceFactors: {
      intervalConsistency: Math.round(intervalConsistency),
      intervalAccuracy: Math.round(intervalAccuracyScore),
      occurrenceBoost: Math.round(occurrenceBoost),
    },
  };
}

/**
 * Calculate next expected date based on frequency
 */
function calculateNextExpected(
  lastDate: Date,
  frequency: DetectedFrequency,
  dayOfMonth?: number,
  _dayOfWeek?: number
): Date {
  const next = new Date(lastDate);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      if (dayOfMonth) {
        next.setDate(Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

/**
 * Check if amounts are consistent (for bills with fixed amounts)
 */
function analyzeAmounts(transactions: Transaction[]): { isConsistent: boolean; average: number; variance: number } {
  const amounts = transactions.map(t => Math.abs(t.amount));
  const avg = average(amounts);
  const stdDev = standardDeviation(amounts);
  const variance = avg > 0 ? stdDev / avg : 0;

  return {
    isConsistent: variance < 0.1, // Less than 10% variance
    average: avg,
    variance,
  };
}

/**
 * Detect recurring payments from transaction history
 */
export function detectRecurringPayments(
  transactions: Transaction[],
  existingRecurringDescriptions: string[] = [],
  existingBillNames: string[] = [],
  minOccurrences: number = 3,
  minConfidence: number = 60
): RecurringSuggestion[] {
  // Include both expenses (negative) and income (positive), exclude zero amounts
  const filtered = transactions
    .filter(t => t.amount !== 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group by normalized description + sign (income vs expense kept separate)
  const groups: Map<string, TransactionGroup> = new Map();

  for (const tx of filtered) {
    const normalized = normalizeDescription(tx.description);
    if (normalized.length < 3) continue; // Skip very short descriptions

    const sign = tx.amount > 0 ? '+' : '-';
    const key = `${sign}:${normalized}`;

    if (!groups.has(key)) {
      groups.set(key, {
        normalizedDescription: normalized,
        transactions: [],
      });
    }
    groups.get(key)!.transactions.push(tx);
  }

  // Normalize existing recurring/bill names for comparison
  const existingNormalized = new Set([
    ...existingRecurringDescriptions.map(normalizeDescription),
    ...existingBillNames.map(normalizeDescription),
  ]);

  const suggestions: RecurringSuggestion[] = [];

  for (const [, group] of groups) {
    const normalized = group.normalizedDescription;
    // Skip if already tracked
    if (existingNormalized.has(normalized)) continue;

    // Need minimum occurrences
    if (group.transactions.length < minOccurrences) continue;

    // Analyze intervals
    const intervalAnalysis = analyzeIntervals(group.transactions);
    if (!intervalAnalysis || intervalAnalysis.confidence < minConfidence) continue;

    // Analyze amounts
    const amountAnalysis = analyzeAmounts(group.transactions);

    // Get the most recent transaction for reference
    const mostRecent = group.transactions[0];
    const lastDate = new Date(mostRecent.date);

    // Calculate next expected date
    const nextExpected = calculateNextExpected(
      lastDate,
      intervalAnalysis.frequency,
      intervalAnalysis.dayOfMonth,
      intervalAnalysis.dayOfWeek
    );

    // Calculate missed payments penalty
    const recencyAnalysis = calculateRecencyPenalty(
      lastDate,
      intervalAnalysis.frequency,
      group.transactions.length
    );

    // Apply recency penalty to confidence
    const adjustedConfidence = Math.max(0, intervalAnalysis.confidence - recencyAnalysis.recencyPenalty);

    // Skip if confidence drops below threshold after penalty
    if (adjustedConfidence < minConfidence) continue;

    // Determine if this is income or expense based on transaction amounts
    const isIncome = group.transactions[0].amount > 0;

    // Determine if we should suggest enabling reminders
    // Suggest reminders for: fixed-amount expenses with monthly/quarterly/yearly frequency
    // Don't suggest reminders for: income, variable amounts, or weekly/biweekly
    const suggestReminders: boolean =
      !isIncome &&
      amountAnalysis.isConsistent &&
      ['monthly', 'quarterly', 'yearly'].includes(intervalAnalysis.frequency);

    // Calculate amount consistency as 100 - variance percentage (capped at 100)
    const amountVariance = Math.round(Math.max(0, 100 - amountAnalysis.variance * 100));

    suggestions.push({
      id: randomUUID(),
      description: mostRecent.description,
      normalizedDescription: normalized,
      amount: Math.abs(mostRecent.amount),
      averageAmount: amountAnalysis.average,
      frequency: intervalAnalysis.frequency,
      confidence: adjustedConfidence,
      confidenceFactors: {
        ...intervalAnalysis.confidenceFactors,
        amountVariance,
        missedPayments: recencyAnalysis.missedPayments,
        recencyPenalty: recencyAnalysis.recencyPenalty,
        daysSinceLastPayment: recencyAnalysis.daysSinceLastPayment,
      },
      occurrences: group.transactions.length,
      lastOccurrence: lastDate,
      nextExpected,
      dayOfMonth: intervalAnalysis.dayOfMonth,
      dayOfWeek: intervalAnalysis.dayOfWeek,
      categoryId: mostRecent.categoryId,
      accountId: mostRecent.accountId,
      transactionIds: group.transactions.map(t => t.id),
      suggestReminders,
      type: isIncome ? 'income' : 'expense',
      status: 'pending',
    });
  }

  // Sort by confidence (highest first)
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

/**
 * Convert frequency to RecurringFrequency type
 */
export function toRecurringFrequency(freq: DetectedFrequency): 'daily' | 'weekly' | 'monthly' | 'yearly' {
  switch (freq) {
    case 'weekly':
    case 'biweekly':
      return 'weekly';
    case 'monthly':
    case 'quarterly':
      return 'monthly';
    case 'yearly':
      return 'yearly';
    default:
      return 'monthly';
  }
}

/**
 * Convert frequency to BillFrequency type
 */
export function toBillFrequency(freq: DetectedFrequency): 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' {
  return freq;
}

/**
 * Convert frequency to unified RecurringFrequency type (includes all frequencies)
 */
export function toUnifiedFrequency(freq: DetectedFrequency): 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' {
  return freq;
}
