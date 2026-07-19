import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { SparePartRequest } from '../api/types';
import { Async, fmtDate } from '../components/ui';

export default function SpareParts() {
  const parts = useQuery({
    queryKey: ['spare-parts'],
    queryFn: () => api<SparePartRequest[]>('/spare-parts'),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Spare Parts (ขออะไหล่เก้าอี้)</h1>
      <Async {...parts} refetch={parts.refetch} isEmpty={(d) => d.length === 0}>
        {(d) => (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2.5">วันที่ขอ</th>
                  <th className="px-3 py-2.5">รุ่น</th>
                  <th className="px-3 py-2.5">GV Serial</th>
                  <th className="px-3 py-2.5">ชิ้นส่วน</th>
                  <th className="px-3 py-2.5">รูป</th>
                </tr>
              </thead>
              <tbody>
                {d.map((p) => (
                  <tr key={p.id} className="border-b border-line/50 last:border-0">
                    <td className="px-3 py-2.5">{fmtDate(p.requestDate)}</td>
                    <td className="px-3 py-2.5 font-medium">{p.model ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{p.gvSerialNo ?? '—'}</td>
                    <td className="px-3 py-2.5">{p.partName ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {p.photoUrls.length > 0 ? (
                        <div className="flex gap-2">
                          {p.photoUrls.map((u, i) => (
                            <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs text-indigo-300 hover:underline">
                              รูป {i + 1}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
    </div>
  );
}
