import { detectSchwab, parseSchwab } from '../../brokerage-parsers/schwab-parser'

describe('Schwab Parser', () => {
  describe('detectSchwab', () => {
    it('should recognize Schwab format headers', () => {
      const headers = ['symbol', 'description', 'quantity', 'price']

      expect(detectSchwab(headers)).toBe(true)
    })

    it('should reject non-Schwab headers', () => {
      const headers = ['account', 'ticker', 'shares']

      expect(detectSchwab(headers)).toBe(false)
    })

    it('should handle price variations', () => {
      const headers = ['symbol', 'description', 'quantity', 'price per share']

      expect(detectSchwab(headers)).toBe(true)
    })
  })

  describe('parseSchwab', () => {
    it('should correctly extract ticker, shares, cost basis', () => {
      const headers = [
        'symbol',
        'description',
        'quantity',
        'price',
        'price change %',
        'price change $',
        'market value',
        'day change %',
        'day change $',
        'cost basis',
      ]

      const rows = [
        [
          'AAPL',
          'APPLE INC',
          '50',
          '$171.21',
          '0.26%',
          '$0.45',
          '$8,560.50',
          '0.26%',
          '$22.50',
          '$7,000.00',
        ],
      ]

      const holdings = parseSchwab(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[0].shares).toBe(500000)
      expect(holdings[0].costBasis).toBe(700000)
      expect(holdings[0].costPerShare).toBe(14000)
    })

    it('should skip cash entries', () => {
      const headers = [
        'symbol',
        'description',
        'quantity',
        'price',
        'price change %',
        'price change $',
        'market value',
        'day change %',
        'day change $',
        'cost basis',
      ]

      const rows = [
        [
          'Cash',
          'Cash Balance',
          '1000',
          '$1.00',
          '0%',
          '$0',
          '$1,000.00',
          '0%',
          '$0',
          '$1,000.00',
        ],
      ]

      const holdings = parseSchwab(rows, headers)

      expect(holdings).toHaveLength(0)
    })

    it('should skip pending activity', () => {
      const headers = [
        'symbol',
        'description',
        'quantity',
        'price',
        'price change %',
        'price change $',
        'market value',
        'day change %',
        'day change $',
        'cost basis',
      ]

      const rows = [
        [
          'Pending Activity',
          'Pending Trade',
          '10',
          '$100',
          '0%',
          '$0',
          '$1,000',
          '0%',
          '$0',
          '$1,000',
        ],
      ]

      const holdings = parseSchwab(rows, headers)

      expect(holdings).toHaveLength(0)
    })

    it('should handle currency symbols and commas', () => {
      const headers = [
        'symbol',
        'description',
        'quantity',
        'price',
        'price change %',
        'price change $',
        'market value',
        'day change %',
        'day change $',
        'cost basis',
      ]

      const rows = [
        [
          'TSLA',
          'TESLA INC',
          '25.5',
          '$250.00',
          '2.04%',
          '$5.00',
          '$6,375.00',
          '2.04%',
          '$127.50',
          '$5,500.00',
        ],
      ]

      const holdings = parseSchwab(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('TSLA')
      expect(holdings[0].shares).toBe(255000)
      expect(holdings[0].costBasis).toBe(550000)
    })

    it('should skip header rows', () => {
      const headers = [
        'symbol',
        'description',
        'quantity',
        'price',
        'price change %',
        'price change $',
        'market value',
        'day change %',
        'day change $',
        'cost basis',
      ]

      const rows = [
        ['AAPL', 'APPLE INC', '10', '$170', '0%', '$0', '$1,700', '0%', '$0', '$1,500'],
        [
          'symbol',
          'description',
          'quantity',
          'price',
          'price change %',
          'price change $',
          'market value',
          'day change %',
          'day change $',
          'cost basis',
        ],
        ['MSFT', 'MICROSOFT', '20', '$300', '0%', '$0', '$6,000', '0%', '$0', '$5,000'],
      ]

      const holdings = parseSchwab(rows, headers)

      expect(holdings).toHaveLength(2)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[1].ticker).toBe('MSFT')
    })

    it('should calculate cost per share from total', () => {
      const headers = [
        'symbol',
        'description',
        'quantity',
        'price',
        'price change %',
        'price change $',
        'market value',
        'day change %',
        'day change $',
        'cost basis',
      ]

      const rows = [
        ['GOOG', 'ALPHABET INC', '10', '$140', '0%', '$0', '$1,400', '0%', '$0', '$1,200'],
      ]

      const holdings = parseSchwab(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costPerShare).toBe(12000)
    })

    it('should skip empty symbols', () => {
      const headers = [
        'symbol',
        'description',
        'quantity',
        'price',
        'price change %',
        'price change $',
        'market value',
        'day change %',
        'day change $',
        'cost basis',
      ]

      const rows = [
        ['AAPL', 'APPLE INC', '10', '$170', '0%', '$0', '$1,700', '0%', '$0', '$1,500'],
        ['', 'Empty', '10', '$100', '0%', '$0', '$1,000', '0%', '$0', '$900'],
      ]

      const holdings = parseSchwab(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
    })

    it('should handle negative values in parentheses', () => {
      const headers = [
        'symbol',
        'description',
        'quantity',
        'price',
        'price change %',
        'price change $',
        'market value',
        'day change %',
        'day change $',
        'cost basis',
      ]

      const rows = [
        ['AAPL', 'APPLE INC', '10', '$170', '-0.5%', '($0.85)', '$1,700', '-0.5%', '($8.50)', '$1,500'],
      ]

      const holdings = parseSchwab(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
    })
  })
})
