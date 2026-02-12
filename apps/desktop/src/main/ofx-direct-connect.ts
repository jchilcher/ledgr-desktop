// OFX Direct Connect - Connect directly to banks via OFX protocol
import { BankInfo } from './bank-directory';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface OFXCredentials {
  bankId: string;
  username: string;
  password: string;
  accountId?: string;
  accountType?: 'CHECKING' | 'SAVINGS' | 'CREDITCARD' | 'MONEYMRKT';
}

// Persistent CLIENTUID storage - many banks require this
let clientUid: string | null = null;

function getClientUid(): string {
  if (clientUid) return clientUid;

  try {
    const userDataPath = app.getPath('userData');
    const clientUidPath = path.join(userDataPath, 'ofx-client-uid');

    if (fs.existsSync(clientUidPath)) {
      clientUid = fs.readFileSync(clientUidPath, 'utf8').trim();
    } else {
      // Generate a new persistent CLIENTUID
      clientUid = randomUUID().replace(/-/g, '').toUpperCase();
      fs.writeFileSync(clientUidPath, clientUid, 'utf8');
    }
  } catch {
    // Fallback if we can't access userData (e.g., during testing)
    clientUid = randomUUID().replace(/-/g, '').toUpperCase();
  }

  return clientUid;
}

export interface OFXAccount {
  accountId: string;
  accountType: string;
  bankId?: string;
  description?: string;
}

export interface OFXTransaction {
  fitId: string;
  type: 'DEBIT' | 'CREDIT';
  datePosted: Date;
  amount: number;
  name: string;
  memo?: string;
  checkNum?: string;
}

export interface OFXResponse {
  success: boolean;
  error?: string;
  accounts?: OFXAccount[];
  transactions?: OFXTransaction[];
  balance?: number;
  balanceDate?: Date;
}

export class OFXDirectConnect {
  private static generateUUID(): string {
    return randomUUID().replace(/-/g, '').toUpperCase();
  }

  private static formatDate(date: Date): string {
    return date.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  }

  private static getOFXErrorMessage(code: string): string {
    // OFX error codes - see OFX spec for full list
    const errorMessages: Record<string, string> = {
      '0': 'Success',
      '1': 'Client is up-to-date',
      '2000': 'General error',
      '2001': 'Invalid account',
      '2002': 'General account error',
      '2003': 'Account not found',
      '2004': 'Account closed',
      '2005': 'Account not authorized',
      '2006': 'Source account not found',
      '2007': 'Source account closed',
      '2008': 'Source account not authorized',
      '2009': 'Destination account not found',
      '2010': 'Destination account closed',
      '2011': 'Destination account not authorized',
      '2012': 'Invalid amount',
      '2014': 'Date too soon',
      '2015': 'Date too far in future',
      '2016': 'Transaction already committed',
      '2017': 'Already canceled',
      '2018': 'Unknown server ID',
      '2019': 'Duplicate request',
      '2020': 'Invalid date',
      '2021': 'Unsupported version',
      '2022': 'Invalid TAN',
      '6500': 'HTML error - check URL',
      '6501': 'General FI error',
      '6502': 'Invalid request - check bank details',
      '10000': 'Stop check in process',
      '10500': 'Too many checks',
      '10501': 'Invalid payee',
      '10502': 'Invalid payee address',
      '10503': 'Invalid payee account',
      '10504': 'Insufficient funds',
      '10505': 'Cannot modify element',
      '10506': 'Cannot modify source account',
      '10507': 'Cannot modify destination account',
      '10508': 'Invalid frequency',
      '10509': 'Model already canceled',
      '10510': 'Invalid payee ID',
      '10511': 'Invalid payee city',
      '10512': 'Invalid payee state',
      '10513': 'Invalid payee postal code',
      '10514': 'Transaction already processed',
      '10515': 'Payee not modifiable',
      '10516': 'Wire beneficiary invalid',
      '10517': 'Invalid payee name',
      '10518': 'Unknown model ID',
      '10519': 'Invalid payee list ID',
      '13000': 'User ID/password invalid - check your credentials',
      '13500': 'User not registered for online services - contact your bank',
      '13501': 'User not registered for bill pay',
      '13502': 'User not registered for bill pay with payee',
      '13503': 'User authentication required',
      '13504': 'User must change password',
      '15000': 'Must change USERPASS - your bank requires a password change',
      '15500': 'Signon invalid - check credentials',
      '15501': 'Customer account in use',
      '15502': 'USERPASS lockout - too many failed attempts, contact your bank',
      '15503': 'Client UID required',
      '15504': 'Contact your financial institution',
      '15505': 'Authentication token required (MFA)',
      '15506': 'Invalid authentication token',
      '15507': 'Invalid OTP',
      '15508': 'OTP required',
      '15509': 'OTP invalid',
      '15510': 'Device authentication required',
      '15511': 'MFA challenge required',
      '15512': 'MFA challenge invalid',
      '16500': 'Account statement download not available',
      '16501': 'Investment position download not available',
      '16502': 'Investment balance download not available',
    };

    return errorMessages[code] || `Unknown error (code: ${code})`;
  }

