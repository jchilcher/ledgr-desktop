import React, { useState } from 'react';

const banks = [
  {
    name: 'Chase',
    steps: [
      'Log in to chase.com and select your account',
      'Click the download icon (arrow pointing down) next to your transactions',
      'Select "CSV" as the file type',
      'Choose your date range and click "Download"',
    ],
  },
  {
    name: 'Bank of America',
    steps: [
      'Log in to bankofamerica.com',
      'Go to your account and click "Download Transactions"',
      'Select "Microsoft Excel" or "CSV" format',
      'Set your date range and click "Download"',
    ],
  },
  {
    name: 'Wells Fargo',
    steps: [
      'Log in to wellsfargo.com',
      'Select your account and go to Account Activity',
      'Click "Download Account Activity"',
      'Choose CSV format and your date range, then click "Download"',
    ],
  },
  {
    name: 'Citi',
    steps: [
      'Log in to online.citi.com',
      'Select your account and click "View More Transactions"',
      'Click "Download" in the top right',
      'Select CSV format and your date range',
    ],
  },
  {
    name: 'Capital One',
    steps: [
      'Log in to capitalone.com',
      'Select your account and click "Download Transactions"',
      'Choose CSV format',
      'Select your date range and download',
    ],
  },
  {
    name: 'Discover',
    steps: [
      'Log in to discover.com',
      'Go to your account Statements & Activity',
      'Click "Download" or "Export"',
      'Select CSV and your date range',
    ],
  },
  {
    name: 'US Bank',
    steps: [
      'Log in to usbank.com',
      'Select your account and go to Transaction History',
      'Click "Download Transactions"',
      'Select CSV format and date range',
    ],
  },
  {
    name: 'PNC',
    steps: [
      'Log in to pnc.com',
      'Go to your account activity',
      'Click "Download" near the transaction list',
      'Choose CSV format and your date range',
    ],
  },
  {
    name: 'TD Bank',
    steps: [
      'Log in to td.com',
      'Go to your account and select "Download Transactions"',
      'Choose CSV format',
      'Select date range and download',
    ],
  },
  {
    name: 'Ally Bank',
    steps: [
      'Log in to ally.com',
      'Go to your account and click "Activity & Statements"',
      'Click "Export" above the transaction list',
      'Select CSV format and your date range',
    ],
  },
  {
    name: 'USAA',
    steps: [
      'Log in to usaa.com',
      'Select your account',
      'Click "Download Transactions"',
      'Choose CSV format and select your date range',
    ],
  },
  {
    name: 'American Express',
    steps: [
      'Log in to americanexpress.com',
      'Go to your account Statements & Activity',
      'Click "Download Your Statement Data"',
      'Select CSV and date range',
    ],
  },
  {
    name: 'Charles Schwab',
    steps: [
      'Log in to schwab.com',
      'Go to History for your account',
      'Click "Export" in the top right',
      'Select CSV format and date range',
    ],
  },
  {
    name: 'Fidelity',
    steps: [
      'Log in to fidelity.com',
      'Go to your account Activity & Orders',
      'Click "Download" at the top of the transaction list',
      'Select CSV format',
    ],
  },
];

const BankExportGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedBank, setExpandedBank] = useState<string | null>(null);

  const filtered = banks.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bank-guide">
      <button className="bank-guide-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span>Need help exporting from your bank?</span>
        <span className="bank-guide-chevron">{isOpen ? '\u25BE' : '\u25B8'}</span>
      </button>
      {isOpen && (
        <div className="bank-guide-content">
          <input
            className="bank-guide-search"
            type="text"
            placeholder="Search your bank..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="bank-guide-list">
            {filtered.map(bank => (
              <div key={bank.name} className="bank-guide-item">
                <button
                  className={`bank-guide-item-header ${expandedBank === bank.name ? 'active' : ''}`}
                  onClick={() => setExpandedBank(expandedBank === bank.name ? null : bank.name)}
                >
                  {bank.name}
                  <span>{expandedBank === bank.name ? '\u2212' : '+'}</span>
                </button>
                {expandedBank === bank.name && (
                  <ol className="bank-guide-steps">
                    {bank.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
            <div className="bank-guide-item">
              <button
                className={`bank-guide-item-header ${expandedBank === 'other' ? 'active' : ''}`}
                onClick={() => setExpandedBank(expandedBank === 'other' ? null : 'other')}
              >
                Other Bank
                <span>{expandedBank === 'other' ? '\u2212' : '+'}</span>
              </button>
              {expandedBank === 'other' && (
                <ol className="bank-guide-steps">
                  <li>Log in to your bank&apos;s website</li>
                  <li>Navigate to your account&apos;s transaction history</li>
                  <li>Look for a &quot;Download&quot;, &quot;Export&quot;, or arrow icon</li>
                  <li>Select &quot;CSV&quot; or &quot;Excel&quot; as the format</li>
                  <li>Choose your desired date range and download</li>
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankExportGuide;
