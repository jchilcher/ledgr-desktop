import React, { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import { useHousehold } from '../contexts/HouseholdContext';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onOpenNewWindow: (view: string) => void;
  onLock: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const STORAGE_KEY = 'sidebar-collapsed';

const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="7" height="7" rx="1" />
    <rect x="11" y="2" width="7" height="4" rx="1" />
    <rect x="11" y="8" width="7" height="10" rx="1" />
    <rect x="2" y="11" width="7" height="7" rx="1" />
  </svg>
);

const TransactionsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h14" />
    <path d="M3 10h14" />
    <path d="M3 15h10" />
  </svg>
);

const RecurringIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2l3 3-3 3" />
    <path d="M3 10V8a4 4 0 0 1 4-4h9" />
    <path d="M6 18l-3-3 3-3" />
    <path d="M17 10v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const BudgetsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="16" height="13" rx="2" />
    <path d="M2 9h16" />
    <path d="M6 13h3" />
  </svg>
);

const SavingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="8" />
    <circle cx="10" cy="10" r="3" />
    <path d="M10 2v3" />
    <path d="M10 15v3" />
    <path d="M2 10h3" />
    <path d="M15 10h3" />
  </svg>
);

const NetWorthIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l4-6 4 3 6-11" />
    <path d="M14 3h4v4" />
  </svg>
);

const InvestmentsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="10" width="3" height="7" rx="0.5" />
    <rect x="7" y="6" width="3" height="11" rx="0.5" />
    <rect x="12" y="3" width="3" height="14" rx="0.5" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="8" />
    <path d="M10 10l5-5" />
    <path d="M10 2v8h8" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="3" />
    <path d="M10 1.5v2M10 16.5v2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M1.5 10h2M16.5 10h2M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4" />
  </svg>
);

const PrivacyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L4 5v4c0 4.4 2.6 8.5 6 10 3.4-1.5 6-5.6 6-10V5L10 2z" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="9" width="12" height="9" rx="2" />
    <path d="M7 9V6a3 3 0 0 1 6 0v3" />
  </svg>
);

const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {collapsed ? (
      <path d="M7 4l6 6-6 6" />
    ) : (
      <path d="M13 4l-6 6 6 6" />
    )}
  </svg>
);

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    ],
  },
  {
    label: 'Money',
    items: [
      { id: 'transactions', label: 'Transactions', icon: <TransactionsIcon /> },
      { id: 'recurring', label: 'Recurring', icon: <RecurringIcon /> },
    ],
  },
  {
    label: 'Planning',
    items: [
      { id: 'budgets', label: 'Budgets', icon: <BudgetsIcon /> },
      { id: 'savings', label: 'Savings', icon: <SavingsIcon /> },
    ],
  },
  {
    label: 'Wealth',
    items: [
      { id: 'networth', label: 'Net Worth', icon: <NetWorthIcon /> },
      { id: 'investments', label: 'Investments', icon: <InvestmentsIcon /> },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { id: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  onOpenNewWindow,
  onLock,
}) => {
  const { householdFilter, setHouseholdFilter, users } = useHousehold();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // localStorage unavailable
    }
  }, [collapsed]);

  const handleItemClick = (viewId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      onOpenNewWindow(viewId);
    } else {
      onNavigate(viewId);
    }
  };

  const handleContextMenu = (viewId: string, e: React.MouseEvent) => {
    e.preventDefault();
    onOpenNewWindow(viewId);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-logo">
        {collapsed ? (
          <span className="sidebar-logo-letter">L</span>
        ) : (
          <span className="sidebar-logo-text">Ledgr</span>
        )}
      </div>

      {users.length >= 2 && !collapsed && (
        <div className="sidebar-household-filter">
          <button
            onClick={() => setHouseholdFilter('all')}
            className={`sidebar-household-btn ${householdFilter === 'all' ? 'sidebar-household-btn--active' : ''}`}
          >
            All
          </button>
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => setHouseholdFilter(user.id)}
              className={`sidebar-household-btn ${householdFilter === user.id ? 'sidebar-household-btn--active' : ''}`}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: user.color,
                  marginRight: '4px',
                }}
              />
              {user.name}
            </button>
          ))}
        </div>
      )}

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.label} className="sidebar-section">
            {!collapsed && (
              <div className="sidebar-section-label">{section.label}</div>
            )}
            {section.items.map((item) => (
              <button
                key={item.id}
                onClick={(e) => handleItemClick(item.id, e)}
                onContextMenu={(e) => handleContextMenu(item.id, e)}
                className={`sidebar-item ${activeView === item.id ? 'sidebar-item--active' : ''}`}
                title={collapsed ? `${item.label} (Shift+Click or right-click to open in new window)` : 'Shift+Click or right-click to open in new window'}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-divider" />
        <button
          onClick={onLock}
          className="sidebar-item"
          title={collapsed ? 'Lock' : 'Lock the app'}
        >
          <span className="sidebar-item-icon"><LockIcon /></span>
          {!collapsed && <span className="sidebar-item-label">Lock</span>}
        </button>
        <button
          onClick={(e) => handleItemClick('privacy', e)}
          onContextMenu={(e) => handleContextMenu('privacy', e)}
          className="sidebar-item"
          title={collapsed ? 'Privacy' : 'Encryption and sharing settings'}
        >
          <span className="sidebar-item-icon"><PrivacyIcon /></span>
          {!collapsed && <span className="sidebar-item-label">Privacy</span>}
        </button>
        <button
          onClick={(e) => handleItemClick('settings', e)}
          onContextMenu={(e) => handleContextMenu('settings', e)}
          className={`sidebar-item ${activeView === 'settings' ? 'sidebar-item--active' : ''}`}
          title={collapsed ? 'Settings (Shift+Click or right-click to open in new window)' : 'Shift+Click or right-click to open in new window'}
        >
          <span className="sidebar-item-icon"><SettingsIcon /></span>
          {!collapsed && <span className="sidebar-item-label">Settings</span>}
        </button>
        <div className="sidebar-footer-actions">
          <ThemeToggle />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-collapse-btn"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
