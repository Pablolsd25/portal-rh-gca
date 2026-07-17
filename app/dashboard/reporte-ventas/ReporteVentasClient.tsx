'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { generateQuotePDF } from '@/lib/ventas/pdfGenerator';
import { formatMoney } from '@/lib/ventas/quotes';
import type { Quote, QuoteItem } from '@/lib/ventas/types';

type Seller = { id: string; full_name: string };
type ClientInfo = {
  full_name: string;
  phone_number: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
};

type SaleRow = {
  id: string;
  quote_date: string;
  total_amount: number;
  subtotal: number | null;
  iva_amount: number | null;
  client_name_temporary: string | null;
  client_phone_temporary: string | null;
  delivery_address: string | null;
  clients: ClientInfo | null;
  seller: Seller | null;
  quote_items: QuoteItem[];
  status: string;
  payment_method: string | null;
  requires_invoice: boolean | null;
  payment_reference: string | null;
  payment_proof_url: string | null;
  metodo_de_pago_cfdi: string | null;
  forma_de_pago_cfdi: string | null;
  uso_cfdi: string | null;
};

type PeriodType = 'all' | 'monthly' | 'weekly';
type VendorMetric = {
  id: string;
  name: string;
  totalSales: number;
  totalAmount: number;
  averageAmount: number;
};

const PAGE_SIZE = 5;
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24 * 7));
}

function weekIdFor(date: Date) {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);
  return `${startOfWeek.getFullYear()}-W${getWeekNumber(startOfWeek)}`;
}

