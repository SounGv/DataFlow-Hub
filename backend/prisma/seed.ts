/**
 * Seed: shops + aliases (raw values observed in DATA_QUALITY_REPORT.md),
 * admin user, data_sources sync config for all synced sheets.
 * Run: npm run seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SHOPS: { code: string; name: string; platform?: string; brand?: 'fantech' | 'ugreen' | 'gadget_villa' | 'philips'; isSalesChannel?: boolean; aliases: string[] }[] = [
  { code: 'lazada_gv', name: 'Lazada GV', platform: 'lazada', brand: 'gadget_villa', aliases: ['Lazada GV', 'Lazada Gadget', 'Lz GV'] },
  { code: 'lazada_ugreen', name: 'Lazada Ugreen', platform: 'lazada', brand: 'ugreen', aliases: ['Lazada Ugreen', 'Lazada UG', 'Lz Ug'] },
  { code: 'lazada_fantech', name: 'Lazada Fantech', platform: 'lazada', brand: 'fantech', aliases: ['Lazada Fantech', 'Lz FT'] },
  { code: 'shopee_gv', name: 'Shopee GV', platform: 'shopee', brand: 'gadget_villa', aliases: ['Shopee GV', 'Shopee Gadget', 'Sh GV', 'Shopee UG GV+'] },
  { code: 'shopee_ugreen', name: 'Shopee UG', platform: 'shopee', brand: 'ugreen', aliases: ['Shopee UG', 'shopee UG', 'Shopee Ugreen', 'Sh Ug'] },
  { code: 'shopee_fantech', name: 'Shopee Fantech', platform: 'shopee', brand: 'fantech', aliases: ['Shopee Fantech', 'Sh Ft'] },
  { code: 'line', name: 'LINE @', platform: 'line', aliases: ['LINE @', 'Line', 'LINE'] },
  { code: 'facebook_fantech', name: 'Facebook Fantech', platform: 'facebook', brand: 'fantech', aliases: ['Facebook Fantech'] },
  { code: 'facebook_gv', name: 'Facebook GV', platform: 'facebook', brand: 'gadget_villa', aliases: ['Facebook GV'] },
  { code: 'philips_mall', name: 'Philips Mall', platform: 'lazada', brand: 'philips', aliases: ['Philip Mall', 'Philips Mall', 'Lazada Philips Mall'] },
  { code: 'parcel', name: 'พัสดุ', isSalesChannel: false, aliases: ['พัสดุ'] },
];

// sheet name → processor + target table (docs/ARCHITECTURE.md classification)
const DATA_SOURCES: { sheetName: string; processor: string; targetTable: string; syncOrder: number }[] = [
  { sheetName: 'ช่วง', processor: 'review_groups', targetTable: 'review_group_lookup', syncOrder: 10 },
  { sheetName: 'บริการหลังการขาย', processor: 'service_cases', targetTable: 'service_cases', syncOrder: 20 },
  { sheetName: 'ส่งก่อน', processor: 'service_cases', targetTable: 'service_cases', syncOrder: 21 },
  { sheetName: 'รีวิว', processor: 'service_cases', targetTable: 'service_cases', syncOrder: 22 },
  { sheetName: 'แจ้งปัญหาการใช้งานสินค้า', processor: 'usage_issues', targetTable: 'usage_issues', syncOrder: 30 },
  { sheetName: 'SMS', processor: 'sms_logs', targetTable: 'sms_logs', syncOrder: 40 },
  { sheetName: 'แชท', processor: 'chat_daily', targetTable: 'chat_daily_metrics', syncOrder: 50 },
  { sheetName: 'นับจำนวนแชท', processor: 'chat_offhour', targetTable: 'chat_offhour_counts', syncOrder: 51 },
  { sheetName: 'call center', processor: 'call_center', targetTable: 'call_center_surveys', syncOrder: 60 },
  { sheetName: 'เก้าอี้', processor: 'chair_claims', targetTable: 'chair_claims', syncOrder: 70 },
  { sheetName: 'ขออะไหล่เก้าอี้', processor: 'spare_parts', targetTable: 'spare_part_requests', syncOrder: 71 },
  { sheetName: 'CN', processor: 'credit_notes', targetTable: 'credit_notes', syncOrder: 80 },
  { sheetName: 'ติดตามลูกค้าก่อนการขาย', processor: 'presale', targetTable: 'presale_followups', syncOrder: 90 },
  { sheetName: 'FAQ', processor: 'faq_general', targetTable: 'faq_entries', syncOrder: 100 },
  { sheetName: 'คำถามพบบ่อย  Fantech', processor: 'faq_fantech', targetTable: 'faq_entries', syncOrder: 101 },
  { sheetName: 'คำถามพบบ่อย  Ugreen', processor: 'faq_ugreen', targetTable: 'faq_entries', syncOrder: 102 },
];

async function main() {
  // shops + aliases
  for (const s of SHOPS) {
    const shop = await prisma.shop.upsert({
      where: { code: s.code },
      create: { code: s.code, name: s.name, platform: s.platform, brand: s.brand, isSalesChannel: s.isSalesChannel ?? true },
      update: {},
    });
    for (const alias of s.aliases) {
      await prisma.shopAlias.upsert({
        where: { alias },
        create: { alias, shopId: shop.id },
        update: { shopId: shop.id },
      });
    }
  }

  // admin user
  const email = process.env.ADMIN_EMAIL ?? 'admin@gadgetvilla.co.th';
  const password = process.env.ADMIN_PASSWORD ?? 'changeme123';
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash: await bcrypt.hash(password, 10), displayName: 'Admin', role: 'admin' },
    update: {},
  });

  // data sources
  const spreadsheetId = process.env.SPREADSHEET_ID ?? 'SET_ME';
  for (const d of DATA_SOURCES) {
    await prisma.dataSource.upsert({
      where: { spreadsheetId_sheetName: { spreadsheetId, sheetName: d.sheetName } },
      create: { spreadsheetId, ...d },
      update: { processor: d.processor, targetTable: d.targetTable, syncOrder: d.syncOrder },
    });
  }

  console.log(`Seeded ${SHOPS.length} shops, ${DATA_SOURCES.length} data sources, admin: ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
