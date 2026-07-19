import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../api/client';
import { ChatVolumePoint } from '../api/types';
import { EmptyState, KpiCard } from '../components/ui';

/**
 * ข้อมูลยอดขายตรง ๆ ไม่มีใน Google Sheets ชุดนี้ —
 * หน้านี้แสดงเฉพาะตัวชี้วัดที่คำนวณได้จากข้อมูลจริง (แชทก่อน/หลังขาย → conversion proxy)
 * และแสดง Empty State ชัดเจนสำหรับส่วนที่ยังไม่มีแหล่งข้อมูล (ห้าม mock data)
 */
export default function SalesPerformance() {
  const chat = useQuery({
    queryKey: ['chat-volume'],
    queryFn: () => api<ChatVolumePoint[]>('/analytics/chat-volume'),
  });

  const totals = useMemo(() => {
    if (!chat.data) return null;
    const presale = chat.data.reduce((s, x) => s + x.presale, 0);
    const postsale = chat.data.reduce((s, x) => s + x.postsale, 0);
    return { presale, postsale, conversion: presale > 0 ? ((postsale / (presale + postsale)) * 100).toFixed(1) : null };
  }, [chat.data]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Sales Performance</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="ลูกค้าสนใจ (Pre-sales chat)" loading={chat.isLoading} value={totals?.presale.toLocaleString() ?? '—'} />
        <KpiCard label="ลูกค้าซื้อแล้ว (Post-sales chat)" loading={chat.isLoading} value={totals?.postsale.toLocaleString() ?? '—'} />
        <KpiCard label="สัดส่วนลูกค้าซื้อแล้ว" loading={chat.isLoading} value={totals?.conversion ? `${totals.conversion}%` : '—'}
          sub="คำนวณจากสัดส่วนแชทก่อน/หลังขาย" />
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Total Sales / Sales by Admin / Sales by Product</h2>
        <EmptyState
          title="ยังไม่มีแหล่งข้อมูลยอดขาย"
          detail="Google Sheets ชุดปัจจุบัน (บริการหลังการขาย) ไม่มีข้อมูลยอดขายตรง ๆ — เพิ่ม Sheet ยอดขายใน Data Sources แล้วตั้ง processor ใหม่ใน Phase 2 เพื่อเปิดหน้านี้เต็มรูปแบบ (ระบบไม่แสดงข้อมูลสมมติ)"
        />
      </div>
    </div>
  );
}
