'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Report = {
  id: string;
  reported_at: string;
  entity_name: string;
  entity_type: string;
  material_description: string;
  brand: string | null;
  price: number;
  zone: string | null;
  notes: string | null;
  seller: { id: string; full_name: string } | null;
};

type Vendor = { id: string; full_name: string };

const PAGE_SIZE = 10;
const PIE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)];
}

export default function AdminReportePreciosClient() {
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [vendorFilter, setVendorFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [reportsRes, vendorsRes] = await Promise.all([
        supabase
          .from('price_reports')
          .select(
            'id, reported_at, entity_name, entity_type, material_description, brand, price, zone, notes, seller:seller_id(id, full_name)',
          )
          .order('reported_at', { ascending: false })
          .limit(2000),
        supabase.from('staff_users').select('id, full_name').order('full_name'),
      ]);
      if (reportsRes.error) throw reportsRes.error;
      setAllReports((reportsRes.data as unknown as Report[]) || []);
      if (!vendorsRes.error) setVendors((vendorsRes.data as Vendor[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const options = useMemo(() => {
    const materials = new Set<string>();
    const brands = new Set<string>();
    const zones = new Set<string>();
    allReports.forEach(r => {
      if (r.material_description) materials.add(r.material_description);
      if (r.brand) brands.add(r.brand);
      if (r.zone) zones.add(r.zone);
    });
    return {
      materials: [...materials].sort(),
      brands: [...brands].sort(),
      zones: [...zones].sort(),
    };
  }, [allReports]);

  const filtered = useMemo(() => {
    return allReports.filter(r => {
      if (vendorFilter !== 'all' && r.seller?.id !== vendorFilter) return false;
      if (materialFilter !== 'all' && r.material_description !== materialFilter) return false;
      if (brandFilter !== 'all' && (r.brand || 'Sin marca') !== brandFilter) return false;
      if (zoneFilter !== 'all' && (r.zone || 'Sin zona') !== zoneFilter) return false;
      if (startDate && new Date(r.reported_at) < new Date(startDate + 'T00:00:00')) return false;
      if (endDate && new Date(r.reported_at) > new Date(endDate + 'T23:59:59.999')) return false;
      return true;
    });
  }, [allReports, vendorFilter, materialFilter, brandFilter, zoneFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const prices = filtered.map(r => Number(r.price)).filter(p => p > 0);
    if (!prices.length) return null;
    const sorted = [...prices].sort((a, b) => a - b);
    return {
      count: prices.length,
      avg: prices.reduce((s, p) => s + p, 0) / prices.length,
      median: median(sorted),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }, [filtered]);

  const materialChart = useMemo(() => {
    const freq: Record<string, number> = {};
    filtered.forEach(r => {
      freq[r.material_description] = (freq[r.material_description] || 0) + 1;
    });
    return Object.entries(freq)
      .map(([name, value]) => ({
        name: name.length > 22 ? name.slice(0, 22) + '…' : name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const zoneChart = useMemo(() => {
    const map: Record<string, number[]> = {};
    filtered.forEach(r => {
      const z = r.zone || 'Sin zona';
      (map[z] ||= []).push(Number(r.price) || 0);
    });
    return Object.entries(map)
      .map(([zone, prices]) => ({
        zone,
        promedio: prices.reduce((s, p) => s + p, 0) / prices.length,
        reportes: prices.length,
      }))
      .sort((a, b) => b.promedio - a.promedio)
      .slice(0, 10);
  }, [filtered]);

  const brandChart = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filtered.forEach(r => {
      const b = r.brand || 'Sin marca';
      map[b] ||= { count: 0, total: 0 };
      map[b].count += 1;
      map[b].total += Number(r.price) || 0;
    });
    return Object.entries(map)
      .map(([brand, d]) => ({
        brand: brand.length > 15 ? brand.slice(0, 15) + '…' : brand,
        promedio: d.total / d.count,
        reportes: d.count,
      }))
      .sort((a, b) => b.reportes - a.reportes)
      .slice(0, 6);
  }, [filtered]);

  const trends = useMemo(() => {
    const map: Record<string, { name: string; brand: string | null; points: { price: number; date: number }[] }> = {};
    filtered.forEach(r => {
      const key = `${r.material_description}__${r.brand || 'Sin marca'}`;
      map[key] ||= { name: r.material_description, brand: r.brand, points: [] };
      map[key].points.push({ price: Number(r.price) || 0, date: new Date(r.reported_at).getTime() });
    });
    return Object.values(map)
      .map(m => {
        const sorted = m.points.sort((a, b) => a.date - b.date);
        if (sorted.length < 2) return null;
        const oldPrice = sorted[0].price;
        const newPrice = sorted[sorted.length - 1].price;
        if (!oldPrice) return null;
        const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;
        return {
          material: m.name,
          brand: m.brand,
          oldPrice,
          newPrice,
          changePercent,
          trend: changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable',
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 6);
  }, [filtered]);

  const variations = useMemo(() => {
    const map: Record<string, number[]> = {};
    filtered.forEach(r => {
      (map[r.material_description] ||= []).push(Number(r.price) || 0);
    });
    return Object.entries(map)
      .map(([material, prices]) => {
        if (prices.length < 2) return null;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (!min) return null;
        return { material, min, max, variation: ((max - min) / min) * 100, count: prices.length };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => b.variation - a.variation)
      .slice(0, 5);
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const clearFilters = () => {
    setVendorFilter('all');
    setMaterialFilter('all');
    setBrandFilter('all');
    setZoneFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '12px',
  };

  if (loading) {
    return <p className="text-sm text-slate-500 py-10 text-center">Cargando análisis…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            Vendedor
            <select
              value={vendorFilter}
              onChange={e => {
                setVendorFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">Todos</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Material
            <select
              value={materialFilter}
              onChange={e => {
                setMaterialFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white max-w-52"
            >
              <option value="all">Todos</option>
              {options.materials.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Marca
            <select
              value={brandFilter}
              onChange={e => {
                setBrandFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">Todas</option>
              {options.brands.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Zona
            <select
              value={zoneFilter}
              onChange={e => {
                setZoneFilter(e.target.value);
                setPage(1);
              }}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">Todas</option>
              {options.zones.map(z => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Desde
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Hasta
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reportes</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Promedio</p>
          <p className="text-lg font-bold text-slate-800 mt-1">
            {stats ? formatMoney(stats.avg) : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mediana</p>
          <p className="text-lg font-bold text-slate-800 mt-1">
            {stats ? formatMoney(stats.median) : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mínimo</p>
          <p className="text-lg font-bold text-rose-700 mt-1">
            {stats ? formatMoney(stats.min) : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Máximo</p>
          <p className="text-lg font-bold text-red-600 mt-1">
            {stats ? formatMoney(stats.max) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Materiales más reportados</h3>
          {materialChart.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={materialChart} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  angle={-30}
                  textAnchor="end"
                  fontSize={9}
                  stroke="#64748b"
                  interval={0}
                />
                <YAxis fontSize={10} stroke="#64748b" allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Reportes" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Precio promedio por zona</h3>
          {zoneChart.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={zoneChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="zone" fontSize={10} stroke="#64748b" />
                <YAxis
                  fontSize={9}
                  stroke="#64748b"
                  tickFormatter={v => formatMoney(Number(v))}
                  width={80}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown) => [formatMoney(Number(value)), 'Promedio']}
                />
                <Bar dataKey="promedio" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Marcas más reportadas</h3>
          {brandChart.length === 0 ? (
            <p className="text-sm text-slate-400 py-10 text-center">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={brandChart}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={entry => {
                    const d = entry as unknown as { brand: string; reportes: number };
                    return `${d.brand}: ${d.reportes}`;
                  }}
                  outerRadius={75}
                  dataKey="reportes"
                >
                  {brandChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-rows-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 overflow-hidden">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Tendencias de precio</h3>
            {trends.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Se requieren 2+ reportes por material/marca
              </p>
            ) : (
              <div className="space-y-1.5 overflow-y-auto max-h-36">
                {trends.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <p className="truncate text-slate-700 font-medium">
                      {t.material}
                      {t.brand ? ` · ${t.brand}` : ''}
                    </p>
                    <p
                      className={`font-bold shrink-0 ${
                        t.trend === 'up'
                          ? 'text-red-600'
                          : t.trend === 'down'
                            ? 'text-rose-600'
                            : 'text-slate-500'
                      }`}
                    >
                      {t.trend === 'up' ? '▲' : t.trend === 'down' ? '▼' : '—'}{' '}
                      {t.changePercent > 0 ? '+' : ''}
                      {t.changePercent.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 overflow-hidden">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Mayor variación de precio</h3>
            {variations.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Sin datos suficientes</p>
            ) : (
              <div className="space-y-1.5 overflow-y-auto max-h-36">
                {variations.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-slate-700 font-medium">{v.material}</p>
                      <p className="text-slate-400">
                        {formatMoney(v.min)} – {formatMoney(v.max)} · {v.count} reportes
                      </p>
                    </div>
                    <p
                      className={`font-bold shrink-0 ${
                        v.variation > 50
                          ? 'text-red-600'
                          : v.variation > 25
                            ? 'text-amber-600'
                            : 'text-rose-600'
                      }`}
                    >
                      {v.variation.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla detallada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Reportes detallados</h3>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs text-rose-600 hover:underline"
          >
            Actualizar
          </button>
        </div>
        {pageRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500 text-center">
            No se encontraron reportes con los filtros seleccionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Vendedor</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Entidad</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Material</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Marca</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase text-right">Precio</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Zona</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600 text-xs">
                      {new Date(r.reported_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-xs">
                      {r.seller?.full_name || 'N/A'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-xs">
                      {r.entity_name}{' '}
                      <span className="text-slate-400">({r.entity_type})</span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800 text-xs">
                      {r.material_description}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {r.brand || <span className="italic text-slate-400">Sin marca</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-rose-700 text-xs">
                      {formatMoney(r.price)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{r.zone || 'N/A'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs max-w-40 truncate">
                      {r.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <p>
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
