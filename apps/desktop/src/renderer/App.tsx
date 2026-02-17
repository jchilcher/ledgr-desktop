import React, { useState, useEffect, useRef } from 'react';
import { Account, DatabaseMetadata, UserAuthStatus } from '../shared/types';
import { HouseholdProvider, useHousehold } from './contexts/HouseholdContext';
import TransactionList from './components/TransactionList';
import Dashboard from './components/Dashboard';
import SpendingVisualization from './components/SpendingVisualization';
import IncomeVsExpenses from './components/IncomeVsExpenses';
import CashFlowForecast from './components/CashFlowForecast';
import RecurringItems from './components/RecurringItems';
import { OFXConnectWizard } from './components/OFXConnectWizard';
import CategoryTrends from './components/CategoryTrends';
import CategoryForecast from './components/CategoryForecast';
import CategoryRules from './components/CategoryRules';
import RecurringItemRules from './components/RecurringItemRules';

import CategoryManager from './components/CategoryManager';
import RecurringSuggestions from './components/RecurringSuggestions';
import BudgetGoals from './components/BudgetGoals';
import SpendingAlerts from './components/SpendingAlerts';
import SavingsGoals from './components/SavingsGoals';
import ExportModal from './components/ExportModal';
import { ToastContainer, useToast } from './components/Toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
// Phase 7: Prediction & Reporting
import AnomalyAlerts from './components/AnomalyAlerts';
import SeasonalPatterns from './components/SeasonalPatterns';
import IncomeAnalysis from './components/IncomeAnalysis';
import SpendingVelocity from './components/SpendingVelocity';
import SubscriptionAudit from './components/SubscriptionAudit';
import FinancialHealthScore from './components/FinancialHealthScore';
import SavingsProjections from './components/SavingsProjections';
import DebtPayoff from './components/DebtPayoff';
import CategoryMigration from './components/CategoryMigration';
import BillCalendar from './components/BillCalendar';
// Phase 8: Recovery Plan Features
import RecoveryPlan from './components/RecoveryPlan';
import WhatIfSimulator from './components/WhatIfSimulator';
import EmergencyMode from './components/EmergencyMode';
import { InvestmentAccounts } from './components/InvestmentAccounts';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import TaxLotReport from './components/TaxLotReport';
import { NetWorthPage } from './pages/NetWorthPage';
import { TransactionImport } from './components/TransactionImport';
import UpdateNotification from './components/UpdateNotification';
import WhatsNewModal from './components/WhatsNewModal';
import { AboutDialog } from './components/AboutDialog';
import { ImportConfirmDialog } from './components/ImportConfirmDialog';
import LockScreen from './components/LockScreen';
import PasswordSettings from './components/PasswordSettings';
import FindBar from './components/FindBar';
import OnboardingWizard from './components/OnboardingWizard';
import EmptyState from './components/EmptyState';
import Sidebar from './components/Sidebar';
import AnalyticsLanding, { AnalyticsToolId } from './components/AnalyticsLanding';
import MonthInReview from './components/MonthInReview';
import YearInReview from './components/YearInReview';
import TransactionReviewQueue from './components/TransactionReviewQueue';
import HouseholdSettings from './components/HouseholdSettings';
import PrivacySettings from './components/PrivacySettings';
import BankExportGuide from './components/BankExportGuide';
import TutorialOverlay from './components/TutorialOverlay';

const BUILT_IN_RELEASE_NOTES: Record<string, string> = {
  '1.0.3': `
    <h3>Recurring Payment Tracking</h3>
    <ul>
      <li>Automatically generates expected payments from your active recurring items with pending, overdue, and paid status tracking.</li>
      <li>Mark payments as paid or link them to an existing transaction directly from the Bill Calendar or Recurring Items views.</li>
    </ul>
    <h3>Payment Rules</h3>
    <ul>
      <li>New "Payment Rules" tab under Recurring Items lets you create pattern-based rules that automatically match imported transactions to recurring items.</li>
      <li>Rules support description matching, amount range, and account filters.</li>
      <li>Imported transactions are now auto-matched against payment rules during file import.</li>
    </ul>
    <h3>Enhanced Automation Rules</h3>
    <ul>
      <li>Category automation rules now support additional conditions: amount range, account filter, and income/expense direction.</li>
      <li>New actions beyond category assignment: add tag, hide from reports, and mark as transfer.</li>
    </ul>
  `,
};

type ViewType = 'dashboard' | 'transactions' | 'recurring' | 'budgets' | 'savings' | 'networth' | 'investments' | 'analytics' | 'settings' | 'privacy' | 'lock';

const validViews: ViewType[] = ['dashboard', 'transactions', 'recurring', 'budgets', 'savings', 'networth', 'investments', 'analytics', 'settings', 'privacy', 'lock'];

