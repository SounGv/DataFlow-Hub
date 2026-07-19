import { useQuery } from '@tanstack/react-query';
import { Phone, User } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Customer } from '../api/types';
import { Async, Badge, fmtDate, Skeleton } from '../components/ui';

/** Customer Profile — timeline จากทุกเคสของลูกค้า (spec: Chat → Order → Shipment → After-sales → Review) */
export default function CustomerProfile() {
  const { id } = useParams();
  const customer = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api<Customer>(`/customers/${id}`),
    enabled: !!id,
  });

  return (
    <div className="space-y-4">
      <Async {...customer} refetch={customer.refetch} skeleton={<Skeleton className="h-60 w-full" />}>
        {(c) => (
          <>
            <div className="card flex flex-wrap items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-indigo-300">
                <User className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-lg font-semibold">{c.fullName ?? c.chatName ?? 'ลูกค้า'}</h1>
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  {c.chatName && <span>แชท: {c.chatName}</span>}
                  {c.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </span>
                  )}
                </p>
                {c.address && <p className="mt-1 max-w-xl text-xs text-slate-500">{c.address}</p>}
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-semibold">{c.serviceCases?.length ?? 0}</p>
                <p className="text-xs text-slate-500">เคสทั้งหมด</p>
              </div>
            </div>

            <div className="card">
              <h2 className="mb-4 text-sm font-semibold text-slate-300">Timeline</h2>
              {(c.serviceCases?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">ไม่มีประวัติเคส</p>
              ) : (
                <ol className="relative ml-3 space-y-6 border-l border-line pl-6">
                  {c.serviceCases!.map((sc) => (
                    <li key={sc.id} className="relative">
                      <span className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link to={`/after-sales?case=${sc.id}`} className="font-medium text-indigo-300 hover:underline">
                          {sc.caseCode}
                        </Link>
                        <Badge value={sc.problemGroup} />
                        <Badge value={sc.status} />
                        <span className="text-xs text-slate-500">{fmtDate(sc.caseDate)} · {sc.shop?.name}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {sc.product?.sku && <span className="mr-2 font-medium text-slate-300">{sc.product.sku}</span>}
                        {sc.problem ?? '—'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        {sc.orderNo && <span>Order: {sc.orderNo}</span>}
                        {sc.returnTrackingNo && <span>Tracking: {sc.returnTrackingNo}</span>}
                        {sc.returnedDate && <span>ส่งคืน: {fmtDate(sc.returnedDate)}</span>}
                        {(sc.followups?.length ?? 0) > 0 && sc.followups![0].satisfaction10 !== null && (
                          <span>พึงพอใจ: {sc.followups![0].satisfaction10 ?? sc.followups![0].satisfaction5}/10</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </Async>
    </div>
  );
}
