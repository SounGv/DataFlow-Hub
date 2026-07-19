# DATABASE_SCHEMA — DATAFLOW HUB (Phase 1)

Database: **PostgreSQL 15+** · Naming: snake_case · ทุกตารางมี `id BIGSERIAL PK`, `created_at`, `updated_at TIMESTAMPTZ DEFAULT now()`

## ENUMs

```sql
CREATE TYPE problem_group AS ENUM
  ('claim','review','usage_issue','after_sales','exchange_return','other');
CREATE TYPE case_status AS ENUM
  ('open','received','in_repair','returned','followed_up','closed');
CREATE TYPE sync_status AS ENUM ('running','success','partial','failed');
CREATE TYPE brand_enum AS ENUM ('fantech','ugreen','gadget_villa','philips','other');
```

## 1. Master / Reference

```sql
CREATE TABLE shops (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,          -- 'lazada_gv','shopee_gv','line','facebook_fantech','parcel',...
  name TEXT NOT NULL,
  platform TEXT,                      -- lazada|shopee|line|facebook|other
  brand brand_enum,
  is_sales_channel BOOLEAN DEFAULT true   -- 'พัสดุ' = false
);
CREATE TABLE shop_aliases (            -- แก้ปัญหา 'Shopee UG'/'shopee UG'/'พัสดุ '
  id BIGSERIAL PRIMARY KEY,
  alias TEXT UNIQUE NOT NULL,
  shop_id BIGINT NOT NULL REFERENCES shops(id)
);

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,           -- normalize: upper(trim())  e.g. 'MK852'
  name TEXT,
  brand brand_enum,
  category TEXT                       -- keyboard|chair|hub|headset|...
);

CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT,
  chat_name TEXT,
  phone TEXT,                         -- E.164 (+66...)
  address TEXT,
  UNIQUE NULLS NOT DISTINCT (phone, full_name)
);
CREATE INDEX idx_customers_phone ON customers(phone);
```

## 2. Service Cases (รวม บริการหลังการขาย + ส่งก่อน + รีวิว, dedupe ด้วย case_code)

```sql
CREATE TABLE service_cases (
  id BIGSERIAL PRIMARY KEY,
  case_code TEXT UNIQUE,              -- 'GV0004'; NULL ได้ (167 แถว) แต่ unique เมื่อมีค่า
  case_date DATE,
  shop_id BIGINT REFERENCES shops(id),
  customer_id BIGINT REFERENCES customers(id),
  order_no TEXT,
  product_id BIGINT REFERENCES products(id),
  product_raw TEXT,                   -- ค่าดิบก่อน map
  serial_no TEXT,
  problem_group problem_group NOT NULL DEFAULT 'other',
  problem TEXT,
  solution TEXT,
  review_group TEXT,                  -- lookup จาก sheet 'ช่วง'
  status case_status NOT NULL DEFAULT 'open',
  -- ขั้นตอนงานเคลม (boolean + วันที่ ตามคอลัมน์จริง)
  defect_received BOOLEAN DEFAULT false,
  defect_received_date DATE,
  sent_replacement_first BOOLEAN DEFAULT false,   -- 'ส่งสินค้าไปก่อน'
  claim_dept_received BOOLEAN DEFAULT false,
  returned_to_customer BOOLEAN DEFAULT false,
  returned_date DATE,
  return_tracking_no TEXT,
  sms_notified BOOLEAN DEFAULT false,
  shipping_cost NUMERIC(10,2),
  -- lineage
  source_sheet TEXT NOT NULL,         -- 'บริการหลังการขาย'|'ส่งก่อน'|'รีวิว'|'Data'
  source_row INT,
  data_quality_flags TEXT[]           -- ['bad_year_fixed','phone_normalized',...]
);
CREATE INDEX idx_cases_date  ON service_cases(case_date);
CREATE INDEX idx_cases_shop  ON service_cases(shop_id, case_date);
CREATE INDEX idx_cases_group ON service_cases(problem_group, case_date);
CREATE INDEX idx_cases_track ON service_cases(return_tracking_no);
CREATE INDEX idx_cases_customer ON service_cases(customer_id);
```

