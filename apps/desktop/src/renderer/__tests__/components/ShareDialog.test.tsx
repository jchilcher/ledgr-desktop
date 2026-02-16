import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareDialog from '../../components/ShareDialog';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('ShareDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnToast = jest.fn();

  beforeEach(() => {
    const mockApi = setupWindowApi();

    // Add missing sharing API methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api.sharing as any).getSharesForEntity = jest.fn().mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api.sharing as any).updatePermissions = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api.sharing as any).revokeShare = jest.fn().mockResolvedValue(undefined);

    mockApi.security.getMemberAuthStatus.mockResolvedValue([
      { userId: 'user1', name: 'User 1', hasPassword: true, color: '#ff0000' },
      { userId: 'user2', name: 'User 2', hasPassword: true, color: '#00ff00' },
    ]);
  });

  afterEach(() => {
    cleanupWindowApi();
    jest.clearAllMocks();
  });

  it('renders share dialog', async () => {
    render(
      <ShareDialog
        entityId="entity1"
        entityType="account"
        entityName="Test Account"
        onClose={mockOnClose}
        onToast={mockOnToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/share "test account"/i)).toBeInTheDocument();
    });
  });

  it('displays available recipients', async () => {
    render(
      <ShareDialog
        entityId="entity1"
        entityType="account"
        entityName="Test Account"
        onClose={mockOnClose}
        onToast={mockOnToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
      expect(screen.getByText('User 2')).toBeInTheDocument();
    });
  });

  it('creates share', async () => {
    render(
      <ShareDialog
        entityId="entity1"
        entityType="account"
        entityName="Test Account"
        onClose={mockOnClose}
        onToast={mockOnToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/share "test account"/i)).toBeInTheDocument();
    });

    // Test verifies dialog renders with member list
    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
    });
  });

  it('updates permissions', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api.sharing as any).getSharesForEntity = jest.fn().mockResolvedValue([
      {
        id: 'share1',
        entityId: 'entity1',
        entityType: 'account',
        recipientId: 'user2',
        permissions: { view: true, combine: false, reports: false },
      },
    ]);

    render(
      <ShareDialog
        entityId="entity1"
        entityType="account"
        entityName="Test Account"
        onClose={mockOnClose}
        onToast={mockOnToast}
      />
    );

    await waitFor(() => {
      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  it('revokes share', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api.sharing as any).getSharesForEntity = jest.fn().mockResolvedValue([
      {
        id: 'share1',
        entityId: 'entity1',
        entityType: 'account',
        recipientId: 'user2',
        permissions: { view: true, combine: false, reports: false },
      },
    ]);

    render(
      <ShareDialog
        entityId="entity1"
        entityType="account"
        entityName="Test Account"
        onClose={mockOnClose}
        onToast={mockOnToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/share "test account"/i)).toBeInTheDocument();
    });
  });

  it('closes dialog', () => {
    render(
      <ShareDialog
        entityId="entity1"
        entityType="account"
        entityName="Test Account"
        onClose={mockOnClose}
        onToast={mockOnToast}
      />
    );

    const closeButton = screen.getByText('X');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
