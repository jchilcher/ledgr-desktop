import React from 'react';

interface EditableDateProps {
  value: string; // ISO date string (YYYY-MM-DD)
  isEditing: boolean;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: string;
  max?: string;
  formatDisplay?: (dateString: string) => string;
}

const defaultFormatDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function EditableDate({
  value,
  isEditing,
  onChange,
  onKeyDown,
  error,
  placeholder,
  disabled,
  className = '',
  min,
  max,
  formatDisplay = defaultFormatDisplay,
}: EditableDateProps) {
  if (!isEditing) {
    return (
      <span className={className}>
        {value ? formatDisplay(value) : <span className="inline-edit-display-muted">{placeholder || 'No date'}</span>}
      </span>
    );
  }

  return (
    <div className="inline-edit-field-wrapper">
      <input
        type="date"
        className={`inline-edit-field inline-edit-field--date ${error ? 'inline-edit-field--error' : ''} ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
      />
      {error && <span className="inline-edit-error">{error}</span>}
    </div>
  );
}
