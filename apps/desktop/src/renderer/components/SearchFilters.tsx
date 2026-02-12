import React, { useState, useEffect } from 'react';
import { Category, Tag, Account } from '../../shared/types';

export interface SearchFiltersState {
  query: string;
  accountId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  tagIds: string[];
}

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onFiltersChange: (filters: SearchFiltersState) => void;
  onSearch: () => void;
  onClear: () => void;
}

export const defaultFilters: SearchFiltersState = {
  query: '',
  accountId: '',
  categoryId: '',
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  tagIds: [],
};

export default function SearchFilters({ filters, onFiltersChange, onSearch, onClear }: SearchFiltersProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const [accts, cats, allTags] = await Promise.all([
        window.api.accounts.getAll(),
        window.api.categories.getAll(),
        window.api.tags.getAll(),
      ]);
      setAccounts(accts);
      setCategories(cats);
      setTags(allTags);
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  };

  const updateFilter = <K extends keyof SearchFiltersState>(key: K, value: SearchFiltersState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleTag = (tagId: string) => {
    const newTagIds = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter(id => id !== tagId)
      : [...filters.tagIds, tagId];
    updateFilter('tagIds', newTagIds);
  };

  const hasActiveFilters =
    filters.query ||
    filters.accountId ||
    filters.categoryId ||
    filters.startDate ||
    filters.endDate ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.tagIds.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="search-filters" style={{ marginBottom: '16px' }}>
      {/* Main Search Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={filters.query}
            onChange={(e) => updateFilter('query', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search transactions..."
            style={{ width: '100%', paddingLeft: '36px' }}
          />
          <span style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
          }}>
            Search
          </span>
        </div>
        <button onClick={onSearch} className="btn btn-primary">
          Search
        </button>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`btn ${showAdvanced ? 'btn-secondary' : 'btn-outline'}`}
        >
          Filters {hasActiveFilters && !showAdvanced ? '*' : ''}
        </button>
        {hasActiveFilters && (
          <button onClick={onClear} className="btn btn-outline">
            Clear
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--color-surface-alt)',
          borderRadius: 'var(--radius-md)',
          marginTop: '8px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* Account Filter */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '13px' }}>
                Account
              </label>
              <select
                value={filters.accountId}
                onChange={(e) => updateFilter('accountId', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '13px' }}>
                Category
              </label>
              <select
                value={filters.categoryId}
                onChange={(e) => updateFilter('categoryId', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '13px' }}>
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => updateFilter('startDate', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '13px' }}>
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => updateFilter('endDate', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Amount Range */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '13px' }}>
                Min Amount
              </label>
              <input
                type="number"
                value={filters.minAmount}
                onChange={(e) => updateFilter('minAmount', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '13px' }}>
                Max Amount
              </label>
              <input
                type="number"
                value={filters.maxAmount}
                onChange={(e) => updateFilter('maxAmount', e.target.value)}
                placeholder="No limit"
                min="0"
                step="0.01"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Tags Filter */}
          {tags.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>
                Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tags.map((tag) => {
                  const isSelected = filters.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 12px',
                        backgroundColor: isSelected ? tag.color || '#808080' : 'transparent',
                        color: isSelected ? '#fff' : 'var(--color-text)',
                        border: `2px solid ${tag.color || '#808080'}`,
                        borderRadius: 'var(--radius-full)',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
