import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { ReactNode } from 'react';
import { Skeleton } from './ui';
import { Sparkline } from './Sparkline';

export interface KpiMetric {
  available: boolean;
  current?: number;
  previous?: number | null;
  changePct?: number | null;
  spark?: number[];
  reason?: string;
}

/**
 * KPI Card ตาม spec Phase 2: Current Value + Previous Period + % Change + Trend Arrow + Mini Sparkline
 * metric ที่ available:false แสดงสถานะรอแหล่งข้อมูล (REAL DATA ONLY — ไม่มีเลขปลอม)
 */
export function KpiStatCard({
  label, icon, metric, loading, onClick, goodWhenDown,
}: {
  label: string;
  icon?: ReactNode;
  metric?: KpiMetric;
  loading?: boolean;
  onClick?: () => void;
  /** metric ที่ "ลดลง = ดี" เช่น เคสค้าง — กลับสีลูกศร */
  goodWhenDown?: boolean;
}) {
  const change = metric?.changePct ?? null;
  const up = change !== null && change > 0;
  const flat = change !== null && change === 0;
  const good = change === null ? null : goodWhenDown ? !up : up;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card text-left transition-colors ${onClick ? 'cursor-pointer hover:border-accent/50' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : !metric?.available ? (
        <div className="mt-1">
          <p className="text-2xl font-semibold text-slate-600">—</p>
          <p className="mt-1 text-[11px] leading-tight text-slate-600">{metric?.reason ?? 'รอแหล่งข้อมูล'}</p>
        </div>
      ) : (
        <>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="text-2xl font-semibold text-slate-100">{(metric.current ?? 0).toLocaleString()}</p>
            {metric.spark && metric.spark.length > 1 && (
              <Sparkline data={metric.spark} stroke={good === null ? '#6366f1' : good ? '#34d399' : '#f87171'} />
            )}
          </div>
          {change !== null ? (
            <p className={`mt-1 flex items-center gap-1 text-xs ${flat ? 'text-slate-500' : good ? 'text-emerald-400' : 'text-red-400'}`}>
              {flat ? <Minus className="h-3 w-3" /> : up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(change)}%
              <span className="text-slate-600">vs ช่วงก่อนหน้า ({(metric.previous ?? 0).toLocaleString()})</span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-600">เลือกช่วงวันที่เพื่อเทียบช่วงก่อนหน้า</p>
          )}
        </>
      )}
    </button>
  );
}
