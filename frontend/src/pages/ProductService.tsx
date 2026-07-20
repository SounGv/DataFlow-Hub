import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, qs } from '../api/client';
import { ChairClaim, Paged, TopProduct, UsageIssue } from '../api/types';
import { Async, fmtDate, fmtDateTime } from '../components/ui';
import { useGlobalFilter } from '../context/GlobalFilter';

/** Product Service — Top products ที่มีเคส, แจ้งปัญหาการใช้งาน, เคลมเก้าอี้ */
export default function ProductService() {
  const { range } = useGlobalFilter();
  const [page, setPage] = useState(1);

  const topProducts = useQuery({
    queryKey: ['top-products', range],
    queryFn: () => api<TopProduct[]>(`/analytics/top-products${qs(range)}`),
  });
  const issues = useQuery({
    queryKey: ['usage-issues', page],
    queryFn: () => api<Paged<UsageIssue>>(`/usage-issues${qs({ page, pageSize: 15 })}`),
  });
  const chairs = useQuery({
    queryKey: ['chair-claims'],
    queryFn: () => api<ChairClaim[]>('/chair-claims'),
  });

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">สินค้าที่มีเคสมากสุด</h2>
        <Async {...topProducts} refetch={topProducts.refetch} isEmpty={(d) => d.length === 0}>
          {(d) => (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.map((x) => ({ sku: x.product?.sku ?? '?', cases: x.cases }))}>
                <CartesianGrid stroke="#1f242e" />
                <XAxis dataKey="sku" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                <Bar dataKey="cases" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Async>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">แจ้งปัญหาการใช้งานสินค้า (ล่าสุด)</h2>
        <Async {...issues} refetch={issues.refetch} isEmpty={(d) => d.items.length === 0}>
          {(d) => (
            <div className="space-y-2">
              {d.items.map((i) => (
                <div key={i.id} className="rounded-lg border border-line/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{fmtDateTime(i.reportedAt)}</span>
                    <span>{i.shop?.name}</span>
                    <span className="font-medium text-slate-300">{i.product?.sku}</span>
                    {i.scoreInitial !== null && i.scoreInitial !== undefined && <span>คะแนน {i.scoreInitial}/10</span>}
                  </div>
                  <p className="mt-1">{i.problem ?? '—'}</p>
                  {i.solution && <p className="text-xs text-emerald-400/80">แก้ไข: {i.solution}</p>}
                </div>
              ))}
              <div className="flex justify-end gap-1 text-xs">
                <button className="btn-ghost !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
                <button className="btn-ghost !py-1" disabled={page >= d.totalPages} onClick={() => setPage(page + 1)}>ถัดไป</button>
              </div>
            </div>
          )}
        </Async>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">เคลมเก้าอี้ (Google Form)</h2>
        <Async {...chairs} refetch={chairs.refetch} isEmpty={(d) => d.length === 0}>
          {(d) => (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-slate-500">
                  <th className="px-2 py-2">วันที่</th>
                  <th className="px-2 py-2">รุ่น</th>
                  <th className="px-2 py-2">Order</th>
                  <th className="px-2 py-2">ชิ้นส่วน</th>
                  <th className="px-2 py-2">อาการ</th>
                </tr>
              </thead>
              <tbody>
                {d.map((c) => (
                  <tr key={c.id} className="border-b border-line/50 last:border-0">
                    <td className="px-2 py-2">{fmtDate(c.submittedAt)}</td>
                    <td className="px-2 py-2 font-medium">{c.model}</td>
                    <td className="px-2 py-2 text-slate-400">{c.orderNo}</td>
                    <td className="px-2 py-2">{c.brokenPart}</td>
                    <td className="px-2 py-2 text-slate-400">{c.symptom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Async>
      </div>
    </div>
  );
}
