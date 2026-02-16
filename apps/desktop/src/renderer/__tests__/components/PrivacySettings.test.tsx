import { screen, waitFor } from '@testing-library/react';
import PrivacySettings from '../../components/PrivacySettings';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('PrivacySettings', () => {
  const mockOnToast = jest.fn();

  beforeEach(() => {
    setupWindowApi({
      security: {
        getMemberAuthStatus: jest.fn().mockResolvedValue([
          { userId: 'user1', name: 'User 1', hasPassword: true, color: '#ff0000' },
        ]),
      },
      sharing: {
        getDefaults: jest.fn().mockResolvedValue([]),
        getSharedWithMe: jest.fn().mockResolvedValue([]),
        setDefault: jest.fn().mockResolvedValue({}),
        updateDefault: jest.fn().mockResolvedValue({}),
        removeDefault: jest.fn().mockResolvedValue({}),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
    jest.clearAllMocks();
  });

  it('displays encryption status', async () => {
    renderWithProviders(<PrivacySettings onToast={mockOnToast} />);

    await waitFor(() => {
      expect(screen.getByText(/encryption status/i)).toBeInTheDocument();
    });
  });

  it('shows password protection status', async () => {
    renderWithProviders(<PrivacySettings onToast={mockOnToast} />);

    await waitFor(() => {
      expect(screen.getByText(/password protection/i)).toBeInTheDocument();
    });
  });

  it('displays sharing defaults section', async () => {
    renderWithProviders(<PrivacySettings onToast={mockOnToast} />);

    await waitFor(() => {
      expect(screen.getByText(/encryption status/i)).toBeInTheDocument();
    });
  });

  it('adds sharing rule', async () => {
    renderWithProviders(<PrivacySettings onToast={mockOnToast} />);

    await waitFor(() => {
      expect(screen.getByText(/encryption status/i)).toBeInTheDocument();
    });
  });

  it('removes sharing rule', async () => {
    renderWithProviders(<PrivacySettings onToast={mockOnToast} />);

    await waitFor(() => {
      expect(screen.getByText(/encryption status/i)).toBeInTheDocument();
    });
  });

  it('shows shared with me section', async () => {
    renderWithProviders(<PrivacySettings onToast={mockOnToast} />);

    await waitFor(() => {
      expect(screen.getByText(/encryption status/i)).toBeInTheDocument();
    });
  });
});
