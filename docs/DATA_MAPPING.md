# DATA_MAPPING — DATAFLOW HUB (Phase 1)

Mapping: Google Sheet → PostgreSQL · **map ตามชื่อคอลัมน์ (ไม่ใช่ตำแหน่ง)** เพราะ sheet ส่งก่อน/รีวิว สลับลำดับคอลัมน์

Transform functions ที่อ้างถึง:
- `TH_DATE(v)` — parse วันที่, ถ้าปี 1957–1970 หรือ ≥2500 ปรับ พ.ศ.↔ค.ศ. ±543, parse ไม่ได้ → NULL + flag
- `PHONE(v)` — ตัดช่องว่าง/ขีด, 9 หลักเติม 0 นำหน้า, แปลง +66
- `SHOP(v)` — trim → หา `shop_aliases` → shop_id (ไม่พบ → NULL + flag)
- `SKU(v)` — upper(trim) → products.sku (ไม่พบ → สร้างใหม่ status pending + เก็บ raw)
- `PGROUP(v)` — map เข้า enum: เคลม*→claim, รีวิว→review, แจ้งปัญหา*→usage_issue, บริการหลังการขาย→after_sales, เปลี่ยน*→exchange_return, อื่น→other
- `BOOL(v)` — TRUE/FALSE/ใช่/ไม่ → boolean

## 1. บริการหลังการขาย → service_cases + customers + case_followups

| คอลัมน์ต้นทาง | ปลายทาง | Transform |
|---|---|---|
| (คอลัมน์แรก ไม่มีชื่อ) | service_cases.case_code | trim; ไม่ตรง `GV\d+` → reject row ลง sync_row_errors |
| วันที่ | case_date | TH_DATE |
| ร้าน | shop_id | SHOP |
| ชื่อแชทลูกค้า | customers.chat_name | trim |
| ชื่อลูกค้า | customers.full_name | trim, ตัด \n |
| เบอร์โทร | customers.phone | PHONE |
| ที่อยู่ส่งคืนลูกค้า | customers.address | trim; '-' → NULL |
| เลขที่ ออเดอร์ | order_no | trim |
| สินค้า | product_id / product_raw | SKU |
| Serial | serial_no | trim |
| กลุ่มของปัญหา (เคลม, …) | problem_group | PGROUP |
| ปัญหา | problem | trim |
| วิธีแก้ไข | solution | trim |
| กลุ่มรีวิว | review_group | trim → FK ตรรกะกับ review_group_lookup |
| วันที่ได้รับสินค้าเสีย | defect_received_date | TH_DATE (จุดที่พบปี 1963 มากสุด) |
| ได้รับของเสียจากลูกค้า | defect_received | BOOL |
| ส่งสินค้าไปก่อน | sent_replacement_first | BOOL |
| ฝ่ายเคลมรับสินค้าเข้าระบบ | claim_dept_received | BOOL |
| วันที่ส่งสินค้าเคลมคืนลูกค้า | returned_date | TH_DATE |
| ส่งสินค้าคืนลูกค้า | returned_to_customer | BOOL |
| Tracking ส่งคืน | return_tracking_no | trim; '-' → NULL |
| SMS | sms_notified | BOOL/มีค่า → true |
| ค่าขนส่ง | shipping_cost | numeric |
| วันที่ติดตามลูกค้า | case_followups.followup_date | TH_DATE; แถว followup สร้างเมื่อคอลัมน์กลุ่มนี้มีค่าอย่างน้อย 1 |
| 1) ผลการการติดตาม… | case_followups.usage_result | trim |
| 1.คุณภาพสินค้า… | case_followups.product_quality_note | trim |
| 2. การให้บริการหลังการขาย… | case_followups.service_note | trim |
| 3. การให้คำแนะนำ… | case_followups.advice_note | trim |
| 2) ระดับความพึงพอใจ…0 ถึง 5 | case_followups.satisfaction_5 | int 0–5 |
| 2) ระดับความพึงพอใจ…0 ถึง 10 | case_followups.satisfaction_10 | int 0–10 |
| 3) ระดับความพอใจในสินค้า…0 ถึง 10 | case_followups.product_score_10 | int 0–10 |
| 4) ข้อเสนอแนะ ติชม | case_followups.feedback | trim |
| Unnamed 32–40 | — | ทิ้ง (ว่าง 100%) |

