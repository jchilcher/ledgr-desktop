import React from 'react';

interface EditableTextProps {
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function EditableText({
  value,
  isEditing,
  onChange,
  onKeyDown,
  error,
  placeholder,
  disabled,
  className = '',
  autoFocus = false,
}: EditableTextProps) {
  if (!isEditing) {
    return <span className={className}>{value || placeholder}</span>;
  }

  return (
    <div className="inline-edit-field-wrapper">
      <input
        type="text"
        className={`inline-edit-field ${error ? 'inline-edit-field--error' : ''} ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {error && <span className="inline-edit-error">{error}</span>}
    </div>
  );
}
