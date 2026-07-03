'use client';

import { useRouter } from 'next/navigation';
import type { PeriodoNomina } from '@/lib/types';

export default function PeriodoSelect({ periodos, value }: { periodos: PeriodoNomina[]; value: string }) {
  const router = useRouter();
  return (
    <select
      value={value}
      onChange={e => router.push(`/dashboard/nomina?periodo=${e.target.value}`)}
      className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      {periodos.map(p => (
        <option key={p.id} value={p.id}>
          {new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
          {' – '}
          {new Date(p.fecha_fin + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          {p.estado === 'abierto' ? ' (abierto)' : ''}
        </option>
      ))}
    </select>
  );
}
