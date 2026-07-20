import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, MessageSquare, Package, Star, Target, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, qs } from '../api/client';
import { Overview as OverviewData, Paged, ServiceCase } from '../api/types';
import { BusinessTrend } from '../components/BusinessTrend';
import { KpiMetric, KpiStatCard } from '../components/KpiStatCard';
import { Async, Badge, fmtDate, STATUS_LABELS } from '../components/ui';
import { useGlobalFilter } from '../context/GlobalFilter';

const GROUP_COLORS: Record<string, string> = {
  claim: '#f87171',
  review: '#fbbf24',
  usage_issue: '#38bdf8',
  after_sales: '#a78bfa',
  exchange_return: '#fb923c',
  other: '#64748b',
};
const STATUS_COLORS: Record<string, string> = {
  open: '#38bdf8',
  received: '#fbbf24',
  in_repair: '#fb923c',
  returned: '#a78bfa',
  followed_up: '#34d399',
  closed: '#34d399',
};

interface KpisResponse {
  metrics: Record<string, KpiMetric>;
}

export default function Overview() {
  const { range } = useGlobalFilter();
  const nav = useNavigate();

  const kpis = useQuery({
    queryKey: ['kpis', range],
    queryFn: () => api<KpisResponse>(`/analytics/kpis${qs(range)}`),
  });
  const overview = useQuery({
    queryKey: ['overview', range],
    queryFn: () => api<OverviewData & { byStatus?: Record<string, number> }>(`/analytics/overview${qs(range)}`),
  });
  const recent = useQuery({
    queryKey: ['recent-cases'],
    queryFn: () => api<Paged<ServiceCase>>(`/cases${qs({ page: 1, pageSize: 8 })}`),
  });
  const statusDist = useQuery({
    queryKey: ['status-dist', range],
    queryFn: () => api<Paged<ServiceCase>>(`/cases${qs({ page: 1, pageSize: 1, ...range })}`),
  });

  const m = kpis.data?.metrics;

  return (
    <div className="space-y-4">
      {/* KPI SECTION — 6 หลักตาม spec (2 ตัวรอแหล่งข้อมูล) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiStatCard label="Customer Contacts" icon={<MessageSquare className="h-4 w-4" />}
          loading={kpis.isLoading} metric={m?.contacts} onClick={() => nav('/customer-chat')} />
        <KpiStatCard label="Closed Sales" icon={<Target className="h-4 w-4" />}
          loading={kpis.isLoading} metric={m?.closed_sales} onClick={() => nav('/sales')} />
        <KpiStatCard label="Conversion Rate" icon={<Target className="h-4 w-4" />}
          loading={kpis.isLoading} metric={m?.conversion_rate} onClick={() => nav('/sales')} />
        <KpiStatCard label="Sales Value" icon={<CircleDollarSign className="h-4 w-4" />}
          loading={kpis.isLoading} metric={m?.sales_value} onClick={() => nav('/sales')} />
        <KpiStatCard label="Shipments" icon={<Package className="h-4 w-4" />}
          loading={kpis.isLoading} metric={m?.shipments} onClick={() => nav('/shipments')} />
        <KpiStatCard label="After-sales Cases" icon={<Wrench className="h-4 w-4" />} goodWhenDown
          loading={kpis.isLoading} metric={m?.after_sales} onClick={() => nav('/after-sales')} />
      </div>

      {/* MAIN BUSINESS TREND */}
      <BusinessTrend />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* AFTER-SALES SUMMARY donut */}
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">🛠️ After-sales Summary</h2>
          <Async {...overview} refetch={overview.refetch}>
            {(o) => {
              const data = Object.entries(o.byProblemGroup ?? {})
                .filter(([, v]) => v > 0)
                .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, key: k, value: v }));
              return data.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">📭 ไม่มีข้อมูลในช่วงที่เลือก</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}
                      onClick={(d) => nav(`/after-sales?problemGroup=${(d as { key?: string }).key ?? ''}`)}>
                      {data.map((d) => (
                        <Cell key={d.key} fill={GROUP_COLORS[d.key] ?? '#64748b'} className="cursor-pointer" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                  </PieChart>
                </ResponsiveContainer>
              );
            }}
          </Async>
          <Async {...overview} refetch={overview.refetch}>
            {(o) => (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {Object.entries(o.byProblemGroup ?? {}).filter(([, v]) => v > 0).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLORS[k] ?? '#64748b' }} />
                    {STATUS_LABELS[k] ?? k} {v.toLocaleString()}
                  </span>
                ))}
              </div>
            )}
          </Async>
        </div>

        {/* TOP PROBLEMS bar */}
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">📊 Top Problems (กลุ่มปัญหา)</h2>
          <Async {...overview} refetch={overview.refetch}>
            {(o) => {
              const data = Object.entries(o.byProblemGroup ?? {})
                .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, key: k, value: v }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
              return data.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">📭 ไม่มีข้อมูลในช่วงที่เลือก</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data} layout="vertical">
                    <CartesianGrid stroke="#1f242e" />
                    <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={110} />
                    <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}
                      onClick={(d) => nav(`/after-sales?problemGroup=${(d as { key?: string }).key ?? ''}`)}>
                      {data.map((d) => (
                        <Cell key={d.key} fill={GROUP_COLORS[d.key] ?? '#6366f1'} className="cursor-pointer" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            }}
          </Async>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">🕒 Recent Activity (เคสล่าสุด)</h2>
          <Async {...recent} refetch={recent.refetch} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <ul className="space-y-2">
                {d.items.map((c) => (
                  <li key={c.id}>
                    <button className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-line/30"
                      onClick={() => nav(`/after-sales?case=${c.id}`)}>
                      <Badge value={c.problemGroup} />
                      <span className="truncate">
                        <span className="font-medium">{c.caseCode}</span>{' '}
                        <span className="text-slate-500">{c.customer?.fullName ?? c.customer?.chatName ?? ''}</span>
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-slate-600">{fmtDate(c.caseDate)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </div>
      </div>

      {/* CUSTOMER FEEDBACK strip */}
      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">⭐ Customer Feedback</h2>
        <Async {...overview} refetch={overview.refetch}>
          {(o) => (
            <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
              <div>
                <p className="text-2xl font-semibold">{o.avgSatisfaction10 ? Number(o.avgSatisfaction10).toFixed(1) : '—'}</p>
                <p className="text-xs text-slate-500">ความพึงพอใจ (0-10)</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{o.avgProductScore10 ? Number(o.avgProductScore10).toFixed(1) : '—'}</p>
                <p className="text-xs text-slate-500">คะแนนสินค้า (0-10)</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{o.avgNps ? Number(o.avgNps).toFixed(1) : '—'}</p>
                <p className="text-xs text-slate-500">NPS (แนะนำเพื่อน)</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{(o.followupCount ?? 0).toLocaleString()}</p>
                <p className="text-xs text-slate-500">จำนวน Feedback</p>
              </div>
            </div>
          )}
        </Async>
      </div>
    </div>
  );
}
