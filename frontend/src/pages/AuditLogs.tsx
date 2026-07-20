import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { AuditLog } from '../api/types';
import { Async, fmtDateTime } from '../components/ui';

export default function AuditLogs() {
  const logs = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api<AuditLog[]>('/audit-logs'),
  });

  return (
    <div className="space-y-4">
      <Async {...logs} refetch={logs.refetch} isEmpty={(d) => d.length === 0}>
        {(d) => (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2.5">เวลา</th>
                  <th className="px-3 py-2.5">ผู้ใช้</th>
                  <th className="px-3 py-2.5">Action</th>
                  <th className="px-3 py-2.5">Entity</th>
                </tr>
              </thead>
              <tbody>
                {d.map((l) => (
                  <tr key={l.id} className="border-b border-line/50 last:border-0">
                    <td className="px-3 py-2.5 text-xs text-slate-400">{fmtDateTime(l.at)}</td>
                    <td className="px-3 py-2.5">{l.actor}</td>
                    <td className="px-3 py-2.5 font-medium">{l.action}</td>
                    <td className="px-3 py-2.5 text-slate-400">{l.entity ?? '—'}</td>
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
