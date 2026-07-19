# DATA_RELATIONSHIPS — DATAFLOW HUB (Phase 1)

## ER Overview

```
shops ──< shop_aliases
shops ──< service_cases >── customers
              │  └── products
              ├──< case_followups
              └──< sms_logs (match ภายหลังด้วยเบอร์โทร)
shops ──< usage_issues >── products
shops ──< chat_daily_metrics
shops ──< chat_offhour_counts
shops ──< call_center_surveys
shops ──< credit_notes
products (brand) ── faq_entries (brand/sku)
service_cases.review_group ─(logical)─ review_group_lookup
data_sources ──< sync_runs ──< sync_row_errors
```

## ความสัมพันธ์ที่พบจากข้อมูลจริง

### 1. 3 sheets เคส = entity เดียวกัน (union ไม่ใช่ join)
`บริการหลังการขาย` (24,659), `ส่งก่อน` (3,954), `รีวิว` (1,486) ใช้ case_code ชุดเดียวกัน (GVxxxx) และคอลัมน์ชุดเดียวกัน
- overlap ส่งก่อน ∩ หลัก = 334/3,580 unique
- overlap รีวิว ∩ หลัก = 115/978 unique
→ ส่วนใหญ่เป็นเคสคนละช่วงเวลา/คนละกลุ่มที่ถูกแยก sheet ออกมา ไม่ใช่ตารางลูก → รวมเป็น `service_cases` เดียว, dedupe ที่ case_code, เก็บ `source_sheet`

### 2. SMS ↔ service_cases: ไม่เชื่อมด้วย tracking
tracking ใน `SMS` ไม่ตรงกับ `Tracking ส่งคืน` แม้แต่รายการเดียว (0/2,424) — SMS เก็บ tracking **ขาลูกค้าส่งของเข้ามา** ส่วน sheet หลักเก็บ **ขาส่งคืน**
→ เชื่อมด้วย `msisdn` ↔ `customers.phone` (fuzzy หลัง normalize เบอร์) ไม่ใช่ tracking

### 3. Customer identity
ไม่มี customer id ในต้นทาง — ระบุตัวตนด้วย `phone (normalized)` + `full_name` เป็น natural key; ลูกค้าเดียวอาจมีหลายเคส (ดู 'เคลม/ครั้งที่ 2') → ตาราง customers แยกเพื่อวิเคราะห์ repeat claims

### 4. Product
`สินค้า` ใน sheet เคส, `รุ่นสินค้า` ใน usage_issues, `Model` ใน chair/spare parts, `SKU` ใน FAQ — ทั้งหมดชี้ products เดียวกัน (หลัง normalize upper/trim) → master `products`

### 5. Shop / Channel
พบ 17 ค่าดิบ → canonical ~11 ร้าน (Lazada/Shopee/Facebook × GV/Ugreen/Fantech + LINE @ + Philips Mall) + ช่องทาง "พัสดุ" (84% ของเคส — ไม่ใช่ร้านขาย, `is_sales_channel=false`)

### 6. Review group
ค่าใน `กลุ่มรีวิว` (sheet หลัก) ตรงกับคอลัมน์แรกของ sheet `ช่วง` → lookup table `review_group_lookup`

### 7. Derived sheets (ไม่มี relationship ต้อง sync)
`KPI`, `ReportWeekly`, `Report Month`, `ข้อมูลรายเดือน` เป็น aggregate ของเคส/แชทรายวัน — Phase 2 สร้างเป็น query/materialized view:
- weekly/monthly cases by problem_group ← service_cases
- chat volume by shop/month ← chat_daily_metrics
- KPI (return rate, ครั้งที่เคลมซ้ำ) ← service_cases + customers

### 8. Lifecycle ของเคสหนึ่งเคส (ตาม boolean/วันที่)
```
รับแจ้ง (case_date) → ได้รับของเสีย (defect_received_date)
  → [option] ส่งสินค้าไปก่อน → ฝ่ายเคลมรับเข้าระบบ
  → ส่งคืนลูกค้า (returned_date + tracking + SMS)
  → ติดตามผล (case_followups: ผลใช้งาน + คะแนน + NPS)
```
