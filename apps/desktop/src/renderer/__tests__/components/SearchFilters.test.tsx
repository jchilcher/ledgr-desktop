import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchFilters, { defaultFilters } from '../../components/SearchFilters';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { mockAccounts, mockCategories } from '../helpers/mock-api-factory';

describe('SearchFilters', () => {
  const mockOnFiltersChange = jest.fn();
  const mockOnSearch = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    setupWindowApi({
      accounts: {
        getAll: jest.fn().mockResolvedValue(mockAccounts),
      },
      categories: {
        getAll: jest.fn().mockResolvedValue(mockCategories),
      },
      tags: {
        getAll: jest.fn().mockResolvedValue([]),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
    jest.clearAllMocks();
  });

  it('renders search input', async () => {
    render(
      <SearchFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
        onSearch={mockOnSearch}
        onClear={mockOnClear}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument();
    });
  });

  it('calls onFiltersChange when search query changes', async () => {
    render(
      <SearchFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
        onSearch={mockOnSearch}
        onClear={mockOnClear}
      />
    );

    const searchInput = await screen.findByPlaceholderText('Search transactions...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'test' })
    );
  });

  it('shows advanced filters when clicked', async () => {
    render(
      <SearchFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
        onSearch={mockOnSearch}
        onClear={mockOnClear}
      />
    );

    const filtersButton = await screen.findByText('Filters');
    fireEvent.click(filtersButton);

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
    });
  });

  it('loads and displays accounts', async () => {
    render(
      <SearchFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
        onSearch={mockOnSearch}
        onClear={mockOnClear}
      />
    );

    const filtersButton = await screen.findByText('Filters');
    fireEvent.click(filtersButton);

    await waitFor(() => {
      expect(screen.getByText('All Accounts')).toBeInTheDocument();
    });
  });

  it('calls onClear when clear button clicked', async () => {
    const filtersWithData = { ...defaultFilters, query: 'test' };

    render(
      <SearchFilters
        filters={filtersWithData}
        onFiltersChange={mockOnFiltersChange}
        onSearch={mockOnSearch}
        onClear={mockOnClear}
      />
    );

    const clearButton = await screen.findByText('Clear');
    fireEvent.click(clearButton);

    expect(mockOnClear).toHaveBeenCalled();
  });
});
