import { Brand } from '@prisma/client';
import { SheetsClient } from '../sheets.client';
import { cleanText, parseBool, phone, score, thDate } from '../normalize/normalizers';
import { ProductResolver, ShopResolver } from './helpers';
import { ProcessResult, SheetProcessor } from './types';

const empty = (): ProcessResult => ({ read: 0, upserted: 0, rejected: 0, errors: [] });
const isBlank = (row: unknown[]) => !row || row.every((c) => c === null || c === undefined || c === '');

/** SMS — inbound tracking log; matched to cases later by phone (not tracking). */
export const smsProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  for (let i = 1; i < rows.length; i++) {
    if (isBlank(rows[i])) continue;
    r.read++;
    const trackingNo = cleanText(rows[i][0]);
    const msisdn = phone(rows[i][1]).value;
    if (!trackingNo || trackingNo === 'TEST') { r.rejected++; continue; }
    try {
      await prisma.smsLog.upsert({
        where: { trackingNo_msisdn: { trackingNo, msisdn: msisdn ?? '' } },
        create: { trackingNo, msisdn },
        update: {},
      });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: rows[i], reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};

/** แจ้งปัญหาการใช้งานสินค้า → usage_issues */
export const usageIssuesProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  if (rows.length < 2) return r;
  const h = SheetsClient.headerIndex(rows[0]);
  const f = (...n: string[]) => SheetsClient.findCol(h, ...n);
  const scoreCols = [...h.entries()].filter(([k]) => k.startsWith('คะแนน 1-10')).map(([, i]) => i);
  const col = {
    shop: f('ชื่อร้าน'), name: f('ชื่อลูกค้า'), order: f('เลขที่คำสั่งซื้อ'),
    product: f('รุ่นสินค้า'), problem: f('ปัญหา'), solution: f('วิธีการแก้ไข'),
    resolved: f('วันเวลาที่แก้ไข'), sat5: f('รบกวนเวลา'), fuResult: f('ติดตามผลการใช้งาน'),
    fuDate: f('วันที่ติดตาม'),
  };
  const shops = await ShopResolver.load(prisma);
  const products = new ProductResolver(prisma);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    try {
      const reportedAt = thDate(row[0]).value;
      const p = await products.resolve(row[col.product]);
      // no natural key in source → upsert by sourceRow (sheet is append-only)
      const data = {
        reportedAt,
        shopId: shops.resolve(row[col.shop]),
        customerName: cleanText(row[col.name]),
        orderNo: cleanText(row[col.order]),
        productId: p.id,
        productRaw: p.raw,
        problem: cleanText(row[col.problem]),
        solution: cleanText(row[col.solution]),
        resolvedTimeRaw: cleanText(row[col.resolved]),
        scoreInitial: scoreCols[0] !== undefined ? score(row[scoreCols[0]], 0, 10).value : null,
        satisfaction5: score(row[col.sat5], 0, 5).value,
        followupResult: cleanText(row[col.fuResult]),
        scoreFollowup: scoreCols[1] !== undefined ? score(row[scoreCols[1]], 0, 10).value : null,
        followupDate: thDate(row[col.fuDate]).value,
        sourceRow: i + 1,
      };
      const existing = await prisma.usageIssue.findFirst({ where: { sourceRow: i + 1 } });
      if (existing) await prisma.usageIssue.update({ where: { id: existing.id }, data });
      else await prisma.usageIssue.create({ data });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: row.slice(0, 8), reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};

/** แชท → chat_daily_metrics (real header is row 2; skip 2 rows) */
export const chatDailyProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  const shops = await ShopResolver.load(prisma);
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    const metricDate = thDate(row[0]).value;
    const shopId = shops.resolve(row[1]);
    if (!metricDate || !shopId) { r.rejected++; continue; }
    const n = (v: unknown) => (typeof v === 'number' ? Math.round(v) : parseInt(String(v ?? '0'), 10) || 0);
    try {
      await prisma.chatDailyMetric.upsert({
        where: { metricDate_shopId: { metricDate, shopId } },
        create: {
          metricDate, shopId,
          qOrderPayment: n(row[2]), qProductInfo: n(row[3]),
          qOrderStatus: n(row[4]), qUsageProblem: n(row[5]),
          presaleTotal: n(row[6]), postsaleTotal: n(row[7]),
        },
        update: {
          qOrderPayment: n(row[2]), qProductInfo: n(row[3]),
          qOrderStatus: n(row[4]), qUsageProblem: n(row[5]),
          presaleTotal: n(row[6]), postsaleTotal: n(row[7]),
        },
      });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: row, reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};

/** นับจำนวนแชท → chat_offhour_counts (unpivot: 2-row header, shop × time slot) */
export const chatOffhourProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  if (rows.length < 3) return r;
  const shops = await ShopResolver.load(prisma);
  // Row 0: shop names spanning 2 cols each; Row 1: time slots
  const cols: { idx: number; shopRaw: string; slot: string }[] = [];
  let currentShop = '';
  for (let c = 1; c < rows[0].length; c++) {
    const s = cleanText(rows[0][c]);
    if (s) currentShop = s;
    const slot = cleanText(rows[1]?.[c]);
    if (currentShop && slot && /\d/.test(slot)) cols.push({ idx: c, shopRaw: currentShop, slot });
  }
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    const metricDate = thDate(row[0]).value;
    if (!metricDate) { r.rejected++; continue; }
    for (const c of cols) {
      const shopId = shops.resolve(c.shopRaw);
      const count = typeof row[c.idx] === 'number' ? Math.round(row[c.idx] as number) : parseInt(String(row[c.idx] ?? ''), 10);
      if (!shopId || isNaN(count)) continue;
      try {
        await prisma.chatOffhourCount.upsert({
          where: { metricDate_shopId_timeSlot: { metricDate, shopId, timeSlot: c.slot } },
          create: { metricDate, shopId, timeSlot: c.slot, chatCount: count },
          update: { chatCount: count },
        });
      } catch { /* skip cell */ }
    }
    r.upserted++;
  }
  return r;
};

