import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { SyncEvent, SyncSourceStatus } from '../api/types';
import { useLiveSync } from '../components/Layout';
import { Async, Badge, fmtDateTime, Skeleton } from '../components/ui';

export default function SyncMonitor() {
  const qc = useQueryClient();
  const { live, lastEvent } = useLiveSync();
  const [events, setEvents] = useState<SyncEvent[]>([]);

  useEffect(() => {
    if (lastEvent) {
      setEvents((prev) => [lastEvent, ...prev].slice(0, 50));
      // DATA_UPDATED → refresh without full reload
      qc.invalidateQueries({ queryKey: ['sync-status'] });
      if (lastEvent.type === 'finished') qc.invalidateQueries();
    }
  }, [lastEvent, qc]);

  const status = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api<SyncSourceStatus[]>('/sync/status'),
    refetchInterval: 30_000,
  });

  const runAll = useMutation({
    mutationFn: () => api<{ enqueued: number }>('/sync/run', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-status'] }),
  });
  const runOne = useMutation({
    mutationFn: (id: string) => api(`/sync/run/${id}`, { method: 'POST' }),
  });

  const staleness = (s: SyncSourceStatus): string => {
    if (s.lastRun?.status === 'running') return 'SYNCING';
    if (s.lastRun?.status === 'failed') return 'ERROR';
    if (!s.lastSyncedAt) return 'STALE';
    return Date.now() - new Date(s.lastSyncedAt).getTime() > 3600_000 ? 'STALE' : 'SYNCED';
  };
  const stalenessColor: Record<string, string> = {
    SYNCED: 'text-emerald-400',
    SYNCING: 'text-sky-400',
    ERROR: 'text-red-400',
    STALE: 'text-amber-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-xl font-semibold">
          Sync Monitor
          <span className="flex items-center gap-1.5 text-xs font-normal text-slate-500">
            <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            {live ? 'LIVE' : 'OFFLINE'}
          </span>
        </h1>
        <button className="btn" onClick={() => runAll.mutate()} disabled={runAll.isPending}>
          <RefreshCw className={`h-4 w-4 ${runAll.isPending ? 'animate-spin' : ''}`} />
          Sync ทั้งหมด
        </button>
      </div>

      <Async {...status} refetch={status.refetch} skeleton={<Skeleton className="h-72 w-full" />}>
        {(sources) => (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2.5">Sheet</th>
                  <th className="px-3 py-2.5">Table</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Last Sync</th>
                  <th className="px-3 py-2.5 text-right">Read</th>
                  <th className="px-3 py-2.5 text-right">Upserted</th>
                  <th className="px-3 py-2.5 text-right">Rejected</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b border-line/50 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{s.sheetName}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{s.targetTable}</td>
                    <td className={`px-3 py-2.5 text-xs font-semibold ${stalenessColor[staleness(s)]}`}>
                      {staleness(s)}
                      {s.lastRun && <span className="ml-2"><Badge value={s.lastRun.status} /></span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{fmtDateTime(s.lastSyncedAt)}</td>
                    <td className="px-3 py-2.5 text-right">{s.lastRun?.rowsRead?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-400">{s.lastRun?.rowsUpserted?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-amber-400">{s.lastRun?.rowsRejected?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <button className="btn-ghost !p-1.5" title="Sync sheet นี้" onClick={() => runOne.mutate(s.id)}>
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>

      <div className="card">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">Live Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มี event — จะแสดงสดเมื่อ worker ทำงาน</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {events.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <Badge value={e.type === 'finished' ? 'success' : e.type === 'started' ? 'running' : e.type} />
                <span className="font-medium">{e.sheetName}</span>
                {e.rowsUpserted !== undefined && (
                  <span className="text-slate-500">{e.rowsUpserted}/{e.rowsRead} upserted · {e.rowsRejected} rejected</span>
                )}
                {e.error && <span className="text-red-400">{e.error}</span>}
                <span className="ml-auto text-slate-600">{new Date(e.at).toLocaleTimeString('th-TH')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
