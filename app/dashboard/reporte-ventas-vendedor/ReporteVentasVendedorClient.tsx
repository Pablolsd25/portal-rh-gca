'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type SaleRow = {
  id: string;
  fecha: string;
  cliente: string;
  vendedor: string;
  producto: string;
  cantidad: number;
  unidad: string;
};

type Compliance = {
  visits: number;
  priceReports: number;
  isCompliant: boolean;
};

/** Lunes 00:00 a domingo 23:59 de la semana actual */
function getWeekBounds(): { startOfWeek: Date; endOfWeek: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { startOfWeek, endOfWeek };
}

export default function ReporteVentasVendedorClient({ userId }: { userId: string }) {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { startOfWeek, endOfWeek } = getWeekBounds();

      const [visitRes, reportRes] = await Promise.all([
        supabase
          .from('follow_ups')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', userId)
          .eq('interaction_type', 'Visita')
          .gte('created_at', startOfWeek.toISOString())
          .lte('created_at', endOfWeek.toISOString()),
        supabase
          .from('price_reports')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', userId)
          .gte('created_at', startOfWeek.toISOString())
          .lte('created_at', endOfWeek.toISOString()),
      ]);
      if (visitRes.error) throw visitRes.error;
      if (reportRes.error) throw reportRes.error;

      const visits = visitRes.count ?? 0;
      const priceReports = reportRes.count ?? 0;
      const isCompliant = visits >= 3 && priceReports >= 2;
      setCompliance({ visits, priceReports, isCompliant });

      if (!isCompliant) {
        setSales([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('quotes')
        .select(
          'id, quote_date, payment_confirmed_at, client_name_temporary, clients(full_name), vendedor:seller_id(full_name), quote_items(description, quantity, unit)',
        )
        .eq('status', 'venta_concretada')
        .order('quote_date', { ascending: false })
        .limit(1000);
      if (fetchError) throw fetchError;

      type Raw = {
        id: string;
        quote_date: string;
        payment_confirmed_at: string | null;
        client_name_temporary: string | null;
        clients: { full_name: string } | { full_name: string }[] | null;
        vendedor: { full_name: string } | { full_name: string }[] | null;
        quote_items: { description: string | null; quantity: number | null; unit: string | null }[];
      };

      const one = (v: { full_name: string } | { full_name: string }[] | null) =>
        Array.isArray(v) ? v[0] ?? null : v;

      const rows: SaleRow[] = ((data as unknown as Raw[]) || [])
        .filter(q => {
          const d = new Date(q.payment_confirmed_at || q.quote_date);
          return d >= startOfWeek && d <= endOfWeek;
        })
        .flatMap(q =>
          (q.quote_items || []).map((item, idx) => ({
            id: `${q.id}-${idx}`,
            fecha: q.payment_confirmed_at || q.quote_date,
            cliente: one(q.clients)?.full_name || q.client_name_temporary || 'Mostrador',
            vendedor: one(q.vendedor)?.full_name || '—',
            producto: item.description || 'Sin descripción',
            cantidad: Number(item.quantity) || 0,
            unidad: item.unit || '',
          })),
        );
      setSales(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500 py-10 text-center">Verificando requisitos y cargando…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {compliance && !compliance.isCompliant ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6 text-center">
          <p className="text-4xl mb-2">⚠️</p>
          <h2 className="text-lg font-bold text-amber-800">
            No cumples los requisitos semanales
          </h2>
          <p className="text-sm text-amber-700 mt-2">
            Para desbloquear el reporte de ventas necesitas cumplir esta semana:
          </p>
          <div className="mt-4 inline-block text-left space-y-2">
            <p
              className={`text-sm font-medium ${
                compliance.visits >= 3 ? 'text-rose-600' : 'text-red-600'
              }`}
            >
              Visitas a clientes/prospectos:{' '}
              <span className="font-mono">{compliance.visits} / 3</span>
            </p>
            <p
              className={`text-sm font-medium ${
                compliance.priceReports >= 2 ? 'text-rose-600' : 'text-red-600'
              }`}
            >
              Reportes de precios: <span className="font-mono">{compliance.priceReports} / 2</span>
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            <Link
              href="/dashboard/bitacora-comercial"
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg"
            >
              Registrar visita
            </Link>
            <Link
              href="/dashboard/reporte-precios"
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
            >
              Capturar reporte de precios
            </Link>
          </div>
        </div>
      ) : (
        <>
          {compliance && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800 flex flex-wrap gap-4">
              <span>
                ✓ Visitas: <strong>{compliance.visits} / 3</strong>
              </span>
              <span>
                ✓ Reportes de precios: <strong>{compliance.priceReports} / 2</strong>
              </span>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {sales.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500 text-center">
                No hay ventas concretadas esta semana.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                        Vendedor
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                        Cliente
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                        Producto
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase text-right">
                        Cantidad
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                        Unidad
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                          {new Date(row.fecha).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{row.vendedor}</td>
                        <td className="px-4 py-2.5 text-slate-700">{row.cliente}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{row.producto}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                          {row.cantidad.toLocaleString('es-MX')}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{row.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
