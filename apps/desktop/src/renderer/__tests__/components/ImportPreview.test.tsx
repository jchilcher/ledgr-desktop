import { render, screen, fireEvent } from '@testing-library/react';
import { ImportPreview } from '../../components/ImportPreview';

describe('ImportPreview', () => {
  const mockRows = [
    {
      ticker: 'AAPL',
      shares: 100000,
      costBasis: 15000,
      costPerShare: 15000,
      status: 'new' as const,
      selected: true,
      rawRow: {},
    },
    {
      ticker: 'GOOGL',
      shares: 50000,
      costBasis: 10000,
      costPerShare: 20000,
      status: 'duplicate' as const,
      selected: false,
      rawRow: {},
    },
    {
      ticker: 'MSFT',
      shares: 75000,
      costBasis: 20000,
      costPerShare: 26667,
      status: 'error' as const,
      errorMessage: 'Invalid data',
      selected: false,
      rawRow: {},
    },
  ];

  const mockStats = {
    total: 3,
    new: 1,
    duplicates: 1,
    errors: 1,
  };

  const mockOnRowSelectionChange = jest.fn();
  const mockOnSelectAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders preview stats', () => {
    const { container } = render(
      <ImportPreview
        rows={mockRows}
        onRowSelectionChange={mockOnRowSelectionChange}
        onSelectAll={mockOnSelectAll}
        stats={mockStats}
      />
    );

    expect(container).toBeTruthy();
  });

  it('renders preview table', () => {
    render(
      <ImportPreview
        rows={mockRows}
        onRowSelectionChange={mockOnRowSelectionChange}
        onSelectAll={mockOnSelectAll}
        stats={mockStats}
      />
    );

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
  });

  it('shows status badges', () => {
    render(
      <ImportPreview
        rows={mockRows}
        onRowSelectionChange={mockOnRowSelectionChange}
        onSelectAll={mockOnSelectAll}
        stats={mockStats}
      />
    );

    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Invalid data')).toBeInTheDocument();
  });

  it('handles row selection', () => {
    render(
      <ImportPreview
        rows={mockRows}
        onRowSelectionChange={mockOnRowSelectionChange}
        onSelectAll={mockOnSelectAll}
        stats={mockStats}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[2]);

    expect(mockOnRowSelectionChange).toHaveBeenCalledWith(1, expect.any(Boolean));
  });

  it('handles select all', () => {
    render(
      <ImportPreview
        rows={mockRows}
        onRowSelectionChange={mockOnRowSelectionChange}
        onSelectAll={mockOnSelectAll}
        stats={mockStats}
      />
    );

    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(selectAllCheckbox);

    expect(mockOnSelectAll).toHaveBeenCalled();
  });

  it('disables error row checkboxes', () => {
    render(
      <ImportPreview
        rows={mockRows}
        onRowSelectionChange={mockOnRowSelectionChange}
        onSelectAll={mockOnSelectAll}
        stats={mockStats}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    const errorRowCheckbox = checkboxes[3];

    expect(errorRowCheckbox).toBeDisabled();
  });
});
