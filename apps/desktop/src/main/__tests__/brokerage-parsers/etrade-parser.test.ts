import { detectEtrade, parseEtrade } from '../../brokerage-parsers/etrade-parser'

describe('E*TRADE Parser', () => {
  describe('detectEtrade', () => {
    it('should recognize E*TRADE format headers', () => {
      const headers = ['symbol', 'last price', '$ change', '% change']

      expect(detectEtrade(headers)).toBe(true)
    })

    it('should handle header variations', () => {
      const headers = ['symbol', 'last price per share', 'change']

      expect(detectEtrade(headers)).toBe(false)
    })

    it('should reject non-E*TRADE headers', () => {
      const headers = ['ticker', 'price', 'quantity']

      expect(detectEtrade(headers)).toBe(false)
    })
  })

  describe('parseEtrade', () => {
    it('should correctly extract ticker and shares', () => {
      const headers = ['symbol', 'last price', '$ change', '% change', 'shares', 'total value', 'gain/loss']

      const rows = [
        ['AAPL', '$171.21', '$0.45', '0.26%', '50', '$8,560.50', '$1,560.50'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[0].shares).toBe(500000)
    })

    it('should calculate cost basis from total value and gain/loss', () => {
      const headers = ['symbol', 'last price', '$ change', '% change', 'shares', 'total value', 'gain/loss']

      const rows = [
        ['AAPL', '$171.21', '$0.45', '0.26%', '50', '$8,560.50', '$1,560.50'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costBasis).toBe(700000)
    })

    it('should use cost basis column if present', () => {
      const headers = ['symbol', 'last price', 'shares', 'total value', 'cost basis']

      const rows = [
        ['AAPL', '$171.21', '50', '$8,560.50', '$7,000.00'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costBasis).toBe(700000)
    })

    it('should use current price as placeholder if no cost basis', () => {
      const headers = ['symbol', 'last price', 'shares', 'total value']

      const rows = [
        ['AAPL', '$171.21', '50', '$8,560.50'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costPerShare).toBe(17121)
    })

    it('should skip cash entries', () => {
      const headers = ['symbol', 'last price', 'shares', 'total value', 'gain/loss']

      const rows = [
        ['Cash', '$1.00', '1000', '$1,000.00', '$0'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(0)
    })

    it('should skip total rows', () => {
      const headers = ['symbol', 'last price', 'shares', 'total value', 'gain/loss']

      const rows = [
        ['AAPL', '$171.21', '50', '$8,560.50', '$1,560.50'],
        ['Total', '', '', '$8,560.50', '$1,560.50'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
    })

    it('should handle currency symbols and commas', () => {
      const headers = ['symbol', 'last price', 'shares', 'total value', 'gain/loss']

      const rows = [
        ['TSLA', '$250.00', '25.5', '$6,375.00', '$875.00'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('TSLA')
      expect(holdings[0].shares).toBe(255000)
    })

    it('should skip header rows', () => {
      const headers = ['symbol', 'last price', 'shares', 'total value', 'gain/loss']

      const rows = [
        ['AAPL', '$171.21', '50', '$8,560.50', '$1,560.50'],
        ['symbol', 'last price', 'shares', 'total value', 'gain/loss'],
        ['MSFT', '$300.00', '20', '$6,000.00', '$1,000.00'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(2)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[1].ticker).toBe('MSFT')
    })

    it('should handle negative gain/loss', () => {
      const headers = ['symbol', 'last price', 'shares', 'total value', 'gain/loss']

      const rows = [
        ['AAPL', '$150.00', '50', '$7,500.00', '-$500.00'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costBasis).toBe(800000)
    })

    it('should handle gain/loss in parentheses', () => {
      const headers = ['symbol', 'last price', 'shares', 'total value', 'gain/loss']

      const rows = [
        ['AAPL', '$150.00', '50', '$7,500.00', '($500.00)'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costBasis).toBe(800000)
    })

    it('should handle flexible column order', () => {
      const headers = ['shares', 'symbol', 'total value', 'last price', 'gain/loss']

      const rows = [
        ['50', 'AAPL', '$8,560.50', '$171.21', '$1,560.50'],
      ]

      const holdings = parseEtrade(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[0].shares).toBe(500000)
    })
  })
})
