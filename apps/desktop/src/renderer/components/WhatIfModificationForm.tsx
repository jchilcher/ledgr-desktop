import React, { useState } from 'react';
import type { WhatIfModification, WhatIfModificationType } from '../hooks/useWhatIfProjections';

interface RecurringItemOption {
  id: string;
  description: string;
  amount: number;
  frequency: string;
}

interface CategoryOption {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface WhatIfModificationFormProps {
  recurringItems: RecurringItemOption[];
  categories: CategoryOption[];
  onAddModification: (mod: WhatIfModification) => void;
}

const WhatIfModificationForm: React.FC<WhatIfModificationFormProps> = ({
  recurringItems,
  categories,
  onAddModification,
}) => {
  const [modType, setModType] = useState<WhatIfModificationType>('pause_expense');
  const [selectedRecurringId, setSelectedRecurringId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [percentReduction, setPercentReduction] = useState(20);
  const [incomeAmount, setIncomeAmount] = useState(0);

  const expenseItems = recurringItems.filter(i => i.amount < 0);
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const handleAdd = () => {
    let mod: WhatIfModification | null = null;

    switch (modType) {
      case 'pause_expense': {
        const item = expenseItems.find(i => i.id === selectedRecurringId);
        if (item) {
          mod = {
            type: 'pause_expense',
            recurringItemId: selectedRecurringId,
            label: `Pause ${item.description}`,
          };
        }
        break;
      }
      case 'cut_category': {
        const cat = expenseCategories.find(c => c.id === selectedCategoryId);
        if (cat && percentReduction > 0) {
          mod = {
            type: 'cut_category',
            categoryId: selectedCategoryId,
            percentReduction,
            label: `Cut ${cat.name} by ${percentReduction}%`,
          };
        }
        break;
      }
      case 'add_income': {
        if (incomeAmount > 0) {
          mod = {
            type: 'add_income',
            amountChange: incomeAmount * 100, // convert dollars to cents
            label: `Add $${incomeAmount}/mo income`,
          };
        }
        break;
      }
    }

    if (mod) {
      onAddModification(mod);
      setSelectedRecurringId('');
      setSelectedCategoryId('');
      setIncomeAmount(0);
    }
  };

  return (
    <div style={{
      padding: '12px',
      backgroundColor: 'var(--color-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontWeight: 500, marginBottom: '10px', fontSize: '13px' }}>
        Add Modification
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            Type
          </label>
          <select
            value={modType}
            onChange={(e) => setModType(e.target.value as WhatIfModificationType)}
            style={{ minWidth: '140px' }}
          >
            <option value="pause_expense">Pause Expense</option>
            <option value="cut_category">Cut Category %</option>
            <option value="add_income">Add Income</option>
          </select>
        </div>

        {modType === 'pause_expense' && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Expense
            </label>
            <select
              value={selectedRecurringId}
              onChange={(e) => setSelectedRecurringId(e.target.value)}
              style={{ minWidth: '200px' }}
            >
              <option value="">Select expense...</option>
              {expenseItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.description} (${(Math.abs(item.amount) / 100).toFixed(0)}/{item.frequency.slice(0, 3)})
                </option>
              ))}
            </select>
          </div>
        )}

        {modType === 'cut_category' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Category
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                style={{ minWidth: '150px' }}
              >
                <option value="">Select category...</option>
                {expenseCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Reduction %
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={percentReduction}
                onChange={(e) => setPercentReduction(parseInt(e.target.value) || 0)}
                style={{ width: '80px' }}
              />
            </div>
          </>
        )}

        {modType === 'add_income' && (
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Amount/month ($)
            </label>
            <input
              type="number"
              min="0"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(parseFloat(e.target.value) || 0)}
              style={{ width: '120px' }}
              placeholder="$0"
            />
          </div>
        )}

        <button onClick={handleAdd} className="btn btn-secondary">
          Add
        </button>
      </div>
    </div>
  );
};

export default WhatIfModificationForm;
