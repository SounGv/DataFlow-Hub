# PROJECT_ANALYSIS — DATAFLOW HUB (PHASE 0)

วันที่วิเคราะห์: 2026-07-20 · เวอร์ชันที่วิเคราะห์: commit ล่าสุดบน `main` (SounGv/DataFlow-Hub)
Production: หน้าเว็บ https://aesthetic-lollipop-1bb8ed.netlify.app · API https://dataflow-hub-api.onrender.com

---

## 1. CURRENT ARCHITECTURE

```
Google Sheets (1 spreadsheet, 16 sheets ที่ sync)   ← Source of Truth
   │  gviz CSV export (link-share mode, ไม่ใช้ Google API key)
   │  อ่านแบบแบ่งหน้า limit/offset ป้องกันโดนตัด response
   ▼
Sync Engine — BullMQ worker (รันใน process เดียวกับ API เพราะ Render free tier)
   ├─ Normalizers: TH_DATE (แก้ปี พ.ศ./ค.ศ.), PHONE (+66), SHOP alias, SKU, PGROUP, BOOL
   ├─ Processors ต่อชีต 14 ตัว (registry pattern)
   ├─ Upsert idempotent ด้วย natural key (case_code / cn_no / date+shop / ...)
   └─ Log: sync_runs + sync_row_errors (raw JSON ของแถวที่ reject)
   ▼
PostgreSQL 18 (Render free) — Prisma ORM, 22 ตาราง
   ▼
NestJS REST API (+ SSE /sync/stream ผ่าน Redis pub/sub)
   ▼
React SPA (Vite + Tailwind + TanStack Query + Recharts) บน Netlify
```

**Deployment:** GitHub `main` → auto deploy ทั้ง Netlify (frontend) และ Render Blueprint (api + postgres + redis/valkey)
**Trigger sync:** ตอน boot + ทุก 15 นาที (cron ใน worker) + ปุ่ม manual ใน Sync Monitor

### โครงสร้าง Folder
```
DataFlow Hub/
├── docs/            Phase 1 design docs (DATA_MAPPING, DATABASE_SCHEMA, DATA_QUALITY_REPORT, ...)
├── backend/src/
│   ├── auth/        JWT login/logout + guard (มี AUTH_DISABLED bypass)
│   ├── cases/       service cases API (server-side pagination/filter/search)
│   ├── analytics/   overview KPI, trends, top-products, by-shop, chat-volume, repeat-claims
│   ├── operations/  usage-issues, chat-metrics, faq, shops, products, spare-parts, chair-claims
│   ├── search/      global search + customer profile + audit logs
│   ├── sync/        sheets client, normalizers(+25 unit tests), processors, worker, SSE
│   └── prisma/, common/, health.controller.ts
├── frontend/src/
│   ├── api/         client (fetch+JWT+error), types
│   ├── components/  Layout(nav+global search+LIVE), DataTable, DateRange, ui(KpiCard/Badge/states)
│   └── pages/       16 หน้า (ดูข้อ 2)
├── render.yaml      Render Blueprint (api+db+redis+env)
└── netlify.toml     build config + SPA redirect
```

---

## 2. CURRENT FEATURES (หน้าที่มีอยู่แล้ว)

| Route | สถานะ | หมายเหตุ |
|---|---|---|
| /overview | ✅ ใช้งานได้ | KPI 8 ใบ + After-sales Trend + Chat Trend, date filter เฉพาะหน้านี้ |
| /analytics | ✅ | สัดส่วนกลุ่มปัญหา (donut), Top Products (bar), เคสตามช่องทาง |
| /customer-chat | ✅ | KPI 6 + chat trend รายวัน + ตารางรายวัน (filter channel) |
| /sales | ⚠️ บางส่วน | มีแค่ conversion proxy จากแชทก่อน/หลังขาย — **ไม่มีข้อมูลยอดขายจริงใน Sheets** แสดง Empty State อธิบายชัด |
| /after-sales | ✅ | ตาราง server-side pagination + filters + Case Detail drawer พร้อม Timeline |
| /shipments | ✅ | เคสที่ส่งคืนแล้ว + tracking + ค้นหา |
| /customer-voice | ✅ | เคสรีวิว + คะแนนพึงพอใจ/NPS เฉลี่ย |
| /product-service | ✅ | top products, แจ้งปัญหาการใช้งาน, เคลมเก้าอี้ |
| /spare-parts | ✅ | ตารางขออะไหล่ |
| /knowledge-base | ✅ | FAQ accordion + filter แบรนด์ + ค้นหา |
| /data-sources | ⚠️ read-only | แสดง 16 sources + last sync — **ไม่มี CRUD** |
| /sync-monitor | ✅ | ตาราง status + Live Events (SSE) + ปุ่ม sync ทั้งหมด/รายชีต |
| /audit-logs | ✅ | login/logout events |
| /settings | ⚠️ minimal | แสดง user ปัจจุบัน (auth ปิดอยู่ → guest) |
| /print-center | ✅ | ค้นหาลูกค้า → เลือกเคส → preview ใบแปะหน้า → print |
| /customers/:id | ✅ | Customer Profile + timeline เคส |
| /login | ✅ (ไม่ใช้) | AUTH_DISABLED=true อยู่ — เข้าได้โดยไม่ login |

