import React from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, secondaryAction }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px', lineHeight: 1 }}>{icon}</div>
      <h3 style={{
        margin: '0 0 8px 0',
        fontSize: '1.1rem',
        fontWeight: 600,
        color: 'var(--color-text)',
      }}>{title}</h3>
      <p style={{
        margin: '0 0 20px 0',
        fontSize: '0.9rem',
        color: 'var(--color-text-muted)',
        maxWidth: '360px',
        lineHeight: 1.5,
      }}>{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary"
        >
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className="btn-link"
          style={{ marginTop: '12px', fontSize: '0.85rem' }}
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
