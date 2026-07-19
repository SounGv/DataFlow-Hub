import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';
import { Paged } from '../api/types';
import { EmptyState, Skeleton } from './ui';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Server-side paginated table (Phase 3 TABLE PERFORMANCE rules) */
export function DataTable<T>({
  data,
  isLoading,
  columns,
  onRowClick,
  page,
  setPage,
}: {
  data?: Paged<T>;
  isLoading: boolean;
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  page: number;
  setPage: (p: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!data || data.items.length === 0) return <EmptyState />;

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left text-xs uppercase tracking-wide text-slate-500">
              {columns.map((c) => (
                <th key={c.header} className={`px-3 py-2.5 font-medium ${c.className ?? ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-line/50 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-line/30' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((c) => (
                  <td key={c.header} className={`px-3 py-2.5 ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {data.total.toLocaleString()} รายการ · หน้า {data.page}/{data.totalPages}
        </span>
        <div className="flex gap-1">
          <button className="btn-ghost !px-2 !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="btn-ghost !px-2 !py-1"
            disabled={page >= data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
