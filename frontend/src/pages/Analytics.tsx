import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, qs } from '../api/client';
import { useGlobalFilter } from '../context/GlobalFilter';
import { Async, STATUS_LABELS } from '../components/ui';

const PIE_COLORS = ['#f87171', '#fbbf24', '#38bdf8', '#a78bfa', '#fb923c', '#64748b'];

type Dimension = 'product' | 'shop' | 'review_group';
type Sort = 'cases' | 'resolved' | 'satisfaction';

interface RankRow {
  key: string;
  label: string;
  cases: number;
  resolved: number;
  resolvedRate: number;
  avgSatisfaction: number | null;
}
interface ChatBreakdown {
  categories: { order_payment: number; product_info: number; order_status: number; usage_problem: number };
  presale: number;
  postsale: number;
  newCustomers: number;
  returningCustomers: number;
}
interface Overview {
  byProblemGroup: Record<string, number>;
}

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'product', label: 'สินค้า' },
  { key: 'shop', label: 'ช่องทาง' },
  { key: 'review_group', label: 'กลุ่มรีวิว' },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: 'cases', label: 'เคสมากสุด' },
  { key: 'resolved', label: 'ปิดเคสมากสุด' },
  { key: 'satisfaction', label: 'พึงพอใจสูงสุด' },
];

const CAT_LABELS: Record<string, string> = {
  order_payment: 'สั่งซื้อ-ชำระเงิน',
  product_info: 'ข้อมูลสินค้า/สเปค',
  order_status: 'ตามสถานะ',
  usage_problem: 'ปัญหาการใช้งาน',
};

export default function Analytics() {
  const { range } = useGlobalFilter();
  const nav = useNavigate();
  const [dimension, setDimension] = useState<Dimension>('product');
  const [sort, setSort] = useState<Sort>('cases');

  const overview = useQuery({
    queryKey: ['overview', range],
    queryFn: () => api<Overview>(`/analytics/overview${qs(range)}`),
  });
  const ranking = useQuery({
    queryKey: ['ranking', dimension, sort, range],
    queryFn: () => api<RankRow[]>(`/analytics/ranking${qs({ dimension, sort, ...range })}`),
  });
  const chat = useQuery({
    queryKey: ['chat-breakdown', range],
    queryFn: () => api<ChatBreakdown>(`/analytics/chat-breakdown${qs(range)}`),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {/* สัดส่วนกลุ่มปัญหา */}
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">สัดส่วนกลุ่มปัญหา</h2>
          <Async {...overview} refetch={overview.refetch}>
            {(o) => {
              const data = Object.entries(o.byProblemGroup ?? {})
                .filter(([, v]) => v > 0)
                .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, key: k, value: v }));
              return data.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-600">📭 ไม่มีข้อมูลในช่วงที่เลือก</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} label={(e) => `${e.name} (${e.value})`}
                      onClick={(d) => nav(`/after-sales?problemGroup=${(d as { key?: string }).key ?? ''}`)}>
                      {data.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} className="cursor-pointer" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                  </PieChart>
                </ResponsiveContainer>
              );
            }}
          </Async>
        </div>

        {/* Chat breakdown */}
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">💬 Customer Contact Breakdown</h2>
          <Async {...chat} refetch={chat.refetch} isEmpty={(d) => d.presale + d.postsale === 0 && Object.values(d.categories).every((v) => v === 0)}>
            {(d) => {
              const catData = Object.entries(d.categories).map(([k, v]) => ({ name: CAT_LABELS[k] ?? k, value: v }));
              return (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="ก่อนขาย" value={d.presale} color="#38bdf8" />
                    <Stat label="หลังขาย" value={d.postsale} color="#a78bfa" />
                    <Stat label="ลูกค้าใหม่" value={d.newCustomers} color="#34d399" />
                    <Stat label="ลูกค้าเก่า" value={d.returningCustomers} color="#fbbf24" />
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={catData}>
                      <CartesianGrid stroke="#1f242e" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              );
            }}
          </Async>
        </div>
      </div>

      {/* Ranking sortable */}
      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <ArrowUpDown className="h-4 w-4" /> Ranking
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {DIMENSIONS.map((d) => (
              <button key={d.key}
                className={`rounded-lg px-2.5 py-1 text-xs ${dimension === d.key ? 'bg-accent text-white' : 'border border-line text-slate-400 hover:bg-line/40'}`}
                onClick={() => setDimension(d.key)}>
                {d.label}
              </button>
            ))}
            <span className="mx-1 w-px bg-line" />
            {SORTS.map((s) => (
              <button key={s.key}
                className={`rounded-lg px-2.5 py-1 text-xs ${sort === s.key ? 'bg-line text-slate-200' : 'border border-line text-slate-500 hover:bg-line/40'}`}
                onClick={() => setSort(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <Async {...ranking} refetch={ranking.refetch} isEmpty={(d) => d.length === 0}>
          {(rows) => {
            const max = Math.max(...rows.map((r) => r.cases), 1);
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase text-slate-500">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">{DIMENSIONS.find((d) => d.key === dimension)?.label}</th>
                      <th className="px-2 py-2">เคส</th>
                      <th className="px-2 py-2 text-right">ปิดเคส</th>
                      <th className="px-2 py-2 text-right">อัตราปิด</th>
                      <th className="px-2 py-2 text-right">พึงพอใจ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.key || i} className="border-b border-line/50 last:border-0 hover:bg-line/20">
                        <td className="px-2 py-2 text-slate-500">{i + 1}</td>
                        <td className="px-2 py-2 font-medium">{r.label || '—'}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-10 shrink-0">{r.cases.toLocaleString()}</span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                              <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.cases / max) * 100}%` }} />
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right text-emerald-400">{r.resolved.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right">{r.resolvedRate}%</td>
                        <td className="px-2 py-2 text-right">{r.avgSatisfaction ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }}
        </Async>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-line/60 p-2 text-center">
      <p className="text-lg font-semibold" style={{ color }}>{value.toLocaleString()}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