/** call center → call_center_surveys (2-row header) */
export const callCenterProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  const shops = await ShopResolver.load(prisma);
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    try {
      const surveyDate = thDate(row[1]).value;
      const ph = phone(row[3]).value;
      await prisma.callCenterSurvey.upsert({
        where: { surveyDate_phone: { surveyDate: surveyDate ?? new Date(0), phone: ph ?? '' } },
        create: {
          surveyDate, customerName: cleanText(row[2]), phone: ph,
          shopId: shops.resolve(row[4]), productBrand: cleanText(row[5]),
          q1ProductQuality: cleanText(row[6]), q2AfterSales: cleanText(row[7]), q3Advice: cleanText(row[8]),
          q4Satisfaction: score(row[9], 0, 10).value, q5Recommend: score(row[10], 0, 10).value,
          suggestion: cleanText(row[11]), remark: cleanText(row[12]), contactResult: cleanText(row[13]),
        },
        update: {},
      });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: row.slice(0, 6), reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};

/** เก้าอี้ → chair_claims */
export const chairClaimsProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    try {
      const submittedAt = thDate(row[0]).value;
      const orderNo = cleanText(row[2]);
      await prisma.chairClaim.upsert({
        where: { submittedAt_orderNo: { submittedAt: submittedAt ?? new Date(0), orderNo: orderNo ?? '' } },
        create: {
          submittedAt, model: cleanText(row[1]), orderNo, serialNo: cleanText(row[3]),
          fantechTracking: cleanText(row[4]), brokenPart: cleanText(row[5]),
          symptom: cleanText(row[6]), photoUrl: cleanText(row[7]),
        },
        update: {},
      });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: row, reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};

