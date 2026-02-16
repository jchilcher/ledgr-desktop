import { renderHook } from '@testing-library/react';
import { useWhatIfProjections, WhatIfModification } from '../../hooks/useWhatIfProjections';

interface RecurringItemForCalc {
  id: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  categoryId?: string | null;
}

describe('useWhatIfProjections', () => {
  const baseProjections = [
    { date: '2026-02-15', balance: 5000 },
    { date: '2026-03-15', balance: 4500 },
    { date: '2026-04-15', balance: 4000 },
    { date: '2026-05-15', balance: 3500 },
  ];

  const recurringItems: RecurringItemForCalc[] = [
    { id: '1', amount: -1000, frequency: 'monthly', categoryId: 'groceries' },
    { id: '2', amount: -500, frequency: 'monthly', categoryId: 'utilities' },
    { id: '3', amount: 3000, frequency: 'monthly', categoryId: 'income' },
  ];

  it('returns null when no modifications', () => {
    const { result } = renderHook(() =>
      useWhatIfProjections(baseProjections, 5000, [], recurringItems)
    );

    expect(result.current).toBe(null);
  });

  it('returns null when no projections', () => {
    const modifications: WhatIfModification[] = [
      { type: 'pause_expense', recurringItemId: '1', label: 'Pause groceries' },
    ];

    const { result } = renderHook(() =>
      useWhatIfProjections([], 5000, modifications, recurringItems)
    );

    expect(result.current).toBe(null);
  });

  it('calculates modified projections for paused expense', () => {
    const modifications: WhatIfModification[] = [
      { type: 'pause_expense', recurringItemId: '1', label: 'Pause groceries' },
    ];

    const { result } = renderHook(() =>
      useWhatIfProjections(baseProjections, 5000, modifications, recurringItems)
    );

    expect(result.current).not.toBe(null);
    expect(result.current?.modifiedProjections).toHaveLength(4);
    expect(result.current?.modifiedProjections[0].modifiedBalance).toBeGreaterThanOrEqual(
      baseProjections[0].balance
    );
    expect(result.current?.comparison.totalMonthlySavings).toBe(1000);
  });

  it('calculates modified projections for category reduction', () => {
    const modifications: WhatIfModification[] = [
      { type: 'cut_category', categoryId: 'groceries', percentReduction: 50, label: 'Cut groceries 50%' },
    ];

    const { result } = renderHook(() =>
      useWhatIfProjections(baseProjections, 5000, modifications, recurringItems)
    );

    expect(result.current).not.toBe(null);
    expect(result.current?.comparison.totalMonthlySavings).toBe(500);
  });

  it('calculates modified projections for added income', () => {
    const modifications: WhatIfModification[] = [
      { type: 'add_income', amountChange: 1000, label: 'Add side income' },
    ];

    const { result } = renderHook(() =>
      useWhatIfProjections(baseProjections, 5000, modifications, recurringItems)
    );

    expect(result.current).not.toBe(null);
    expect(result.current?.comparison.totalMonthlySavings).toBe(1000);
  });

  it('calculates comparison metrics', () => {
    const modifications: WhatIfModification[] = [
      { type: 'pause_expense', recurringItemId: '1', label: 'Pause groceries' },
    ];

    const { result } = renderHook(() =>
      useWhatIfProjections(baseProjections, 5000, modifications, recurringItems)
    );

    expect(result.current).not.toBe(null);
    expect(result.current?.comparison).toHaveProperty('originalEndingBalance');
    expect(result.current?.comparison).toHaveProperty('modifiedEndingBalance');
    expect(result.current?.comparison).toHaveProperty('originalLowestBalance');
    expect(result.current?.comparison).toHaveProperty('modifiedLowestBalance');
    expect(result.current?.comparison.modifiedEndingBalance).toBeGreaterThan(
      result.current!.comparison.originalEndingBalance
    );
  });

  it('handles multiple modifications', () => {
    const modifications: WhatIfModification[] = [
      { type: 'pause_expense', recurringItemId: '1', label: 'Pause groceries' },
      { type: 'add_income', amountChange: 500, label: 'Add side income' },
    ];

    const { result } = renderHook(() =>
      useWhatIfProjections(baseProjections, 5000, modifications, recurringItems)
    );

    expect(result.current).not.toBe(null);
    expect(result.current?.comparison.totalMonthlySavings).toBe(1500);
  });

  it('recalculates when modifications change', () => {
    const modifications1: WhatIfModification[] = [
      { type: 'pause_expense', recurringItemId: '1', label: 'Pause groceries' },
    ];

    const { result, rerender } = renderHook(
      ({ mods }) => useWhatIfProjections(baseProjections, 5000, mods, recurringItems),
      { initialProps: { mods: modifications1 } }
    );

    const firstResult = result.current;
    expect(firstResult?.comparison.totalMonthlySavings).toBe(1000);

    const modifications2: WhatIfModification[] = [
      { type: 'add_income', amountChange: 2000, label: 'Add side income' },
    ];

    rerender({ mods: modifications2 });

    expect(result.current?.comparison.totalMonthlySavings).toBe(2000);
    expect(result.current).not.toBe(firstResult);
  });
});
