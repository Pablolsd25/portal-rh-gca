'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';
import { fetchAndGenerateCreditPDF } from '@/lib/creditos/pdf';
import type { Credit } from '@/lib/creditos/types';

type Tab = 'pendiente' | 'activo' | 'all';

const PAGE_SIZE = 25;

export default function CreditosClient({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Credit[]>([]);
  const [tab, setTab] = useState<Tab>('pendiente');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pendiente: 0, activo: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('credits')
        .select(
          'id, status, requested_amount, total_amount_due, credit_type, start_date, created_at, weekly_payment_amount, payment_term_weeks, refinanced_from_credit_id, clients(full_name)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to);
      if (tab !== 'all') q = q.eq('status', tab);

      const [list, pend, act] = await Promise.all([
        q,
        supabase.from('credits').select('*', { count: 'exact', head: true }).eq('status', 'pendiente'),
        supabase.from('credits').select('*', { count: 'exact', head: true }).eq('status', 'activo'),
      ]);
      if (list.error) throw list.error;
      setRows((list.data as unknown as Credit[]) || []);
      setTotalCount(list.count ?? 0);
      setCounts({ pendiente: pend.count ?? 0, activo: act.count ?? 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar créditos');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [tab]);

  const decidir = async (id: string, status: 'activo' | 'rechazado') => {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        status,
        approved_by_staff_id: userId,
        approved_or_rejected_at: new Date().toISOString(),
      };
      if (status === 'activo') {
        payload.start_date = new Date().toISOString().slice(0, 10);
      }
      const { error: err } = await supabase.from('credits').update(payload).eq('id', id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async (creditId: string) => {
    if (pdfLoadingId) return;
    setPdfLoadingId(creditId);
    try {
      await fetchAndGenerateCreditPDF(createClient(), creditId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setPdfLoadingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-800',
      activo: 'bg-emerald-100 text-emerald-800',
      rechazado: 'bg-red-100 text-red-800',
      pagado: 'bg-blue-100 text-blue-800',
      refinanciado: 'bg-slate-100 text-slate-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Pendientes</p>
          <p className="text-2xl font-semibold text-amber-700 mt-1">{counts.pendiente}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase font-medium">Activos</p>
          <p className="text-2xl font-semibold text-emerald-700 mt-1">{counts.activo}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 sm:col-span-1 flex items-center justify-center">
          <Link
            href="/dashboard/creditos/nuevo"
            className="w-full text-center px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            + Nuevo crédito
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['pendiente', 'Pendientes'],
            ['activo', 'Activos'],
            ['all', 'Todos'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
              tab === k
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 font-semibold">Solicitado</th>
                  <th className="px-4 py-2.5 font-semibold">Total</th>
                  <th className="px-4 py-2.5 font-semibold">Tipo</th>
                  <th className="px-4 py-2.5 font-semibold">Estado</th>
                  <th className="px-4 py-2.5 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Sin créditos
                    </td>
                  </tr>
                ) : (
                  rows.map(c => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/creditos/${c.id}`}
                          className="font-medium text-slate-800 hover:text-emerald-700 hover:underline"
                        >
                          {c.clients?.full_name || 'Cliente'}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(c.created_at).toLocaleDateString('es-MX')}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatMoney(c.requested_amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatMoney(c.total_amount_due)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">
                        {(c.credit_type || 'por_plazo').replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(c.status)}`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/dashboard/creditos/${c.id}`}
                            className="text-xs text-emerald-700 hover:underline font-medium"
                          >
                            Ver
                          </Link>
                          {(c.status === 'activo' || c.status === 'pagado') && (
                            <button
                              type="button"
                              disabled={pdfLoadingId === c.id}
                              onClick={() => void handlePdf(c.id)}
                              className="text-xs text-slate-600 hover:underline font-medium disabled:opacity-50"
                            >
                              {pdfLoadingId === c.id ? 'PDF…' : 'PDF'}
                            </button>
                          )}
                          {c.status === 'pendiente' && (
                            <>
                              <Link
                                href={`/dashboard/creditos/${c.id}/editar`}
                                className="text-xs text-slate-600 hover:underline"
                              >
                                Editar
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void decidir(c.id, 'activo')}
                                className="text-xs text-emerald-700 font-medium disabled:opacity-50"
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void decidir(c.id, 'rechazado')}
                                className="text-xs text-red-600 font-medium disabled:opacity-50"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Página {page + 1} de {totalPages} ({totalCount} créditos)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
