import { CaseStatus, Prisma } from '@prisma/client';
import { SheetsClient } from '../sheets.client';
import {
  caseCode, cleanText, money, parseBool, pgroup, phone, score, thDate,
} from '../normalize/normalizers';
import { CustomerResolver, ProductResolver, ShopResolver } from './helpers';
import { ProcessorContext, ProcessResult, SheetProcessor } from './types';

/**
 * Processor for the 3 case sheets (บริการหลังการขาย / ส่งก่อน / รีวิว).
 * - Maps columns BY HEADER NAME (sheets differ in column order — see DATA_MAPPING.md §2)
 * - Sheet "รีวิว" has a broken header row → falls back to the canonical header layout
 * - Upserts by case_code; rows without a valid GV code are rejected
 * - Creates case_followups when any follow-up column has data
 */
export const serviceCasesProcessor: SheetProcessor = async (rows, ctx): Promise<ProcessResult> => {
  const { prisma, sourceSheet } = ctx;
  const result: ProcessResult = { read: 0, upserted: 0, rejected: 0, errors: [] };
  if (rows.length < 2) return result;

  const headers = SheetsClient.headerIndex(rows[0]);
  const f = (...n: string[]) => SheetsClient.findCol(headers, ...n);

  // Canonical fallback for sheet "รีวิว" (broken header) — main-sheet column order
  const broken = f('วันที่') === -1;
  const col = {
    caseCode: 0,
    date: broken ? 1 : f('วันที่'),
    shop: broken ? 2 : f('ร้าน'),
    chatName: broken ? 3 : f('ชื่อแชทลูกค้า'),
    custName: broken ? 4 : f('ชื่อลูกค้า'),
    phone: broken ? 5 : f('เบอร์โทร'),
    address: broken ? 6 : f('ที่อยู่ส่งคืนลูกค้า'),
    orderNo: broken ? 7 : f('เลขที่ ออเดอร์', 'เลขที่ออเดอร์'),
    product: broken ? 8 : f('สินค้า'),
    serial: broken ? -1 : f('Serial'),
    pgroup: broken ? 9 : f('กลุ่มของปัญหา'),
    problem: broken ? 10 : f('ปัญหา'),
    solution: broken ? 11 : f('วิธีแก้ไข'),
    reviewGroup: broken ? 12 : f('กลุ่มรีวิว'),
    defectDate: broken ? 13 : f('วันที่ได้รับสินค้าเสีย'),
    defectRecv: broken ? 14 : f('ได้รับของเสียจากลูกค้า'),
    sentFirst: broken ? 15 : f('ส่งสินค้าไปก่อน'),
    claimRecv: broken ? 16 : f('ฝ่ายเคลมรับสินค้าเข้าระบบ'),
    returnedDate: broken ? 17 : f('วันที่ส่งสินค้าเคลมคืนลูกค้า', 'วันที่ส่งสินค้าเคลมคืนลูก'),
    returned: broken ? 18 : f('ส่งสินค้าคืนลูกค้า'),
    tracking: broken ? 19 : f('Tracking ส่งคืน'),
    sms: broken ? 20 : f('SMS'),
    shipCost: broken ? 21 : f('ค่าขนส่ง'),
    fuDate: broken ? 22 : f('วันที่ติดตามลูกค้า'),
    fuResult: broken ? 23 : f('1) ผลการการติดตาม', 'ผลการการติดตาม'),
    fuQuality: broken ? 24 : f('1.คุณภาพสินค้า'),
    fuService: broken ? 25 : f('2. การให้บริการหลังการขาย'),
    fuAdvice: broken ? 26 : f('3. การให้คำแนะนำ'),
    sat5: broken ? 27 : f('0 ถึง 5'),
    sat10: broken ? 28 : f('0 ถึง 10'),
    prod10: broken ? 29 : f('3) ระดับความพอใจในสินค้า'),
    nps: broken ? -1 : f('คุณจะแนะนำเรา'),
    feedback: broken ? 30 : f('4) ข้อเสนอแนะ'),
  };
  const cell = (row: unknown[], i: number) => (i >= 0 && i < row.length ? row[i] : null);

  const shopResolver = await ShopResolver.load(prisma);
  const productResolver = new ProductResolver(prisma);
  const customerResolver = new CustomerResolver(prisma);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;
    result.read++;

    const code = caseCode(cell(row, col.caseCode));
    if (!code.value) {
      result.rejected++;
      result.errors.push({ sourceRow: r + 1, rawData: row.slice(0, 12), reason: code.flags.join(',') || 'invalid_case_code' });
      continue;
    }

    const flags = new Set<string>();
    const track = (n: { flags: string[] }) => n.flags.forEach((x) => flags.add(x));

    const caseDate = thDate(cell(row, col.date)); track(caseDate);
    const defectDate = thDate(cell(row, col.defectDate)); track(defectDate);
    const returnedDate = thDate(cell(row, col.returnedDate)); track(returnedDate);
    const ph = phone(cell(row, col.phone)); track(ph);
    const pg = pgroup(cell(row, col.pgroup)); track(pg);
    const cost = money(cell(row, col.shipCost)); track(cost);

    const shopId = shopResolver.resolve(cell(row, col.shop));
    if (cell(row, col.shop) && !shopId) flags.add('shop_unmapped');
    const { id: productId, raw: productRaw } = await productResolver.resolve(cell(row, col.product));
    const customerId = await customerResolver.resolve({
      fullName: cleanText(cell(row, col.custName)),
      chatName: cleanText(cell(row, col.chatName)),
      phone: ph.value,
      address: cleanText(cell(row, col.address)),
    });

    const returned = parseBool(cell(row, col.returned));
    const claimRecv = parseBool(cell(row, col.claimRecv));
    const defectRecv = parseBool(cell(row, col.defectRecv));
    const fuDate = thDate(cell(row, col.fuDate)); track(fuDate);

    const status: CaseStatus = fuDate.value
      ? 'closed'
      : returned
        ? 'returned'
        : claimRecv
          ? 'in_repair'
          : defectRecv
            ? 'received'
            : 'open';

    const data = {
      caseDate: caseDate.value,
      shopId,
      customerId,
      orderNo: cleanText(cell(row, col.orderNo)),
      productId,
      productRaw,
      serialNo: cleanText(cell(row, col.serial)),
      problemGroup: pg.value ?? 'other',
      problem: cleanText(cell(row, col.problem)),
      solution: cleanText(cell(row, col.solution)),
      reviewGroup: cleanText(cell(row, col.reviewGroup)),
      status,
      defectReceived: defectRecv,
      defectReceivedDate: defectDate.value,
      sentReplacementFirst: parseBool(cell(row, col.sentFirst)),
      claimDeptReceived: claimRecv,
      returnedToCustomer: returned,
      returnedDate: returnedDate.value,
      returnTrackingNo: cleanText(cell(row, col.tracking)),
      smsNotified: parseBool(cell(row, col.sms)) || !!cleanText(cell(row, col.sms)),
      shippingCost: cost.value !== null ? new Prisma.Decimal(cost.value) : null,
      sourceRow: r + 1,
      dataQualityFlags: [...flags],
    };

    try {
      // Dedupe rule (DATA_RELATIONSHIPS.md §1): keep the more complete row.
      const existing = await prisma.serviceCase.findUnique({ where: { caseCode: code.value } });
      const filled = (o: object) => Object.values(o).filter((v) => v !== null && v !== false).length;
      let saved;
      if (existing && existing.sourceSheet !== sourceSheet && filled(existing) >= filled(data)) {
        saved = existing; // existing row is more complete → keep, still counts as processed
      } else {
        saved = await prisma.serviceCase.upsert({
          where: { caseCode: code.value },
          create: { caseCode: code.value, sourceSheet, ...data },
          update: { sourceSheet, ...data },
        });
      }

      // Follow-up row when any follow-up field present
      const fu = {
        followupDate: fuDate.value,
        usageResult: cleanText(cell(row, col.fuResult)),
        productQualityNote: cleanText(cell(row, col.fuQuality)),
        serviceNote: cleanText(cell(row, col.fuService)),
        adviceNote: cleanText(cell(row, col.fuAdvice)),
        satisfaction5: score(cell(row, col.sat5), 0, 5).value,
        satisfaction10: score(cell(row, col.sat10), 0, 10).value,
        productScore10: score(cell(row, col.prod10), 0, 10).value,
        npsScore: score(cell(row, col.nps), 0, 10).value,
        feedback: cleanText(cell(row, col.feedback)),
      };
      if (Object.values(fu).some((v) => v !== null)) {
        await prisma.caseFollowup.deleteMany({ where: { caseId: saved.id } });
        await prisma.caseFollowup.create({ data: { caseId: saved.id, ...fu } });
      }
      result.upserted++;
    } catch (e) {
      result.rejected++;
      result.errors.push({ sourceRow: r + 1, rawData: row.slice(0, 12), reason: (e as Error).message.slice(0, 500) });
    }
  }
  return result;
};
