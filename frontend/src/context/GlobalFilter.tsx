import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

/**
 * GLOBAL FILTERS (Phase 1 — Information Architecture)
 * Filter กลางของทั้งระบบ: Date (ใช้งานแล้ว) + Admin/Channel/Product/Status (โครงพร้อม, จะ wire ใน Phase 2-3)
 * เมื่อเปลี่ยนค่า ทุก widget/หน้า ที่ subscribe ผ่าน useGlobalFilter() จะ refetch ตามพร้อมกัน
 */

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'prevMonth'
  | 'thisYear'
  | 'all'
  | 'custom';

export interface DateRangeValue {
  dateFrom?: string;
  dateTo?: string;
}

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'วันนี้',
  yesterday: 'เมื่อวาน',
  last7: '7 วันล่าสุด',
  last30: '30 วันล่าสุด',
  thisMonth: 'เดือนนี้',
  prevMonth: 'เดือนก่อน',
  thisYear: 'ปีนี้',
  all: 'ทั้งหมด',
  custom: 'กำหนดเอง',
};

const iso = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

export function computeRange(preset: DatePreset, custom: DateRangeValue): DateRangeValue {
  const now = new Date();
  const day = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };
  switch (preset) {
    case 'today':
      return { dateFrom: iso(now), dateTo: iso(now) };
    case 'yesterday':
      return { dateFrom: iso(day(-1)), dateTo: iso(day(-1)) };
    case 'last7':
      return { dateFrom: iso(day(-6)), dateTo: iso(now) };
    case 'last30':
      return { dateFrom: iso(day(-29)), dateTo: iso(now) };
    case 'thisMonth':
      return { dateFrom: iso(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: iso(now) };
    case 'prevMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: iso(first), dateTo: iso(last) };
    }
    case 'thisYear':
      return { dateFrom: iso(new Date(now.getFullYear(), 0, 1)), dateTo: iso(now) };
    case 'custom':
      return custom;
    case 'all':
    default:
      return {};
  }
}

/** ช่วงก่อนหน้า (ความยาวเท่ากัน) — ใช้ทำ KPI compare ใน Phase 2 */
export function previousRange(range: DateRangeValue): DateRangeValue {
  if (!range.dateFrom || !range.dateTo) return {};
  const from = new Date(range.dateFrom);
  const to = new Date(range.dateTo);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - days + 1);
  return { dateFrom: iso(prevFrom), dateTo: iso(prevTo) };
}

interface GlobalFilterContextValue {
  preset: DatePreset;
  setPreset: (p: DatePreset) => void;
  customRange: DateRangeValue;
  setCustomRange: (r: DateRangeValue) => void;
  /** ช่วงวันที่ effective — ใช้ส่งเข้า API */
  range: DateRangeValue;
  /** ช่วงก่อนหน้า สำหรับ compare */
  prevRange: DateRangeValue;
  // Reserved filters (Phase 2-3): ทำงานร่วมกับ date เสมอ
  shopId?: string;
  setShopId: (v?: string) => void;
  productId?: string;
  setProductId: (v?: string) => void;
  status?: string;
  setStatus: (v?: string) => void;
}

const Ctx = createContext<GlobalFilterContextValue | null>(null);

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<DatePreset>('all');
  const [customRange, setCustomRange] = useState<DateRangeValue>({});
  const [shopId, setShopId] = useState<string | undefined>();
  const [productId, setProductId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();

  const range = useMemo(() => computeRange(preset, customRange), [preset, customRange]);
  const prevRange = useMemo(() => previousRange(range), [range]);

  const value = useMemo(
    () => ({
      preset, setPreset, customRange, setCustomRange, range, prevRange,
      shopId, setShopId, productId, setProductId, status, setStatus,
    }),
    [preset, customRange, range, prevRange, shopId, productId, status],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGlobalFilter(): GlobalFilterContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGlobalFilter must be used within GlobalFilterProvider');
  return v;
}
