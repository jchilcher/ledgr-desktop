import { detectVanguard, parseVanguard } from '../../brokerage-parsers/vanguard-parser'

describe('Vanguard Parser', () => {
  describe('detectVanguard', () => {
    it('should recognize Vanguard format headers', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'share price']

      expect(detectVanguard(headers)).toBe(true)
    })

    it('should handle variations in header names', () => {
      const headers = ['account number', 'fund name', 'shares']

      expect(detectVanguard(headers)).toBe(true)
    })

    it('should reject non-Vanguard headers', () => {
      const headers = ['symbol', 'quantity', 'price']

      expect(detectVanguard(headers)).toBe(false)
    })
  })

  describe('parseVanguard', () => {
    it('should map fund names to tickers', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'share price', 'total value', 'cost basis']

      const rows = [
        ['XXXX-1234', 'Vanguard Total Stock Mkt Idx Adm', '100.123', '$123.45', '$12,360.18', '$10,000.00'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('VTSAX')
      expect(holdings[0].shares).toBe(1001230)
      expect(holdings[0].costBasis).toBe(1000000)
    })

    it('should extract ticker from parentheses if present', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'share price', 'total value', 'cost basis']

      const rows = [
        ['XXXX-1234', 'Some Fund (VTSMX)', '50', '$100', '$5,000', '$4,500'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('VTSMX')
    })

    it('should create placeholder ticker for unmapped funds', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'share price', 'total value', 'cost basis']

      const rows = [
        ['XXXX-1234', 'Unknown Custom Fund Name', '25', '$200', '$5,000', '$4,000'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBeDefined()
      expect(holdings[0].ticker.length).toBeGreaterThan(0)
    })

    it('should handle direct ticker column if present', () => {
      const headers = ['fund account number', 'symbol', 'fund name', 'shares', 'cost basis']

      const rows = [
        ['XXXX-1234', 'VFIAX', 'Vanguard 500 Index Admiral', '50', '$15,000'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('VFIAX')
    })

    it('should calculate cost per share from total', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'share price', 'total value', 'cost basis']

      const rows = [
        ['XXXX-1234', 'Vanguard Total Stock Mkt Idx Adm', '100', '$120', '$12,000', '$10,000'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costPerShare).toBe(10000)
    })

    it('should skip header rows', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'cost basis']

      const rows = [
        ['XXXX-1234', 'Vanguard Total Stock Mkt Idx Adm', '100', '$10,000'],
        ['Fund Account Number', 'Fund Name', 'Shares', 'Cost Basis'],
        ['XXXX-5678', 'Vanguard 500 Index Admiral', '50', '$15,000'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(2)
      expect(holdings[0].ticker).toBe('VTSAX')
      expect(holdings[1].ticker).toBe('VFIAX')
    })

    it('should handle currency symbols and commas', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'share price', 'total value', 'cost basis']

      const rows = [
        ['XXXX-1234', 'Vanguard Total Stock Mkt Idx Adm', '1,234.56', '$123.45', '$152,407.29', '$120,000.00'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].shares).toBe(12345600)
      expect(holdings[0].costBasis).toBe(12000000)
    })

    it('should recognize common fund name variations', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'cost basis']

      const rows = [
        ['1', 'Vanguard Total Stock Market Index Admiral', '100', '$10,000'],
        ['2', 'Vanguard 500 Index Fund Admiral', '50', '$15,000'],
        ['3', 'Vanguard Total Bond Market Index Adm', '75', '$7,500'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(3)
      expect(holdings[0].ticker).toBe('VTSAX')
      expect(holdings[1].ticker).toBe('VFIAX')
      expect(holdings[2].ticker).toBe('VBTLX')
    })

    it('should create placeholder ticker for empty symbols', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'cost basis']

      const rows = [
        ['XXXX-1234', 'Vanguard Total Stock Mkt Idx Adm', '100', '$10,000'],
        ['XXXX-5678', '', '50', '$5,000'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(2)
      expect(holdings[0].ticker).toBe('VTSAX')
      expect(holdings[1].ticker).toBe('VGRD')
    })

    it('should handle zero shares gracefully', () => {
      const headers = ['fund account number', 'fund name', 'shares', 'cost basis']

      const rows = [
        ['XXXX-1234', 'Vanguard Total Stock Mkt Idx Adm', '0', '$0'],
      ]

      const holdings = parseVanguard(rows, headers)

      expect(holdings).toHaveLength(0)
    })
  })
})