function monthIdFor(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatPeriodLabel(period: string, periodType: PeriodType) {
  if (periodType === 'monthly') {
    const [year, month] = period.split('-');
    return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
  }
  if (periodType === 'weekly') {
    const [year, week] = period.split('-W');
    return `Semana ${week}, ${year}`;
  }
  return period;
}

function clientName(sale: SaleRow) {
  return sale.clients?.full_name || sale.client_name_temporary || 'N/A';
}

type Props = {
  userName: string;
  userSucursal: string | null;
};

export default function ReporteVentasClient({ userName, userSucursal }: Props) {
  const [allSales, setAllSales] = useState<SaleRow[]>([]);
  const [vendors, setVendors] = useState<Seller[]>([]);
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('all');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [salesRes, vendorsRes] = await Promise.all([
        supabase
          .from('quotes')
          .select(
            `
            id,
            quote_date,
            total_amount,
            subtotal,
            iva_amount,
            client_name_temporary,
            client_phone_temporary,
            delivery_address,
            clients (full_name, phone_number, address_street, address_number, address_neighborhood, address_city, address_state, address_postal_code),
            seller:seller_id (full_name, id),
            quote_items (description, quantity, unit, unit_price, subtotal_item),
            status,
            payment_method,
            requires_invoice,
            payment_reference,
            payment_proof_url,
            metodo_de_pago_cfdi,
            forma_de_pago_cfdi,
            uso_cfdi
          `,
          )
          .eq('status', 'venta_concretada')
          .order('quote_date', { ascending: false }),
        supabase
          .from('staff_users')
          .select('id, full_name')
          .in('role', ['vendedor', 'admin', 'venta mostrador']),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (vendorsRes.error) throw vendorsRes.error;
      setAllSales((salesRes.data as unknown as SaleRow[]) || []);
      setVendors((vendorsRes.data as Seller[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los datos');
      setAllSales([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const availablePeriods = useMemo(() => {
    if (periodType === 'all' || allSales.length === 0) return [];
    const periods = new Set<string>();
    for (const sale of allSales) {
      const date = new Date(sale.quote_date);
      periods.add(periodType === 'monthly' ? monthIdFor(date) : weekIdFor(date));
    }
    return Array.from(periods).sort().reverse();
  }, [allSales, periodType]);

  useEffect(() => {
    if (periodType === 'all') {
      setSelectedPeriod('');
      return;
    }
    if (availablePeriods.length === 0) {
      setSelectedPeriod('');
      return;
    }
    if (!selectedPeriod || !availablePeriods.includes(selectedPeriod)) {
      setSelectedPeriod(availablePeriods[0]);
    }
  }, [periodType, availablePeriods, selectedPeriod]);

  const filteredSales = useMemo(() => {
    let rows = allSales;

    if (selectedVendor !== 'all') {
      rows = rows.filter(s => s.seller?.id === selectedVendor);
    }

    if (periodType !== 'all' && selectedPeriod) {
      rows = rows.filter(sale => {
        const date = new Date(sale.quote_date);
        if (periodType === 'monthly') return monthIdFor(date) === selectedPeriod;
        return weekIdFor(date) === selectedPeriod;
      });
    } else if (periodType === 'all') {
      if (startDate) {
        const from = new Date(startDate);
        rows = rows.filter(s => new Date(s.quote_date) >= from);
      }
      if (endDate) {
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        rows = rows.filter(s => new Date(s.quote_date) <= to);
      }
    }

    return rows;
  }, [allSales, selectedVendor, periodType, selectedPeriod, startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredSales]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const currentReports = filteredSales.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const totalVentas = filteredSales.length;
  const totalMonto = filteredSales.reduce((acc, s) => acc + (s.total_amount || 0), 0);

  const hoyLabel = new Date().toLocaleDateString('es-MX');
  const ventasHoy = filteredSales.filter(
    s => new Date(s.quote_date).toLocaleDateString('es-MX') === hoyLabel,
  ).length;

  const vendorMetrics: VendorMetric[] = useMemo(() => {
    const map = new Map<string, VendorMetric>();
    for (const sale of filteredSales) {
      const id = sale.seller?.id || 'no-seller';
      const name = sale.seller?.full_name || 'Sin Vendedor';
      const prev = map.get(id) || {
        id,
        name,
        totalSales: 0,
        totalAmount: 0,
        averageAmount: 0,
      };
      prev.totalSales += 1;
      prev.totalAmount += sale.total_amount || 0;
      map.set(id, prev);
    }
    return Array.from(map.values()).map(v => ({
      ...v,
      averageAmount: v.totalSales > 0 ? v.totalAmount / v.totalSales : 0,
    }));
  }, [filteredSales]);

  const topSeller = vendorMetrics.reduce<VendorMetric | null>(
    (top, v) => (v.totalSales > (top?.totalSales || 0) ? v : top),
    null,
  );
  const lowestSeller = vendorMetrics
    .filter(v => v.totalSales > 0)
    .reduce<VendorMetric | null>(
      (low, v) => (v.totalSales < (low?.totalSales ?? Infinity) ? v : low),
      null,
    );
  const topByAmount = vendorMetrics.reduce<VendorMetric | null>(
    (top, v) => (v.totalAmount > (top?.totalAmount || 0) ? v : top),
    null,
  );
  const avgTicket =
    vendorMetrics.length > 0
      ? vendorMetrics.reduce((sum, v) => sum + v.averageAmount, 0) / vendorMetrics.length
      : 0;

  const vendorChartData = vendorMetrics.map(v => ({
    name: v.name.length > 15 ? `${v.name.slice(0, 15)}…` : v.name,
    ventas: v.totalSales,
    monto: v.totalAmount,
  }));

  const clearFilters = () => {
    setSelectedVendor('all');
    setStartDate('');
    setEndDate('');
    setPeriodType('all');
    setSelectedPeriod('');
  };

  const handlePdf = async (sale: SaleRow) => {
    setPdfLoadingId(sale.id);
    try {
      const full = {
        ...sale,
        items: sale.quote_items || [],
      } as unknown as Quote & { items: QuoteItem[] };
      await generateQuotePDF(full, userName, userSucursal ?? undefined);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setPdfLoadingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 py-10 text-center">Cargando ventas…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[260px] bg-white border border-slate-200 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Período</h3>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-600">
              Tipo
              <select
                value={periodType}
                onChange={e => {
                  setPeriodType(e.target.value as PeriodType);
                  setSelectedPeriod('');
                }}
                className="mt-1 block border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="all">Manual (rango)</option>
                <option value="monthly">Mensual</option>
                <option value="weekly">Semanal</option>
              </select>
            </label>
            {periodType !== 'all' && (
              <label className="text-xs text-slate-600">
                Período
                <select
                  value={selectedPeriod}
                  onChange={e => setSelectedPeriod(e.target.value)}
                  className="mt-1 block border border-slate-300 rounded-lg px-2 py-1.5 text-sm min-w-[160px]"
                >
                  {availablePeriods.map(p => (
                    <option key={p} value={p}>
                      {formatPeriodLabel(p, periodType)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-center min-w-[90px]">
            <div className="text-lg font-bold text-slate-800">{totalVentas}</div>
            <div className="text-[10px] text-slate-600">Ventas</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-center min-w-[110px]">
            <div className="text-sm font-bold text-slate-800 truncate">{formatMoney(totalMonto)}</div>
            <div className="text-[10px] text-slate-600">Total</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-center min-w-[110px]">
            <div className="text-xs font-bold text-slate-800 truncate">{topSeller?.name || '—'}</div>
            <div className="text-[10px] text-slate-600">Top</div>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-center min-w-[90px]">
            <div className="text-lg font-bold text-slate-800">{ventasHoy}</div>
            <div className="text-[10px] text-slate-600">Hoy</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
          Más ventas: <strong>{topSeller?.name || 'N/A'}</strong>
          <span className="text-slate-500">({topSeller?.totalSales || 0})</span>
        </span>
        <span className="inline-flex items-center gap-1 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
          Menos ventas: <strong>{lowestSeller?.name || 'N/A'}</strong>
          <span className="text-slate-500">({lowestSeller?.totalSales || 0})</span>
        </span>
        <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
          Más monto: <strong>{topByAmount?.name || 'N/A'}</strong>
        </span>
        <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1">
          Promedio ticket: <strong>{formatMoney(avgTicket)}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Ventas por vendedor</h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorChartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-35} textAnchor="end" height={48} fontSize={10} />
                <YAxis fontSize={10} width={28} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="ventas" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Monto por vendedor</h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-35} textAnchor="end" height={48} fontSize={10} />
                <YAxis
                  fontSize={9}
                  width={52}
                  tickFormatter={v =>
                    new Intl.NumberFormat('es-MX', {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(Number(v))
                  }
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value) || 0)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="monto" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Promedios</h4>
          <div className="max-h-44 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-white text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="text-left py-1.5 pr-2 font-semibold">Vendedor</th>
                  <th className="text-right py-1.5 px-2 font-semibold">Ventas</th>
                  <th className="text-right py-1.5 pl-2 font-semibold">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...vendorMetrics]
                  .sort((a, b) => b.averageAmount - a.averageAmount)
                  .map(v => (
                    <tr key={v.id}>
                      <td className="py-1.5 pr-2 truncate max-w-[120px]">{v.name}</td>
                      <td className="py-1.5 px-2 text-right">{v.totalSales}</td>
                      <td className="py-1.5 pl-2 text-right font-medium">
                        {formatMoney(v.averageAmount)}
                      </td>
                    </tr>
                  ))}
                {vendorMetrics.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-500">
                      Sin datos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            Vendedor
            <select
              value={selectedVendor}
              onChange={e => setSelectedVendor(e.target.value)}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="all">Todos</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.full_name}
                </option>
              ))}
            </select>
          </label>

          {periodType === 'all' && (
            <>
              <label className="text-xs text-slate-600">
                Desde
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                Hasta
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </label>
            </>
          )}

          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          {currentReports.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No hay ventas con los filtros seleccionados.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">ID</th>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Cliente</th>
                  <th className="px-3 py-2 font-semibold">Vendedor</th>
                  <th className="px-3 py-2 font-semibold">Total</th>
                  <th className="px-3 py-2 font-semibold">Productos</th>
                  <th className="px-3 py-2 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentReports.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {sale.id.slice(0, 6)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {new Date(sale.quote_date).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800 max-w-[160px] truncate">
                      {clientName(sale)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate">
                      {sale.seller?.full_name || 'N/A'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{formatMoney(sale.total_amount)}</div>
                      <div className="text-[11px] text-slate-500">
                        {(sale.payment_method || '').slice(0, 14)}
                        {sale.requires_invoice ? ' · F' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {sale.quote_items?.length || 0} producto
                      {(sale.quote_items?.length || 0) !== 1 ? 's' : ''}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/dashboard/cotizador?id=${sale.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handlePdf(sale)}
                          disabled={pdfLoadingId === sale.id}
                          className="text-xs text-red-600 hover:underline disabled:opacity-40"
                        >
                          {pdfLoadingId === sale.id ? 'PDF…' : 'PDF'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredSales.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
