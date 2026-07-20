import { CalendarDays, CalendarRange, FileSpreadsheet, Settings2 } from 'lucide-react';
import { ReactNode } from 'react';

/**
 * 📑 Report Center — โครงหน้า (Phase 1: Information Architecture)
 * ฟังก์ชัน Generate/Export จะเปิดใช้ใน Phase 4 (Report Center)
 * ไม่แสดงข้อมูลตัวอย่าง/ตัวเลขปลอมตามข้อกำหนด REAL DATA ONLY
 */
const TYPES: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <CalendarDays className="h-6 w-6" />, title: 'Daily Report', desc: 'สรุปรายวัน: ลูกค้าทัก, เคส, จัดส่ง, รายชื่อลูกค้า' },
  { icon: <CalendarRange className="h-6 w-6" />, title: 'Monthly Report', desc: 'สรุปรายเดือน: trend รายวัน, ranking, จัดส่ง, เคส' },
  { icon: <FileSpreadsheet className="h-6 w-6" />, title: 'Yearly Report', desc: 'สรุปรายปี: เทียบรายเดือน, best month, top products' },
  { icon: <Settings2 className="h-6 w-6" />, title: 'Custom Report', desc: 'เลือกข้อมูลเอง + filter + export Excel/CSV/PDF' },
];

export default function ReportCenter() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        เลือกประเภทรายงาน → เลือกช่วงเวลา → Filter → Generate → Export (Excel / CSV / PDF / Print)
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TYPES.map((t) => (
          <div key={t.title} className="card flex flex-col gap-2 opacity-70">
            <span className="text-indigo-300">{t.icon}</span>
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-slate-500">{t.desc}</p>
            <span className="mt-auto inline-block w-fit rounded-full bg-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              เปิดใช้ใน Phase 4
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
