import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api/client';
import { Paged, ServiceCase } from '../api/types';
import { Column, DataTable } from '../components/DataTable';
import { DateRangeFilter, Range } from '../components/DateRange';
import { Badge, fmtDate, KpiCard, Skeleton } from '../components/ui';

function CaseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: c, isLoading } = useQuery({
    queryKey: ['case', id],
    queryFn: () => api<ServiceCase>(`/cases/${id}`),
  });

  const timeline: { label: string; date?: string | null; done: boolean }[] = c
    ? [
        { label: 'รับแจ้ง', date: c.caseDate, done: true },
        { label: 'ได้รับสินค้าเสีย', date: c.defectReceivedDate, done: c.defectReceived },
        { label: 'ส่งสินค้าไปก่อน', done: c.sentReplacementFirst },
        { label: 'ฝ่ายเคลมรับเข้าระบบ', done: c.claimDeptReceived },
        { label: 'ส่งคืนลูกค้า', date: c.returnedDate, done: c.returnedToCustomer },
        { label: 'ติดตามผล', date: c.followups?.[0]?.followupDate, done: (c.followups?.length ?? 0) > 0 },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 h-full w-full max-w-lg overflow-y-auto border-l border-line bg-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{c?.caseCode ?? 'เคส'}</h2>
          <button className="btn-ghost !p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {isLoading || !c ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="card space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge value={c.problemGroup} />
                <Badge value={c.status} />
                <span className="text-xs text-slate-500">{c.shop?.name}</span>
              </div>
              <p>
                <span className="text-slate-500">ลูกค้า: </span>
                {c.customer ? (
                  <Link className="text-indigo-300 hover:underline" to={`/customers/${c.customer.id}`}>
                    {c.customer.fullName ?? c.customer.chatName}
                  </Link>
                ) : '—'}
                <span className="ml-2 text-slate-500">{c.customer?.phone}</span>
              </p>
              <p><span className="text-slate-500">Order: </span>{c.orderNo ?? '—'}</p>
              <p><span className="text-slate-500">สินค้า: </span>{c.product?.sku ?? c.productRaw ?? '—'}
                <span className="ml-2 text-slate-500">Serial: {c.serialNo ?? '—'}</span></p>
              <p><span className="text-slate-500">Tracking ส่งคืน: </span>{c.returnTrackingNo ?? '—'}</p>
            </div>

            <div className="card">
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">ปัญหา</p>
              <p>{c.problem ?? '—'}</p>
              <p className="mb-1 mt-3 text-xs font-semibold uppercase text-slate-500">วิธีแก้ไข</p>
              <p>{c.solution ?? '—'}</p>
            </div>

            <div className="card">
              <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Timeline</p>
              <ol className="space-y-2">
                {timeline.map((t) => (
                  <li key={t.label} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${t.done ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                    <span className={t.done ? '' : 'text-slate-500'}>{t.label}</span>
                    <span className="ml-auto text-xs text-slate-500">{fmtDate(t.date)}</span>
                  </li>
                ))}
              </ol>
            </div>

            {(c.followups?.length ?? 0) > 0 && (
              <div className="card space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">ผลติดตาม</p>
                {c.followups!.map((f) => (
                  <div key={f.id} className="space-y-1 text-sm">
                    <p>{f.usageResult ?? '—'}</p>
                    <p className="text-xs text-slate-500">
                      พึงพอใจ: {f.satisfaction10 ?? f.satisfaction5 ?? '—'} · สินค้า: {f.productScore10 ?? '—'} · NPS: {f.npsScore ?? '—'}
                    </p>
                    {f.feedback && <p className="text-xs italic text-slate-400">“{f.feedback}”</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AfterSales() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [range, setRange] = useState<Range>({});
  const [q, setQ] = useState(params.get('q') ?? '');
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState('');
  const selectedCase = params.get('case');

  useEffect(() => setPage(1), [q, group, status, range]);

  const query = useQuery({
    queryKey: ['cases', page, q, group, status, range],
    queryFn: () =>
      api<Paged<ServiceCase>>(`/cases${qs({ page, pageSize: 25, q, problemGroup: group, status, ...range })}`),
  });

  const stats = useQuery({
    queryKey: ['overview', range],
    queryFn: () => api<{ totalCases: number; pendingCases: number; byProblemGroup: Record<string, number> }>(`/analytics/overview${qs(range)}`),
  });

  const columns: Column<ServiceCase>[] = [
    { header: 'Case', cell: (c) => <span className="font-medium">{c.caseCode}</span> },
    { header: 'วันที่', cell: (c) => fmtDate(c.caseDate) },
    { header: 'ลูกค้า', cell: (c) => c.customer?.fullName ?? c.customer?.chatName ?? '—' },
    { header: 'สินค้า', cell: (c) => c.product?.sku ?? '—' },
    { header: 'กลุ่ม', cell: (c) => <Badge value={c.problemGroup} /> },
    { header: 'สถานะ', cell: (c) => <Badge value={c.status} /> },
    { header: 'Tracking', cell: (c) => <span className="text-xs text-slate-400">{c.returnTrackingNo ?? '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">After-sales</h1>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Cases" loading={stats.isLoading} value={stats.data?.totalCases?.toLocaleString() ?? '—'} />
        <KpiCard label="Pending" loading={stats.isLoading} value={stats.data?.pendingCases?.toLocaleString() ?? '—'} />
        <KpiCard label="เคลม" loading={stats.isLoading} value={(stats.data?.byProblemGroup?.claim ?? 0).toLocaleString()} />
        <KpiCard label="Resolved (ปิดเคส)" loading={stats.isLoading}
          value={((stats.data?.totalCases ?? 0) - (stats.data?.pendingCases ?? 0)).toLocaleString()} />
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="input w-64" placeholder="ค้นหา (เคส/ลูกค้า/Order/Tracking)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">ทุกกลุ่มปัญหา</option>
          <option value="claim">เคลม</option>
          <option value="review">รีวิว</option>
          <option value="usage_issue">แจ้งปัญหาการใช้งาน</option>
          <option value="after_sales">บริการหลังการขาย</option>
          <option value="exchange_return">เปลี่ยน/คืนสินค้า</option>
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="open">รับแจ้ง</option>
          <option value="received">ได้รับของ</option>
          <option value="in_repair">กำลังเคลม</option>
          <option value="returned">ส่งคืนแล้ว</option>
          <option value="closed">ปิดเคส</option>
        </select>
      </div>

      <DataTable
        data={query.data}
        isLoading={query.isLoading}
        columns={columns}
        page={page}
        setPage={setPage}
        onRowClick={(c) => setParams((p) => { p.set('case', c.id); return p; })}
      />

      {selectedCase && (
        <CaseDetail id={selectedCase} onClose={() => setParams((p) => { p.delete('case'); return p; })} />
      )}
    </div>
  );
}