## 3. Follow-up & ความพึงพอใจ (แยกตาราง — NULL 63–94% ใน sheet)

```sql
CREATE TABLE case_followups (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  followup_date DATE,
  usage_result TEXT,                  -- 1) ผลการติดตามการใช้งาน
  product_quality_note TEXT,          -- 1. คุณภาพสินค้า
  service_note TEXT,                  -- 2. การให้บริการหลังการขาย
  advice_note TEXT,                   -- 3. การให้คำแนะนำ
  satisfaction_5 SMALLINT CHECK (satisfaction_5 BETWEEN 0 AND 5),
  satisfaction_10 SMALLINT CHECK (satisfaction_10 BETWEEN 0 AND 10),
  product_score_10 SMALLINT CHECK (product_score_10 BETWEEN 0 AND 10),
  nps_score SMALLINT CHECK (nps_score BETWEEN 0 AND 10),  -- 'จะแนะนำเพื่อน'
  feedback TEXT
);
CREATE INDEX idx_followups_case ON case_followups(case_id);
```

## 4. Usage Issues (sheet แจ้งปัญหาการใช้งานสินค้า — 7,670 แถว)

```sql
CREATE TABLE usage_issues (
  id BIGSERIAL PRIMARY KEY,
  reported_at TIMESTAMPTZ,
  shop_id BIGINT REFERENCES shops(id),
  customer_name TEXT,
  order_no TEXT,
  product_id BIGINT REFERENCES products(id),
  product_raw TEXT,
  problem TEXT,
  solution TEXT,
  resolved_time_raw TEXT,             -- format ปน '17.09'/'17:50' เก็บดิบ
  score_initial SMALLINT,
  satisfaction_5 SMALLINT CHECK (satisfaction_5 BETWEEN 0 AND 5),
  followup_result TEXT,
  score_followup SMALLINT,
  followup_date DATE,
  source_row INT
);
CREATE INDEX idx_usage_issues_at ON usage_issues(reported_at);
```

## 5. Logs & Operations

```sql
CREATE TABLE sms_logs (               -- sheet SMS: tracking ขาเข้า (ลูกค้าส่งของมา)
  id BIGSERIAL PRIMARY KEY,
  tracking_no TEXT NOT NULL,
  msisdn TEXT,                        -- E.164
  case_id BIGINT REFERENCES service_cases(id)  -- match ภายหลังด้วยเบอร์โทร
);

CREATE TABLE credit_notes (           -- sheet CN
  id BIGSERIAL PRIMARY KEY,
  cn_date DATE, shop_id BIGINT REFERENCES shops(id),
  order_no TEXT, cn_no TEXT UNIQUE, product_raw TEXT, note TEXT
);

CREATE TABLE chair_claims (           -- sheet เก้าอี้ (Google Form)
  id BIGSERIAL PRIMARY KEY,
  submitted_at TIMESTAMPTZ, model TEXT, order_no TEXT, serial_no TEXT,
  fantech_tracking TEXT, broken_part TEXT, symptom TEXT, photo_url TEXT
);

CREATE TABLE spare_part_requests (    -- sheet ขออะไหล่เก้าอี้
  id BIGSERIAL PRIMARY KEY,
  request_date DATE, model TEXT, serial_no TEXT, gv_serial_no TEXT,
  buy_date DATE, sell_date DATE, part_name TEXT, photo_urls TEXT[]
);

CREATE TABLE presale_followups (      -- sheet ติดตามลูกค้าก่อนการขาย
  id BIGSERIAL PRIMARY KEY,
  submitted_at TIMESTAMPTZ, purchased BOOLEAN, brand brand_enum,
  model TEXT, no_purchase_reason TEXT
);

CREATE TABLE call_center_surveys (    -- sheet call center (หัวตาราง 2 ชั้น)
  id BIGSERIAL PRIMARY KEY,
  survey_date DATE, customer_name TEXT, phone TEXT,
  shop_id BIGINT REFERENCES shops(id), product_brand TEXT,
  q1_product_quality TEXT, q2_after_sales TEXT, q3_advice TEXT,
  q4_satisfaction SMALLINT, q5_recommend SMALLINT,
  suggestion TEXT, remark TEXT, contact_result TEXT
);
```

