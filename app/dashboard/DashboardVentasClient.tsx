'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
  ShoppingCartIcon,
  TrashIcon,
  TrophyIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import { generateQuotePDF } from '@/lib/ventas/pdfGenerator';
import { formatMoney, proofPublicUrl } from '@/lib/ventas/quotes';
import type { Quote, QuoteItem, QuotePaymentProof } from '@/lib/ventas/types';
import FilePreviewModal from '@/components/ventas/FilePreviewModal';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
} from 'recharts';

type FilterType = 'week' | 'month' | 'year' | 'day' | 'range';

type Sale = Quote & {
  seller: { id: string; full_name: string } | null;
  confirmador?: { full_name: string } | null;
  quote_items: QuoteItem[];
  quote_payment_proofs?: QuotePaymentProof[];
};

type CrmStats = {
  prospectos: number;
  prospectosPorEstado: { name: string; value: number }[];
  seguimientos: number;
  seguimientosPendientes: number;
  seguimientosPorTipo: { name: string; value: number }[];
  reportesPrecios: number;
  creditosActivos: number;
  creditosPendientes: number;
  clientes: number;
};

type ChartBucket = {
  label: string;
  ventas: number;
  monto: number;
  date?: string;
  key?: string;
  month?: number;
};

const PIE_COLORS = ['#9f1239', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];
const ROSE = '#9f1239';
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function saleDate(s: Sale): Date {
  return new Date(s.payment_confirmed_at || s.quote_date);
}

