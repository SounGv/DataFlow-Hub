/**
 * Google Sheets client — LINK-SHARE MODE (no Google Cloud / service account needed).
 *
 * Requires the spreadsheet shared as "Anyone with the link → Viewer".
 * Reads each sheet via the public gviz CSV export:
 *   https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:csv&sheet={name}
 *
 * Values arrive as displayed strings (dates as d/m/yyyy etc.) —
 * normalizers.thDate/parseBool/score handle string forms.
 */
export class SheetsClient {
  /**
   * Returns all rows of a sheet as a 2D array (string | null cells).
   * อ่านแบบแบ่งหน้า (limit/offset) — gviz ตัด response ใหญ่ (~13k แถวของชีตหลัก)
   */
  async readSheet(spreadsheetId: string, sheetName: string): Promise<unknown[][]> {
    const pageSize = 3000;
    const all: unknown[][] = [];
    for (let offset = 0; ; offset += pageSize) {
      const tq = encodeURIComponent(`select * limit ${pageSize} offset ${offset}`);
      const url =
        `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}` +
        `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&headers=0&tq=${tq}`;
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        throw new Error(
          `อ่านชีต "${sheetName}" ไม่ได้ (HTTP ${res.status}) — ตรวจว่าแชร์สเปรดชีตเป็น "ทุกคนที่มีลิงก์ (Viewer)" และ SPREADSHEET_ID ถูกต้อง`,
        );
      }
      const text = await res.text();
      if (text.trimStart().startsWith('<')) {
        throw new Error(
          `ชีต "${sheetName}" ยังไม่เปิดแชร์แบบลิงก์ — เปิด Google Sheets → Share → General access → "Anyone with the link" (Viewer)`,
        );
      }
      const page = parseCsv(text);
      all.push(...page);
      if (page.length < pageSize) break;
    }
    return all;
  }

  /** Map header row → column index, matched by normalized header text. */
  static headerIndex(headerRow: unknown[]): Map<string, number> {
    const map = new Map<string, number>();
    headerRow.forEach((h, i) => {
      const key = String(h ?? '').replace(/\s+/g, ' ').trim();
      if (key && !map.has(key)) map.set(key, i);
    });
    return map;
  }

  /** Find column index whose header contains the given substring. */
  static findCol(headers: Map<string, number>, ...needles: string[]): number {
    for (const needle of needles) {
      for (const [k, i] of headers) {
        if (k.includes(needle)) return i;
      }
    }
    return -1;
  }
}

/**
 * RFC4180-style CSV parser — handles quoted cells containing commas,
 * double quotes ("") and newlines (คอลัมน์ปัญหา/ที่อยู่มีขึ้นบรรทัดใหม่).
 */
export function parseCsv(text: string): (string | null)[][] {
  const rows: (string | null)[][] = [];
  let row: (string | null)[] = [];
  let cell = '';
  let inQuotes = false;
  let hasCell = false;

  const pushCell = () => {
    row.push(hasCell && cell !== '' ? cell : cell === '' ? (hasCell ? '' : null) : cell);
    cell = '';
    hasCell = false;
  };
  const pushRow = () => {
    pushCell();
    // เก็บแถวว่างไว้ด้วย — จำเป็นต่อการนับหน้า (pagination); processors ข้ามแถวว่างเองอยู่แล้ว
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
      hasCell = true;
    } else if (ch === ',') {
      pushCell();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch === '\r') {
      // ignore (handles \r\n)
    } else {
      cell += ch;
      hasCell = true;
    }
  }
  if (hasCell || cell !== '' || row.length > 0) pushRow();
  return rows;
}
