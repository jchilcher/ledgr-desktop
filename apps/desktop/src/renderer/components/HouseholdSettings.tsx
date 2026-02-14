import React, { useState, useEffect } from 'react';
import { User, UserAuthStatus } from '../../shared/types';

interface HouseholdSettingsProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

const HouseholdSettings: React.FC<HouseholdSettingsProps> = ({ onToast }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#ef4444');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [memberAuthStatus, setMemberAuthStatus] = useState<UserAuthStatus[]>([]);

  useEffect(() => {
    loadUsers();
    loadMemberAuthStatus();
  }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await window.api.users.getAll();
      setUsers(allUsers);
    } catch {
      onToast('Error loading household members', 'error');
    }
  };

  const loadMemberAuthStatus = async () => {
    try {
      const members = await window.api.security.getMemberAuthStatus();
      setMemberAuthStatus(members);
    } catch {
      // May fail if no users exist yet
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await window.api.users.create(newName.trim(), newColor);
      setNewName('');
      setNewColor('#ef4444');
      setShowAddForm(false);
      await loadUsers();
      await loadMemberAuthStatus();
      onToast(`Added "${newName.trim()}" to household`, 'success');
    } catch {
      onToast('Error adding member', 'error');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await window.api.users.update(id, { name: editName.trim(), color: editColor });
      setEditingId(null);
      await loadUsers();
      onToast('Member updated', 'success');
    } catch {
      onToast('Error updating member', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user || user.isDefault) return;
    if (!window.confirm(`Remove "${user.name}" from household?`)) return;
    try {
      await window.api.users.delete(id);
      await loadUsers();
      onToast(`Removed "${user.name}" from household`, 'success');
    } catch {
      onToast('Error removing member', 'error');
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditColor(user.color);
  };

  return (
    <div>
      <h3>Household Members</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
        Manage household members to track shared and individual finances.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {users.map(user => (
          <div
            key={user.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              background: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              borderLeft: `4px solid ${user.color}`,
            }}
          >
            {editingId === user.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.9rem' }}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdate(user.id); if (e.key === 'Escape') setEditingId(null); }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: c,
                        border: editColor === c ? '2px solid var(--color-text)' : '2px solid transparent',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => handleUpdate(user.id)}>Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: user.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    flexShrink: 0,
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>
                  {user.name}
                  {user.isDefault && (
                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(default)</span>
                  )}
                </span>
                <button className="btn btn-sm btn-secondary" onClick={() => startEdit(user)}>Edit</button>
                {!user.isDefault && (() => {
                  const authInfo = memberAuthStatus.find(m => m.userId === user.id);
                  const canDelete = authInfo?.hasPassword ?? false;
                  return (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(user.id)}
                      disabled={!canDelete}
                      title={canDelete ? 'Remove this member' : 'Member must have a password set before they can be removed'}
                    >
                      Remove
                    </button>
                  );
                })()}
              </>
            )}
          </div>
        ))}
      </div>

      {showAddForm ? (
        <div style={{
          padding: '14px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <input
            type="text"
            placeholder="Member name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddForm(false); }}
            style={{ padding: '6px 10px', fontSize: '0.9rem' }}
          />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Color:</span>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: c,
                  border: newColor === c ? '2px solid var(--color-text)' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newName.trim()}>
              Add Member
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => setShowAddForm(true)}>
          + Add Member
        </button>
      )}
    </div>
  );
};

export default HouseholdSettings;
