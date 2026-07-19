# DATAFLOW HUB — Backend (Phase 2)

Google Sheets → Sync Engine → PostgreSQL → Analytics API

Stack: **Node.js · TypeScript · NestJS · PostgreSQL + Prisma · Redis + BullMQ · REST + SSE**

## เริ่มใช้งาน

```bash
# 1. Database + Redis
docker compose up -d

# 2. ติดตั้งและตั้งค่า
npm install
cp .env.example .env        # แก้ SPREADSHEET_ID, JWT_SECRET, GOOGLE_APPLICATION_CREDENTIALS

# 3. สร้างตาราง + seed (shops, aliases, admin user, sync config)
npm run prisma:migrate      # ครั้งแรก: ตั้งชื่อ migration เช่น "init"
npm run seed

# 4. รัน
npm run start:dev           # API → http://localhost:3000/api
npm run worker:dev          # Sync worker (คนละ terminal)
```

### เชื่อม Google Sheets (Link-share mode — ไม่ต้องใช้ Google Cloud)
1. เปิด Google Sheets → **Share** → General access → **"Anyone with the link" (Viewer)**
2. copy Spreadsheet ID จาก URL (`/d/<ID>/edit`) ใส่ใน `.env` → `SPREADSHEET_ID`

> หมายเหตุ: โหมดนี้ทุกคนที่มีลิงก์เปิดดูชีตได้ — ถ้าต้องการจำกัดสิทธิ์เข้มกว่านี้
> ให้กลับไปใช้ Service Account (แก้ `src/sync/sheets.client.ts` เป็นเวอร์ชัน googleapis)

### Login เริ่มต้น
`admin@gadgetvilla.co.th` / `changeme123` — **เปลี่ยนทันทีใน production** (ตั้ง `ADMIN_EMAIL`/`ADMIN_PASSWORD` ก่อน seed)

## API

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` → `{accessToken}` |
| POST | `/api/auth/logout` | revoke token |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้ปัจจุบัน |
| GET | `/api/cases` | รายการเคส (filter: `q, problemGroup, status, shopId, dateFrom, dateTo, page, pageSize`) |
| GET | `/api/cases/:id` · `/api/cases/code/GV0004` | รายละเอียดเคส + follow-ups |
| GET | `/api/usage-issues` | แจ้งปัญหาการใช้งาน |
| GET | `/api/chat-metrics` | จำนวนแชทรายวัน |
| GET | `/api/faq?brand=fantech&q=...` | Knowledge base |
| GET | `/api/shops` · `/api/products` · `/api/spare-parts` · `/api/chair-claims` | lookups |
| GET | `/api/analytics/overview?dateFrom&dateTo` | KPI หน้า Overview |
| GET | `/api/analytics/trends` · `top-products` · `by-shop` · `chat-volume` · `repeat-claims` | analytics |
| POST | `/api/sync/run` · `/api/sync/run/:dataSourceId` | trigger sync |
| GET | `/api/sync/status` · `/api/sync/runs` · `/api/sync/runs/:id/errors` | Sync Monitor |
| GET (SSE) | `/api/sync/stream?token=JWT` | live sync events |

ทุก endpoint (ยกเว้น login) ต้องมี `Authorization: Bearer <token>`

## Sync Engine
- Worker แยก process (`npm run worker`) — BullMQ, full sync ทุก `SYNC_CRON_MINUTES` (default 15) + trigger ผ่าน API
- Extract → Normalize (พ.ศ.→ค.ศ., เบอร์โทร, shop alias, SKU, กลุ่มปัญหา) → Validate → Upsert (idempotent)
- แถวที่ผิดลง `sync_row_errors` (raw JSON) — ไม่ทิ้งข้อมูล; ทุก record มี `source_sheet`/`source_row`
- กติกาทั้งหมดตาม `../docs/DATA_MAPPING.md` และ `../docs/DATA_QUALITY_REPORT.md`

## โครงสร้าง
```
src/
├── auth/        JWT login/logout (Redis denylist)
├── cases/       Service cases API
├── analytics/   KPI / trends / top products (แทน sheet KPI, Report*)
├── operations/  usage issues, chat metrics, FAQ, lookups
├── sync/        Sheets client, normalizers(+tests), processors, worker, SSE monitor
├── prisma/      Prisma service
└── common/      pagination
prisma/schema.prisma  ← ตรงกับ docs/DATABASE_SCHEMA.md
prisma/seed.ts        ← shops/aliases + admin + sync config
```

## ทดสอบ
```bash
npm test          # unit tests (normalizers — กติกา cleaning ทั้งหมด)
npm run typecheck
```
