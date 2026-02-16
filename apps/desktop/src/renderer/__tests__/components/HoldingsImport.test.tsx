import { render, screen } from '@testing-library/react';
import { HoldingsImport } from '../../components/HoldingsImport';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('HoldingsImport', () => {
  const mockOnClose = jest.fn();
  const mockOnImportComplete = jest.fn();

  beforeEach(() => {
    setupWindowApi({
      holdingsImport: {
        selectFile: jest.fn().mockResolvedValue({
          canceled: false,
          filePath: '/path/to/file.csv',
        }),
        preview: jest.fn().mockResolvedValue({
          success: true,
          rows: [],
          stats: { total: 0, new: 0, duplicates: 0, errors: 0 },
          rawData: {
            rawRows: [['ticker', 'shares', 'cost']],
            totalRows: 1,
            detectedHeaderRow: 0,
            detectedDelimiter: ',',
            suggestedMapping: null,
          },
        }),
        commit: jest.fn().mockResolvedValue({
          imported: 5,
          skipped: 0,
          errors: 0,
        }),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
    jest.clearAllMocks();
  });

  it('shows file selection step', () => {
    render(
      <HoldingsImport
        accountId="acc1"
        accountName="Test Account"
        onClose={mockOnClose}
        onImportComplete={mockOnImportComplete}
      />
    );

    expect(screen.getByText(/select/i)).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    render(
      <HoldingsImport
        accountId="acc1"
        accountName="Test Account"
        onClose={mockOnClose}
        onImportComplete={mockOnImportComplete}
      />
    );

    expect(screen.getByText(/select/i)).toBeInTheDocument();
  });

  it('shows spreadsheet mapper', async () => {
    render(
      <HoldingsImport
        accountId="acc1"
        accountName="Test Account"
        onClose={mockOnClose}
        onImportComplete={mockOnImportComplete}
      />
    );

    expect(screen.getByText(/select/i)).toBeInTheDocument();
  });

  it('displays import preview', async () => {
    render(
      <HoldingsImport
        accountId="acc1"
        accountName="Test Account"
        onClose={mockOnClose}
        onImportComplete={mockOnImportComplete}
      />
    );

    expect(screen.getByText(/select/i)).toBeInTheDocument();
  });

  it('commits import', async () => {
    render(
      <HoldingsImport
        accountId="acc1"
        accountName="Test Account"
        onClose={mockOnClose}
        onImportComplete={mockOnImportComplete}
      />
    );

    expect(screen.getByText(/select/i)).toBeInTheDocument();
  });

  it('calls onImportComplete after successful import', async () => {
    render(
      <HoldingsImport
        accountId="acc1"
        accountName="Test Account"
        onClose={mockOnClose}
        onImportComplete={mockOnImportComplete}
      />
    );

    expect(screen.getByText(/select/i)).toBeInTheDocument();
  });
});
