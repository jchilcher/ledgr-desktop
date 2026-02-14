import { useHousehold } from '../contexts/HouseholdContext';

interface OwnershipSelectorProps {
  value: string | null;
  onChange: (ownerId: string | null) => void;
  label?: string;
}

export default function OwnershipSelector({ value, onChange, label = 'Owner' }: OwnershipSelectorProps) {
  const { users } = useHousehold();

  if (users.length < 2) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <label style={{ fontSize: '0.85em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{label}:</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ fontSize: '0.85em', padding: '4px 8px' }}
      >
        <option value="">Shared (Household)</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
    </div>
  );
}