  private static buildOFXHeader(): string {
    return [
      'OFXHEADER:100',
      'DATA:OFXSGML',
      'VERSION:102',
      'SECURITY:NONE',
      'ENCODING:USASCII',
      'CHARSET:1252',
      'COMPRESSION:NONE',
      'OLDFILEUID:NONE',
      'NEWFILEUID:' + this.generateUUID(),
      '',
      '',
    ].join('\r\n');
  }

  private static buildSignonRequest(
    bank: BankInfo,
    credentials: OFXCredentials
  ): string {
    const now = this.formatDate(new Date());
    const uid = getClientUid();
    return `
<SIGNONMSGSRQV1>
<SONRQ>
<DTCLIENT>${now}
<USERID>${credentials.username}
<USERPASS>${credentials.password}
<LANGUAGE>ENG
<FI>
<ORG>${bank.org}
<FID>${bank.fid}
</FI>
<APPID>QWIN
<APPVER>2700
<CLIENTUID>${uid}
</SONRQ>
</SIGNONMSGSRQV1>`;
  }

  private static buildAccountListRequest(): string {
    return `
<SIGNUPMSGSRQV1>
<ACCTINFOTRNRQ>
<TRNUID>${this.generateUUID()}
<ACCTINFORQ>
<DTACCTUP>19700101
</ACCTINFORQ>
</ACCTINFOTRNRQ>
</SIGNUPMSGSRQV1>`;
  }

  private static buildBankStatementRequest(
    credentials: OFXCredentials,
    startDate: Date,
    endDate: Date
  ): string {
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);

    if (credentials.accountType === 'CREDITCARD') {
      return `
<CREDITCARDMSGSRQV1>
<CCSTMTTRNRQ>
<TRNUID>${this.generateUUID()}
<CCSTMTRQ>
<CCACCTFROM>
<ACCTID>${credentials.accountId}
</CCACCTFROM>
<INCTRAN>
<DTSTART>${start}
<DTEND>${end}
<INCLUDE>Y
</INCTRAN>
</CCSTMTRQ>
</CCSTMTTRNRQ>
</CREDITCARDMSGSRQV1>`;
    }

