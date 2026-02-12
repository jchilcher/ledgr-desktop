import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseOFX } from '../ofx-parser';

describe('OFX/QFX Parser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofx-test-'));
  });

  afterEach(() => {
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should parse OFX version 1 SGML format', () => {
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260115120000
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>123456789
<ACCTID>9876543210
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260101120000
<DTEND>20260115120000
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260102120000
<TRNAMT>-45.67
<FITID>2026010201
<NAME>STARBUCKS STORE #123
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260105120000
<TRNAMT>2500.00
<FITID>2026010501
<NAME>SALARY DEPOSIT
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260110120000
<TRNAMT>-125.89
<FITID>2026011001
<NAME>WALMART SUPERCENTER
<MEMO>GROCERIES
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5000.00
<DTASOF>20260115120000
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const filePath = path.join(tempDir, 'test.ofx');
    fs.writeFileSync(filePath, ofxContent);

    const result = parseOFX(filePath);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(3);
    expect(result.skipped).toBe(0);

    // Check first transaction (debit)
    expect(result.transactions[0].date).toEqual(new Date(2026, 0, 2));
    expect(result.transactions[0].description).toBe('STARBUCKS STORE #123');
    expect(result.transactions[0].amount).toBe(-45.67);

    // Check second transaction (credit)
    expect(result.transactions[1].date).toEqual(new Date(2026, 0, 5));
    expect(result.transactions[1].description).toBe('SALARY DEPOSIT');
    expect(result.transactions[1].amount).toBe(2500.00);

    // Check third transaction with memo
    expect(result.transactions[2].date).toEqual(new Date(2026, 0, 10));
    expect(result.transactions[2].description).toBe('WALMART SUPERCENTER - GROCERIES');
    expect(result.transactions[2].amount).toBe(-125.89);
  });

  test('should parse OFX version 2 XML format', () => {
    const ofxContent = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <DTSERVER>20260115120000</DTSERVER>
      <LANGUAGE>ENG</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <STMTRS>
        <CURDEF>USD</CURDEF>
        <BANKACCTFROM>
          <BANKID>123456789</BANKID>
          <ACCTID>9876543210</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20260101120000</DTSTART>
          <DTEND>20260115120000</DTEND>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260103120000</DTPOSTED>
            <TRNAMT>-85.00</TRNAMT>
            <FITID>2026010301</FITID>
            <NAME>TARGET STORE</NAME>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20260108120000</DTPOSTED>
            <TRNAMT>150.00</TRNAMT>
            <FITID>2026010801</FITID>
            <NAME>REFUND FROM AMAZON</NAME>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>3500.00</BALAMT>
          <DTASOF>20260115120000</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    const filePath = path.join(tempDir, 'test-v2.ofx');
    fs.writeFileSync(filePath, ofxContent);

    const result = parseOFX(filePath);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);

    expect(result.transactions[0].date).toEqual(new Date(2026, 0, 3));
    expect(result.transactions[0].description).toBe('TARGET STORE');
    expect(result.transactions[0].amount).toBe(-85.00);

    expect(result.transactions[1].date).toEqual(new Date(2026, 0, 8));
    expect(result.transactions[1].description).toBe('REFUND FROM AMAZON');
    expect(result.transactions[1].amount).toBe(150.00);
  });

  test('should handle QFX files (same as OFX)', () => {
    const qfxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260115120000
<TRNAMT>-50.00
<FITID>TEST001
<NAME>TEST TRANSACTION
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const filePath = path.join(tempDir, 'test.qfx');
    fs.writeFileSync(filePath, qfxContent);

    const result = parseOFX(filePath);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(-50.00);
  });

  test('should handle credit card transactions', () => {
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<CCTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260112120000
<TRNAMT>-35.50
<FITID>CC001
<NAME>NETFLIX SUBSCRIPTION
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260113120000
<TRNAMT>35.50
<FITID>CC002
<NAME>REFUND - NETFLIX
</STMTTRN>
</CCTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>`;

    const filePath = path.join(tempDir, 'creditcard.ofx');
    fs.writeFileSync(filePath, ofxContent);

    const result = parseOFX(filePath);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe('NETFLIX SUBSCRIPTION');
    expect(result.transactions[1].amount).toBe(35.50);
  });

  test('should return error for non-existent file', () => {
    const result = parseOFX('/non/existent/file.ofx');

    expect(result.success).toBe(false);
    expect(result.transactions).toHaveLength(0);
    expect(result.error).toBe('File does not exist');
  });

  test('should return error for empty file', () => {
    const filePath = path.join(tempDir, 'empty.ofx');
    fs.writeFileSync(filePath, '');

    const result = parseOFX(filePath);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Content is empty');
  });

  test('should return error for invalid OFX format', () => {
    const filePath = path.join(tempDir, 'invalid.ofx');
    fs.writeFileSync(filePath, 'This is not valid OFX content');

    const result = parseOFX(filePath);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No transactions found');
  });

  test('should skip transactions with missing required fields', () => {
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260101120000
<TRNAMT>-50.00
<FITID>VALID001
<NAME>VALID TRANSACTION
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<FITID>INVALID001
<NAME>MISSING DATE
</STMTTRN>
<STMTTRN>
<DTPOSTED>20260102120000
<TRNAMT>-75.00
<FITID>INVALID002
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260103120000
<FITID>VALID002
<NAME>ANOTHER VALID
<TRNAMT>-30.00
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const filePath = path.join(tempDir, 'partial.ofx');
    fs.writeFileSync(filePath, ofxContent);

    const result = parseOFX(filePath);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);
    expect(result.skipped).toBe(2);
    expect(result.transactions[0].description).toBe('VALID TRANSACTION');
    expect(result.transactions[1].description).toBe('ANOTHER VALID');
  });

  test('should parse dates in YYYYMMDDHHMMSS format', () => {
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261231235959
<TRNAMT>-100.00
<FITID>DATE001
<NAME>END OF YEAR TRANSACTION
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const filePath = path.join(tempDir, 'date-test.ofx');
    fs.writeFileSync(filePath, ofxContent);

    const result = parseOFX(filePath);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].date).toEqual(new Date(2026, 11, 31));
  });

  test('should handle positive amounts for credits and negative for debits', () => {
    const ofxContent = `OFXHEADER:100
DATA:OFXSGML

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260101120000
<TRNAMT>500.00
<FITID>AMT001
<NAME>PAYCHECK
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260102120000
<TRNAMT>-75.50
<FITID>AMT002
<NAME>GROCERIES
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const filePath = path.join(tempDir, 'amounts.ofx');
    fs.writeFileSync(filePath, ofxContent);

    const result = parseOFX(filePath);

    expect(result.success).toBe(true);
    expect(result.transactions[0].amount).toBe(500.00);
    expect(result.transactions[1].amount).toBe(-75.50);
  });
});
