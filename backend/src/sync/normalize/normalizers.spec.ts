import { describe, expect, it } from 'vitest';
import { parseCsv } from '../sheets.client';
import { caseCode, cleanText, fromSerial, money, parseBool, pgroup, phone, score, sku, thDate } from './normalizers';

describe('parseCsv (link-share mode)', () => {
  it('parses quoted cells with commas and newlines', () => {
    const rows = parseCsv('"GV0004","ปัญหา: ไฟไม่ติด,\nกดไม่ได้","TRUE"\n"GV0005","ปกติ","FALSE"');
    expect(rows).toHaveLength(2);
    expect(rows[0][1]).toBe('ปัญหา: ไฟไม่ติด,\nกดไม่ได้');
    expect(rows[1][0]).toBe('GV0005');
  });
  it('handles escaped double quotes', () => {
    expect(parseCsv('"เขาบอกว่า ""เสีย""",x')[0][0]).toBe('เขาบอกว่า "เสีย"');
  });
  it('keeps empty rows (needed for pagination counting)', () => {
    expect(parseCsv('"a","b"\n"",""\n"c","d"')).toHaveLength(3);
  });
});

describe('thDate (string forms from CSV)', () => {
  it('parses d/m/yyyy with time', () => {
    const r = thDate('20/4/2022, 16:39:34');
    expect(r.value?.toISOString()).toBe('2022-04-20T16:39:34.000Z');
  });
  it('parses d/m/yyyy without time', () => {
    expect(thDate('21/9/2020').value?.toISOString().slice(0, 10)).toBe('2020-09-21');
  });
});

describe('thDate', () => {
  it('parses Sheets serial numbers', () => {
    // 2020-09-21 = serial 44095
    expect(thDate(44095).value?.toISOString().slice(0, 10)).toBe('2020-09-21');
  });
  it('fixes BE full year (2564 → 2021)', () => {
    const r = thDate('15/03/2564');
    expect(r.value?.getUTCFullYear()).toBe(2021);
    expect(r.flags).toContain('be_year_fixed');
  });
  it('fixes 2-digit BE parsed as 19xx (1963 → 2020)', () => {
    const serial1963 = (Date.UTC(1963, 8, 23) / 86400000) + 25569;
    const r = thDate(serial1963);
    expect(r.value?.getUTCFullYear()).toBe(2020);
    expect(r.flags).toContain('be_year_fixed');
  });
  it('flags out-of-range years', () => {
    expect(thDate('01/01/2050').flags).toContain('needs_review');
  });
  it('returns null for garbage', () => {
    expect(thDate('JIB').value).toBeNull();
  });
});

describe('phone', () => {
  it('restores lost leading zero (891333557 → +66891333557)', () => {
    expect(phone(891333557).value).toBe('+66891333557');
  });
  it('handles formatted numbers', () => {
    expect(phone('081 997 9966').value).toBe('+66819979966');
  });
  it('handles 66 prefix', () => {
    expect(phone('66819979966').value).toBe('+66819979966');
  });
  it('flags invalid', () => {
    expect(phone('abc').flags).toContain('phone_invalid');
  });
});

describe('pgroup', () => {
  it('maps variants of เคลม', () => {
    expect(pgroup('เคลม').value).toBe('claim');
    expect(pgroup('เคลม/ครั้งที่ 2').value).toBe('claim');
    expect(pgroup('เคลม.').value).toBe('claim');
  });
  it('maps misspelled เปลี่ยนคินสินค้า', () => {
    expect(pgroup('เปลี่ยนคินสินค้า').value).toBe('exchange_return');
    expect(pgroup('เปลี่ยนรุ่น-คืนสินค้า').value).toBe('exchange_return');
  });
  it('maps others', () => {
    expect(pgroup('รีวิว').value).toBe('review');
    expect(pgroup('แจ้งปัญหาสินค้าการใช้งาน').value).toBe('usage_issue');
    expect(pgroup('บริการหลังการขาย').value).toBe('after_sales');
    expect(pgroup('2100501126114').value).toBe('other');
  });
});

describe('caseCode', () => {
  it('accepts GV codes', () => {
    expect(caseCode('GV0004').value).toBe('GV0004');
    expect(caseCode(' gv6384 ').value).toBe('GV6384');
  });
  it('rejects junk / header rows', () => {
    expect(caseCode('ร้าน').value).toBeNull();
    expect(caseCode('2222').value).toBeNull();
    expect(caseCode(null).flags).toContain('case_code_missing');
  });
});

describe('sku / bool / score / money / cleanText', () => {
  it('normalizes sku case', () => {
    expect(sku('mk852').value).toBe('MK852');
    expect(sku(' wgp13s ').value).toBe('WGP13S');
  });
  it('parses booleans', () => {
    expect(parseBool('TRUE')).toBe(true);
    expect(parseBool(true)).toBe(true);
    expect(parseBool('FALSE')).toBe(false);
    expect(parseBool(null)).toBe(false);
  });
  it('validates score ranges (two scales)', () => {
    expect(score(4, 0, 5).value).toBe(4);
    expect(score(10, 0, 5).value).toBeNull();
    expect(score(10, 0, 10).value).toBe(10);
  });
  it('parses money', () => {
    expect(money('120 บาท').value).toBe(120);
  });
  it('treats "-" and empty as null', () => {
    expect(cleanText('-')).toBeNull();
    expect(cleanText('  ')).toBeNull();
  });
  it('serial roundtrip', () => {
    expect(fromSerial(25569).toISOString().slice(0, 10)).toBe('1970-01-01');
  });
});
