import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { api, qs } from '../api/client';
import { useGlobalFilter } from '../context/GlobalFilter';
import { Async } from './ui';

type Metric = 'contacts' | 'shipments' | 'after_sales';
type Bucket = 'day' | 'week' | 'month' | 'year';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'contacts', label: 'ลูกค้าทัก' },
  { key: 'shipments', label: 'จัดส่ง (ส่งคืน)' },
  { key: 'after_sales', label: 'เคสหลังการขาย' },
];
const UNAVAILABLE = ['ปิดการขาย', 'ยอดขาย'];

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'day', label: 'รายวัน' },
  { key: 'week', label: 'รายสัปดาห์' },
  { key: 'month', label: 'รายเดือน' },
  { key: 'year', label: 'รายปี' },
];

interface TrendResponse {
  metric: string;
  bucket: string;
  series: { t: string; value: number }[];
  prevSeries: { t: string; value: number }[] | null;
}

/** 📈 BUSINESS PERFORMANCE TREND — กราฟหลัก เลือก metric/bucket + เทียบช่วงก่อนหน้า + คลิกจุดเพื่อ drill-down */
export function BusinessTrend() {
  const { range } = useGlobalFilter();
  const nav = useNavigate();
  const [metric, setMetric] = useState<Metric>('after_sales');
  const [bucket, setBucket] = useState<Bucket>('month');
  const hasRange = !!range.dateFrom;

  const trend = useQuery({
    queryKey: ['business-trend', metric, bucket, range],
    queryFn: () => api<TrendResponse>(`/analytics/business-trend${qs({ metric, bucket, compare: hasRange ? '1' : undefined, ...range })}`),
  });

  const chartData = useMemo(() => {
    const cur = trend.data?.series ?? [];
    const prev = trend.data?.prevSeries ?? [];
    return cur.map((p, i) => ({ t: p.t, ปัจจุบัน: p.value, ...(prev[i] ? { ช่วงก่อนหน้า: prev[i].value } : {}) }));
  }, [trend.data]);

  const drill = (t?: string) => {
    if (!t || metric === 'contacts') {
      nav('/customer-chat');
      return;
    }
    // คลิกจุด → เปิดรายการเคสของช่วงนั้น
    const from = t;
    const to = bucket === 'day' ? t : undefined;
    nav(`/after-sales?${new URLSearchParams({ ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}) })}`);
  };

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">📈 Business Performance Trend</h2>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button key={m.key}
              className={`rounded-lg px-2.5 py-1 text-xs ${metric === m.key ? 'bg-accent text-white' : 'border border-line text-slate-400 hover:bg-line/40'}`}
              onClick={() => setMetric(m.key)}>
              {m.label}
            </button>
          ))}
          {UNAVAILABLE.map((l) => (
            <span key={l} title="ยังไม่มีชีตข้อมูลยอดขาย"
              className="cursor-not-allowed rounded-lg border border-line/50 px-2.5 py-1 text-xs text-slate-700">
              {l}
            </span>
          ))}
          <span className="mx-1 w-px bg-line" />
          {BUCKETS.map((b) => (
            <button key={b.key}
              className={`rounded-lg px-2.5 py-1 text-xs ${bucket === b.key ? 'bg-line text-slate-200' : 'border border-line text-slate-500 hover:bg-line/40'}`}
              onClick={() => setBucket(b.key)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <Async {...trend} refetch={trend.refetch} isEmpty={(d) => d.series.length === 0}>
        {() => (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} onClick={(e) => drill((e as { activeLabel?: string })?.activeLabel)}>
              <defs>
                <linearGradient id="curGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f242e" />
              <XAxis dataKey="t" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
              {hasRange && <Legend />}
              <Area type="monotone" dataKey="ปัจจุบัน" stroke="#6366f1" strokeWidth={2} fill="url(#curGrad)" />
              {hasRange && (
                <Area type="monotone" dataKey="ช่วงก่อนหน้า" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Async>
      <p className="mt-2 text-[11px] text-slate-600">คลิกจุดบนกราฟเพื่อเปิดรายการข้อมูลของช่วงนั้น</p>
    </div>
  );
}
