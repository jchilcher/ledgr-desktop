
interface EditableCheckboxProps {
  value: boolean;
  isEditing: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  displayTrue?: string;
  displayFalse?: string;
}

export function EditableCheckbox({
  value,
  isEditing,
  onChange,
  label,
  disabled,
  className = '',
  displayTrue,
  displayFalse,
}: EditableCheckboxProps) {
  if (!isEditing) {
    if (displayTrue || displayFalse) {
      return <span className={className}>{value ? displayTrue : displayFalse}</span>;
    }
    return (
      <span className={`inline-edit-checkbox-display ${className}`}>
        {value ? '✓' : '–'}
        {label && <span className="inline-edit-checkbox-label">{label}</span>}
      </span>
    );
  }

  return (
    <label className={`inline-edit-checkbox ${className}`}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      {label && <span className="inline-edit-checkbox-label">{label}</span>}
    </label>
  );
}