/** ขออะไหล่เก้าอี้ → spare_part_requests */
export const sparePartsProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    try {
      const requestDate = thDate(row[0]).value;
      const gvSerialNo = cleanText(row[3]);
      const partName = cleanText(row[6]);
      const photoUrls = row.slice(7, 14).map(cleanText).filter((x): x is string => !!x);
      await prisma.sparePartRequest.upsert({
        where: { requestDate_gvSerialNo_partName: { requestDate: requestDate ?? new Date(0), gvSerialNo: gvSerialNo ?? '', partName: partName ?? '' } },
        create: {
          requestDate, model: cleanText(row[1]), serialNo: cleanText(row[2]), gvSerialNo,
          buyDate: thDate(row[4]).value, sellDate: thDate(row[5]).value, partName, photoUrls,
        },
        update: { photoUrls },
      });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: row, reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};

/** CN → credit_notes */
export const creditNotesProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  const shops = await ShopResolver.load(prisma);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    const cnNo = cleanText(row[3]);
    if (!cnNo) { r.rejected++; continue; }
    try {
      await prisma.creditNote.upsert({
        where: { cnNo },
        create: {
          cnDate: thDate(row[0]).value, shopId: shops.resolve(row[1]),
          orderNo: cleanText(row[2]), cnNo, productRaw: cleanText(row[4]), note: cleanText(row[5]),
        },
        update: { note: cleanText(row[5]) },
      });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: row, reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};

/** ติดตามลูกค้าก่อนการขาย → presale_followups */
export const presaleProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  const brandOf = (v: unknown): Brand | null => {
    const s = cleanText(v)?.toLowerCase();
    if (!s) return null;
    if (s.includes('fantech')) return 'fantech';
    if (s.includes('ugreen')) return 'ugreen';
    if (s.includes('philips')) return 'philips';
    if (s.includes('gadget') || s.includes('gv')) return 'gadget_villa';
    return 'other';
  };
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    try {
      const submittedAt = thDate(row[0]).value;
      const model = cleanText(row[3]);
      await prisma.presaleFollowup.upsert({
        where: { submittedAt_model: { submittedAt: submittedAt ?? new Date(0), model: model ?? '' } },
        create: {
          submittedAt,
          purchased: cleanText(row[1]) ? !/ไม่/.test(String(row[1])) : null,
          brand: brandOf(row[2]), model, noPurchaseReason: cleanText(row[4]),
        },
        update: {},
      });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: row, reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};

/** FAQ sheets → faq_entries (brand passed via closure) */
export const faqProcessor = (brand: Brand | null, hasSkuCol: boolean): SheetProcessor =>
  async (rows, { prisma, sourceSheet }) => {
    const r = empty();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (isBlank(row)) continue;
      r.read++;
      const skuVal = hasSkuCol ? cleanText(row[0]) : null;
      const question = cleanText(hasSkuCol ? row[1] : row[0]);
      const answer = cleanText(hasSkuCol ? row[2] : row[1]);
      // skip repeated header row inside data
      if (!question || question === 'คำถามที่พบบ่อย' || question === 'หัวข้อ คำถาม') { r.rejected++; continue; }
      try {
        await prisma.faqEntry.upsert({
          where: { brand_sku_question: { brand: brand ?? 'other', sku: skuVal ?? '', question } },
          create: { brand, sku: skuVal, question, answer, manualUrl: hasSkuCol ? cleanText(row[3]) : null, sourceSheet },
          update: { answer },
        });
        r.upserted++;
      } catch (e) {
        r.rejected++;
        r.errors.push({ sourceRow: i + 1, rawData: row, reason: (e as Error).message.slice(0, 300) });
      }
    }
    return r;
  };

/** ช่วง → review_group_lookup */
export const reviewGroupProcessor: SheetProcessor = async (rows, { prisma }) => {
  const r = empty();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlank(row)) continue;
    r.read++;
    const reviewGroup = cleanText(row[0]);
    if (!reviewGroup) { r.rejected++; continue; }
    try {
      await prisma.reviewGroupLookup.upsert({
        where: { reviewGroup },
        create: { reviewGroup, meaning: cleanText(row[1]) },
        update: { meaning: cleanText(row[1]) },
      });
      r.upserted++;
    } catch (e) {
      r.rejected++;
      r.errors.push({ sourceRow: i + 1, rawData: row, reason: (e as Error).message.slice(0, 300) });
    }
  }
  return r;
};
