import { Calendar } from 'lucide-react';
import { DatePreset, PRESET_LABELS, useGlobalFilter } from '../context/GlobalFilter';

/** Global Date Filter ใน header — เปลี่ยนแล้วทุกหน้า/ทุก widget เปลี่ยนตาม */
export function GlobalDateFilter() {
  const { preset, setPreset, customRange, setCustomRange, range } = useGlobalFilter();

  return (
    <div className="flex items-center gap-1.5">
      <Calendar className="hidden h-4 w-4 text-slate-500 sm:block" />
      <select
        className="input !py-1.5 text-xs"
        value={preset}
        onChange={(e) => setPreset(e.target.value as DatePreset)}
        title="Global Date Filter"
      >
        {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
          <option key={p} value={p}>
            {PRESET_LABELS[p]}
          </option>
        ))}
      </select>
      {preset === 'custom' && (
        <span className="flex items-center gap-1">
          <input
            type="date"
            className="input !py-1.5 text-xs"
            value={customRange.dateFrom ?? ''}
            onChange={(e) => setCustomRange({ ...customRange, dateFrom: e.target.value || undefined })}
          />
          <span className="text-slate-600">→</span>
          <input
            type="date"
            className="input !py-1.5 text-xs"
            value={customRange.dateTo ?? ''}
            onChange={(e) => setCustomRange({ ...customRange, dateTo: e.target.value || undefined })}
          />
        </span>
      )}
      {preset !== 'custom' && preset !== 'all' && range.dateFrom && (
        <span className="hidden text-xs text-slate-500 lg:inline">
          {range.dateFrom === range.dateTo ? range.dateFrom : `${range.dateFrom} → ${range.dateTo}`}
        </span>
      )}
    </div>
  );
}
