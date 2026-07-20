import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import { ChatDailyMetric } from '../api/types';
import { Async, fmtDate, KpiCard } from '../components/ui';

export default function CustomerChat() {
  const [shopFilter, setShopFilter] = useState('');
  const metrics = useQuery({
    queryKey: ['chat-metrics'],
    queryFn: () => api<ChatDailyMetric[]>('/chat-metrics'),
  });

  const shops = useMemo(
    () => [...new Set((metrics.data ?? []).map((m) => m.shop?.name).filter(Boolean))] as string[],
    [metrics.data],
  );
  const filtered = useMemo(
    () => (metrics.data ?? []).filter((m) => !shopFilter || m.shop?.name === shopFilter),
    [metrics.data, shopFilter],
  );
  const totals = useMemo(() => {
    const t = { presale: 0, postsale: 0, order: 0, info: 0, status: 0, usage: 0 };
    for (const m of filtered) {
      t.presale += m.presaleTotal;
      t.postsale += m.postsaleTotal;
      t.order += m.qOrderPayment;
      t.info += m.qProductInfo;
      t.status += m.qOrderStatus;
      t.usage += m.qUsageProblem;
    }
    return t;
  }, [filtered]);

  const chart = useMemo(() => {
    const byDate = new Map<string, { date: string; presale: number; postsale: number }>();
    for (const m of filtered) {
      const d = m.metricDate.slice(0, 10);
      const cur = byDate.get(d) ?? { date: d, presale: 0, postsale: 0 };
      cur.presale += m.presaleTotal;
      cur.postsale += m.postsaleTotal;
      byDate.set(d, cur);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <select className="input" value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
          <option value="">ทุก Channel</option>
          {shops.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="ลูกค้าทัก (ก่อนขาย)" loading={metrics.isLoading} value={totals.presale.toLocaleString()} />
        <KpiCard label="ลูกค้าทัก (หลังขาย)" loading={metrics.isLoading} value={totals.postsale.toLocaleString()} />
        <KpiCard label="สั่งซื้อ-ชำระเงิน" loading={metrics.isLoading} value={totals.order.toLocaleString()} />
        <KpiCard label="ถามข้อมูลสินค้า" loading={metrics.isLoading} value={totals.info.toLocaleString()} />
        <KpiCard label="ตามสถานะ" loading={metrics.isLoading} value={totals.status.toLocaleString()} />
        <KpiCard label="ปัญหาการใช้งาน" loading={metrics.isLoading} value={totals.usage.toLocaleString()} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Chat Trend (รายวัน)</h2>
        <Async {...metrics} refetch={metrics.refetch} isEmpty={(d) => d.length === 0}>
          {() => (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chart}>
                <CartesianGrid stroke="#1f242e" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#12151c', border: '1px solid #1f242e' }} />
                <Legend />
                <Bar dataKey="presale" name="ก่อนขาย" stackId="a" fill="#38bdf8" />
                <Bar dataKey="postsale" name="หลังขาย" stackId="a" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Async>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">รายวันล่าสุด</h2>
        <Async {...metrics} refetch={metrics.refetch} isEmpty={(d) => d.length === 0}>
          {() => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-slate-500">
                    <th className="px-2 py-2">วันที่</th>
                    <th className="px-2 py-2">Shop</th>
                    <th className="px-2 py-2 text-right">สั่งซื้อ</th>
                    <th className="px-2 py-2 text-right">ข้อมูลสินค้า</th>
                    <th className="px-2 py-2 text-right">สถานะ</th>
                    <th className="px-2 py-2 text-right">ปัญหา</th>
                    <th className="px-2 py-2 text-right">ก่อน</th>
                    <th className="px-2 py-2 text-right">หลัง</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 30).map((m) => (
                    <tr key={m.id} className="border-b border-line/50 last:border-0">
                      <td className="px-2 py-2">{fmtDate(m.metricDate)}</td>
                      <td className="px-2 py-2">{m.shop?.name ?? '—'}</td>
                      <td className="px-2 py-2 text-right">{m.qOrderPayment}</td>
                      <td className="px-2 py-2 text-right">{m.qProductInfo}</td>
                      <td className="px-2 py-2 text-right">{m.qOrderStatus}</td>
                      <td className="px-2 py-2 text-right">{m.qUsageProblem}</td>
                      <td className="px-2 py-2 text-right text-sky-400">{m.presaleTotal}</td>
                      <td className="px-2 py-2 text-right text-violet-400">{m.postsaleTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Async>
      </div>
    </div>
  );
}
