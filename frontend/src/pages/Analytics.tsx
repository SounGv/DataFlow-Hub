import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, qs } from '../api/client';
import { Overview, ShopCases, TopProduct } from '../api/types';
import { DateRangeFilter, Range } from '../components/DateRange';
import { Async, STATUS_LABELS } from '../components/ui';

const PIE_COLORS = ['#f87171', '#fbbf24', '#38bdf8', '#a78bfa', '#fb923c', '#94a3b8'];

export default function Analytics() {
  const [range, setRange] = useState<Range>({});
  const overview = useQuery({
    queryKey: ['overview', range],
    queryFn: () => api<Overview>(`/analytics/overview${qs(range)}`),
  });
  const topProducts = useQuery({
    queryKey: ['top-products', range],
    queryFn: () => api<TopProduct[]>(`/analytics/top-products${qs(range)}`),
  });
  const byShop = useQuery({
    queryKey: ['by-shop', range],
    queryFn: () => api<ShopCases[]>(`/analytics/by-shop${qs(range)}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">สัดส่วนกลุ่มปัญหา</h2>
          <Async {...overview} refetch={overview.refetch}>
            {(o) => {
              const data = Object.entries(o.byProblemGroup).map(([k, v]) => ({
                name: STATUS_LABELS[k] ?? k,
                value: v,
              }));
              return (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} label={(e) => `${e.name} (${e.value})`}>
                      {data.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                  </PieChart>
                </ResponsiveContainer>
              );
            }}
          </Async>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Top Products (เคสมากสุด)</h2>
          <Async {...topProducts} refetch={topProducts.refetch} isEmpty={(d) => d.length === 0}>
            {(d) => (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={d.map((x) => ({ sku: x.product?.sku ?? '?', cases: x.cases }))} layout="vertical">
                  <CartesianGrid stroke="#1f242e" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="sku" stroke="#64748b" fontSize={11} width={80} />
                  <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                  <Bar dataKey="cases" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Async>
        </div>

        <div className="card xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">เคสตามช่องทาง (Shop)</h2>
          <Async {...byShop} refetch={byShop.refetch} isEmpty={(d) => d.length === 0}>
            {(d) => (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={d.map((x) => ({ shop: x.shop?.name ?? 'ไม่ระบุ', cases: x.cases }))}>
                  <CartesianGrid stroke="#1f242e" />
                  <XAxis dataKey="shop" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                  <Bar dataKey="cases" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Async>
        </div>
      </div>
    </div>
  );
}