    return `
<BANKMSGSRQV1>
<STMTTRNRQ>
<TRNUID>${this.generateUUID()}
<STMTRQ>
<BANKACCTFROM>
<BANKID>${credentials.bankId || ''}
<ACCTID>${credentials.accountId}
<ACCTTYPE>${credentials.accountType || 'CHECKING'}
</BANKACCTFROM>
<INCTRAN>
<DTSTART>${start}
<DTEND>${end}
<INCLUDE>Y
</INCTRAN>
</STMTRQ>
</STMTTRNRQ>
</BANKMSGSRQV1>`;
  }

  static async getAccounts(
    bank: BankInfo,
    credentials: OFXCredentials
  ): Promise<OFXResponse> {
    const request =
      this.buildOFXHeader() +
      '<OFX>' +
      this.buildSignonRequest(bank, credentials) +
      this.buildAccountListRequest() +
      '</OFX>';

    try {
      const response = await this.sendRequest(bank.ofxUrl, request);
      return this.parseAccountListResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get accounts',
      };
    }
  }

  static async getTransactions(
    bank: BankInfo,
    credentials: OFXCredentials,
    startDate: Date,
    endDate: Date
  ): Promise<OFXResponse> {
    const request =
      this.buildOFXHeader() +
      '<OFX>' +
      this.buildSignonRequest(bank, credentials) +
      this.buildBankStatementRequest(credentials, startDate, endDate) +
      '</OFX>';

    try {
      const response = await this.sendRequest(bank.ofxUrl, request);
      return this.parseStatementResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transactions',
      };
    }
  }

  private static async sendRequest(url: string, body: string): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ofx',
        'Accept': 'application/ofx',
      },
      body: body,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }

  private static parseAccountListResponse(response: string): OFXResponse {
    // Check for signon errors first (in SONRS)
    const signonStatusMatch = response.match(/<SONRS>[\s\S]*?<STATUS>[\s\S]*?<CODE>(\d+)/);
    if (signonStatusMatch && signonStatusMatch[1] !== '0') {
      const messageMatch = response.match(/<SONRS>[\s\S]*?<MESSAGE>([^<]+)/);
      const errorCode = signonStatusMatch[1];
      const errorMessage = messageMatch ? messageMatch[1] : this.getOFXErrorMessage(errorCode);
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Check for general errors
    const statusMatch = response.match(/<STATUS>[\s\S]*?<CODE>(\d+)/);
    if (statusMatch && statusMatch[1] !== '0') {
      const messageMatch = response.match(/<MESSAGE>([^<]+)/);
      const errorCode = statusMatch[1];
      const errorMessage = messageMatch ? messageMatch[1] : this.getOFXErrorMessage(errorCode);
      return {
        success: false,
        error: errorMessage,
      };
    }

    const accounts: OFXAccount[] = [];

    // Parse bank accounts
    const bankAcctRegex = /<BANKACCTINFO>[\s\S]*?<BANKACCTFROM>[\s\S]*?<ACCTID>([^<\s]+)[\s\S]*?<ACCTTYPE>([^<\s]+)/g;
    let match;
    while ((match = bankAcctRegex.exec(response)) !== null) {
      accounts.push({
        accountId: match[1].trim(),
        accountType: match[2].trim(),
      });
    }

    // Parse credit card accounts
    const ccAcctRegex = /<CCACCTINFO>[\s\S]*?<CCACCTFROM>[\s\S]*?<ACCTID>([^<\s]+)/g;
    while ((match = ccAcctRegex.exec(response)) !== null) {
      accounts.push({
        accountId: match[1].trim(),
        accountType: 'CREDITCARD',
      });
    }

    return {
      success: true,
      accounts,
    };
  }

  private static parseStatementResponse(response: string): OFXResponse {
    // Check for signon errors first
    const signonStatusMatch = response.match(/<SONRS>[\s\S]*?<STATUS>[\s\S]*?<CODE>(\d+)/);
    if (signonStatusMatch && signonStatusMatch[1] !== '0') {
      const messageMatch = response.match(/<SONRS>[\s\S]*?<MESSAGE>([^<]+)/);
      const errorCode = signonStatusMatch[1];
      const errorMessage = messageMatch ? messageMatch[1] : this.getOFXErrorMessage(errorCode);
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Check for general errors
    const statusMatch = response.match(/<STATUS>[\s\S]*?<CODE>(\d+)/);
    if (statusMatch && statusMatch[1] !== '0') {
      const messageMatch = response.match(/<MESSAGE>([^<]+)/);
      const errorCode = statusMatch[1];
      const errorMessage = messageMatch ? messageMatch[1] : this.getOFXErrorMessage(errorCode);
      return {
        success: false,
        error: errorMessage,
      };
    }

    const transactions: OFXTransaction[] = [];

    // Parse transactions
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;
    while ((match = stmtTrnRegex.exec(response)) !== null) {
      const trn = match[1];

      const dateMatch = trn.match(/<DTPOSTED>(\d{8})/);
      const amountMatch = trn.match(/<TRNAMT>([^<\s]+)/);
      const fitIdMatch = trn.match(/<FITID>([^<\s]+)/);
      const nameMatch = trn.match(/<NAME>([^<]+)/);
      const memoMatch = trn.match(/<MEMO>([^<]+)/);
      const checkNumMatch = trn.match(/<CHECKNUM>([^<]+)/);

      if (dateMatch && amountMatch && fitIdMatch) {
        const amountDollars = parseFloat(amountMatch[1]);
        const amountCents = Math.round(amountDollars * 100);
        const dateStr = dateMatch[1];
        const year = parseInt(dateStr.slice(0, 4));
        const month = parseInt(dateStr.slice(4, 6)) - 1;
        const day = parseInt(dateStr.slice(6, 8));

        transactions.push({
          fitId: fitIdMatch[1].trim(),
          type: amountDollars < 0 ? 'DEBIT' : 'CREDIT',
          datePosted: new Date(year, month, day),
          amount: amountCents,
          name: nameMatch ? nameMatch[1].trim() : 'Unknown',
          memo: memoMatch ? memoMatch[1].trim() : undefined,
          checkNum: checkNumMatch ? checkNumMatch[1].trim() : undefined,
        });
      }
    }

    // Parse balance
    let balance: number | undefined;
    let balanceDate: Date | undefined;
    const balanceMatch = response.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\s]+)/);
    if (balanceMatch) {
      balance = Math.round(parseFloat(balanceMatch[1]) * 100);
    }
    const balDateMatch = response.match(/<LEDGERBAL>[\s\S]*?<DTASOF>(\d{8})/);
    if (balDateMatch) {
      const dateStr = balDateMatch[1];
      const year = parseInt(dateStr.slice(0, 4));
      const month = parseInt(dateStr.slice(4, 6)) - 1;
      const day = parseInt(dateStr.slice(6, 8));
      balanceDate = new Date(year, month, day);
    }

    return {
      success: true,
      transactions,
      balance,
      balanceDate,
    };
  }

  static testConnection(
    bank: BankInfo,
    credentials: OFXCredentials
  ): Promise<OFXResponse> {
    return this.getAccounts(bank, credentials);
  }
}
