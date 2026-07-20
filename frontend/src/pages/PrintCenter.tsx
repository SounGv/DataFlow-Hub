import { useQuery } from '@tanstack/react-query';
import { Printer, Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client';
import { Customer, SearchResult, ServiceCase } from '../api/types';
import { fmtDate } from '../components/ui';

/**
 * Print Center — ค้นหาลูกค้า → เลือกเคส/ออเดอร์ → ดึงข้อมูลล่าสุด → Preview → Print
 * พนักงานไม่ต้องกรอกข้อมูลซ้ำ (ใบแปะหน้ากล่องส่งคืนลูกค้า)
 */
export default function PrintCenter() {
  const [q, setQ] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedCase, setSelectedCase] = useState<ServiceCase | null>(null);
  const [sender, setSender] = useState({ name: 'บริษัท แก็ดเจ็ต วิลล่า จำกัด', phone: '' });

  const search = useQuery({
    queryKey: ['print-search', q],
    queryFn: () => api<SearchResult>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });
  const profile = useQuery({
    queryKey: ['customer', customer?.id],
    queryFn: () => api<Customer>(`/customers/${customer!.id}`),
    enabled: !!customer,
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <div className="card space-y-3">
          <p className="text-sm font-medium">1) ค้นหาลูกค้า</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input className="input w-full !pl-9" placeholder="ชื่อ หรือ เบอร์โทร"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {search.data && q.trim().length >= 2 && !customer && (
            <div className="space-y-1">
              {search.data.customers.length === 0 && <p className="text-sm text-slate-500">ไม่พบลูกค้า</p>}
              {search.data.customers.map((c) => (
                <button key={c.id} className="block w-full rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-line/40"
                  onClick={() => setCustomer(c)}>
                  {c.fullName ?? c.chatName} <span className="text-slate-500">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
          {customer && (
            <div className="flex items-center justify-between rounded-lg bg-accent/10 px-3 py-2 text-sm">
              <span>{customer.fullName ?? customer.chatName} · {customer.phone}</span>
              <button className="text-xs text-slate-400 hover:text-slate-200"
                onClick={() => { setCustomer(null); setSelectedCase(null); }}>เปลี่ยน</button>
            </div>
          )}
        </div>

        {customer && (
          <div className="card space-y-2">
            <p className="text-sm font-medium">2) เลือกเคส/ออเดอร์ (ข้อมูลล่าสุดจากระบบ)</p>
            {(profile.data?.serviceCases ?? []).map((sc) => (
              <button key={sc.id}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedCase?.id === sc.id ? 'border-accent bg-accent/10' : 'border-line hover:bg-line/40'
                }`}
                onClick={() => setSelectedCase(sc)}>
                <span className="font-medium">{sc.caseCode}</span>
                <span className="ml-2 text-slate-500">{fmtDate(sc.caseDate)} · {sc.product?.sku ?? ''} · {sc.orderNo ?? ''}</span>
              </button>
            ))}
            {profile.data && (profile.data.serviceCases?.length ?? 0) === 0 && (
              <p className="text-sm text-slate-500">ลูกค้าคนนี้ไม่มีเคสในระบบ</p>
            )}
          </div>
        )}

        {selectedCase && (
          <div className="card space-y-3">
            <p className="text-sm font-medium">3) ผู้ส่ง</p>
            <input className="input w-full" value={sender.name}
              onChange={(e) => setSender({ ...sender, name: e.target.value })} placeholder="ชื่อผู้ส่ง" />
            <input className="input w-full" value={sender.phone}
              onChange={(e) => setSender({ ...sender, phone: e.target.value })} placeholder="โทรผู้ส่ง" />
            <button className="btn w-full justify-center" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> พิมพ์ใบแปะหน้า
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-400">Preview</p>
        {selectedCase && customer ? (
          <div id="print-area" className="rounded-xl border-2 border-dashed border-line bg-white p-6 text-black">
            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="w-24 border border-black p-2 align-top font-bold">ผู้ส่ง<br />(FROM)</td>
                  <td className="border border-black p-2">
                    {sender.name}
                    {sender.phone && <><br />โทร. {sender.phone}</>}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 align-top font-bold">ผู้รับ<br />(TO)</td>
                  <td className="border border-black p-2">
                    <span className="text-base font-bold">{customer.fullName ?? customer.chatName}</span>
                    <br />
                    {customer.address ?? '(ไม่มีที่อยู่ในระบบ)'}
                    <br />โทร. {customer.phone ?? '—'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-bold">อ้างอิง</td>
                  <td className="border border-black p-2">
                    เคส {selectedCase.caseCode} · สินค้า {selectedCase.product?.sku ?? selectedCase.productRaw ?? '—'}
                    {selectedCase.orderNo && <> · Order {selectedCase.orderNo}</>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-line text-sm text-slate-600">
            เลือกลูกค้าและเคสเพื่อดูตัวอย่าง
          </div>
        )}
      </div>
    </div>
  );
}