## 6. Chat Metrics (sheets แชท + นับจำนวนแชท — unpivot เป็น long format)

```sql
CREATE TABLE chat_daily_metrics (     -- sheet แชท
  id BIGSERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,
  shop_id BIGINT REFERENCES shops(id),
  q_order_payment INT DEFAULT 0,      -- การสั่งซื้อ-ชำระเงิน
  q_product_info INT DEFAULT 0,       -- ข้อมูลสินค้า/สเปค
  q_order_status INT DEFAULT 0,       -- ตามสถานะ
  q_usage_problem INT DEFAULT 0,      -- ปัญหาการใช้งาน
  presale_total INT DEFAULT 0,        -- ก่อน
  postsale_total INT DEFAULT 0,       -- หลัง
  UNIQUE (metric_date, shop_id)
);

CREATE TABLE chat_offhour_counts (    -- sheet นับจำนวนแชท (unpivot)
  id BIGSERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,
  shop_id BIGINT REFERENCES shops(id),
  time_slot TEXT NOT NULL,            -- '20:00-24:00' | '00:01-09:00'
  chat_count INT DEFAULT 0,
  UNIQUE (metric_date, shop_id, time_slot)
);
```

## 7. Knowledge Base (FAQ + คำถามพบบ่อย Fantech/Ugreen + ช่วง)

```sql
CREATE TABLE faq_entries (
  id BIGSERIAL PRIMARY KEY,
  brand brand_enum,                   -- NULL = ทั่วไป (sheet FAQ)
  sku TEXT, question TEXT NOT NULL, answer TEXT, manual_url TEXT,
  source_sheet TEXT
);

CREATE TABLE review_group_lookup (    -- sheet ช่วง
  id BIGSERIAL PRIMARY KEY,
  review_group TEXT UNIQUE NOT NULL, meaning TEXT
);
```

## 8. Sync & Audit (สำหรับ Phase 2)

```sql
CREATE TABLE data_sources (
  id BIGSERIAL PRIMARY KEY,
  spreadsheet_id TEXT NOT NULL, sheet_name TEXT NOT NULL,
  target_table TEXT NOT NULL, enabled BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ, UNIQUE (spreadsheet_id, sheet_name)
);
CREATE TABLE sync_runs (
  id BIGSERIAL PRIMARY KEY,
  data_source_id BIGINT REFERENCES data_sources(id),
  started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ,
  status sync_status NOT NULL DEFAULT 'running',
  rows_read INT, rows_upserted INT, rows_rejected INT, error TEXT
);
CREATE TABLE sync_row_errors (
  id BIGSERIAL PRIMARY KEY,
  sync_run_id BIGINT REFERENCES sync_runs(id),
  source_row INT, raw_data JSONB, reason TEXT
);
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL, action TEXT NOT NULL,
  entity TEXT, entity_id BIGINT, diff JSONB, at TIMESTAMPTZ DEFAULT now()
);
```

## หมายเหตุการออกแบบ
1. **service_cases เป็นตารางกลาง** — 3 sheets (หลัก/ส่งก่อน/รีวิว) โครงเดียวกัน ต่างแค่ลำดับคอลัมน์ จึง union แล้ว dedupe ด้วย `case_code`; `source_sheet` เก็บที่มา
2. **Follow-up แยกตาราง** เพราะข้อมูลเบาบางมาก (NULL 63–94%) — ลดความกว้างตารางหลัก และรองรับติดตามหลายครั้ง/case
3. **KPI / ReportWeekly / Report Month / ข้อมูลรายเดือน ไม่เก็บใน DB** — เป็น derived data ให้ Analytics API คำนวณสด (มี materialized view ได้ใน Phase 2)
4. **Sheets ปริ้นทั้งหมดไม่ sync** — เป็น template สำหรับ Print Center (Phase 3)
5. ค่าดิบที่ map ไม่ได้ (shop/product/problem_group) เก็บใน `*_raw` + flag — ไม่ทิ้งข้อมูล
