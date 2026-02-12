// OFX Direct Connect Bank Directory
// Data sourced from OFX Home (https://www.ofxhome.com/)

export interface BankInfo {
  id: string;
  name: string;
  ofxUrl: string;
  org: string;
  fid: string;
  brokererId?: string;
  notes?: string;
}

// Popular banks with OFX Direct Connect support
export const BANK_DIRECTORY: BankInfo[] = [
  // Major US Banks
  {
    id: 'chase',
    name: 'Chase Bank',
    ofxUrl: 'https://ofx.chase.com',
    org: 'B1',
    fid: '10898',
  },
  {
    id: 'wellsfargo',
    name: 'Wells Fargo',
    ofxUrl: 'https://ofxdc.wellsfargo.com/ofx/process.ofx',
    org: 'WF',
    fid: '3000',
  },
  {
    id: 'bankofamerica',
    name: 'Bank of America',
    ofxUrl: 'https://eftx.bankofamerica.com/eftxweb/access.ofx',
    org: 'HAN',
    fid: '5959',
  },
  {
    id: 'citi',
    name: 'Citibank',
    ofxUrl: 'https://www.accountonline.com/cards/svc/CitiaborOfx.do',
    org: 'Citigroup',
    fid: '24909',
  },
  {
    id: 'usbank',
    name: 'US Bank',
    ofxUrl: 'https://www.oasis.cfree.com/fip/genesis/prod/04950200.ofx',
    org: 'US Bank',
    fid: '1401',
  },
  {
    id: 'pnc',
    name: 'PNC Bank',
    ofxUrl: 'https://www.oasis.cfree.com/fip/genesis/prod/04840400.ofx',
    org: 'PNC',
    fid: '4501',
  },
  {
    id: 'capitalone',
    name: 'Capital One',
    ofxUrl: 'https://ofx.capitalone.com/ofx/process.ofx',
    org: 'Capital One',
    fid: '1001',
  },
  {
    id: 'tdbank',
    name: 'TD Bank',
    ofxUrl: 'https://onlinebanking.tdbank.com/scripts/serverext.dll',
    org: 'td',
    fid: '1001',
  },
  {
    id: 'regions',
    name: 'Regions Bank',
    ofxUrl: 'https://www.oasis.cfree.com/fip/genesis/prod/06200100.ofx',
    org: 'Regions Bank',
    fid: '6200',
  },
  {
    id: 'suntrust',
    name: 'Truist (SunTrust)',
    ofxUrl: 'https://www.oasis.cfree.com/fip/genesis/prod/05300010.ofx',
    org: 'SunTrust',
    fid: '2801',
  },
  // Credit Unions
  {
    id: 'navyfed',
    name: 'Navy Federal Credit Union',
    ofxUrl: 'https://www.oasis.cfree.com/fip/genesis/prod/25608900.ofx',
    org: 'Navy FCU',
    fid: '11075',
  },
  {
    id: 'becu',
    name: 'BECU',
    ofxUrl: 'https://www.oasis.cfree.com/fip/genesis/prod/32587900.ofx',
    org: 'BECU',
    fid: '1001',
  },
  {
    id: 'alliant',
    name: 'Alliant Credit Union',
    ofxUrl: 'https://www.oasis.cfree.com/fip/genesis/prod/27188100.ofx',
    org: 'Alliant CU',
    fid: '1001',
  },
  // Credit Cards
  {
    id: 'amex',
    name: 'American Express',
    ofxUrl: 'https://online.americanexpress.com/myca/ofxdl/desktop/desktopDownload.do?request_type=nl_ofxdownload',
    org: 'AMEX',
    fid: '3101',
  },
  {
    id: 'discover',
    name: 'Discover Card',
    ofxUrl: 'https://ofx.discovercard.com',
    org: 'Discover',
    fid: '7101',
  },
  // Brokerages
  {
    id: 'vanguard',
    name: 'Vanguard',
    ofxUrl: 'https://vesnc.vanguard.com/us/OfxDirectConnectServlet',
    org: 'Vanguard',
    fid: '1358',
    brokererId: 'vanguard.com',
  },
  {
    id: 'fidelity',
    name: 'Fidelity Investments',
    ofxUrl: 'https://ofx.fidelity.com/ftgw/OFX/clients/download',
    org: 'fidelity.com',
    fid: '7776',
    brokererId: 'fidelity.com',
  },
  {
    id: 'schwab',
    name: 'Charles Schwab',
    ofxUrl: 'https://ofx.schwab.com/cgi_dev/ofx_server',
    org: 'ISC',
    fid: '5104',
    brokererId: 'schwab.com',
  },
  {
    id: 'etrade',
    name: 'E*TRADE',
    ofxUrl: 'https://ofx.etrade.com/cgi-ofx/elogin',
    org: 'E*TRADE',
    fid: '9999',
    brokererId: 'etrade.com',
  },
];

export function searchBanks(query: string): BankInfo[] {
  const lowerQuery = query.toLowerCase();
  return BANK_DIRECTORY.filter(
    bank => bank.name.toLowerCase().includes(lowerQuery)
  );
}

export function getBankById(id: string): BankInfo | undefined {
  return BANK_DIRECTORY.find(bank => bank.id === id);
}

export function getAllBanks(): BankInfo[] {
  return [...BANK_DIRECTORY].sort((a, b) => a.name.localeCompare(b.name));
}
