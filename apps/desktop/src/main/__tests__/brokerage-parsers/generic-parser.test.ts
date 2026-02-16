import { suggestColumnMapping, parseGeneric } from '../../brokerage-parsers/generic-parser'

describe('Generic Parser', () => {
  describe('suggestColumnMapping', () => {
    it('should suggest ticker column from common names', () => {
      const headers = ['symbol', 'quantity', 'price']

      const mapping = suggestColumnMapping(headers)

      expect(mapping.ticker).toBe('symbol')
    })

    it('should suggest shares column from common names', () => {
      const headers = ['ticker', 'shares', 'price']

      const mapping = suggestColumnMapping(headers)

      expect(mapping.shares).toBe('shares')
    })

    it('should prefer total cost basis over per-share', () => {
      const headers = ['symbol', 'shares', 'cost basis', 'avg cost']

      const mapping = suggestColumnMapping(headers)

      expect(mapping.costBasis).toBe('cost basis')
      expect(mapping.costBasisType).toBe('total')
    })

    it('should detect per-share cost basis', () => {
      const headers = ['symbol', 'shares', 'avg cost']

      const mapping = suggestColumnMapping(headers)

      expect(mapping.costBasis).toBe('avg cost')
      expect(mapping.costBasisType).toBe('per_share')
    })

    it('should handle variations in column names', () => {
      const headers = ['stock symbol', 'quantity', 'total cost']

      const mapping = suggestColumnMapping(headers)

      expect(mapping.ticker).toBe('stock symbol')
      expect(mapping.shares).toBe('quantity')
      expect(mapping.costBasis).toBe('total cost')
    })

    it('should return null for missing columns', () => {
      const headers = ['symbol', 'price']

      const mapping = suggestColumnMapping(headers)

      expect(mapping.ticker).toBe('symbol')
      expect(mapping.shares).toBeNull()
    })
  })

  describe('parseGeneric', () => {
    it('should parse with user-provided column mapping', () => {
      const headers = ['ticker', 'qty', 'total cost']
      const rows = [
        ['AAPL', '50', '$7,000.00'],
        ['MSFT', '25', '$8,000.00'],
      ]

      const mapping = {
        ticker: 'ticker',
        shares: 'qty',
        costBasis: 'total cost',
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(2)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[0].shares).toBe(500000)
      expect(holdings[0].costBasis).toBe(700000)
    })

    it('should calculate total cost from per-share', () => {
      const headers = ['ticker', 'qty', 'avg cost']
      const rows = [
        ['AAPL', '50', '$140.00'],
      ]

      const mapping = {
        ticker: 'ticker',
        shares: 'qty',
        costBasis: 'avg cost',
        costBasisType: 'per_share' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costPerShare).toBe(14000)
      expect(holdings[0].costBasis).toBe(700000)
    })

    it('should skip rows without ticker or shares', () => {
      const headers = ['ticker', 'qty', 'cost']
      const rows = [
        ['AAPL', '50', '$7,000'],
        ['', '25', '$2,500'],
        ['MSFT', '0', '$0'],
      ]

      const mapping = {
        ticker: 'ticker',
        shares: 'qty',
        costBasis: 'cost',
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
    })

    it('should return empty array if mapping lacks required fields', () => {
      const headers = ['ticker', 'price']
      const rows = [['AAPL', '$150']]

      const mapping = {
        ticker: 'ticker',
        shares: null,
        costBasis: null,
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(0)
    })

    it('should handle currency symbols and commas', () => {
      const headers = ['symbol', 'shares', 'cost']
      const rows = [
        ['TSLA', '1,234.56', '$250,000.00'],
      ]

      const mapping = {
        ticker: 'symbol',
        shares: 'shares',
        costBasis: 'cost',
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].shares).toBe(12345600)
      expect(holdings[0].costBasis).toBe(25000000)
    })

    it('should uppercase and trim tickers', () => {
      const headers = ['ticker', 'qty', 'cost']
      const rows = [
        ['  aapl  ', '50', '$7,000'],
      ]

      const mapping = {
        ticker: 'ticker',
        shares: 'qty',
        costBasis: 'cost',
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
    })

    it('should skip header rows that match column names', () => {
      const headers = ['ticker', 'qty', 'cost']
      const rows = [
        ['AAPL', '50', '$7,000'],
        ['ticker', 'qty', 'cost'],
        ['MSFT', '25', '$8,000'],
      ]

      const mapping = {
        ticker: 'ticker',
        shares: 'qty',
        costBasis: 'cost',
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(2)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[1].ticker).toBe('MSFT')
    })

    it('should handle missing cost basis', () => {
      const headers = ['ticker', 'qty']
      const rows = [
        ['AAPL', '50'],
      ]

      const mapping = {
        ticker: 'ticker',
        shares: 'qty',
        costBasis: null,
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costBasis).toBe(0)
      expect(holdings[0].costPerShare).toBe(0)
    })

    it('should handle negative values', () => {
      const headers = ['ticker', 'qty', 'cost']
      const rows = [
        ['AAPL', '50', '-$7,000'],
      ]

      const mapping = {
        ticker: 'ticker',
        shares: 'qty',
        costBasis: 'cost',
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costBasis).toBe(-700000)
    })

    it('should preserve raw row data', () => {
      const headers = ['ticker', 'qty', 'cost', 'notes']
      const rows = [
        ['AAPL', '50', '$7,000', 'Long term hold'],
      ]

      const mapping = {
        ticker: 'ticker',
        shares: 'qty',
        costBasis: 'cost',
        costBasisType: 'total' as const,
      }

      const holdings = parseGeneric(rows, headers, mapping)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].rawRow).toBeDefined()
      expect(holdings[0].rawRow.notes).toBe('Long term hold')
    })
  })
})
