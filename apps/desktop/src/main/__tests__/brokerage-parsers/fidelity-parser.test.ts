import { detectFidelity, parseFidelity } from '../../brokerage-parsers/fidelity-parser'

describe('Fidelity Parser', () => {
  describe('detectFidelity', () => {
    it('should recognize Fidelity format headers', () => {
      const headers = [
        'account name/number',
        'symbol',
        'description',
        'quantity',
        'last price',
      ]

      expect(detectFidelity(headers)).toBe(true)
    })

    it('should reject non-Fidelity headers', () => {
      const headers = ['symbol', 'description', 'quantity']

      expect(detectFidelity(headers)).toBe(false)
    })

    it('should handle case variations', () => {
      const headers = [
        'Account Name/Number',
        'Symbol',
        'Description',
      ]

      expect(detectFidelity(headers)).toBe(true)
    })
  })

  describe('parseFidelity', () => {
    it('should correctly extract ticker, shares, cost basis', () => {
      const headers = [
        'Account Name/Number',
        'Symbol',
        'Description',
        'Quantity',
        'Last Price',
        'Last Price Change',
        'Current Value',
        "Today's Gain/Loss Dollar",
        "Today's Gain/Loss Percent",
        'Total Gain/Loss Dollar',
        'Total Gain/Loss Percent',
        'Percent Of Account',
        'Cost Basis',
        'Cost Basis Per Share',
        'Type',
      ]

      const rows = [
        [
          'Individual - TOD XXXX1234',
          'AAPL',
          'APPLE INC',
          '50.0000',
          '$171.21',
          '$0.45',
          '$8,560.50',
          '$22.50',
          '+0.26%',
          '$1,560.50',
          '+22.29%',
          '12.34%',
          '$7,000.00',
          '$140.00',
          'Cash',
        ],
      ]

      const holdings = parseFidelity(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[0].shares).toBe(500000)
      expect(holdings[0].costBasis).toBe(700000)
      expect(holdings[0].costPerShare).toBe(14000)
    })

    it('should handle missing columns gracefully', () => {
      const headers = ['Account', 'Symbol', 'Description', 'Quantity']
      const rows = [['Account1', 'AAPL', 'Apple Inc', '10']]

      const holdings = parseFidelity(rows, headers)

      expect(holdings).toHaveLength(0)
    })

    it('should skip cash entries', () => {
      const headers = [
        'Account Name/Number',
        'Symbol',
        'Description',
        'Quantity',
        'Last Price',
        'Last Price Change',
        'Current Value',
        "Today's Gain/Loss Dollar",
        "Today's Gain/Loss Percent",
        'Total Gain/Loss Dollar',
        'Total Gain/Loss Percent',
        'Percent Of Account',
        'Cost Basis',
        'Cost Basis Per Share',
        'Type',
      ]

      const rows = [
        [
          'Account',
          'SPAXX',
          'FIDELITY MONEY MARKET',
          '1000',
          '$1.00',
          '$0.00',
          '$1,000.00',
          '$0.00',
          '0.00%',
          '$0.00',
          '0.00%',
          '5%',
          '$1,000.00',
          '$1.00',
          'Cash',
        ],
      ]

      const holdings = parseFidelity(rows, headers)

      expect(holdings).toHaveLength(0)
    })

    it('should handle currency symbols and commas', () => {
      const headers = [
        'Account Name/Number',
        'Symbol',
        'Description',
        'Quantity',
        'Last Price',
        'Last Price Change',
        'Current Value',
        "Today's Gain/Loss Dollar",
        "Today's Gain/Loss Percent",
        'Total Gain/Loss Dollar',
        'Total Gain/Loss Percent',
        'Percent Of Account',
        'Cost Basis',
        'Cost Basis Per Share',
        'Type',
      ]

      const rows = [
        [
          'Account',
          'TSLA',
          'TESLA INC',
          '25.5000',
          '$250.00',
          '$5.00',
          '$6,375.00',
          '$127.50',
          '+2.04%',
          '$875.00',
          '+15.94%',
          '8%',
          '$5,500.00',
          '$215.69',
          'Cash',
        ],
      ]

      const holdings = parseFidelity(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].ticker).toBe('TSLA')
      expect(holdings[0].shares).toBe(255000)
      expect(holdings[0].costBasis).toBe(550000)
      expect(holdings[0].costPerShare).toBe(21569)
    })

    it('should skip header rows that appear mid-file', () => {
      const headers = [
        'Account Name/Number',
        'Symbol',
        'Description',
        'Quantity',
        'Last Price',
        'Last Price Change',
        'Current Value',
        "Today's Gain/Loss Dollar",
        "Today's Gain/Loss Percent",
        'Total Gain/Loss Dollar',
        'Total Gain/Loss Percent',
        'Percent Of Account',
        'Cost Basis',
        'Cost Basis Per Share',
        'Type',
      ]

      const rows = [
        [
          'Account1',
          'AAPL',
          'APPLE INC',
          '10',
          '$170',
          '$0',
          '$1,700',
          '$0',
          '0%',
          '$0',
          '0%',
          '10%',
          '$1,500',
          '$150',
          'Cash',
        ],
        [
          'Account Name/Number',
          'Symbol',
          'Description',
          'Quantity',
          'Last Price',
          'Last Price Change',
          'Current Value',
          "Today's Gain/Loss Dollar",
          "Today's Gain/Loss Percent",
          'Total Gain/Loss Dollar',
          'Total Gain/Loss Percent',
          'Percent Of Account',
          'Cost Basis',
          'Cost Basis Per Share',
          'Type',
        ],
        [
          'Account2',
          'MSFT',
          'MICROSOFT',
          '20',
          '$300',
          '$0',
          '$6,000',
          '$0',
          '0%',
          '$0',
          '0%',
          '20%',
          '$5,000',
          '$250',
          'Cash',
        ],
      ]

      const holdings = parseFidelity(rows, headers)

      expect(holdings).toHaveLength(2)
      expect(holdings[0].ticker).toBe('AAPL')
      expect(holdings[1].ticker).toBe('MSFT')
    })

    it('should calculate cost per share if not provided', () => {
      const headers = [
        'Account Name/Number',
        'Symbol',
        'Description',
        'Quantity',
        'Last Price',
        'Last Price Change',
        'Current Value',
        "Today's Gain/Loss Dollar",
        "Today's Gain/Loss Percent",
        'Total Gain/Loss Dollar',
        'Total Gain/Loss Percent',
        'Percent Of Account',
        'Cost Basis',
        'Cost Basis Per Share',
        'Type',
      ]

      const rows = [
        [
          'Account',
          'GOOG',
          'ALPHABET INC',
          '10',
          '$140',
          '$0',
          '$1,400',
          '$0',
          '0%',
          '$0',
          '0%',
          '10%',
          '$1,200',
          '',
          'Cash',
        ],
      ]

      const holdings = parseFidelity(rows, headers)

      expect(holdings).toHaveLength(1)
      expect(holdings[0].costPerShare).toBe(12000)
    })

    it('should skip empty rows', () => {
      const headers = [
        'Account Name/Number',
        'Symbol',
        'Description',
        'Quantity',
        'Last Price',
        'Last Price Change',
        'Current Value',
        "Today's Gain/Loss Dollar",
        "Today's Gain/Loss Percent",
        'Total Gain/Loss Dollar',
        'Total Gain/Loss Percent',
        'Percent Of Account',
        'Cost Basis',
        'Cost Basis Per Share',
        'Type',
      ]

      const rows = [
        [
          'Account',
          'AAPL',
          'APPLE INC',
          '10',
          '$170',
          '$0',
          '$1,700',
          '$0',
          '0%',
          '$0',
          '0%',
          '10%',
          '$1,500',
          '$150',
          'Cash',
        ],
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ]

      const holdings = parseFidelity(rows, headers)

      expect(holdings).toHaveLength(1)
    })
  })
})
