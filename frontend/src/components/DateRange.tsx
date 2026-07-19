import { useState } from 'react';

export interface Range {
  dateFrom?: string;
  dateTo?: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

const PRESETS: { label: string; range: () => Range }[] = [
  { label: 'วันนี้', range: () => ({ dateFrom: iso(new Date()), dateTo: iso(new Date()) }) },
  {
    label: 'เมื่อวาน',
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { dateFrom: iso(d), dateTo: iso(d) };
    },
  },
  {
    label: '7 วัน',
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { dateFrom: iso(d), dateTo: iso(new Date()) };
    },
  },
  {
    label: 'เดือนนี้',
    range: () => {
      const n = new Date();
      return { dateFrom: iso(new Date(n.getFullYear(), n.getMonth(), 1)), dateTo: iso(n) };
    },
  },
  { label: 'ทั้งหมด', range: () => ({}) },
];

export function DateRangeFilter({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [custom, setCustom] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          className="btn-ghost !py-1.5 text-xs"
          onClick={() => {
            setCustom(false);
            onChange(p.range());
          }}
        >
          {p.label}
        </button>
      ))}
      <button className="btn-ghost !py-1.5 text-xs" onClick={() => setCustom((v) => !v)}>
        กำหนดเอง
      </button>
      {custom && (
        <span className="flex items-center gap-1">
          <input
            type="date"
            className="input !py-1.5 text-xs"
            value={value.dateFrom ?? ''}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })}
          />
          <span className="text-slate-500">→</span>
          <input
            type="date"
            className="input !py-1.5 text-xs"
            value={value.dateTo ?? ''}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value || undefined })}
          />
        </span>
      )}
    </div>
  );
}