**Global Search** (header): ชื่อ/เบอร์/order/tracking/serial/SKU — partial, ignore space/hyphen ✅
**🟢 LIVE indicator + Last updated** ใน header ✅ (SSE)

### Components ที่ใช้ซ้ำได้ (สำคัญ — ห้ามลบ)
`DataTable` (server-side pagination), `DateRangeFilter`, `KpiCard`, `Badge`+STATUS_LABELS, `Async` (loading/empty/error wrapper), `Skeleton/EmptyState/ErrorState`, `Layout`+`useLiveSync`, `api()`+`qs()` client — ทั้งหมดออกแบบเป็น generic แล้ว รองรับหน้าที่จะเพิ่มใหม่ได้ทันที

---

## 3. CURRENT DATA FLOW (ข้อมูลจริง vs Mock vs Hardcode)

### ✅ Real Data ทั้งหมด (จาก Sheets → DB → API)
เคสหลังการขาย (GV/SK/RV/DT codes), followups+คะแนน, แจ้งปัญหาการใช้งาน, SMS logs, chat metrics รายวัน, call center surveys, เคลมเก้าอี้, ขออะไหล่, CN, presale followups, FAQ, review groups, shops+aliases (seed จากผลวิเคราะห์ Phase 1), products (auto-create จาก SKU)

### ❌ ไม่มี Mock Data ใน production
หน้าที่ไม่มีแหล่งข้อมูล (Sales) แสดง Empty State พร้อมคำอธิบาย ไม่แสดงตัวเลขปลอม

### ⚠️ จุด Hardcode ที่พบ (ต้องรู้ไว้)
1. `frontend/src/api/client.ts` — `PROD_API = 'https://dataflow-hub-api.onrender.com'` (ตั้งใจ hardcode หลัง VITE_API_BASE สร้างปัญหาใน Netlify; override ได้ด้วย env)
2. `PrintCenter.tsx` — ชื่อผู้ส่ง default "บริษัท แก็ดเจ็ต วิลล่า จำกัด" (แก้ได้ในฟอร์ม แต่ควรย้ายเป็น setting)
3. `seed.ts` — รายชื่อร้าน/aliases และ mapping ชีต→processor (โดยเจตนา: เป็น config เริ่มต้น แก้ผ่าน DB ได้)
4. `render.yaml` — SPREADSHEET_ID และ CORS_ORIGIN ผูกกับ deployment ปัจจุบัน
5. สเกลคะแนน 0-5/0-10 แยก field ตามโครงชีตจริง (ไม่ใช่ hardcode แต่ผูกกับ format ชีต)

---

## 4. CURRENT PROBLEMS (จากการใช้งานจริงบน production)

### ระดับข้อมูล
- **P1 — ไม่มีข้อมูล Sales/Order/Admin ใน Sheets ชุดปัจจุบัน**: spec ใหม่ต้องการ Sales Value, Closed Sales, Admin Performance, Conversion Funnel — ชีตทั้ง 31 แผ่นไม่มีคอลัมน์ admin และไม่มียอดขาย/ออเดอร์ขาย (มีแต่เคสหลังการขาย) → **ต้องเพิ่ม Google Sheets ใหม่** (เช่น ชีตยอดขายรายวัน, ชีตบันทึกแชทที่มีชื่อแอดมิน) หรือรับข้อมูลจากแพลตฟอร์ม → เป็น blocker หลักของ KPI ครึ่งหนึ่งใน spec
- **P2 — Shipment status มีแค่ 2 สถานะจริง** (ส่งแล้ว/ยังไม่ส่ง จาก boolean ชีต) — spec ต้องการ Pending/Processing/Shipped/Delivered/Returned → ต้องมีแหล่ง tracking status เพิ่ม
- **P3 — Delete detection ยังไม่มี**: sync เป็น upsert-only; แถวที่ถูกลบใน Sheets ยังค้างใน DB (spec ต้องการ New/Updated/Deleted)
- **P4 — นับจำนวนแชท (chat_offhour) reject 100%**: โครง pivot 2 ชั้นของชีตจริงไม่ตรงกับ parser — ต้องแก้ processor
- **P5 — FAQ sheets อ่านได้ 301 แถว/reject 20**: มีแถวว่าง-หัวซ้ำจำนวนมากในชีต → dedupe ทำงานแต่ควรกรองให้สะอาดกว่านี้