const legacyViewMap: Record<string, ViewType> = {
  reports: 'analytics',
  insights: 'analytics',
  import: 'transactions',
  rules: 'settings',
  'review-queue': 'transactions',
};

let initialTransactionsTab: 'list' | 'import' | 'review' = 'list';
let initialSettingsTab: 'general' | 'categories' | 'rules' | 'household' | 'security' | 'data' = 'general';

function getInitialView(): ViewType {
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  if (viewParam) {
    if (validViews.includes(viewParam as ViewType)) {
      return viewParam as ViewType;
    }
    const mapped = legacyViewMap[viewParam];
    if (mapped) {
      if (viewParam === 'import') initialTransactionsTab = 'import';
      if (viewParam === 'review-queue') initialTransactionsTab = 'review';
      if (viewParam === 'rules') initialSettingsTab = 'rules';
      return mapped;
    }
  }
  return 'dashboard';
}

const AppContent: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>(getInitialView);
  const [showExportModal, setShowExportModal] = useState(false);
  const [analyticsToolId, setAnalyticsToolId] = useState<AnalyticsToolId | null>(null);
  const [transactionsTab, setTransactionsTab] = useState<'list' | 'import' | 'review'>(initialTransactionsTab);
  const [settingsTab, setSettingsTab] = useState<'general' | 'categories' | 'rules' | 'household' | 'security' | 'data'>(initialSettingsTab);
  const [investmentTab, setInvestmentTab] = useState<'holdings' | 'performance' | 'tax-reports'>('holdings');
  const [recurringTab, setRecurringTab] = useState<'items' | 'calendar' | 'rules'>('items');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'checking' | 'savings' | 'credit'>('checking');
  const [newAccountInstitution, setNewAccountInstitution] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [showOFXWizard, setShowOFXWizard] = useState(false);
  const [showTransactionImport, setShowTransactionImport] = useState(false);
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState('');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncPassword, setSyncPassword] = useState('');
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [versionString, setVersionString] = useState('');
  // Security state
  const [isLocked, setIsLocked] = useState(false);
  const [isStartupLock, setIsStartupLock] = useState(false);

  // Household context
  const household = useHousehold();

  // Per-member auth state
  const [memberAuthStatus, setMemberAuthStatus] = useState<UserAuthStatus[]>([]);

  // What's New post-update state
  const [whatsNewData, setWhatsNewData] = useState<{ version: string; releaseNotes: string } | null>(null);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState<AnalyticsToolId | null>(null);

  // Phase 10: Database Import/Export state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [currentMetadata, setCurrentMetadata] = useState<DatabaseMetadata | null>(null);
  const [importedMetadata, setImportedMetadata] = useState<DatabaseMetadata | null>(null);
  const [importFilePath, setImportFilePath] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const toast = useToast();
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll content area to top when view changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeView]);

  // Load accounts and member auth on mount
  useEffect(() => {
    loadAccounts();
    loadMemberAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load version info on mount + detect post-update for "What's New"
  useEffect(() => {
    window.api.app.getVersion().then(info => {
      setVersionString(info.app);

      const currentVersion = info.app;
      const lastSeen = localStorage.getItem('ledgr:lastSeenVersion');

      if (!lastSeen) {
        // Fresh install — just record current version, don't show modal
        localStorage.setItem('ledgr:lastSeenVersion', currentVersion);
        return;
      }

      if (lastSeen !== currentVersion) {
        // Version changed — check for stored release notes, fall back to built-in
        let found = false;
        try {
          const raw = localStorage.getItem('ledgr:pendingUpdateNotes');
          if (raw) {
            const parsed = JSON.parse(raw) as { version: string; releaseNotes: string };
            if (parsed.version === currentVersion && parsed.releaseNotes) {
              setWhatsNewData(parsed);
              found = true;
            }
          }
        } catch { /* bad JSON — skip */ }

        if (!found && BUILT_IN_RELEASE_NOTES[currentVersion]) {
          setWhatsNewData({ version: currentVersion, releaseNotes: BUILT_IN_RELEASE_NOTES[currentVersion] });
        }

        localStorage.setItem('ledgr:lastSeenVersion', currentVersion);
        localStorage.removeItem('ledgr:pendingUpdateNotes');
      }
    }).catch(() => {});
  }, []);

  // Check onboarding status on mount
  useEffect(() => {
    window.api.onboarding.getStatus().then(status => {
      if (status !== 'true') {
        setShowOnboarding(true);
      }
    }).catch(() => {});
  }, []);

  // Tutorial: check if tool needs tutorial on first visit
  useEffect(() => {
    if (!analyticsToolId) return;
    let cancelled = false;
    window.api.tutorials.isCompleted(analyticsToolId).then(status => {
      if (!cancelled && status !== 'true') {
        setShowTutorial(analyticsToolId);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [analyticsToolId]);

  // Security: check status, listen for lock/unlock, handle startup lock
  useEffect(() => {
    // Check if this is the startup lock view
    if (activeView === 'lock') {
      setIsStartupLock(true);
      setIsLocked(true);
      return;
    }

    // Listen for lock/unlock events
    const removeLock = window.api.security.onLock(() => {
      setIsLocked(true);
    });
    const removeUnlock = window.api.security.onUnlock(() => {
      setIsLocked(false);
    });

    return () => {
      removeLock();
      removeUnlock();
    };
  }, [activeView]);

  // Activity heartbeat for auto-lock
  useEffect(() => {
    let hasActivity = false;

    const markActivity = () => { hasActivity = true; };

    window.addEventListener('mousemove', markActivity);
    window.addEventListener('keydown', markActivity);
    window.addEventListener('click', markActivity);
    window.addEventListener('scroll', markActivity);

    const heartbeatInterval = setInterval(() => {
      if (hasActivity) {
        hasActivity = false;
        window.api.security.heartbeat().catch(() => {});
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('click', markActivity);
      window.removeEventListener('scroll', markActivity);
      clearInterval(heartbeatInterval);
    };
  }, []);

  const loadAccounts = async () => {
    try {
      const allAccounts = await window.api.accounts.getAll();
      setAccounts(allAccounts);
      if (allAccounts.length > 0 && !selectedAccountId) {
        const storedDefault = await window.api.accounts.getDefault();
        const defaultExists = storedDefault && allAccounts.some(a => a.id === storedDefault);
        setSelectedAccountId(defaultExists ? storedDefault : allAccounts[0].id);
        if (storedDefault) {
          setDefaultAccountId(storedDefault);
        }
      }
    } catch (error) {
      toast.error(`Error loading accounts: ${error}`);
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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await window.api.accounts.create({
        name: newAccountName,
        type: newAccountType,
        institution: newAccountInstitution,
        balance: Math.round((parseFloat(newAccountBalance) || 0) * 100),
        lastSynced: null,
      });
      toast.success(`Account "${newAccountName}" created successfully`);
      setNewAccountName('');
      setNewAccountInstitution('');
      setNewAccountBalance('');
      setShowAccountForm(false);
      await loadAccounts();
    } catch (error) {
      toast.error(`Error creating account: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBalance = async () => {
    if (!editingBalance) return;

    try {
      setLoading(true);
      await window.api.accounts.update(editingBalance, { balance: Math.round((parseFloat(editBalanceValue) || 0) * 100) });
      toast.success('Account balance updated');
      setEditingBalance(null);
      setEditBalanceValue('');
      await loadAccounts();
    } catch (error) {
      toast.error(`Error updating balance: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccountId) return;

    const accountToDelete = accounts.find(a => a.id === selectedAccountId);
    setShowDeleteAccountConfirm(false);

    try {
      setLoading(true);
      if (selectedAccountId === defaultAccountId) {
        await window.api.accounts.setDefault('');
        setDefaultAccountId(null);
      }
      await window.api.accounts.delete(selectedAccountId);
      toast.success(`Account "${accountToDelete?.name}" deleted successfully`);
      setSelectedAccountId(null);
      await loadAccounts();
    } catch (error) {
      toast.error(`Error deleting account: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedAccountId) {
      toast.warning('Please select an account first');
      return;
    }

    try {
      setLoading(true);

      // Open file dialog
      const filePath = await window.api.import.selectFile();

      if (!filePath) {
        toast.info('No file selected');
        setLoading(false);
        return;
      }

      // Import the file (supports CSV, OFX, QFX)
      const result = await window.api.import.file(selectedAccountId, filePath);

      if (result.success) {
        toast.success(
          `Import successful! Imported: ${result.imported}, Duplicates: ${result.duplicates}, Errors: ${result.errors}`
        );
      } else {
        toast.error(`Import failed: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Error importing file: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (view: string, accountId?: string) => {
    if (view === 'import') {
      setActiveView('transactions');
      setTransactionsTab('import');
    } else if (view === 'review-queue') {
      setActiveView('transactions');
      setTransactionsTab('review');
    } else if (view === 'rules') {
      setActiveView('settings');
      setSettingsTab('rules');
    } else {
      setActiveView(view as ViewType);
    }
    if (accountId) {
      setSelectedAccountId(accountId);
    }
  };

  const handleOFXSuccess = async (newAccounts: { name: string; accountId: string; type: string }[]) => {
    toast.success(`Successfully connected ${newAccounts.length} account(s)!`);
    setShowOFXWizard(false);
    await loadAccounts();
  };

  const handleSyncAccount = async () => {
    if (!selectedAccountId || !syncPassword) {
      toast.warning('Please enter your banking password');
      return;
    }

    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account?.ofxUrl) {
      toast.error('This account is not configured for OFX sync');
      return;
    }

    try {
      setLoading(true);
      toast.info('Syncing transactions...');
      const result = await window.api.ofx.syncTransactions(selectedAccountId, syncPassword);

      if (result.success) {
        toast.success(
          `Sync complete: ${result.imported} new transactions, ${result.duplicates} duplicates`
        );
        await loadAccounts();
      } else {
        toast.error(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Error syncing: ${error}`);
    } finally {
      setLoading(false);
      setSyncPassword('');
      setShowSyncModal(false);
    }
  };

  // Phase 10: Database Export/Import handlers
  const handleExportDatabase = async () => {
    try {
      const result = await window.api.database.export();
      if (result.success && result.filePath) {
        toast.success(`Database exported to: ${result.filePath}`);
      } else {
        if (result.error && result.error !== 'Export canceled by user') {
          toast.error(`Export failed: ${result.error}`);
        }
      }
    } catch (error) {
      toast.error(`Error exporting database: ${error}`);
    }
  };

  const handleImportDatabase = async () => {
    try {
      const result = await window.api.database.importSelect();

      if (result.canceled) {
        return;
      }

      if (result.error) {
        toast.error(`Import validation failed: ${result.error}`);
        return;
      }

      if (!result.metadata || !result.filePath) {
        toast.error('Invalid import file');
        return;
      }

      // Get current database metadata for comparison
      const current = await window.api.database.importGetCurrentMetadata();

      // Open comparison dialog
      setCurrentMetadata(current);
      setImportedMetadata(result.metadata);
      setImportFilePath(result.filePath);
      setImportDialogOpen(true);
    } catch (error) {
      toast.error(`Error selecting import file: ${error}`);
    }
  };

  const handleImportConfirm = async () => {
    if (!importFilePath) return;

    setIsImporting(true);
    try {
      const result = await window.api.database.importConfirm(importFilePath);

      if (result.success) {
        // Close dialog
        setImportDialogOpen(false);
        setIsImporting(false);

        // Show success message with restart prompt
        const shouldRestart = window.confirm(
          'Import complete! The app needs to restart to load your imported data.\n\nRestart now?'
        );

        if (shouldRestart) {
          await window.api.app.restart();
        }
      } else {
        toast.error(`Import failed: ${result.error}`);
        setIsImporting(false);
        // Keep dialog open on error so user can cancel
      }
    } catch (error) {
      toast.error(`Error importing database: ${error}`);
      setIsImporting(false);
    }
  };

  const handleImportCancel = () => {
    setImportDialogOpen(false);
    setCurrentMetadata(null);
    setImportedMetadata(null);
    setImportFilePath('');
    setIsImporting(false);
  };

  // Register menu event listeners
  useEffect(() => {
    const cleanupExport = window.api.database.onMenuExport(handleExportDatabase);
    const cleanupImport = window.api.database.onMenuImport(handleImportDatabase);
    return () => {
      cleanupExport();
      cleanupImport();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transactionsTabs = [
    { id: 'list', label: 'Transactions' },
    { id: 'import', label: 'Import' },
    { id: 'review', label: 'Review' },
  ] as const;

  const settingsTabs = [
    { id: 'general', label: 'General' },
    { id: 'categories', label: 'Categories' },
    { id: 'rules', label: 'Rules' },
    { id: 'household', label: 'Household' },
    { id: 'security', label: 'Security' },
    { id: 'data', label: 'Data' },
  ] as const;

  const investmentTabs = [
    { id: 'holdings', label: 'Holdings' },
    { id: 'performance', label: 'Performance' },
    { id: 'tax-reports', label: 'Tax Reports' },
  ] as const;

  const recurringTabs = [
    { id: 'items', label: 'Recurring Items' },
    { id: 'calendar', label: 'Bill Calendar' },
    { id: 'rules', label: 'Payment Rules' },
  ] as const;

  // Startup lock screen — render only the lock screen, no app chrome
  if (isStartupLock) {
    return (
      <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LockScreen
          isStartup={true}
          onUnlock={() => {
            setIsStartupLock(false);
            setIsLocked(false);
            // After startup unlock, the main process creates the main window,
            // so we redirect this lock window or it gets closed by main
            window.close();
          }}
          members={memberAuthStatus}
          onMemberUnlock={(userId) => household.setCurrentUserId(userId)}
        />
      </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <div className="app">

      {/* In-session lock overlay */}
      {isLocked && !isStartupLock && (
        <LockScreen
          isStartup={false}
          onUnlock={() => setIsLocked(false)}
          members={memberAuthStatus}
          onMemberUnlock={(userId) => household.setCurrentUserId(userId)}
        />
      )}

      {/* Onboarding wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={(options) => {
            setShowOnboarding(false);
            window.api.onboarding.setComplete('true').catch(() => {});
            loadAccounts();
            if (options?.navigateTo) {
              setActiveView(options.navigateTo as ViewType);
            }
          }}
        />
      )}

      <Sidebar
        activeView={activeView}
        onNavigate={(view) => setActiveView(view as ViewType)}
        onOpenNewWindow={(view) => window.api.window.openNewWindow(view)}
        onLock={() => setIsLocked(true)}
      />

      <div className="app-content" ref={contentRef}>
      <div className="section">
        <h2>Accounts</h2>
        {accounts.length === 0 ? (
          <EmptyState
            icon="🏦"
            title="No accounts yet"
            description="Add a bank account or credit card to start tracking your finances."
            action={{ label: 'Add Account', onClick: () => setShowAccountForm(true) }}
          />
        ) : (
          <div>
            <select
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={loading}
            >
              {household.filterByOwnership(accounts)
                .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.id === defaultAccountId ? '\u2605 ' : ''}{account.ofxUrl ? '\u{1F517} ' : ''}
                  {account.name} - {account.institution} (${(account.balance / 100).toFixed(2)})
                  {household.users.length > 1 && account.ownerId ? ` [${household.users.find(u => u.id === account.ownerId)?.name ?? 'Unknown'}]` : ''}
                  {account.lastSynced ? ` - Last synced: ${new Date(account.lastSynced).toLocaleString()}` : ''}
                </option>
              ))}
            </select>
            {selectedAccountId && (
              <>
                {editingBalance === selectedAccountId ? (
                  <span style={{ marginLeft: '10px' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={editBalanceValue}
                      onChange={(e) => setEditBalanceValue(e.target.value)}
                      disabled={loading}
                      style={{ width: '120px' }}
                      placeholder="Balance"
                    />
                    <button
                      onClick={handleUpdateBalance}
                      disabled={loading}
                      className="btn btn-primary"
                      style={{ marginLeft: '5px' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingBalance(null); setEditBalanceValue(''); }}
                      disabled={loading}
                      className="btn btn-secondary"
                      style={{ marginLeft: '5px' }}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      const account = accounts.find(a => a.id === selectedAccountId);
                      setEditingBalance(selectedAccountId);
                      setEditBalanceValue(((account?.balance ?? 0) / 100).toString());
                    }}
                    disabled={loading}
                    className="btn btn-secondary"
                    style={{ marginLeft: '10px' }}
                    title="Edit account balance"
                  >
                    Edit Balance
                  </button>
                )}
                {selectedAccountId === defaultAccountId ? (
                  <span
                    style={{ marginLeft: '10px', color: 'var(--color-success)', fontWeight: 'bold', fontSize: '0.85em' }}
                    title="This is your default account"
                  >
                    Default
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      await window.api.accounts.setDefault(selectedAccountId);
                      setDefaultAccountId(selectedAccountId);
                      toast.success('Default account set');
                    }}
                    disabled={loading}
                    className="btn btn-secondary"
                    style={{ marginLeft: '10px' }}
                    title="Set this account as default on startup"
                  >
                    Set as Default
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteAccountConfirm(true)}
                  disabled={loading}
                  className="btn btn-outline-danger"
                  style={{ marginLeft: '10px' }}
                  title="Delete this account"
                >
                  Delete
                </button>
              </>
            )}
            {selectedAccountId && household.users.length > 1 && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '0.85em', color: 'var(--color-text-muted)' }}>Owner:</label>
                <select
                  value={accounts.find(a => a.id === selectedAccountId)?.ownerId || ''}
                  onChange={async (e) => {
                    const ownerId = e.target.value || null;
                    await window.api.accounts.update(selectedAccountId, { ownerId });
                    await loadAccounts();
                  }}
                  style={{ fontSize: '0.85em', padding: '2px 6px' }}
                >
                  <option value="">Shared (Household)</option>
                  {household.users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginTop: '10px', fontSize: '0.85em', color: 'var(--color-text-muted)' }}>
              {selectedAccountId && accounts.find(a => a.id === selectedAccountId)?.ofxUrl ? (
                <span style={{ color: 'var(--color-success)' }}>
                  {'\u2713'} Connected via OFX Direct Connect
                  {accounts.find(a => a.id === selectedAccountId)?.lastSynced && (
                    <span> - Last synced: {new Date(accounts.find(a => a.id === selectedAccountId)!.lastSynced!).toLocaleString()}</span>
                  )}
                </span>
              ) : (
                <span>
                  Manual account (file import only)
                </span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowAccountForm(!showAccountForm)}
          disabled={loading}
          className="btn btn-secondary"
          style={{ marginTop: '10px' }}
        >
          {showAccountForm ? 'Cancel' : 'Add Account'}
        </button>

        {showAccountForm && (
          <form onSubmit={handleCreateAccount} style={{ marginTop: '10px' }}>
            <div>
              <input
                type="text"
                placeholder="Account Name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div style={{ marginTop: '5px' }}>
              <input
                type="text"
                placeholder="Institution Name"
                value={newAccountInstitution}
                onChange={(e) => setNewAccountInstitution(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div style={{ marginTop: '5px' }}>
              <select
                value={newAccountType}
                onChange={(e) => setNewAccountType(e.target.value as 'checking' | 'savings' | 'credit')}
                disabled={loading}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit Card</option>
              </select>
            </div>
            <div style={{ marginTop: '5px' }}>
              <input
                type="number"
                step="0.01"
                placeholder="Current Balance"
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '5px' }}>
              Create Account
            </button>
          </form>
        )}
      </div>

      {activeView === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}

      {activeView === 'transactions' && (
        <div className="section" style={{ marginTop: '20px' }}>
          <div className="report-tabs">
            {transactionsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTransactionsTab(tab.id)}
                className={`report-tab ${transactionsTab === tab.id ? 'report-tab--active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {transactionsTab === 'list' && (
            <TransactionList accountId={selectedAccountId} />
          )}
          {transactionsTab === 'import' && (
            <>
              <h2>Import Transactions</h2>
              <BankExportGuide />

              <div style={{ marginBottom: '20px' }}>
                <h3>Option 1: Import from CSV (with Preview)</h3>
                <button
                  onClick={() => setShowTransactionImport(true)}
                  disabled={loading || !selectedAccountId}
                  className="btn btn-primary"
                  data-testid="import-wizard-button"
                >
                  Import CSV File
                </button>
                <p style={{ marginTop: '8px', fontSize: '0.85em', color: 'var(--color-text-muted)' }}>
                  Preview transactions before importing, with manual column mapping support.
                </p>
              </div>

              <div style={{ marginBottom: '20px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                <h3>Option 2: Quick Import (OFX/QFX)</h3>
                <button
                  onClick={handleImport}
                  disabled={loading || !selectedAccountId}
                  className="btn btn-secondary"
                  data-testid="import-button"
                >
                  {loading ? 'Importing...' : 'Import OFX/QFX File'}
                </button>
                <p style={{ marginTop: '8px', fontSize: '0.85em', color: 'var(--color-text-muted)' }}>
                  Direct import without preview for bank-exported OFX/QFX files.
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
                <h3>Option 3: Connect Bank (OFX Direct Connect)</h3>
                <button
                  onClick={() => setShowOFXWizard(true)}
                  disabled={loading}
                  className="btn btn-primary"
                  data-testid="ofx-connect-button"
                >
                  Connect Bank
                </button>
                <p style={{ marginTop: '10px', fontSize: '0.9em', color: 'var(--color-text-muted)' }}>
                  Connect directly to your bank - no third-party data aggregators.
                  Your credentials are sent directly to your bank.
                </p>
              </div>

              {selectedAccountId && accounts.find(a => a.id === selectedAccountId)?.ofxUrl && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px' }}>
                  <h3>Sync Account</h3>
                  {!showSyncModal ? (
                    <button
                      onClick={() => setShowSyncModal(true)}
                      disabled={loading}
                      className="btn btn-success"
                      data-testid="sync-button"
                    >
                      Sync Transactions
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="password"
                        placeholder="Enter your banking password"
                        value={syncPassword}
                        onChange={(e) => setSyncPassword(e.target.value)}
                        disabled={loading}
                        style={{ flex: 1 }}
                      />
                      <button
                        onClick={handleSyncAccount}
                        disabled={loading || !syncPassword}
                        className="btn btn-success"
                      >
                        {loading ? 'Syncing...' : 'Sync'}
                      </button>
                      <button
                        onClick={() => { setShowSyncModal(false); setSyncPassword(''); }}
                        disabled={loading}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <p style={{ marginTop: '10px', fontSize: '0.9em', color: 'var(--color-text-muted)' }}>
                    Enter your online banking password to sync transactions.
                    Your password is sent directly to your bank and is not stored.
                  </p>
                </div>
              )}
            </>
          )}
          {transactionsTab === 'review' && (
            <TransactionReviewQueue />
          )}
        </div>
      )}

      {activeView === 'analytics' && (
        <div className="section" style={{ marginTop: '20px' }}>
          <AnalyticsLanding onSelectTool={setAnalyticsToolId} activeToolId={analyticsToolId} />
          {analyticsToolId === 'spending' && <SpendingVisualization />}
          {analyticsToolId === 'income-vs-expenses' && <IncomeVsExpenses />}
          {analyticsToolId === 'trends' && <CategoryTrends />}
          {analyticsToolId === 'cashflow' && <CashFlowForecast />}
          {analyticsToolId === 'category-forecast' && <CategoryForecast />}
          {analyticsToolId === 'income-analysis' && <IncomeAnalysis />}
          {analyticsToolId === 'month-review' && <MonthInReview />}
          {analyticsToolId === 'year-review' && <YearInReview />}
          {analyticsToolId === 'recovery' && (
            <RecoveryPlan
              onNavigateToEmergency={() => setAnalyticsToolId('emergency')}
              onNavigateToSimulator={() => setAnalyticsToolId('simulator')}
            />
          )}
          {analyticsToolId === 'simulator' && <WhatIfSimulator />}
          {analyticsToolId === 'emergency' && <EmergencyMode />}
          {analyticsToolId === 'anomalies' && <AnomalyAlerts />}
          {analyticsToolId === 'seasonal' && <SeasonalPatterns />}
          {analyticsToolId === 'velocity' && <SpendingVelocity />}
          {analyticsToolId === 'subscriptions' && <SubscriptionAudit />}
          {analyticsToolId === 'health' && <FinancialHealthScore />}
          {analyticsToolId === 'debt' && <DebtPayoff />}
          {analyticsToolId === 'migration' && <CategoryMigration />}
        </div>
      )}

      {activeView === 'recurring' && (
        <div className="section" style={{ marginTop: '20px' }}>
          <div className="report-tabs">
            {recurringTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRecurringTab(tab.id)}
                className={`report-tab ${recurringTab === tab.id ? 'report-tab--active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {recurringTab === 'items' && (
            <>
              <RecurringItems />
              <div style={{ marginTop: '32px' }}>
                <RecurringSuggestions />
              </div>
            </>
          )}
          {recurringTab === 'calendar' && <BillCalendar />}
          {recurringTab === 'rules' && <RecurringItemRules />}
        </div>
      )}

      {activeView === 'budgets' && (
        <div className="section" style={{ marginTop: '20px' }}>
          <BudgetGoals />
          <div style={{ marginTop: '32px' }}>
            <SpendingAlerts />
          </div>
        </div>
      )}

      {activeView === 'networth' && (
        <NetWorthPage />
      )}

      {activeView === 'investments' && (
        <div className="section" style={{ marginTop: '20px' }}>
          <div className="report-tabs">
            {investmentTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setInvestmentTab(tab.id)}
                className={`report-tab ${investmentTab === tab.id ? 'report-tab--active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {investmentTab === 'holdings' && (
            <InvestmentAccounts onSelectAccount={() => {}} />
          )}
          {investmentTab === 'performance' && <PerformanceDashboard />}
          {investmentTab === 'tax-reports' && <TaxLotReport />}
        </div>
      )}

      {activeView === 'savings' && (
        <div className="section" style={{ marginTop: '20px' }}>
          <SavingsGoals />
          <div style={{ marginTop: '32px' }}>
            <SavingsProjections />
          </div>
        </div>
      )}

      {activeView === 'privacy' && (
        <div className="section" style={{ marginTop: '20px' }}>
          <PrivacySettings
            onToast={(message, type) => {
              type === 'success' ? toast.success(message) : toast.error(message);
            }}
          />
        </div>
      )}

      {activeView === 'settings' && (
        <div className="section" style={{ marginTop: '20px' }}>
          <h2>Settings</h2>
          <div className="report-tabs">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSettingsTab(tab.id)}
                className={`report-tab ${settingsTab === tab.id ? 'report-tab--active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {settingsTab === 'general' && (
            <>
              <div style={{ marginTop: '32px' }}>
                <h3>Updates</h3>
                <button onClick={() => window.api.updater.checkForUpdates()} className="btn btn-secondary">
                  Check for Updates
                </button>
              </div>
              <div style={{ marginTop: '32px' }}>
                <h3>Tutorials</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>
                  Show tutorial guides again when visiting analytics tools.
                </p>
                <button
                  onClick={async () => {
                    await window.api.tutorials.resetAll();
                    toast.success('Tutorials reset — they\'ll appear again on next visit');
                  }}
                  className="btn btn-secondary"
                >
                  Reset All Tutorials
                </button>
              </div>
              <div style={{ marginTop: '32px' }}>
                <h3>Legal</h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => window.api.shell.openExternal('https://github.com/jchilcher/ledgr/blob/main/PRIVACY.md')}
                    className="btn-link"
                    style={{ fontSize: '0.9rem', padding: 0 }}
                  >
                    Privacy Policy
                  </button>
                  <button
                    onClick={() => window.api.shell.openExternal('https://github.com/jchilcher/ledgr/blob/main/TERMS.md')}
                    className="btn-link"
                    style={{ fontSize: '0.9rem', padding: 0 }}
                  >
                    Terms of Service
                  </button>
                  <button
                    onClick={() => window.api.shell.openExternal('https://github.com/jchilcher/ledgr')}
                    className="btn-link"
                    style={{ fontSize: '0.9rem', padding: 0 }}
                  >
                    Source Code (AGPL-3.0)
                  </button>
                </div>
              </div>
              <div style={{ marginTop: '32px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Ledgr v{versionString}
                </p>
                <button
                  onClick={() => setShowAboutDialog(true)}
                  className="btn-link"
                  style={{ fontSize: '0.85rem', padding: 0, marginTop: '4px' }}
                >
                  About Ledgr
                </button>
              </div>
            </>
          )}
          {settingsTab === 'categories' && (
            <CategoryManager />
          )}
          {settingsTab === 'rules' && (
            <CategoryRules />
          )}
          {settingsTab === 'household' && (
            <HouseholdSettings
              onToast={(message, type) => {
                type === 'success' ? toast.success(message) : toast.error(message);
                household.refreshUsers();
                loadMemberAuthStatus();
              }}
            />
          )}
          {settingsTab === 'security' && (
            <PasswordSettings
              currentUserId={household.currentUserId}
              onToast={(message, type) => {
                type === 'success' ? toast.success(message) : toast.error(message);
                loadMemberAuthStatus();
              }}
            />
          )}
          {settingsTab === 'data' && (
            <>
              <div style={{ marginTop: '32px' }}>
                <h3>Data Management</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                  Back up your database or restore from a previous backup.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={handleExportDatabase} className="btn btn-secondary">
                    Export Database
                  </button>
                  <button onClick={handleImportDatabase} className="btn btn-secondary">
                    Import Database
                  </button>
                </div>
              </div>
              <div style={{ marginTop: '32px' }}>
                <h3>Data Export</h3>
                <button onClick={() => setShowExportModal(true)} className="btn btn-secondary">
                  Export Data
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onSuccess={(message) => toast.success(message)}
        />
      )}

      {showOFXWizard && (
        <OFXConnectWizard
          onSuccess={handleOFXSuccess}
          onCancel={() => setShowOFXWizard(false)}
        />
      )}

      {showTransactionImport && selectedAccountId && (
        <TransactionImport
          accountId={selectedAccountId}
          accountName={accounts.find(a => a.id === selectedAccountId)?.name ?? 'Account'}
          onClose={() => setShowTransactionImport(false)}
          onImportComplete={() => {
            toast.success('Transactions imported successfully!');
            loadAccounts();
          }}
        />
      )}

      {showTutorial && (
        <TutorialOverlay
          toolId={showTutorial}
          onDismiss={() => setShowTutorial(null)}
        />
      )}

      <FindBar />
      <UpdateNotification />
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {showAboutDialog && (
        <AboutDialog
          isOpen={showAboutDialog}
          onClose={() => setShowAboutDialog(false)}
        />
      )}

      {whatsNewData && (
        <WhatsNewModal
          version={whatsNewData.version}
          releaseNotes={whatsNewData.releaseNotes}
          onClose={() => setWhatsNewData(null)}
        />
      )}

      <ImportConfirmDialog
        isOpen={importDialogOpen}
        currentMetadata={currentMetadata}
        importedMetadata={importedMetadata}
        importFilePath={importFilePath}
        onConfirm={handleImportConfirm}
        onCancel={handleImportCancel}
        isImporting={isImporting}
      />

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={() => setShowDeleteAccountConfirm(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              maxWidth: '450px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: 'var(--color-danger)' }}>{'\u26A0'} Delete Account?</h3>
            <p>
              Are you sure you want to delete <strong>&quot;{accounts.find(a => a.id === selectedAccountId)?.name}&quot;</strong>?
            </p>
            <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>
              This will permanently delete all transactions associated with this account. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setShowDeleteAccountConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="btn btn-danger"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </ThemeProvider>
    </QueryClientProvider>
  );
};

const App: React.FC = () => (
  <HouseholdProvider>
    <AppContent />
  </HouseholdProvider>
);

export default App;
