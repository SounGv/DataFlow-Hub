import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-line/60 ${className}`} />;
}

export function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />;
}

export function EmptyState({ title = 'ไม่มีข้อมูล', detail }: { title?: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Inbox className="h-8 w-8 text-slate-600" />
      <p className="text-sm font-medium text-slate-400">{title}</p>
      {detail && <p className="max-w-sm text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p className="text-sm font-medium text-slate-300">โหลดข้อมูลไม่สำเร็จ</p>
      <p className="max-w-md text-xs text-slate-500">{error instanceof Error ? error.message : String(error)}</p>
      {retry && (
        <button className="btn-ghost mt-2" onClick={retry}>
          ลองใหม่
        </button>
      )}
    </div>
  );
}

/** Wraps react-query states → skeleton / error / empty / content */
export function Async<T>({
  isLoading,
  error,
  data,
  refetch,
  isEmpty,
  skeleton,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
  refetch?: () => void;
  isEmpty?: (d: T) => boolean;
  skeleton?: ReactNode;
  children: (d: T) => ReactNode;
}) {
  if (isLoading) return <>{skeleton ?? <Skeleton className="h-40 w-full" />}</>;
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (data === undefined || (isEmpty && isEmpty(data))) return <EmptyState />;
  return <>{children(data)}</>;
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  loading,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
      )}
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-sky-500/15 text-sky-400',
  received: 'bg-amber-500/15 text-amber-400',
  in_repair: 'bg-orange-500/15 text-orange-400',
  returned: 'bg-violet-500/15 text-violet-400',
  followed_up: 'bg-emerald-500/15 text-emerald-400',
  closed: 'bg-emerald-500/15 text-emerald-400',
  success: 'bg-emerald-500/15 text-emerald-400',
  partial: 'bg-amber-500/15 text-amber-400',
  failed: 'bg-red-500/15 text-red-400',
  running: 'bg-sky-500/15 text-sky-400',
  claim: 'bg-red-500/15 text-red-400',
  review: 'bg-amber-500/15 text-amber-400',
  usage_issue: 'bg-sky-500/15 text-sky-400',
  after_sales: 'bg-violet-500/15 text-violet-400',
  exchange_return: 'bg-orange-500/15 text-orange-400',
  other: 'bg-slate-500/15 text-slate-400',
};

export const STATUS_LABELS: Record<string, string> = {
  open: 'รับแจ้ง',
  received: 'ได้รับของ',
  in_repair: 'กำลังเคลม',
  returned: 'ส่งคืนแล้ว',
  followed_up: 'ติดตามแล้ว',
  closed: 'ปิดเคส',
  claim: 'เคลม',
  review: 'รีวิว',
  usage_issue: 'แจ้งปัญหาการใช้งาน',
  after_sales: 'บริการหลังการขาย',
  exchange_return: 'เปลี่ยน/คืนสินค้า',
  other: 'อื่น ๆ',
};

export function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[value] ?? STATUS_COLORS.other}`}>
      {STATUS_LABELS[value] ?? value}
    </span>
  );
}

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const fmtNum = (n?: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString());