### ระดับระบบ
- **P6 — Render free tier หลับหลัง 15 นาที**: ตื่นช้า ~1 นาที + cron sync หยุดตอนหลับ (แก้บางส่วนแล้วด้วย sync-on-boot; ถ้าต้องการ live จริงต้อง keep-alive ping หรือ paid plan) · Postgres ฟรีหมดอายุ ~17 ส.ค. 2026 (30 วันจากวันสร้าง)
- **P7 — Authentication ปิดอยู่** (AUTH_DISABLED=true ตามคำขอผู้ใช้): ข้อมูลลูกค้าเปิดเข้าถึงได้จากลิงก์ — spec ใหม่ต้องการ Auth + RBAC → ต้องเปิดกลับและทำ Role ให้จริง (schema มี admin/staff/viewer แล้ว)
- **P8 — ไม่มี Rate limiting / helmet** — spec Security ต้องการ
- **P9 — Date filter เป็นราย-หน้า ไม่ใช่ Global**: spec ต้องการ filter กลางที่ทุก widget ตามพร้อมกัน
- **P10 — KPI ไม่มี compare vs previous period / sparkline / funnel** — analytics API ยังไม่มี endpoint เปรียบเทียบช่วงเวลา
- **P11 — ไม่มี Report Center / Export (Excel/CSV/PDF)** — ยังไม่ได้สร้างเลย
- **P12 — Data Sources เป็น read-only** — ไม่มี CRUD/mapping editor ตาม spec
- **P13 — SSE ผ่าน query-string token** (ตอน auth เปิด) — ควรย้ายเป็น cookie/short-lived token

### จุดที่ **ไม่ควรลบ/ไม่ควรเขียนทับ**
- Normalizers + unit tests 25 ตัว (กติกา พ.ศ./เบอร์โทร/SKU ผ่านการ verify กับข้อมูลจริง 24k แถว)
- Processor registry + dedupe logic (case GV/SK/RV ข้ามชีต) — แก้ปัญหาจริงที่เจอบน production มาแล้ว
- ตาราง sync_runs/sync_row_errors + SSE pipeline
- โครง DataTable/Async/KpiCard — หน้าใหม่ทั้งหมดควร build บนสิ่งเหล่านี้
- docs/ Phase 1 ทั้ง 5 ไฟล์ (ground truth ของ mapping)

---

## 5. RECOMMENDED ARCHITECTURE

หลักการ: **ต่อยอด ไม่รื้อ** — โครง Sheets→Sync→DB→API→SPA ถูกต้องตาม spec ใหม่อยู่แล้ว สิ่งที่ขาดคือชั้น Analytics ที่ลึกขึ้น + Report/Export + การจัดการ Data Source + ข้อมูลมิติใหม่ (sales/admin)

```
Google Sheets (หลาย spreadsheet ได้ — data_sources รองรับอยู่แล้ว)
   ▼
Data Source Manager  ← เพิ่ม CRUD UI + mapping config ต่อ source (P12)
   ▼
Sync Engine  ← เพิ่ม: content-hash ต่อแถวเพื่อ detect Updated, soft-delete แถวที่หายไป (P3),
   │            แก้ chat_offhour processor (P4)
   ▼
PostgreSQL  ← เพิ่มตาราง: sales_records, admins (เมื่อมีชีตใหม่), report_snapshots,
   │            คอลัมน์ row_hash + deleted_at
   ▼
Analytics Engine (NestJS service ใหม่)
   ├─ period comparison (current vs previous) สำหรับ KPI cards + sparkline series
   ├─ date bucketing (daily/weekly/monthly/yearly) — SQL date_trunc รวมศูนย์
   ├─ funnel (contact → interested → order → closed) เมื่อมีข้อมูล sales
   └─ ranking (admin/product/shop) แบบ parameterized
   ▼
REST API + SSE (เดิม) + เพิ่ม /reports/* + /export/* (xlsx=exceljs, csv=stream, pdf=puppeteer หรือ pdfkit)
   ▼
React SPA
   ├─ GlobalFilterContext (date/admin/channel/product/status) — ทุก widget subscribe (P9)
   ├─ หน้าเดิม 16 หน้า (คง route) + /reports (Report Center)
   └─ chart click-through → drill-down list (spec CHART INTERACTION)
```

