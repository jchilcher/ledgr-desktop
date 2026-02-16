import { renderHook, act } from '@testing-library/react';
import { useInlineEdit } from '../../hooks/useInlineEdit';

interface TestItem {
  id: string;
  name: string;
  amount: number;
}

describe('useInlineEdit', () => {
  it('enters edit mode with initial data', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    expect(result.current.editingId).toBe('1');
    expect(result.current.editData).toEqual(testItem);
    expect(result.current.errors).toEqual({});
  });

  it('cancels edit mode', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    expect(result.current.editingId).toBe('1');

    act(() => {
      result.current.cancelEdit();
    });

    expect(result.current.editingId).toBe(null);
    expect(result.current.editData).toEqual({});
    expect(result.current.errors).toEqual({});
  });

  it('updates field values', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    act(() => {
      result.current.updateField('name', 'Updated');
    });

    expect(result.current.editData.name).toBe('Updated');
  });

  it('saves changes successfully', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    act(() => {
      result.current.updateField('name', 'Updated');
    });

    let saveResult: boolean = false;
    await act(async () => {
      saveResult = await result.current.saveEdit();
    });

    expect(saveResult).toBe(true);
    expect(onSave).toHaveBeenCalledWith('1', { ...testItem, name: 'Updated' });
    expect(result.current.editingId).toBe(null);
  });

  it('validates fields on update when validator provided', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const validateField = jest.fn((field: keyof TestItem, value: unknown) => {
      if (field === 'amount' && typeof value === 'number' && value <= 0) {
        return 'Amount must be positive';
      }
      return null;
    });

    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave, validateField }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    act(() => {
      result.current.updateField('amount', -50);
    });

    expect(result.current.errors.amount).toBe('Amount must be positive');
  });

  it('clears field error when field is updated', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const validateField = jest.fn((field: keyof TestItem, value: unknown) => {
      if (field === 'amount' && typeof value === 'number' && value <= 0) {
        return 'Amount must be positive';
      }
      return null;
    });

    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave, validateField }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    act(() => {
      result.current.updateField('amount', -50);
    });

    expect(result.current.errors.amount).toBe('Amount must be positive');

    act(() => {
      result.current.updateField('amount', 200);
    });

    expect(result.current.errors.amount).toBeUndefined();
  });

  it('prevents save with validation errors', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const validateField = jest.fn((field: keyof TestItem, value: unknown) => {
      if (field === 'amount' && typeof value === 'number' && value <= 0) {
        return 'Amount must be positive';
      }
      return null;
    });

    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave, validateField }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    act(() => {
      result.current.updateField('amount', -50);
    });

    let saveResult: boolean = false;
    await act(async () => {
      saveResult = await result.current.saveEdit();
    });

    expect(saveResult).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.editingId).toBe('1');
  });

  it('handles save errors', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Save failed'));
    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    let saveResult: boolean = false;
    await act(async () => {
      saveResult = await result.current.saveEdit();
    });

    expect(saveResult).toBe(false);
    expect(result.current.errors._form).toBe('Save failed');
    expect(result.current.editingId).toBe('1');
  });

  it('handles Escape key to cancel', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    const escapeEvent = {
      key: 'Escape',
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleKeyDown(escapeEvent);
    });

    expect(escapeEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.editingId).toBe(null);
  });

  it('handles Enter key to save (non-textarea)', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    const enterEvent = {
      key: 'Enter',
      shiftKey: false,
      target: { tagName: 'INPUT' },
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    await act(async () => {
      result.current.handleKeyDown(enterEvent);
    });

    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });

  it('does not save on Enter in textarea', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInlineEdit<TestItem>({ onSave }));

    const testItem: TestItem = { id: '1', name: 'Test', amount: 100 };

    act(() => {
      result.current.startEdit('1', testItem);
    });

    const enterEvent = {
      key: 'Enter',
      shiftKey: false,
      target: { tagName: 'TEXTAREA' },
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    await act(async () => {
      result.current.handleKeyDown(enterEvent);
    });

    expect(enterEvent.preventDefault).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
