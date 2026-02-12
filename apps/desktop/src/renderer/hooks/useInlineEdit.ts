import { useState, useCallback } from 'react';

export interface UseInlineEditOptions<T> {
  onSave: (id: string, data: Partial<T>) => Promise<void>;
  validateField?: (field: keyof T, value: unknown) => string | null;
}

export interface UseInlineEditReturn<T> {
  editingId: string | null;
  editData: Partial<T>;
  errors: Record<string, string>;
  isSubmitting: boolean;
  startEdit: (id: string, initialData: T) => void;
  cancelEdit: () => void;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  saveEdit: () => Promise<boolean>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useInlineEdit<T extends { id: string }>(
  options: UseInlineEditOptions<T>
): UseInlineEditReturn<T> {
  const { onSave, validateField } = options;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEdit = useCallback((id: string, initialData: T) => {
    // Auto-cancel any current edit when starting a new one
    setEditingId(id);
    setEditData({ ...initialData });
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditData({});
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setEditData(prev => ({ ...prev, [field]: value }));

    // Clear error for this field when user updates it
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field as string];
      return newErrors;
    });

    // Run validation if provided
    if (validateField) {
      const error = validateField(field, value);
      if (error) {
        setErrors(prev => ({ ...prev, [field as string]: error }));
      }
    }
  }, [validateField]);

  const saveEdit = useCallback(async (): Promise<boolean> => {
    if (!editingId || isSubmitting) return false;

    // Validate all fields if validator provided
    if (validateField) {
      const newErrors: Record<string, string> = {};
      for (const [key, value] of Object.entries(editData)) {
        const error = validateField(key as keyof T, value);
        if (error) {
          newErrors[key] = error;
        }
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
      }
    }

    setIsSubmitting(true);
    try {
      await onSave(editingId, editData);
      cancelEdit();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setErrors({ _form: message });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [editingId, editData, isSubmitting, onSave, validateField, cancelEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Don't save on Enter in textareas (allow multiline input)
      if ((e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        saveEdit();
      }
    }
  }, [cancelEdit, saveEdit]);

  return {
    editingId,
    editData,
    errors,
    isSubmitting,
    startEdit,
    cancelEdit,
    updateField,
    saveEdit,
    handleKeyDown,
  };
}