`status` (derived): returned/ติดตามแล้ว → closed·followed_up; returned_to_customer → returned; claim_dept_received → in_repair; defect_received → received; อื่น → open

## 2. ส่งก่อน → service_cases (source_sheet='ส่งก่อน')
คอลัมน์ชุดเดียวกับข้อ 1 (ลำดับต่าง) + เพิ่ม `3) คุณจะแนะนำเราให้กับเพื่อน…` → case_followups.nps_score. Dedupe: case_code ชนกับ sheet หลัก 334 แถว → เก็บแถวที่ field ไม่ว่างมากกว่า

## 3. รีวิว → service_cases (source_sheet='รีวิว')
หัวตารางแถวแรกเสีย (`2222`,`ิ`) → ใช้ mapping ตำแหน่งเทียบกับหัวของ sheet หลัก + NPS column เหมือนข้อ 2. Dedupe ชนกัน 115 แถว

## 4. แจ้งปัญหาการใช้งานสินค้า → usage_issues

| ต้นทาง | ปลายทาง | Transform |
|---|---|---|
| (คอลัมน์แรก timestamp) | reported_at | TH_DATE+time |
| ชื่อร้าน | shop_id | SHOP |
| ชื่อลูกค้า/ชื่อแชท | customer_name | trim |
| เลขที่คำสั่งซื้อ | order_no | trim |
| รุ่นสินค้า | product_id/product_raw | SKU |
| ปัญหา / วิธีการแก้ไข | problem / solution | trim |
| วันเวลาที่แก้ไขเสร็จ | resolved_time_raw | เก็บดิบ (format ปน) |
| คะแนน 1-10 (ตัวแรก) | score_initial | int |
| รบกวนเวลา…ประเมินความพึงพอใจ 1-5 | satisfaction_5 | int 0–5 |
| ติดตามผลการใช้งาน | followup_result | trim |
| คะแนน 1-10 (ตัวหลัง) | score_followup | int |
| วันที่ติดตาม | followup_date | TH_DATE |

## 5. Sheets อื่น

| Sheet | ปลายทาง | หมายเหตุ |
|---|---|---|
| SMS | sms_logs (tracking_no, msisdn=PHONE) | match case ภายหลังด้วยเบอร์โทร |
| Data | service_cases (source_sheet='Data', problem_group จากคอลัมน์ เคลม/เซอร์วิส) | legacy; คอลัมน์ที่อยู่ซ้ำ 2 → concat |
| แชท | chat_daily_metrics | แถวหัวจริงคือแถวที่ 2; ข้าม 2 แถวแรก; รวม (ก่อน/หลัง/รวม) ไม่เก็บ 'รวม' (derived) |
| นับจำนวนแชท | chat_offhour_counts | unpivot: หัว 2 ชั้น (shop × time_slot) → long format |
| call center | call_center_surveys | หัว 2 ชั้น (แถว 1–2) → flatten |
| เก้าอี้ | chair_claims | Google Form export |
| ขออะไหล่เก้าอี้ | spare_part_requests | วันที่ format 'May 10, 2021'; รูป1–7 → photo_urls[] |
| CN | credit_notes | |
| ติดตามลูกค้าก่อนการขาย | presale_followups | ซื้อ/ไม่ซื้อ → BOOL |
| FAQ | faq_entries (brand=NULL) | |
| คำถามพบบ่อย Fantech / Ugreen | faq_entries (brand=fantech/ugreen) | แถวแรกเป็นหัวซ้ำ → ข้าม |
| ช่วง | review_group_lookup | |

## 6. Sheets ที่ไม่ sync
KPI, ReportWeekly, Report Month, ข้อมูลรายเดือน (derived — คำนวณจาก DB), ปริ้น/ปริ้นใบแปะกล่อง/ใบแปะ ลค/ใบแปะหน้าให้ลูกค้า/สำเนาของ×3 (print template), ชีต31 (ว่าง), ชีต20_conflict2087686213 (conflict), ประชุมทีม SV (บันทึกประชุม — เก็บเป็น option ภายหลังได้)
