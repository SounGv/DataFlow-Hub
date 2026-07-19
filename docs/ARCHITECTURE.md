# ARCHITECTURE — DATAFLOW HUB (Phase 1)

## System Overview

```
Google Sheets (Source of Truth)
   │  Google Sheets API (service account, read-only)
   ▼
Sync Engine (Background Worker + Queue)      ← Phase 2
   ├─ Extract   : อ่านตาม data_sources config
   ├─ Normalize : TH_DATE / PHONE / SHOP / SKU / PGROUP (ดู DATA_MAPPING.md)
   ├─ Validate  : reject rows → sync_row_errors
   └─ Upsert    : natural key ต่อตาราง (case_code, cn_no, date+shop, ...)
   ▼
PostgreSQL (normalized schema — ดู DATABASE_SCHEMA.md)
   ▼
Analytics API (REST + SSE sync status)       ← Phase 2
   ▼
Dashboard (Overview / Analytics / After-sales / ... / Print Center)  ← Phase 3
```

## หลักการ
1. **Google Sheets = Source of Truth** — DB เป็น read model; ไม่เขียนกลับ Sheets; sync ทางเดียว
2. **Idempotent upsert** — sync ซ้ำได้โดยไม่เกิดข้อมูลซ้ำ (unique natural keys)
3. **ไม่ทิ้งข้อมูล** — แถวที่ผิดเก็บลง `sync_row_errors` (raw JSONB); ค่าที่ map ไม่ได้เก็บ `*_raw` + `data_quality_flags`
4. **Traceability** — ทุก record มี `source_sheet`, `source_row`, sync run id
5. **Derived data ไม่ sync** — KPI/report sheets คำนวณจาก DB (materialized views refresh หลัง sync)

## Sheet Classification (ผลวิเคราะห์ 31 sheets)

| กลุ่ม | Sheets | การจัดการ |
|---|---|---|
| Transaction | บริการหลังการขาย, ส่งก่อน, รีวิว, Data, แจ้งปัญหาการใช้งานสินค้า, เก้าอี้, ขออะไหล่เก้าอี้, CN, ติดตามลูกค้าก่อนการขาย | sync → tables |
| Log/Survey | SMS, call center | sync → tables |
| Metric | แชท, นับจำนวนแชท | sync + unpivot |
| Knowledge | FAQ, คำถามพบบ่อย ×2, ช่วง | sync → faq/lookup |
| Derived | KPI, ReportWeekly, Report Month, ข้อมูลรายเดือน | ไม่ sync — คำนวณใหม่ |
| Template | ปริ้น ×2, ใบแปะ ×2, สำเนาของ ×3 | ไม่ sync — Print Center (Phase 3) |
| ขยะ | ชีต31, ชีต20_conflict… | ข้าม |
| บันทึก | ประชุมทีม SV | optional ภายหลัง |

## Sync Strategy (ข้อเสนอสำหรับ Phase 2)
- Full-sheet read ต่อรอบ (ข้อมูล ~40k แถวรวม — อ่านทั้งชีตเร็วกว่าจับ delta และกัน edit ย้อนหลัง)
- ตารางใหญ่ (`บริการหลังการขาย`) sync ทุก 5–15 นาที; ตารางเล็ก/FAQ ทุกชั่วโมง — config ต่อ data_source
- Batch upsert เป็น chunk (1,000 แถว) ใน transaction ต่อ sheet
- หลัง sync สำเร็จ → refresh materialized views → push SSE event ไป Sync Monitor

## Tech Stack ที่ล็อกไว้สำหรับ Phase 2 (ตาม spec)
Node.js + TypeScript · NestJS (module ต่อ domain: cases, chat, kb, sync) · PostgreSQL + Prisma · Redis (BullMQ queue สำหรับ sync jobs) · REST API + SSE

## สิ่งที่ Phase 1 ส่งมอบ
DATA_MAPPING.md · DATABASE_SCHEMA.md · DATA_QUALITY_REPORT.md · DATA_RELATIONSHIPS.md · ARCHITECTURE.md (ไฟล์นี้)
**ยังไม่สร้าง**: Frontend, Dashboard, API, Sync Engine (ตามข้อห้ามใน Phase 1)
