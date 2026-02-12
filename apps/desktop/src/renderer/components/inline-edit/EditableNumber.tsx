import React from 'react';

interface EditableNumberProps {
  value: number | string;
  isEditing: boolean;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  error?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  step?: number | string;
  formatDisplay?: (value: number | string) => string;
}

export function EditableNumber({
  value,
  isEditing,
  onChange,
  onKeyDown,
  error,
  prefix,
  suffix,
  placeholder,
  disabled,
  className = '',
  min,
  max,
  step = 'any',
  formatDisplay,
}: EditableNumberProps) {
  if (!isEditing) {
    const displayValue = formatDisplay ? formatDisplay(value) : String(value);
    return (
      <span className={className}>
        {prefix}{displayValue}{suffix}
      </span>
    );
  }

  return (
    <div className="inline-edit-field-wrapper">
      <div className="inline-edit-number-container">
        {prefix && <span className="inline-edit-prefix">{prefix}</span>}
        <input
          type="number"
          className={`inline-edit-field inline-edit-field--number ${error ? 'inline-edit-field--error' : ''} ${className}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
        />
        {suffix && <span className="inline-edit-suffix">{suffix}</span>}
      </div>
      {error && <span className="inline-edit-error">{error}</span>}
    </div>
  );
}
