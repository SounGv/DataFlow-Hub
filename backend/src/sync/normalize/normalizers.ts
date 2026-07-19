/**
 * Pure normalization functions — rules from docs/DATA_MAPPING.md + DATA_QUALITY_REPORT.md
 * Every function returns { value, flags } so the sync engine keeps traceability.
 */

export interface Norm<T> {
  value: T | null;
  flags: string[];
}

const ok = <T>(value: T | null, ...flags: string[]): Norm<T> => ({ value, flags });
const none = (...flags: string[]): Norm<never> => ({ value: null, flags });

export function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'nan') return null;
  return s;
}

/** Google Sheets serial number → JS Date (UTC) */
export function fromSerial(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

/**
 * TH_DATE — parse date from Sheets (serial number or string),
 * fix Buddhist-era corruption:
 *  - year >= 2500        → typed full BE year   → -543
 *  - year in 1955..1980  → typed 2-digit BE year, parsed as 19xx → +57
 * Valid business range: 2015..2035, otherwise flag needs_review.
 */
export function thDate(v: unknown): Norm<Date> {
  if (v === null || v === undefined || v === '') return none();
  let d: Date | null = null;

  if (typeof v === 'number' && isFinite(v) && v > 1000) {
    d = fromSerial(v);
  } else if (v instanceof Date) {
    d = v;
  } else {
    const s = String(v).trim();
    if (!s || s === '-') return none();
    // dd/mm/yyyy or dd-mm-yyyy (Thai convention: day first), optional time "d/m/yyyy, HH:mm[:ss]"
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      let year = parseInt(m[3], 10);
      if (year < 100) year += year > 40 ? 2500 - 100 + 43 : 2000;
      d = new Date(Date.UTC(
        year, parseInt(m[2], 10) - 1, parseInt(m[1], 10),
        m[4] ? parseInt(m[4], 10) : 0, m[5] ? parseInt(m[5], 10) : 0, m[6] ? parseInt(m[6], 10) : 0,
      ));
    } else {
      const t = Date.parse(s);
      if (!isNaN(t)) d = new Date(t);
    }
  }
  if (!d || isNaN(d.getTime())) return none('date_unparseable');

  const flags: string[] = [];
  let y = d.getUTCFullYear();
  if (y >= 2500) {
    d = new Date(Date.UTC(y - 543, d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()));
    flags.push('be_year_fixed');
  } else if (y >= 1955 && y <= 1980) {
    d = new Date(Date.UTC(y + 57, d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()));
    flags.push('be_year_fixed');
  }
  y = d.getUTCFullYear();
  if (y < 2015 || y > 2035) flags.push('needs_review');
  return { value: d, flags };
}

/**
 * PHONE — normalize Thai phone number to E.164 (+66…)
 * Handles: lost leading zero (Sheets stored as number), spaces/dashes, 66 prefix.
 */
export function phone(v: unknown): Norm<string> {
  const s = cleanText(v);
  if (!s) return none();
  let digits = s.replace(/[^\d]/g, '');
  if (!digits) return none('phone_invalid');
  if (digits.startsWith('66') && digits.length >= 10) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  // now expect 8-9 digits (mobile 9: 8x/9x/6x, landline 8)
  if (digits.length === 9 || digits.length === 8) {
    return ok(`+66${digits}`, ...(s.match(/^\d{8,9}$/) ? ['phone_leading_zero_restored'] : []));
  }
  return ok(s, 'phone_invalid');
}

/** SKU — upper(trim), collapse spaces */
export function sku(v: unknown): Norm<string> {
  const s = cleanText(v);
  if (!s) return none();
  return ok(s.toUpperCase().replace(/\s+/g, ' '));
}

export type ProblemGroup =
  | 'claim'
  | 'review'
  | 'usage_issue'
  | 'after_sales'
  | 'exchange_return'
  | 'other';

/** PGROUP — map raw Thai problem-group values to enum */
export function pgroup(v: unknown): Norm<ProblemGroup> {
  const s = cleanText(v);
  if (!s) return ok('other', 'pgroup_missing');
  if (/เคลม/.test(s)) return ok('claim');
  if (/รีวิว/.test(s)) return ok('review');
  if (/แจ้งปัญหา/.test(s)) return ok('usage_issue');
  if (/บริการหลังการขาย/.test(s)) return ok('after_sales');
  if (/เปลี่ยน|คืนสินค้า/.test(s)) return ok('exchange_return');
  return ok('other', 'pgroup_unmapped');
}

/** BOOL — TRUE/FALSE (Sheets checkbox) + Thai variants */
export function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = cleanText(v);
  if (!s) return false;
  return /^(true|1|ใช่|yes|✓|y)$/i.test(s);
}

/** Numeric score within range, else null */
export function score(v: unknown, min: number, max: number): Norm<number> {
  if (v === null || v === undefined || v === '') return none();
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  if (isNaN(n)) return none('score_unparseable');
  if (n < min || n > max) return none('score_out_of_range');
  return ok(Math.round(n));
}

/** Money — numeric, strip currency text */
export function money(v: unknown): Norm<number> {
  if (v === null || v === undefined || v === '') return none();
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? none('money_unparseable') : ok(n);
}

/** Case code — must match GV\d+ */
export function caseCode(v: unknown): Norm<string> {
  const s = cleanText(v);
  if (!s) return none('case_code_missing');
  const m = s.toUpperCase().match(/^GV\s*(\d+)/);
  if (!m) return none('case_code_invalid');
  return ok(`GV${m[1]}`);
}
