import { useMemo } from 'react';
import { RecurringFrequency } from '../../shared/types';

export type WhatIfModificationType = 'pause_expense' | 'cut_category' | 'add_income';

export interface WhatIfModification {
  type: WhatIfModificationType;
  recurringItemId?: string;
  categoryId?: string;
  percentReduction?: number;
  amountChange?: number; // cents per month
  label: string;
}

export interface WhatIfProjectionPoint {
  date: string;
  modifiedBalance: number;
}

export interface WhatIfComparisonMetrics {
  originalEndingBalance: number;
  modifiedEndingBalance: number;
  originalLowestBalance: number;
  modifiedLowestBalance: number;
  originalDaysUntilNegative: number | null;
  modifiedDaysUntilNegative: number | null;
  totalMonthlySavings: number;
}

export interface WhatIfResult {
  modifiedProjections: WhatIfProjectionPoint[];
  comparison: WhatIfComparisonMetrics;
}

interface RecurringItemForCalc {
  id: string;
  amount: number;
  frequency: RecurringFrequency;
  categoryId?: string | null;
}

interface ProjectionPoint {
  date: string;
  balance: number;
}

function calculateMonthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  const absAmount = Math.abs(amount);
  switch (frequency) {
    case 'daily':
      return absAmount * 30;
    case 'weekly':
      return absAmount * 4.33;
    case 'biweekly':
      return absAmount * 2.17;
    case 'monthly':
      return absAmount;
    case 'quarterly':
      return absAmount / 3;
    case 'yearly':
      return absAmount / 12;
    default:
      return absAmount;
  }
}

function calculateTotalMonthlySavings(
  modifications: WhatIfModification[],
  recurringItems: RecurringItemForCalc[],
): number {
  let totalMonthlySavings = 0;

  for (const mod of modifications) {
    switch (mod.type) {
      case 'pause_expense': {
        const item = recurringItems.find(i => i.id === mod.recurringItemId);
        if (item && item.amount < 0) {
          totalMonthlySavings += calculateMonthlyEquivalent(item.amount, item.frequency);
        }
        break;
      }
      case 'cut_category': {
        const pct = (mod.percentReduction ?? 0) / 100;
        const categoryItems = recurringItems.filter(
          i => i.categoryId === mod.categoryId && i.amount < 0,
        );
        for (const item of categoryItems) {
          totalMonthlySavings += calculateMonthlyEquivalent(item.amount, item.frequency) * pct;
        }
        break;
      }
      case 'add_income': {
        totalMonthlySavings += Math.abs(mod.amountChange ?? 0);
        break;
      }
    }
  }

  return totalMonthlySavings;
}

function findDaysUntilNegative(
  startBalance: number,
  projections: { date: string; balance: number }[],
): number | null {
  if (startBalance < 0) return 0;
  const startDate = projections.length > 0 ? new Date(projections[0].date) : new Date();
  for (const p of projections) {
    if (p.balance < 0) {
      const d = new Date(p.date);
      const days = Math.round((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return days;
    }
  }
  return null;
}

export function useWhatIfProjections(
  projections: ProjectionPoint[],
  currentBalance: number,
  modifications: WhatIfModification[],
  recurringItems: RecurringItemForCalc[],
): WhatIfResult | null {
  return useMemo(() => {
    if (modifications.length === 0 || projections.length === 0) {
      return null;
    }

    const monthlySavings = calculateTotalMonthlySavings(modifications, recurringItems);
    // Convert monthly savings to daily savings (in cents)
    const dailySavings = monthlySavings / 30;

    const startDate = new Date(projections[0].date);
    const modifiedProjections: WhatIfProjectionPoint[] = projections.map(p => {
      const d = new Date(p.date);
      const daysFromStart = Math.max(
        0,
        Math.round((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const cumulativeSavings = dailySavings * daysFromStart;
      return {
        date: p.date,
        modifiedBalance: p.balance + cumulativeSavings,
      };
    });

    const originalLowest = Math.min(currentBalance, ...projections.map(p => p.balance));
    const modifiedLowest = Math.min(
      currentBalance,
      ...modifiedProjections.map(p => p.modifiedBalance),
    );

    const originalEnding =
      projections.length > 0 ? projections[projections.length - 1].balance : currentBalance;
    const modifiedEnding =
      modifiedProjections.length > 0
        ? modifiedProjections[modifiedProjections.length - 1].modifiedBalance
        : currentBalance;

    const comparison: WhatIfComparisonMetrics = {
      originalEndingBalance: originalEnding,
      modifiedEndingBalance: modifiedEnding,
      originalLowestBalance: originalLowest,
      modifiedLowestBalance: modifiedLowest,
      originalDaysUntilNegative: findDaysUntilNegative(currentBalance, projections),
      modifiedDaysUntilNegative: findDaysUntilNegative(
        currentBalance,
        modifiedProjections.map(p => ({ date: p.date, balance: p.modifiedBalance })),
      ),
      totalMonthlySavings: monthlySavings,
    };

    return { modifiedProjections, comparison };
  }, [projections, currentBalance, modifications, recurringItems]);
}
