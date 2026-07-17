'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';
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
} from 'recharts';

type FilterType = 'week' | 'month' | 'year' | 'day' | 'range';

type SaleItem = {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  subtotal_item: number | null;
};

type Sale = {
  id: string;
  quote_date: string;
  payment_confirmed_at: string | null;
  total_amount: number | null;
  seller: { id: string; full_name: string } | null;
  quote_items: SaleItem[];
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

const PIE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function saleDate(s: Sale): Date {
  return new Date(s.payment_confirmed_at || s.quote_date);
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
  // Semana (domingo a hoy)
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
}: {
  userId: string;
  role: string;
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      let salesQuery = supabase
        .from('quotes')
        .select(
          'id, quote_date, payment_confirmed_at, total_amount, seller:seller_id(id, full_name), quote_items(description, quantity, unit_price, subtotal_item)',
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

  // Tendencia últimos 7 días (independiente del filtro)
  const trend7 = useMemo(() => {
    const out: { date: string; ventas: number; monto: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
      const delDia = allSales.filter(s => saleDate(s).toDateString() === d.toDateString());
      out.push({
        date: label,
        ventas: delDia.length,
        monto: delDia.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0),
      });
    }
    return out;
  }, [allSales]);

  // Barras del período seleccionado
  const chartData = useMemo(() => {
    if (!bounds) return [];
    if (filterType === 'week') {
      const data = DIAS.map(label => ({ label, ventas: 0, monto: 0 }));
      filteredSales.forEach(s => {
        const idx = saleDate(s).getDay();
        data[idx].ventas += 1;
        data[idx].monto += Number(s.total_amount) || 0;
      });
      return data;
    }
    if (filterType === 'year') {
      const data = MESES.map(label => ({ label, ventas: 0, monto: 0 }));
      filteredSales.forEach(s => {
        const idx = saleDate(s).getMonth();
        data[idx].ventas += 1;
        data[idx].monto += Number(s.total_amount) || 0;
      });
      return data;
    }
    // month / range / day → por día
    const days = Math.min(
      62,
      Math.ceil((bounds.end.getTime() - bounds.start.getTime()) / 86400000) + 1,
    );
    const data: { label: string; key: string; ventas: number; monto: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(bounds.start);
      d.setDate(bounds.start.getDate() + i);
      data.push({ label: String(d.getDate()), key: d.toDateString(), ventas: 0, monto: 0 });
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

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Cargando métricas…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Filtros de período */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex bg-slate-100 rounded-lg p-1">
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
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterType === type
                  ? 'bg-white text-emerald-700 shadow-sm'
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
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        )}
        {filterType === 'month' && (
          <input
            type="month"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        )}
        {filterType === 'year' && (
          <select
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
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
              onChange={e => setRangeStart(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg"
            />
            <span>a</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={e => setRangeEnd(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* KPIs de ventas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {isAdmin ? 'Ventas' : 'Mis ventas'}
          </p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{kpis.total}</p>
          <p className="text-xs text-slate-400 mt-1 capitalize">{periodoLabel[filterType]}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Total vendido
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatMoney(kpis.monto)}</p>
          <p className="text-xs text-slate-400 mt-1">Ingresos {periodoLabel[filterType]}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Ticket promedio
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatMoney(kpis.ticket)}</p>
          <p className="text-xs text-slate-400 mt-1">Por venta</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ventas hoy</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{kpis.hoy}</p>
          <p className="text-xs text-slate-400 mt-1">Últimas 24h</p>
        </div>
      </div>

      {/* KPIs CRM y créditos */}
      {crm && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/dashboard/prospectos"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-emerald-300 transition-colors"
          >
            <p className="text-2xl font-bold text-slate-800">{crm.prospectos}</p>
            <p className="text-xs text-slate-500 mt-0.5">{isAdmin ? 'Prospectos' : 'Mis prospectos'}</p>
          </Link>
          <Link
            href="/dashboard/bitacora-comercial"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-emerald-300 transition-colors"
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
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-emerald-300 transition-colors"
          >
            <p className="text-2xl font-bold text-slate-800">{crm.reportesPrecios}</p>
            <p className="text-xs text-slate-500 mt-0.5">Reportes precios</p>
          </Link>
          <Link
            href="/dashboard/creditos"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-emerald-300 transition-colors"
          >
            <p className="text-2xl font-bold text-emerald-700">{crm.creditosActivos}</p>
            <p className="text-xs text-slate-500 mt-0.5">Créditos activos</p>
          </Link>
          <Link
            href="/dashboard/creditos"
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-emerald-300 transition-colors"
          >
            <p className="text-2xl font-bold text-amber-600">{crm.creditosPendientes}</p>
            <p className="text-xs text-slate-500 mt-0.5">Créditos pendientes</p>
          </Link>
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Tendencia (últimos 7 días)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend7}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={11} stroke="#64748b" />
              <YAxis fontSize={11} stroke="#64748b" allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Ventas del período seleccionado
          </h3>
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
                <Bar dataKey="ventas" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
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

      {/* Top productos + ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    <span className="w-7 h-7 shrink-0 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs">
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
                  <Bar dataKey="ventas" fill="#10b981" radius={[0, 6, 6, 0]} />
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
    </div>
  );
}