function saleDateKey(s: Sale): string {
  const d = saleDate(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateString: string) {
  return new Date(dateString + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function clientDisplayName(s: Sale) {
  return s.clients?.full_name || s.client_name_temporary || 'Mostrador';
}

function boundsFor(
  filterType: FilterType,
  selectedDate: string,
  rangeStart: string,
  rangeEnd: string,
): { start: Date; end: Date } | null {
  const today = new Date();
  if (filterType === 'range') {
    if (!rangeStart || !rangeEnd) return null;
    const start = new Date(rangeStart + 'T00:00:00');
    const end = new Date(rangeEnd + 'T23:59:59.999');
    return { start, end };
  }
  if (filterType === 'day') {
    if (!selectedDate) return null;
    const start = new Date(selectedDate + 'T00:00:00');
    const end = new Date(selectedDate + 'T23:59:59.999');
    return { start, end };
  }
  if (filterType === 'month') {
    const base = selectedDate
      ? new Date(Number(selectedDate.split('-')[0]), Number(selectedDate.split('-')[1]) - 1, 1)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: base, end };
  }
  if (filterType === 'year') {
    const year = selectedDate ? Number(selectedDate) : today.getFullYear();
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function DashboardVentasClient({
  userId,
  role,
  userName,
  userSucursal,
}: {
  userId: string;
  role: string;
  userName: string;
  userSucursal: string | null;
}) {
  const isAdmin = role === 'admin';
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [crm, setCrm] = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<FilterType>('week');
  const [selectedDate, setSelectedDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [pdfLoadingQuoteId, setPdfLoadingQuoteId] = useState<string | null>(null);
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const [previewItems, setPreviewItems] = useState<QuoteItem[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      let salesQuery = supabase
        .from('quotes')
        .select(
          `
          id,
          quote_date,
          payment_confirmed_at,
          total_amount,
          subtotal,
          iva_amount,
          payment_method,
          client_id,
          client_name_temporary,
          client_phone_temporary,
          status,
          sucursal,
          delivery_address,
          requires_invoice,
          metodo_de_pago_cfdi,
          forma_de_pago_cfdi,
          uso_cfdi,
          numero_factura,
          payment_profile_type,
          seller:seller_id(id, full_name),
          confirmador:payment_confirmed_by(full_name),
          clients(full_name, phone_number, address_street, address_number, address_neighborhood, address_city, address_state, address_postal_code),
          quote_items(description, quantity, unit, unit_price, subtotal_item),
          quote_payment_proofs(*)
        `,
        )
        .eq('status', 'venta_concretada')
        .order('quote_date', { ascending: false })
        .limit(2000);
      if (!isAdmin) salesQuery = salesQuery.eq('seller_id', userId);

      let prospectsQuery = supabase.from('prospects').select('id, status');
      if (!isAdmin) prospectsQuery = prospectsQuery.eq('assigned_to_seller_id', userId);

      let followUpsQuery = supabase
        .from('follow_ups')
        .select('id, interaction_type, next_follow_up_date');
      if (!isAdmin) followUpsQuery = followUpsQuery.eq('seller_id', userId);

      let priceReportsQuery = supabase
        .from('price_reports')
        .select('*', { count: 'exact', head: true });
      if (!isAdmin) priceReportsQuery = priceReportsQuery.eq('seller_id', userId);

      const [salesRes, prospectsRes, followUpsRes, priceReportsRes, credActRes, credPendRes, clientsRes] =
        await Promise.all([
          salesQuery,
          prospectsQuery,
          followUpsQuery,
          priceReportsQuery,
          supabase.from('credits').select('*', { count: 'exact', head: true }).eq('status', 'activo'),
          supabase.from('credits').select('*', { count: 'exact', head: true }).eq('status', 'pendiente'),
          supabase.from('clients').select('*', { count: 'exact', head: true }),
        ]);

      if (salesRes.error) throw salesRes.error;
      setAllSales((salesRes.data as unknown as Sale[]) || []);

      const prospects = (prospectsRes.data as { id: string; status: string | null }[]) || [];
      const porEstadoMap: Record<string, number> = {};
      prospects.forEach(p => {
        const st = (p.status || 'nuevo').toLowerCase();
        porEstadoMap[st] = (porEstadoMap[st] || 0) + 1;
      });

      const followUps =
        (followUpsRes.data as {
          id: string;
          interaction_type: string | null;
          next_follow_up_date: string | null;
        }[]) || [];
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const porTipoMap: Record<string, number> = {};
      followUps.forEach(f => {
        const t = f.interaction_type || 'Otro';
        porTipoMap[t] = (porTipoMap[t] || 0) + 1;
      });

      setCrm({
        prospectos: prospects.length,
        prospectosPorEstado: Object.entries(porEstadoMap).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        })),
        seguimientos: followUps.length,
        seguimientosPendientes: followUps.filter(
          f => f.next_follow_up_date && new Date(f.next_follow_up_date + 'T00:00:00') >= hoy,
        ).length,
        seguimientosPorTipo: Object.entries(porTipoMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5),
        reportesPrecios: priceReportsRes.count ?? 0,
        creditosActivos: credActRes.count ?? 0,
        creditosPendientes: credPendRes.count ?? 0,
        clientes: clientsRes.count ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las métricas');
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const bounds = useMemo(
    () => boundsFor(filterType, selectedDate, rangeStart, rangeEnd),
    [filterType, selectedDate, rangeStart, rangeEnd],
  );

  const filteredSales = useMemo(() => {
    if (!bounds) return [];
    return allSales.filter(s => {
      const d = saleDate(s);
      return d >= bounds.start && d <= bounds.end;
    });
  }, [allSales, bounds]);

  const tableSales = useMemo(() => {
    if (!selectedDay) return filteredSales;
    if (selectedDay.startsWith('Mes:')) {
      const monthLabel = selectedDay.replace('Mes: ', '');
      const monthIdx = MESES.indexOf(monthLabel);
      if (monthIdx < 0) return filteredSales;
      return filteredSales.filter(s => saleDate(s).getMonth() === monthIdx);
    }
    return filteredSales.filter(s => saleDateKey(s) === selectedDay);
  }, [filteredSales, selectedDay]);

  const kpis = useMemo(() => {
    const total = filteredSales.length;
    const monto = filteredSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const hoy = allSales.filter(s => saleDate(s) >= inicioHoy).length;
    return {
      total,
      monto,
      ticket: total > 0 ? monto / total : 0,
      hoy,
    };
  }, [filteredSales, allSales]);

  const trend7 = useMemo(() => {
    const out: { date: string; dateKey: string; ventas: number; monto: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const delDia = allSales.filter(s => saleDate(s).toDateString() === d.toDateString());
      out.push({
        date: label,
        dateKey,
        ventas: delDia.length,
        monto: delDia.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0),
      });
    }
    return out;
  }, [allSales]);

  const chartData = useMemo((): ChartBucket[] => {
    if (!bounds) return [];
    if (filterType === 'week') {
      const data: ChartBucket[] = DIAS.map(label => ({ label, ventas: 0, monto: 0, date: '' }));
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(bounds.start);
        dayDate.setDate(bounds.start.getDate() + i);
        data[i].date = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
      }
      filteredSales.forEach(s => {
        const idx = saleDate(s).getDay();
        data[idx].ventas += 1;
        data[idx].monto += Number(s.total_amount) || 0;
      });
      return data;
    }
    if (filterType === 'year') {
      const data: ChartBucket[] = MESES.map((label, month) => ({ label, ventas: 0, monto: 0, month }));
      filteredSales.forEach(s => {
        const idx = saleDate(s).getMonth();
        data[idx].ventas += 1;
        data[idx].monto += Number(s.total_amount) || 0;
      });
      return data;
    }
    const days = Math.min(
      62,
      Math.ceil((bounds.end.getTime() - bounds.start.getTime()) / 86400000) + 1,
    );
    const data: ChartBucket[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(bounds.start);
      d.setDate(bounds.start.getDate() + i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      data.push({ label: String(d.getDate()), key: d.toDateString(), date: dateKey, ventas: 0, monto: 0 });
    }
    filteredSales.forEach(s => {
      const key = saleDate(s).toDateString();
      const bucket = data.find(b => b.key === key);
      if (bucket) {
        bucket.ventas += 1;
        bucket.monto += Number(s.total_amount) || 0;
      }
    });
    return data;
  }, [filteredSales, bounds, filterType]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; amount: number }> = {};
    filteredSales.forEach(s => {
      (s.quote_items || []).forEach(i => {
        const name = i.description || 'Sin nombre';
        if (!map[name]) map[name] = { name, quantity: 0, amount: 0 };
        map[name].quantity += Number(i.quantity) || 0;
        map[name].amount += Number(i.subtotal_item) || 0;
      });
    });
    return Object.values(map)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredSales]);

  const ranking = useMemo(() => {
    if (!isAdmin) return [];
    const map: Record<string, { name: string; ventas: number; monto: number }> = {};
    filteredSales.forEach(s => {
      const id = s.seller?.id;
      if (!id) return;
      if (!map[id]) map[id] = { name: s.seller?.full_name || 'Sin vendedor', ventas: 0, monto: 0 };
      map[id].ventas += 1;
      map[id].monto += Number(s.total_amount) || 0;
    });
    return Object.values(map)
      .sort((a, b) => b.ventas - a.ventas)
      .slice(0, 6);
  }, [filteredSales, isAdmin]);

  const periodoLabel: Record<FilterType, string> = {
    week: 'esta semana',
    month: 'este mes',
    year: 'este año',
    day: 'este día',
    range: 'en el rango',
  };

  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
  };

  const tooltipFormatter = (value: unknown, name: unknown) => {
    const n = String(name);
    const v = value == null ? 0 : value;
    return [
      n === 'monto' ? formatMoney(Number(v)) : v,
      n === 'monto' ? 'Monto' : 'Ventas',
    ] as [string | number, string];
  };

  const clearDayFilter = () => setSelectedDay(null);

  const handleBarBucketClick = (data: ChartBucket) => {
    if (data.date) {
      setSelectedDay(data.date);
    } else if (data.month !== undefined && filterType === 'year') {
      setSelectedDay(`Mes: ${data.label}`);
    }
  };

  const handleTrendDayClick = (dateKey: string) => {
    setSelectedDay(dateKey);
  };

  const TrendDot = (props: DotProps) => {
    const { cx, cy } = props;
    const dateKey = (props as DotProps & { payload?: { dateKey?: string } }).payload?.dateKey;
    if (cx == null || cy == null) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={ROSE}
        cursor="pointer"
        onClick={() => {
          if (dateKey) handleTrendDayClick(dateKey);
        }}
      />
    );
  };

  const handleDownloadPDF = async (sale: Sale) => {
    try {
      setPdfLoadingQuoteId(sale.id);
      await generateQuotePDF(
        { ...sale, items: sale.quote_items || [] },
        userName,
        userSucursal || sale.sucursal || 'tecamac',
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al generar el PDF');
    } finally {
      setPdfLoadingQuoteId(null);
    }
  };

  const handleDeleteSale = async (saleId: string, name: string) => {
    if (
      !window.confirm(
        `¿Seguro que quieres eliminar la venta para "${name}"?\n\nEsta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('quotes').delete().eq('id', saleId);
      if (err) throw err;
      setAllSales(prev => prev.filter(s => s.id !== saleId));
      if (previewSale?.id === saleId) {
        setPreviewSale(null);
        setPreviewItems([]);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar la venta');
    }
  };

  const openPreviewModal = async (sale: Sale) => {
    setPreviewSale(sale);
    setLoadingPreview(true);
    try {
      if (sale.quote_items?.length) {
        setPreviewItems(sale.quote_items);
      } else {
        const supabase = createClient();
        const { data: items, error: err } = await supabase
          .from('quote_items')
          .select('*')
          .eq('quote_id', sale.id);
        if (err) throw err;
        setPreviewItems((items as QuoteItem[]) || []);
      }
    } catch {
      alert('Error al cargar los detalles de la venta');
      setPreviewSale(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const tableTitle = selectedDay
    ? selectedDay.startsWith('Mes:')
      ? selectedDay
      : `Día: ${formatDateLabel(selectedDay)}`
    : 'Todas las ventas del período';

  const tableTotal = tableSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="w-10 h-10 border-4 border-rose-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Cargando métricas…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Filtros de período */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="flex bg-slate-100 rounded-lg p-1 overflow-x-auto scrollbar-none -mx-1 px-1 sm:mx-0">
          {(
            [
              ['week', 'Semana'],
              ['month', 'Mes'],
              ['year', 'Año'],
              ['day', 'Día'],
              ['range', 'Rango'],
            ] as [FilterType, string][]
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setFilterType(type);
                setSelectedDate('');
                setSelectedDay(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                filterType === type
                  ? 'bg-white text-rose-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filterType === 'day' && (
          <input
            type="date"
            value={selectedDate}
            onChange={e => {
              setSelectedDate(e.target.value);
              setSelectedDay(null);
            }}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        )}
        {filterType === 'month' && (
          <input
            type="month"
            value={selectedDate}
            onChange={e => {
              setSelectedDate(e.target.value);
              setSelectedDay(null);
            }}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        )}
        {filterType === 'year' && (
          <select
            value={selectedDate}
            onChange={e => {
              setSelectedDate(e.target.value);
              setSelectedDay(null);
            }}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">Año actual</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        {filterType === 'range' && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="date"
              value={rangeStart}
              onChange={e => {
                setRangeStart(e.target.value);
                setSelectedDay(null);
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg"
            />
            <span>a</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={e => {
                setRangeEnd(e.target.value);
                setSelectedDay(null);
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg"
            />
          </div>
        )}

        {selectedDay && (
          <button
            type="button"
            onClick={clearDayFilter}
            className="px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg"
          >
            Limpiar filtro de día
          </button>
        )}
      </div>

      {/* KPIs de ventas */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Resumen del período
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-4 sm:p-5 text-white transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <ShoppingCartIcon className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-sm opacity-90">{isAdmin ? 'Ventas' : 'Mis ventas'}</p>
              <p className="text-2xl sm:text-3xl font-bold">{kpis.total}</p>
            </div>
          </div>
          <p className="text-xs opacity-75 capitalize">{periodoLabel[filterType]}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-4 sm:p-5 text-white transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <CurrencyDollarIcon className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-sm opacity-90">Total vendido</p>
              <p className="text-lg sm:text-2xl font-bold">{formatMoney(kpis.monto)}</p>
            </div>
          </div>
          <p className="text-xs opacity-75">Ingresos {periodoLabel[filterType]}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-4 sm:p-5 text-white transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <ChartBarIcon className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-sm opacity-90">Ticket promedio</p>
              <p className="text-lg sm:text-2xl font-bold">{formatMoney(kpis.ticket)}</p>
            </div>
          </div>
          <p className="text-xs opacity-75">Por venta</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-4 sm:p-5 text-white transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between mb-3">
            <TrophyIcon className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
            <div className="text-right">
              <p className="text-sm opacity-90">Ventas hoy</p>
              <p className="text-2xl sm:text-3xl font-bold">{kpis.hoy}</p>
            </div>
          </div>
          <p className="text-xs opacity-75">En las últimas 24h</p>
        </div>
        </div>

      {/* KPIs CRM y créditos */}
      {crm && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-3 sm:mt-4">
          <Link
            href="/dashboard/prospectos"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-rose-300 transition-colors"
          >
            <p className="text-2xl font-bold text-slate-800">{crm.prospectos}</p>
            <p className="text-xs text-slate-500 mt-0.5">{isAdmin ? 'Prospectos' : 'Mis prospectos'}</p>
          </Link>
          <Link
            href="/dashboard/bitacora-comercial"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-rose-300 transition-colors"
          >
            <p className="text-2xl font-bold text-slate-800">{crm.seguimientos}</p>
            <p className="text-xs text-slate-500 mt-0.5">Seguimientos</p>
          </Link>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-2xl font-bold text-amber-600">{crm.seguimientosPendientes}</p>
            <p className="text-xs text-slate-500 mt-0.5">Seg. pendientes</p>
          </div>
          <Link
            href="/dashboard/reporte-precios"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-rose-300 transition-colors"
          >
            <p className="text-2xl font-bold text-slate-800">{crm.reportesPrecios}</p>
            <p className="text-xs text-slate-500 mt-0.5">Reportes precios</p>
          </Link>
          <Link
            href="/dashboard/creditos"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-rose-300 transition-colors"
          >
            <p className="text-2xl font-bold text-rose-800">{crm.creditosActivos}</p>
            <p className="text-xs text-slate-500 mt-0.5">Créditos activos</p>
          </Link>
          <Link
            href="/dashboard/creditos"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-rose-300 transition-colors"
          >
            <p className="text-2xl font-bold text-amber-600">{crm.creditosPendientes}</p>
            <p className="text-xs text-slate-500 mt-0.5">Créditos pendientes</p>
          </Link>
        </div>
      )}
      </section>

      {/* Gráficas */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Análisis y tendencias
        </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">
            Tendencia (últimos 7 días)
          </h3>
          <p className="text-[11px] text-slate-400 mb-3">Click en un punto para ver ventas del día</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend7}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={11} stroke="#64748b" />
              <YAxis fontSize={11} stroke="#64748b" allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke={ROSE}
                strokeWidth={3}
                dot={<TrendDot />}
                activeDot={{ r: 6, fill: ROSE, cursor: 'pointer' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">
            Ventas del período seleccionado
          </h3>
          <p className="text-[11px] text-slate-400 mb-3">Click en una barra para ver ventas del día</p>
          {!bounds ? (
            <p className="text-sm text-slate-400 py-16 text-center">
              Selecciona {filterType === 'day' ? 'un día' : 'las fechas del rango'}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" fontSize={11} stroke="#64748b" />
                <YAxis fontSize={11} stroke="#64748b" allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
                <Bar
                  dataKey="ventas"
                  fill={ROSE}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={item => {
                    const bucket = (item as { payload?: ChartBucket }).payload;
                    if (bucket) handleBarBucketClick(bucket);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {crm && crm.prospectosPorEstado.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Prospectos por estado</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={crm.prospectosPorEstado}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={entry => `${entry.name} ${entry.value}`}
                  outerRadius={75}
                  dataKey="value"
                >
                  {crm.prospectosPorEstado.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {crm && crm.seguimientosPorTipo.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Seguimientos por tipo</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={crm.seguimientosPorTipo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} stroke="#64748b" />
                <YAxis fontSize={11} stroke="#64748b" allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      </section>

      {/* Tabla de ventas (drill-down) */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Ventas
        </h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{tableTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {tableSales.length} {tableSales.length === 1 ? 'venta' : 'ventas'} ·{' '}
              <span className="font-semibold text-rose-800">{formatMoney(tableTotal)}</span>
            </p>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[420px]">
          {tableSales.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">
              {selectedDay ? 'No hay ventas en este día' : 'Sin ventas en el período'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                <tr className="text-left text-[11px] uppercase text-slate-500">
                  <th className="px-3 py-2 font-semibold">Cliente / Vendedor</th>
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold text-right">Monto</th>
                  <th className="px-3 py-2 font-semibold">Método</th>
                  <th className="px-3 py-2 font-semibold">N° Factura</th>
                  <th className="px-3 py-2 font-semibold text-center">Prod.</th>
                  <th className="px-3 py-2 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tableSales.map((sale, index) => {
                  const refs = sale.quote_payment_proofs
                    ?.map(p => p.reference_number)
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <tr
                      key={sale.id}
                      className={`border-b border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-rose-50/50`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{clientDisplayName(sale)}</p>
                        <p className="text-xs text-slate-500">{sale.seller?.full_name || '—'}</p>
                        <p className="text-[10px] font-mono text-slate-400">{sale.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {formatDateLabel(saleDateKey(sale))}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-800">
                        {formatMoney(sale.total_amount)}
                      </td>
                      <td className="px-3 py-2">
                        {sale.payment_method && (
                          <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-800 text-[10px] font-medium rounded-full capitalize">
                            {sale.payment_method.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {sale.numero_factura || refs || '—'}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600">
                        {sale.quote_items?.length || 0}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => void openPreviewModal(sale)}
                            title="Ver detalle"
                            className="p-1.5 rounded-md text-rose-800 hover:bg-rose-100"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadPDF(sale)}
                            disabled={pdfLoadingQuoteId === sale.id}
                            title="Descargar PDF"
                            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            {pdfLoadingQuoteId === sale.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <DocumentArrowDownIcon className="w-4 h-4" />
                            )}
                          </button>
                          {isAdmin && (
                            <>
                              <Link
                                href={`/dashboard/cotizador?id=${sale.id}`}
                                title="Editar venta"
                                className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50"
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteSale(sale.id, clientDisplayName(sale))
                                }
                                disabled={pdfLoadingQuoteId === sale.id}
                                title="Eliminar venta"
                                className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </section>

      {/* Top productos + ranking */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Productos y desempeño
        </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Productos más vendidos ({periodoLabel[filterType]})
          </h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Sin ventas en el período</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 shrink-0 bg-rose-100 rounded-full flex items-center justify-center text-rose-800 font-bold text-xs">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.quantity.toLocaleString('es-MX')} unidades</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 shrink-0 ml-2">
                    {formatMoney(p.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Ranking de vendedores</h3>
            {ranking.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Sin ventas en el período</p>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={ranking} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" fontSize={11} stroke="#64748b" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={10} stroke="#64748b" width={90} />
                  <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
                  <Bar dataKey="ventas" fill={ROSE} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl shadow-sm p-5 text-white">
            <h3 className="text-sm font-semibold mb-4">Mi resumen</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-600">
                <span className="text-sm text-slate-300">Total ventas</span>
                <span className="text-xl font-bold">{kpis.total}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-600">
                <span className="text-sm text-slate-300">Monto total</span>
                <span className="text-lg font-bold">{formatMoney(kpis.monto)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-600">
                <span className="text-sm text-slate-300">Ticket promedio</span>
                <span className="text-lg font-bold">{formatMoney(kpis.ticket)}</span>
              </div>
              {crm && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Clientes registrados</span>
                  <span className="text-lg font-bold">{crm.clientes}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </section>

      {/* Modal detalle de venta */}
      {previewSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-rose-800 to-rose-700 px-6 py-4 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Detalle de venta</h2>
              <button
                type="button"
                onClick={() => {
                  setPreviewSale(null);
                  setPreviewItems([]);
                }}
                className="text-white/90 hover:text-white"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-rose-800" />
                  Información del cliente
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Cliente</p>
                    <p className="font-medium">{clientDisplayName(previewSale)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Vendedor</p>
                    <p className="font-medium">{previewSale.seller?.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Fecha</p>
                    <p className="font-medium">{formatDateLabel(saleDateKey(previewSale))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Estado</p>
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 capitalize">
                      {(previewSale.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  {previewSale.delivery_address && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500 mb-1">Dirección de entrega</p>
                      <p className="font-medium">{previewSale.delivery_address}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Conceptos</h3>
                {loadingPreview ? (
                  <p className="text-sm text-slate-500 text-center py-4">Cargando conceptos…</p>
                ) : previewItems.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Sin conceptos</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {previewItems.map((item, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200">
                        <div className="flex justify-between gap-2">
                          <p className="font-medium text-sm">{item.description || 'Sin descripción'}</p>
                          <p className="font-bold text-sm text-rose-800 whitespace-nowrap">
                            {formatMoney(item.subtotal_item ?? item.quantity * item.unit_price)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Cant: {item.quantity} · P.U: {formatMoney(item.unit_price)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                <h3 className="text-sm font-semibold text-rose-900 mb-3">Resumen de montos</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatMoney(previewSale.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA</span>
                    <span className="font-medium">{formatMoney(previewSale.iva_amount)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-rose-200 font-bold text-base">
                    <span>Total</span>
                    <span className="text-rose-800">{formatMoney(previewSale.total_amount)}</span>
                  </div>
                </div>
              </div>

              {previewSale.quote_payment_proofs && previewSale.quote_payment_proofs.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h3 className="text-sm font-semibold text-amber-900 mb-3">
                    Comprobantes ({previewSale.quote_payment_proofs.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {previewSale.quote_payment_proofs.map((proof, idx) => {
                      const supabase = createClient();
                      const imageUrl = proofPublicUrl(supabase, proof.file_path);
                      const complementUrl = proofPublicUrl(
                        supabase,
                        proof.complement_file_url ?? null,
                      );
                      return (
                        <div key={proof.id} className="bg-white rounded-lg border border-amber-200 p-3">
                          <p className="text-xs font-semibold text-slate-700 mb-2">
                            #{idx + 1} · {formatMoney(proof.amount_paid)}
                          </p>
                          {proof.reference_number && (
                            <p className="text-xs text-slate-500 mb-2">Ref: {proof.reference_number}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {imageUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewFile({ url: imageUrl, name: proof.file_name || 'Comprobante' })
                                }
                                className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-800 hover:bg-rose-100"
                              >
                                Ver comprobante
                              </button>
                            )}
                            {complementUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewFile({
                                    url: complementUrl,
                                    name: proof.complement_file_name || 'Complemento',
                                  })
                                }
                                className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                              >
                                Ver complemento
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadPDF(previewSale)}
                disabled={pdfLoadingQuoteId === previewSale.id}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-800 rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                {pdfLoadingQuoteId === previewSale.id ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <DocumentArrowDownIcon className="w-4 h-4" />
                )}
                Descargar PDF
              </button>
              {isAdmin && (
                <Link
                  href={`/dashboard/cotizador?id=${previewSale.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-50 rounded-lg hover:bg-amber-100"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  Editar
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          fileUrl={previewFile.url}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
