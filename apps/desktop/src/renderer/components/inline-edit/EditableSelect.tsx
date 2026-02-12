import React from 'react';

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
}

interface EditableSelectProps {
  value: string;
  isEditing: boolean;
  options: SelectOption[];
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export function EditableSelect({
  value,
  isEditing,
  options,
  onChange,
  onKeyDown,
  error,
  placeholder,
  disabled,
  className = '',
  allowEmpty = false,
  emptyLabel = 'None',
}: EditableSelectProps) {
  if (!isEditing) {
    const selectedOption = options.find(opt => opt.value === value);
    if (!selectedOption) {
      return <span className={`inline-edit-display-muted ${className}`}>{emptyLabel}</span>;
    }
    return (
      <span className={className}>
        {selectedOption.icon && <span className="inline-edit-option-icon">{selectedOption.icon} </span>}
        {selectedOption.label}
      </span>
    );
  }

  return (
    <div className="inline-edit-field-wrapper">
      <select
        className={`inline-edit-field inline-edit-field--select ${error ? 'inline-edit-field--error' : ''} ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {placeholder && !value && <option value="" disabled>{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.icon ? `${option.icon} ${option.label}` : option.label}
          </option>
        ))}
      </select>
      {error && <span className="inline-edit-error">{error}</span>}
    </div>
  );
}
