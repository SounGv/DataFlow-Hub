import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, qs } from '../api/client';
import { Paged, ServiceCase } from '../api/types';
import { Column, DataTable } from '../components/DataTable';
import { Badge, fmtDate, KpiCard } from '../components/ui';

/** Customer Voice — เคสกลุ่มรีวิว + ผลติดตาม/ข้อเสนอแนะจริงจากลูกค้า */
export default function CustomerVoice() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  useEffect(() => setPage(1), [q]);

  const reviews = useQuery({
    queryKey: ['reviews', page, q],
    queryFn: () => api<Paged<ServiceCase>>(`/cases${qs({ page, pageSize: 25, q, problemGroup: 'review' })}`),
  });
  const stats = useQuery({
    queryKey: ['overview-all'],
    queryFn: () => api<{ avgSatisfaction10?: number; avgNps?: number; followupCount: number }>(`/analytics/overview`),
  });

  const columns: Column<ServiceCase>[] = [
    { header: 'Case', cell: (c) => <span className="font-medium">{c.caseCode}</span> },
    { header: 'วันที่', cell: (c) => fmtDate(c.caseDate) },
    { header: 'ร้าน', cell: (c) => c.shop?.name ?? '—' },
    { header: 'ลูกค้า', cell: (c) => c.customer?.fullName ?? c.customer?.chatName ?? '—' },
    { header: 'กลุ่มรีวิว', cell: (c) => c.reviewGroup ?? '—' },
    { header: 'เนื้อหา', cell: (c) => <span className="line-clamp-2 max-w-md text-slate-400">{c.problem ?? c.solution ?? '—'}</span> },
    { header: 'สถานะ', cell: (c) => <Badge value={c.status} /> },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Customer Voice</h1>
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="ความพึงพอใจเฉลี่ย (0-10)" loading={stats.isLoading}
          value={stats.data?.avgSatisfaction10 ? Number(stats.data.avgSatisfaction10).toFixed(1) : '—'} />
        <KpiCard label="NPS เฉลี่ย" loading={stats.isLoading}
          value={stats.data?.avgNps ? Number(stats.data.avgNps).toFixed(1) : '—'} />
        <KpiCard label="Feedback ทั้งหมด" loading={stats.isLoading}
          value={stats.data?.followupCount?.toLocaleString() ?? '—'} />
      </div>
      <input className="input w-full max-w-md" placeholder="ค้นหารีวิว" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable data={reviews.data} isLoading={reviews.isLoading} columns={columns} page={page} setPage={setPage} />
    </div>
  );
}
