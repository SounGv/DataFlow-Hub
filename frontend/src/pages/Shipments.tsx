import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../api/client';
import { Paged, ServiceCase } from '../api/types';
import { Column, DataTable } from '../components/DataTable';
import { Badge, fmtDate } from '../components/ui';

/** Shipments = เคสที่มีการส่งสินค้าคืนลูกค้า (tracking จริงจากระบบเคลม) */
export default function Shipments() {
  const [, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  useEffect(() => setPage(1), [q]);

  const query = useQuery({
    queryKey: ['shipments', page, q],
    queryFn: () => api<Paged<ServiceCase>>(`/cases${qs({ page, pageSize: 25, q, status: 'returned' })}`),
  });

  const columns: Column<ServiceCase>[] = [
    { header: 'Tracking', cell: (c) => <span className="font-medium">{c.returnTrackingNo ?? '—'}</span> },
    { header: 'ลูกค้า', cell: (c) => c.customer?.fullName ?? c.customer?.chatName ?? '—' },
    { header: 'เบอร์โทร', cell: (c) => <span className="text-slate-400">{c.customer?.phone ?? '—'}</span> },
    { header: 'Order', cell: (c) => c.orderNo ?? '—' },
    { header: 'สินค้า', cell: (c) => c.product?.sku ?? '—' },
    { header: 'วันที่ส่ง', cell: (c) => fmtDate(c.returnedDate) },
    { header: 'SMS', cell: (c) => (c.smsNotified ? <Badge value="success" /> : <span className="text-slate-600">—</span>) },
    { header: 'Case', cell: (c) => <span className="text-xs text-indigo-300">{c.caseCode}</span> },
  ];

  return (
    <div className="space-y-4">
      <input
        className="input w-full max-w-md"
        placeholder="ค้นหา ลูกค้า / เบอร์ / Order / Tracking"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <DataTable
        data={query.data}
        isLoading={query.isLoading}
        columns={columns}
        page={page}
        setPage={setPage}
        onRowClick={(c) => setParams({ case: c.id }, { state: undefined })}
      />
      <p className="text-xs text-slate-600">* ข้อมูลจากเคสหลังการขายที่ส่งสินค้าคืนแล้ว (Tracking ขาส่งคืนจริง)</p>
    </div>
  );
}
