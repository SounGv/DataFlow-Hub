# DATAFLOW HUB — Dashboard (Phase 3)

React + Vite + TypeScript + Tailwind + TanStack Query + Recharts

## เริ่มใช้งาน

```bash
npm install
npm run dev      # → http://localhost:5173  (proxy /api → localhost:3000)
```

ต้องรัน Backend ก่อน (ดู ../backend/README.md) แล้ว login ด้วยบัญชีที่ seed ไว้

## หน้าจอ

- **MAIN** — Overview (KPI + Trend + Date Filter), Analytics (สัดส่วนกลุ่มปัญหา, Top Products, ตามช่องทาง)
- **OPERATIONS** — Customer & Chat, Sales Performance, After-sales (ตาราง server-side pagination + Case Detail Timeline), Shipments
- **INSIGHTS** — Customer Voice, Product Service, Spare Parts, Knowledge Base
- **SYSTEM** — Data Sources, Sync Monitor (SSE live + trigger sync), Audit Logs, Settings
- **TOOLS** — Print Center (ค้นหาลูกค้า → เลือกเคส → preview → พิมพ์ใบแปะหน้า)

Global Search บน header: ชื่อลูกค้า / เบอร์ / Order / Tracking / Serial / SKU (partial, ignore space-hyphen)

🟢 LIVE indicator เชื่อม `/api/sync/stream` (SSE) — เมื่อ sync เสร็จ UI refresh อัตโนมัติโดยไม่ reload

## Build production

```bash
npm run build    # → dist/ (เสิร์ฟผ่าน nginx/สแตติก + proxy /api ไป backend)
```

หมายเหตุ: ทุกหน้าใช้ข้อมูลจริงจาก API — ไม่มี mock data; ส่วนที่ยังไม่มีแหล่งข้อมูล (เช่น ยอดขายตรง ๆ) แสดง Empty State พร้อมคำอธิบาย
