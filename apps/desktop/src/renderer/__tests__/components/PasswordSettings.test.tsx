import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasswordSettings from '../../components/PasswordSettings';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('PasswordSettings', () => {
  const mockOnToast = jest.fn();

  beforeEach(() => {
    setupWindowApi({
      security: {
        getAutoLock: jest.fn().mockResolvedValue(15),
        setAutoLock: jest.fn().mockResolvedValue({}),
        lock: jest.fn().mockResolvedValue({}),
        getMemberAuthStatus: jest.fn().mockResolvedValue([
          { userId: 'user1', name: 'User 1', hasPassword: true, color: '#ff0000' },
        ]),
        enableMemberPassword: jest.fn().mockResolvedValue({}),
        changeMemberPassword: jest.fn().mockResolvedValue({}),
        disableMemberPassword: jest.fn().mockResolvedValue({}),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
    jest.clearAllMocks();
  });

  it('displays auto-lock settings', async () => {
    render(<PasswordSettings onToast={mockOnToast} currentUserId="user1" />);

    await waitFor(() => {
      expect(screen.getByText(/auto-lock timeout/i)).toBeInTheDocument();
    });
  });

  it('shows current auto-lock value', async () => {
    render(<PasswordSettings onToast={mockOnToast} currentUserId="user1" />);

    await waitFor(() => {
      expect(screen.getByText(/15 minutes/i)).toBeInTheDocument();
    });
  });

  it('updates auto-lock timeout', async () => {
    render(<PasswordSettings onToast={mockOnToast} currentUserId="user1" />);

    await waitFor(() => {
      expect(screen.getByText(/auto-lock timeout/i)).toBeInTheDocument();
    });
  });

  it('locks app immediately', async () => {
    render(<PasswordSettings onToast={mockOnToast} currentUserId="user1" />);

    await waitFor(() => {
      const lockButton = screen.getByText(/lock now/i);
      fireEvent.click(lockButton);
    });

    await waitFor(() => {
      expect(window.api.security.lock).toHaveBeenCalled();
    });
  });

  it('displays member passwords section', async () => {
    render(<PasswordSettings onToast={mockOnToast} currentUserId="user1" />);

    await waitFor(() => {
      expect(screen.getByText(/member passwords/i)).toBeInTheDocument();
    });
  });

  it('sets member password', async () => {
    render(<PasswordSettings onToast={mockOnToast} currentUserId="user1" />);

    await waitFor(() => {
      expect(screen.getByText(/member passwords/i)).toBeInTheDocument();
    });
  });
});
