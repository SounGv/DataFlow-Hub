import { useQuery } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { api } from '../api/client';
import { SyncSourceStatus } from '../api/types';
import { Async, fmtDateTime } from '../components/ui';

export default function DataSources() {
  const status = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api<SyncSourceStatus[]>('/sync/status'),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Google Sheets เป็น Source of Truth — ระบบ sync ทางเดียวเข้า PostgreSQL ตาม mapping ใน docs/DATA_MAPPING.md
      </p>
      <Async {...status} refetch={status.refetch} isEmpty={(d) => d.length === 0}>
        {(sources) => (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((s) => (
              <div key={s.id} className="card">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-slate-500" />
                  <p className="font-medium">{s.sheetName}</p>
                  <span className={`ml-auto h-2 w-2 rounded-full ${s.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </div>
                <p className="mt-1 text-xs text-slate-500">→ {s.targetTable}</p>
                <p className="mt-2 text-xs text-slate-500">Sync ล่าสุด: {fmtDateTime(s.lastSyncedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Async>
    </div>
  );
}
