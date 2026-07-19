import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, qs } from '../api/client';
import { FaqEntry } from '../api/types';
import { Async } from '../components/ui';

export default function KnowledgeBase() {
  const [brand, setBrand] = useState('');
  const [q, setQ] = useState('');
  const faq = useQuery({
    queryKey: ['faq', brand, q],
    queryFn: () => api<FaqEntry[]>(`/faq${qs({ brand, q })}`),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Knowledge Base</h1>
      <div className="flex flex-wrap gap-2">
        <input className="input w-64" placeholder="ค้นหาคำถาม / SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">ทุกแบรนด์</option>
          <option value="fantech">Fantech</option>
          <option value="ugreen">Ugreen</option>
        </select>
      </div>
      <Async {...faq} refetch={faq.refetch} isEmpty={(d) => d.length === 0}>
        {(d) => (
          <div className="space-y-2">
            {d.map((f) => (
              <details key={f.id} className="card group">
                <summary className="cursor-pointer text-sm font-medium marker:text-slate-600">
                  {f.sku && <span className="mr-2 rounded bg-line px-1.5 py-0.5 text-xs text-slate-400">{f.sku}</span>}
                  {f.question}
                  {f.brand && <span className="ml-2 text-xs uppercase text-slate-500">{f.brand}</span>}
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{f.answer ?? '—'}</p>
                {f.manualUrl && (
                  <a href={f.manualUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-indigo-300 hover:underline">
                    คู่มือ →
                  </a>
                )}
              </details>
            ))}
          </div>
        )}
      </Async>
    </div>
  );
}
