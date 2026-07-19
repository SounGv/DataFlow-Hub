import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Package, Star, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, qs } from '../api/client';
import { ChatVolumePoint, Overview as OverviewData, Paged, ServiceCase, TrendPoint } from '../api/types';
import { DateRangeFilter, Range } from '../components/DateRange';
import { Async, fmtNum, KpiCard, STATUS_LABELS } from '../components/ui';

const GROUP_COLORS: Record<string, string> = {
  claim: '#f87171',
  review: '#fbbf24',
  usage_issue: '#38bdf8',
  after_sales: '#a78bfa',
  exchange_return: '#fb923c',
  other: '#94a3b8',
};

export default function Overview() {
  const [range, setRange] = useState<Range>({});

  const overview = useQuery({
    queryKey: ['overview', range],
    queryFn: () => api<OverviewData>(`/analytics/overview${qs(range)}`),
  });
  const trends = useQuery({
    queryKey: ['trends', range],
    queryFn: () => api<TrendPoint[]>(`/analytics/trends${qs(range)}`),
  });
  const chat = useQuery({
    queryKey: ['chat-volume'],
    queryFn: () => api<ChatVolumePoint[]>('/analytics/chat-volume'),
  });
  const shipments = useQuery({
    queryKey: ['shipments-count', range],
    queryFn: () => api<Paged<ServiceCase>>(`/cases${qs({ ...range, status: 'returned', pageSize: 1 })}`),
  });

  const chatTotals = useMemo(() => {
    if (!chat.data) return null;
    const presale = chat.data.reduce((s, x) => s + x.presale, 0);
    const postsale = chat.data.reduce((s, x) => s + x.postsale, 0);
    return { presale, postsale };
  }, [chat.data]);

  const trendChart = useMemo(() => {
    if (!trends.data) return [];
    const byMonth = new Map<string, Record<string, number | string>>();
    for (const t of trends.data) {
      const m = t.month.slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, { month: m });
      byMonth.get(m)![t.problemGroup] = t.count;
    }
    return [...byMonth.values()];
  }, [trends.data]);

  const chatChart = useMemo(() => {
    if (!chat.data) return [];
    const byMonth = new Map<string, { month: string; presale: number; postsale: number }>();
    for (const c of chat.data) {
      const m = c.month.slice(0, 7);
      const cur = byMonth.get(m) ?? { month: m, presale: 0, postsale: 0 };
      cur.presale += c.presale;
      cur.postsale += c.postsale;
      byMonth.set(m, cur);
    }
    return [...byMonth.values()];
  }, [chat.data]);

  const o = overview.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Overview</h1>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="ลูกค้าทัก (แชท)" loading={chat.isLoading} icon={<MessageSquare className="h-4 w-4" />}
          value={fmtNum(chatTotals ? chatTotals.presale + chatTotals.postsale : undefined)}
          sub={chatTotals ? `ก่อนขาย ${fmtNum(chatTotals.presale)} · หลังขาย ${fmtNum(chatTotals.postsale)}` : undefined} />
        <KpiCard label="After-sales Cases" loading={overview.isLoading} icon={<Wrench className="h-4 w-4" />}
          value={fmtNum(o?.totalCases)} sub={`เคลม ${fmtNum(o?.byProblemGroup?.claim ?? 0)}`} />
        <KpiCard label="Pending Cases" loading={overview.isLoading} icon={<Wrench className="h-4 w-4" />}
          value={fmtNum(o?.pendingCases)} sub="รอดำเนินการ (open/received/in repair)" />
        <KpiCard label="Shipments (ส่งคืนแล้ว)" loading={shipments.isLoading} icon={<Package className="h-4 w-4" />}
          value={fmtNum(shipments.data?.total)} />
        <KpiCard label="Customer Feedback" loading={overview.isLoading} icon={<Star className="h-4 w-4" />}
          value={fmtNum(o?.followupCount)} sub="จำนวนการติดตามผล" />
        <KpiCard label="ความพึงพอใจ (0-10)" loading={overview.isLoading} icon={<Star className="h-4 w-4" />}
          value={o?.avgSatisfaction10 ? Number(o.avgSatisfaction10).toFixed(1) : '—'} />
        <KpiCard label="คะแนนสินค้า (0-10)" loading={overview.isLoading} icon={<Star className="h-4 w-4" />}
          value={o?.avgProductScore10 ? Number(o.avgProductScore10).toFixed(1) : '—'} />
        <KpiCard label="NPS (แนะนำเพื่อน)" loading={overview.isLoading} icon={<Star className="h-4 w-4" />}
          value={o?.avgNps ? Number(o.avgNps).toFixed(1) : '—'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">After-sales Trend (รายเดือน)</h2>
          <Async {...trends} refetch={trends.refetch} isEmpty={(d) => d.length === 0}>
            {() => (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendChart}>
                  <CartesianGrid stroke="#1f242e" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                  <Legend />
                  {Object.entries(GROUP_COLORS).map(([g, color]) => (
                    <Line key={g} type="monotone" dataKey={g} name={STATUS_LABELS[g] ?? g} stroke={color} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Async>
        </div>
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Customer Chat Trend (รายเดือน)</h2>
          <Async {...chat} refetch={chat.refetch} isEmpty={(d) => d.length === 0}>
            {() => (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chatChart}>
                  <CartesianGrid stroke="#1f242e" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                  <Legend />
                  <Line type="monotone" dataKey="presale" name="ก่อนขาย" stroke="#38bdf8" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="postsale" name="หลังขาย" stroke="#a78bfa" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Async>
        </div>
      </div>
    </div>
  );
}