**Security track:** เปิด auth กลับ (AUTH_DISABLED=false) + RolesGuard ใช้ enum ที่มีอยู่ + @nestjs/throttler + helmet + เปลี่ยนรหัส admin — ทำเป็น Phase ท้ายตาม spec (PHASE 10)

---

## 6. IMPLEMENTATION PLAN (ตาม Phase ของ spec)

| Phase | งาน | ของเดิมที่ reuse | ของใหม่ | ความเสี่ยง/เงื่อนไข |
|---|---|---|---|---|
| 1. Information Architecture | เพิ่มเมนู Report Center ในกลุ่ม OVERVIEW, ทำ GlobalFilterContext + Global Date Filter ใน header | Layout, DateRangeFilter | FilterContext, header filter bar | ต่ำ |
| 2. Dashboard Visualization | ยกระดับ /overview: KPI + %change + sparkline + Business Trend (เลือก metric, daily/weekly/monthly/yearly) + donut after-sales + recent activity | KpiCard, Async, Recharts | analytics API: /kpi-compare, /trend-bucketed | ต่ำ |
| 3. Analytics | drill-down (คลิกจุดกราฟ → รายการ), ranking sortable, chat new/returning | DataTable | /analytics/drill endpoints | ต่ำ |
| 4. Report Center | /reports: Daily/Monthly/Yearly/Custom + Export xlsx/csv/pdf/print | Async, filters | ReportBuilder UI, /reports API, exceljs/pdf lib | กลาง — PDF บน Render free (memory) ควรใช้ pdfkit ไม่ใช่ puppeteer |
| 5. Data Sources | CRUD UI + เพิ่ม spreadsheet ใหม่ + enable/disable + manual sync ต่อ source | data_sources table, sync API | POST/PATCH/DELETE /sync/sources | ต่ำ |
| 6. Sync Engine | row_hash detect updated, soft-delete missing rows, แก้ chat_offhour, นับ created/updated/deleted แยกใน sync_runs | processors ทั้งหมด | migration เพิ่มคอลัมน์ | กลาง — ต้องระวัง false-delete ตอนชีตโดนตัด/อ่านพลาด → ใช้ threshold |
| 7. Global Search | มีแล้ว — เพิ่ม order/tracking จาก sales เมื่อมีข้อมูล | search.controller | — | ต่ำ |
| 8. Customer Profile | มีแล้ว — เพิ่ม chat history + orders เมื่อมีแหล่งข้อมูล | CustomerProfile | — | ขึ้นกับ P1 |
| 9. Print Center | มีแล้ว — ย้ายชื่อผู้ส่งเป็น setting, เพิ่ม template ใบแปะกล่อง | PrintCenter | settings table | ต่ำ |
| 10. Security | เปิด auth+RBAC, throttler, helmet, เปลี่ยนรหัส, จำกัด CORS (ทำแล้ว) | auth module | RolesGuard, throttler | ต้องตกลง flow login กับทีมก่อน (ตอนนี้ผู้ใช้ขอปิด login อยู่) |
| 11. Testing | unit (normalizers มี 25), เพิ่ม processor tests + e2e API + sync new/update/delete กับชีตทดสอบ | vitest | ชีตทดสอบแยก | ต่ำ |
| 12. Deployment | มี pipeline แล้ว — ตัดสินใจเรื่อง Postgres ฟรีหมดอายุ + keep-alive | render.yaml | UptimeRobot/paid | **ต้องตัดสินใจภายใน ~17 ส.ค.** |

### ⚠️ การตัดสินใจที่ต้องได้จากทีมก่อนเริ่ม (blockers)
1. **แหล่งข้อมูล Sales/Admin (P1)** — จะเพิ่มชีตยอดขาย/ชีตแอดมินไหม? โครงคอลัมน์เป็นอย่างไร? — กระทบ Phase 2,3,4,7,8
2. **Auth (P7)** — spec ต้องการ login+role แต่ทีมเพิ่งขอปิด login → เลือก: เปิดเฉพาะ role admin สำหรับหน้า SYSTEM, หรือเปิดทั้งระบบ?
3. **งบ hosting (P6)** — free tier (หลับ+DB หมดอายุ 30 วัน) vs ~$14/เดือน (ตื่นตลอด+DB ถาวร)

---
**สถานะ: PHASE 0 เสร็จสิ้น — รอคำสั่ง `PROCEED TO PHASE 1`**
