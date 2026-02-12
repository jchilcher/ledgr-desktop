import { useState, useEffect } from 'react';
import { Category, TransactionType } from '../../shared/types';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { EditableText, EditableSelect } from './inline-edit';

const DEFAULT_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#78716C', '#71717A', '#64748B',
];

const CATEGORY_ICONS = [
  '🛒', '🍽️', '🏠', '💡', '⛽', '🚗', '⚕️', '🎬', '🛍️', '📱',
  '💰', '💼', '📝', '📈', '↩️', '💵', '🏦', '🔄', '✈️', '🎄',
  '🎁', '🏋️', '📚', '🎮', '🐾', '👶', '💄', '🔧', '🏥', '🎓',
];

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

interface EditFormData {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  isDefault: boolean;
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formIcon, setFormIcon] = useState(CATEGORY_ICONS[0]);
  const [formColor, setFormColor] = useState(DEFAULT_COLORS[0]);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  // Inline edit hook
  const inlineEdit = useInlineEdit<EditFormData>({
    onSave: async (id, data) => {
      if (!data.name?.trim()) {
        throw new Error('Category name is required');
      }

      // Check for duplicate names
      const duplicate = categories.find(
        c => c.name.toLowerCase() === data.name!.trim().toLowerCase() && c.id !== id
      );
      if (duplicate) {
        throw new Error('A category with this name already exists');
      }

      await window.api.categories.update(id, {
        name: data.name.trim(),
        type: data.type,
        icon: data.icon,
        color: data.color,
      });
      await loadCategories();
    },
    validateField: (field, value) => {
      if (field === 'name' && (!value || !(value as string).trim())) {
        return 'Name is required';
      }
      return null;
    },
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const allCategories = await window.api.categories.getAll();
      setCategories(allCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formName.trim()) {
      setError('Category name is required');
      return;
    }

    // Check for duplicate names
    const duplicate = categories.find(
      c => c.name.toLowerCase() === formName.trim().toLowerCase()
    );
    if (duplicate) {
      setError('A category with this name already exists');
      return;
    }

    try {
      setLoading(true);
      await window.api.categories.create({
        name: formName.trim(),
        type: formType,
        icon: formIcon,
        color: formColor,
        isDefault: false,
      });
      resetForm();
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInlineEdit = (category: Category) => {
    if (showForm) {
      setShowForm(false);
    }

    inlineEdit.startEdit(category.id, {
      id: category.id,
      name: category.name,
      type: category.type,
      icon: category.icon || CATEGORY_ICONS[0],
      color: category.color || DEFAULT_COLORS[0],
      isDefault: category.isDefault,
    });
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Delete category "${category.name}"? Transactions using this category will become uncategorized.`)) {
      return;
    }

    try {
      setLoading(true);
      await window.api.categories.delete(category.id);
      await loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormType('expense');
    setFormIcon(CATEGORY_ICONS[0]);
    setFormColor(DEFAULT_COLORS[0]);
    setError('');
  };

  const filteredCategories = categories.filter(c => {
    if (filterType === 'all') return true;
    return c.type === filterType;
  });

  const incomeCategories = filteredCategories.filter(c => c.type === 'income');
  const expenseCategories = filteredCategories.filter(c => c.type === 'expense');

  const renderCategoryCard = (category: Category) => {
    const isEditing = inlineEdit.editingId === category.id;

    if (isEditing) {
      const editData = inlineEdit.editData as EditFormData;

      return (
        <div
          key={category.id}
          className="inline-edit-card"
          style={{
            padding: '12px',
            backgroundColor: 'var(--color-surface)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-md)',
            borderLeft: `4px solid ${editData.color || '#808080'}`,
          }}
          onKeyDown={inlineEdit.handleKeyDown}
        >
          <div className="inline-edit-grid" style={{ gap: '10px' }}>
            {/* Row 1: Name */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label" style={{ minWidth: '50px' }}>Name</span>
              <div className="inline-edit-grid-value">
                <EditableText
                  value={editData.name || ''}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('name', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.name}
                  disabled={inlineEdit.isSubmitting}
                  autoFocus
                />
              </div>
            </div>

            {/* Row 2: Type (only if not default) */}
            {!editData.isDefault && (
              <div className="inline-edit-grid-row">
                <span className="inline-edit-grid-label" style={{ minWidth: '50px' }}>Type</span>
                <div className="inline-edit-grid-value">
                  <EditableSelect
                    value={editData.type || 'expense'}
                    isEditing={true}
                    options={TYPE_OPTIONS}
                    onChange={(v) => inlineEdit.updateField('type', v as TransactionType)}
                    onKeyDown={inlineEdit.handleKeyDown}
                    disabled={inlineEdit.isSubmitting}
                  />
                </div>
              </div>
            )}

            {/* Row 3: Icon */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label" style={{ minWidth: '50px' }}>Icon</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {CATEGORY_ICONS.slice(0, 15).map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => inlineEdit.updateField('icon', icon)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: editData.icon === icon ? 'var(--color-primary)' : 'var(--color-surface)',
                      border: editData.icon === icon ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    disabled={inlineEdit.isSubmitting}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 4: Color */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label" style={{ minWidth: '50px' }}>Color</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {DEFAULT_COLORS.slice(0, 10).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => inlineEdit.updateField('color', color)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: editData.color === color ? '2px solid var(--color-text)' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    disabled={inlineEdit.isSubmitting}
                  />
                ))}
              </div>
            </div>

            {/* Form error */}
            {inlineEdit.errors._form && (
              <div className="inline-edit-error">
                {inlineEdit.errors._form}
              </div>
            )}

            {/* Actions */}
            <div className="inline-edit-actions" style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => inlineEdit.saveEdit()}
                className="btn btn-success"
                disabled={inlineEdit.isSubmitting}
                style={{ padding: '4px 12px', fontSize: '13px' }}
              >
                {inlineEdit.isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={inlineEdit.cancelEdit}
                className="btn btn-secondary"
                disabled={inlineEdit.isSubmitting}
                style={{ padding: '4px 12px', fontSize: '13px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // View mode
    return (
      <div
        key={category.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          borderLeft: `4px solid ${category.color || '#808080'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{category.icon}</span>
          <div>
            <div style={{ fontWeight: 500 }}>{category.name}</div>
            {category.isDefault && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Default</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => handleStartInlineEdit(category)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              color: 'var(--color-primary)',
              fontSize: '12px',
            }}
            title="Edit category"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(category)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              color: 'var(--color-danger)',
              fontSize: '12px',
            }}
            title="Delete category"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="category-manager">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Categories</h3>
        <button
          onClick={() => {
            inlineEdit.cancelEdit();
            setShowForm(!showForm);
          }}
          className="btn btn-primary"
          disabled={loading}
        >
          {showForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
          {error && (
            <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
              {error}
            </div>
          )}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Category name"
              disabled={loading}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as TransactionType)}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CATEGORY_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormIcon(icon)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: formIcon === icon ? 'var(--color-primary)' : 'var(--color-surface)',
                    border: formIcon === icon ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormColor(color)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: formColor === color ? '3px solid var(--color-text)' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Create
            </button>
            <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setFilterType('all')}
          className={filterType === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '6px 12px' }}
        >
          All ({categories.length})
        </button>
        <button
          onClick={() => setFilterType('expense')}
          className={filterType === 'expense' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '6px 12px' }}
        >
          Expenses ({categories.filter(c => c.type === 'expense').length})
        </button>
        <button
          onClick={() => setFilterType('income')}
          className={filterType === 'income' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '6px 12px' }}
        >
          Income ({categories.filter(c => c.type === 'income').length})
        </button>
      </div>

      {loading && categories.length === 0 ? (
        <p>Loading categories...</p>
      ) : filteredCategories.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No categories found.</p>
      ) : (
        <div>
          {filterType !== 'expense' && incomeCategories.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px', color: 'var(--color-success)' }}>Income Categories</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {incomeCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          {filterType !== 'income' && expenseCategories.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '8px', color: 'var(--color-danger)' }}>Expense Categories</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {expenseCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
