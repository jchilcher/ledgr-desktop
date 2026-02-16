import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareDialog from '../../components/ShareDialog';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('ShareDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnToast = jest.fn();

  beforeEach(() => {
    setupWindowApi({
      sharing: {
        getSharesForEntity: jest.fn().mockResolvedValue([]),
        createShare: jest.fn().mockResolvedValue({}),
        updatePermissions: jest.fn().mockResolvedValue({}),
        revokeShare: jest.fn().mockResolvedValue({}),
      },
      security: {
        getMemberAuthStatus: jest.fn().mockResolvedValue([
          { userId: 'user1', name: 'User 1', hasPassword: true, color: '#ff0000' },
          { userId: 'user2', name: 'User 2', hasPassword: true, color: '#00ff00' },
        ]),
      },
    });
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
      const shareButton = screen.getByText(/share/i);
      fireEvent.click(shareButton);
    });

    await waitFor(() => {
      expect(window.api.sharing.createShare).toHaveBeenCalled();
    });
  });

  it('updates permissions', async () => {
    window.api.sharing.getSharesForEntity = jest.fn().mockResolvedValue([
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
      const checkbox = screen.getByRole('checkbox', { name: /combine/i });
      fireEvent.click(checkbox);
    });

    await waitFor(() => {
      expect(window.api.sharing.updatePermissions).toHaveBeenCalled();
    });
  });

  it('revokes share', async () => {
    window.confirm = jest.fn().mockReturnValue(true);

    window.api.sharing.getSharesForEntity = jest.fn().mockResolvedValue([
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
      const revokeButton = screen.getByText(/revoke/i);
      fireEvent.click(revokeButton);
    });

    await waitFor(() => {
      expect(window.api.sharing.revokeShare).toHaveBeenCalled();
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
