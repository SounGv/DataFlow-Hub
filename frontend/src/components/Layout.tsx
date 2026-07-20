import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Boxes, Brain, Database, FileClock, FileText, Home, LogOut, Menu, MessageSquare,
  Package, Printer, RefreshCw, Search, Settings as SettingsIcon, Star, TrendingUp, User, Wrench,
} from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, API_BASE, auth } from '../api/client';
import { SearchResult, SyncEvent, SyncSourceStatus } from '../api/types';
import { GlobalFilterProvider } from '../context/GlobalFilter';
import { GlobalDateFilter } from './GlobalDateFilter';
import { Badge } from './ui';

/** MAIN NAVIGATION — โครงตาม spec (Phase 1) */
const NAV: { group: string; items: { to: string; label: string; icon: ReactNode }[] }[] = [
  {
    group: 'OVERVIEW',
    items: [
      { to: '/overview', label: 'Overview', icon: <Home className="h-4 w-4" /> },
      { to: '/analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
      { to: '/reports', label: 'Report Center', icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    group: 'OPERATIONS',
    items: [
      { to: '/customer-chat', label: 'Customer & Chat', icon: <MessageSquare className="h-4 w-4" /> },
      { to: '/sales', label: 'Sales Performance', icon: <TrendingUp className="h-4 w-4" /> },
      { to: '/shipments', label: 'Shipments', icon: <Package className="h-4 w-4" /> },
      { to: '/after-sales', label: 'After-sales', icon: <Wrench className="h-4 w-4" /> },
    ],
  },
  {
    group: 'INSIGHTS',
    items: [
      { to: '/customer-voice', label: 'Customer Voice', icon: <Star className="h-4 w-4" /> },
      { to: '/product-service', label: 'Product Service', icon: <Boxes className="h-4 w-4" /> },
      { to: '/spare-parts', label: 'Spare Parts', icon: <Wrench className="h-4 w-4" /> },
      { to: '/knowledge-base', label: 'Knowledge Base', icon: <Brain className="h-4 w-4" /> },
    ],
  },
  {
    group: 'SYSTEM',
    items: [
      { to: '/data-sources', label: 'Data Sources', icon: <Database className="h-4 w-4" /> },
      { to: '/sync-monitor', label: 'Sync Monitor', icon: <RefreshCw className="h-4 w-4" /> },
      { to: '/audit-logs', label: 'Audit Logs', icon: <FileClock className="h-4 w-4" /> },
      { to: '/settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" /> },
    ],
  },
  {
    group: 'TOOLS',
    items: [{ to: '/print-center', label: 'Print Center', icon: <Printer className="h-4 w-4" /> }],
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/analytics': 'Analytics',
  '/reports': 'Report Center',
  '/customer-chat': 'Customer & Chat',
  '/sales': 'Sales Performance',
  '/shipments': 'Shipments',
  '/after-sales': 'After-sales',
  '/customer-voice': 'Customer Voice',
  '/product-service': 'Product Service',
  '/spare-parts': 'Spare Parts',
  '/knowledge-base': 'Knowledge Base',
  '/data-sources': 'Data Sources',
  '/sync-monitor': 'Sync Monitor',
  '/audit-logs': 'Audit Logs',
  '/settings': 'Settings',
  '/print-center': 'Print Center',
};

/** LIVE indicator — subscribe SSE sync events */
export function useLiveSync() {
  const [live, setLive] = useState(false);
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/sync/stream?token=${auth.token ?? ''}`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (e) => {
      try {
        setLastEvent(JSON.parse(e.data) as SyncEvent);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);
  return { live, lastEvent };
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api<SearchResult>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
      <input
        className="input w-full !pl-9"
        placeholder="ค้นหา ลูกค้า / เบอร์ / Order / Tracking / SKU"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && q.trim().length >= 2 && data && (
        <div className="absolute z-30 mt-1 max-h-96 w-96 max-w-[90vw] overflow-y-auto rounded-xl border border-line bg-panel p-2 shadow-xl">
          {data.customers.length === 0 && data.cases.length === 0 && data.products.length === 0 && (
            <p className="p-3 text-sm text-slate-500">ไม่พบผลลัพธ์</p>
          )}
          {data.customers.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">ลูกค้า</p>
              {data.customers.map((c) => (
                <button key={c.id} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-line/50"
                  onClick={() => { setOpen(false); nav(`/customers/${c.id}`); }}>
                  {c.fullName ?? c.chatName} <span className="text-slate-500">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
          {data.cases.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">เคส</p>
              {data.cases.map((c) => (
                <button key={c.id} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-line/50"
                  onClick={() => { setOpen(false); nav(`/after-sales?case=${c.id}`); }}>
                  <span className="font-medium">{c.caseCode}</span>{' '}
                  <span className="text-slate-500">
                    {c.customer?.fullName} · {c.product?.sku} · {c.returnTrackingNo ?? c.orderNo ?? ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {data.products.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">สินค้า</p>
              {data.products.map((p) => (
                <button key={p.id} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-line/50"
                  onClick={() => { setOpen(false); nav(`/after-sales?q=${p.sku}`); }}>
                  {p.sku} <span className="text-slate-500">{p.brand}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserChip() {
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ email: string; role: string }>('/auth/me'),
    staleTime: Infinity,
    retry: 0,
  });
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-xs text-slate-400" title={data?.email}>
      <User className="h-3.5 w-3.5" />
      <span className="hidden max-w-[120px] truncate md:inline">{data?.email ?? 'guest'}</span>
    </span>
  );
}

export default function Layout() {
  const nav = useNavigate();
  const location = useLocation();
  const { live, lastEvent } = useLiveSync();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status-header', lastEvent?.at],
    queryFn: () => api<SyncSourceStatus[]>('/sync/status'),
    refetchInterval: 60_000,
  });
  const lastSynced = syncStatus?.map((s) => s.lastSyncedAt).filter(Boolean).sort().at(-1);
  const pageTitle =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/customers/') ? 'Customer Profile' : 'DataFlow Hub');

  const sidebar = (
    <nav className="flex h-full w-60 flex-col gap-4 overflow-y-auto border-r border-line bg-panel p-4">
      <Link to="/overview" className="flex items-center gap-2 px-1">
        <span className="rounded-lg bg-accent px-2 py-1 text-sm font-bold text-white">DF</span>
        <span className="text-sm font-semibold tracking-wide text-slate-100">DATAFLOW HUB</span>
      </Link>
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{g.group}</p>
          {g.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
                  isActive ? 'bg-accent/15 font-medium text-indigo-300' : 'text-slate-400 hover:bg-line/40 hover:text-slate-200'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
      {auth.token && (
        <button
          className="mt-auto flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-line/40"
          onClick={async () => {
            try {
              await api('/auth/logout', { method: 'POST' });
            } finally {
              auth.clear();
              nav('/login');
            }
          }}
        >
          <LogOut className="h-4 w-4" /> ออกจากระบบ
        </button>
      )}
    </nav>
  );

  return (
    <GlobalFilterProvider>
      <div className="flex h-screen">
        <div className="hidden lg:block">{sidebar}</div>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <div className="relative z-50">{sidebar}</div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* HEADER: Title · Search · Global Date Filter · LIVE · Last updated · User */}
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-panel/70 px-4 py-2.5 backdrop-blur">
            <button className="btn-ghost !p-2 lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="mr-2 text-base font-semibold text-slate-100">{pageTitle}</h1>
            <div className="hidden flex-1 justify-center md:flex">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <GlobalDateFilter />
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {live ? 'LIVE' : 'OFFLINE'}
              </span>
              {lastEvent && (
                <span className="hidden items-center gap-1 text-xs text-slate-500 xl:flex">
                  <Badge value={lastEvent.type === 'finished' ? 'success' : lastEvent.type} />
                  {lastEvent.sheetName}
                </span>
              )}
              {lastSynced && (
                <span className="hidden text-xs text-slate-500 xl:inline">
                  Last updated {new Date(lastSynced).toLocaleTimeString('th-TH')}
                </span>
              )}
              <UserChip />
            </div>
          </header>
          <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </GlobalFilterProvider>
  );
}
