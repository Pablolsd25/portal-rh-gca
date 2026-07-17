'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { marcarRevisadoBascula, programarRuta, reordenarRuta, type PedidoEntrega } from '@/lib/rutas';
import { googleMapsDirectionsUrl, type Coord } from '@/lib/gps';
import { fmtDia, fmtMoney } from '@/lib/semana';

const RutaMapa = dynamic(() => import('@/components/RutaMapa'), { ssr: false });

interface Props {
  userId: string;
  puedeProgramar: boolean;
  sucursal: string | null;
  fechaVenta: string;
  fechaEntrega: string;
  vistaActiva: 'bascula' | 'programar' | 'ruta';
  pedidosDia: PedidoEntrega[];
  pedidosPorProgramar: PedidoEntrega[];
  ruta: PedidoEntrega[];
}

const allTabs = [
  { id: 'bascula' as const, label: 'Reporte báscula' },
  { id: 'programar' as const, label: 'Programar ruta' },
  { id: 'ruta' as const, label: 'Ver ruta' },
];

function PedidoRow({
  pedido,
  checked,
  onToggle,
  showEstado,
  showTipo,
  ordenSugerido,
}: {
  pedido: PedidoEntrega;
  checked?: boolean;
  onToggle?: () => void;
  showEstado?: boolean;
  showTipo?: boolean;
  ordenSugerido?: number;
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      {onToggle && (
        <td className="px-3 py-2">
          <input type="checkbox" checked={checked} onChange={onToggle} className="rounded" />
        </td>
      )}
      {(pedido.orden_ruta != null || ordenSugerido != null) && (
        <td className="px-3 py-2 text-sm font-bold text-emerald-700">
          {ordenSugerido ?? pedido.orden_ruta}
        </td>
      )}
      <td className="px-3 py-2 text-sm font-medium text-slate-800">{pedido.cliente}</td>
      <td className="px-3 py-2 text-sm text-slate-600">{pedido.telefono ?? '—'}</td>
      <td className="px-3 py-2 text-sm text-slate-600 max-w-xs truncate" title={pedido.direccion || 'Sin dirección'}>
        {pedido.direccion || '—'}
      </td>
      <td className="px-3 py-2 text-sm text-slate-600">{pedido.items.length} prod.</td>
      <td className="px-3 py-2 text-sm font-medium text-slate-800">{fmtMoney(pedido.total)}</td>
      {showEstado && (
        <td className="px-3 py-2">
          {pedido.revisado_bascula ? (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Revisado</span>
          ) : (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pendiente</span>
          )}
        </td>
      )}
      {showTipo && (
        <td className="px-3 py-2">
          {pedido.para_ruta ? (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Ruta</span>
          ) : (
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Mostrador</span>
          )}
        </td>
      )}
    </tr>
  );
}

export default function RutasClient({
  userId,
  puedeProgramar,
  sucursal,
  fechaVenta,
  fechaEntrega,
  vistaActiva,
  pedidosDia,
  pedidosPorProgramar,
  ruta,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [optimizando, setOptimizando] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [optInfo, setOptInfo] = useState<string | null>(null);
  const [seleccionBascula, setSeleccionBascula] = useState<Set<string>>(new Set());
  const [seleccionRuta, setSeleccionRuta] = useState<Set<string>>(new Set());
  const [ordenSugerido, setOrdenSugerido] = useState<string[] | null>(null);
  const [coordsOpt, setCoordsOpt] = useState<Record<string, Coord>>({});

  const navegar = (vista: string, extra?: Record<string, string>) => {
    const p = new URLSearchParams({ vista, fecha: fechaVenta, entrega: fechaEntrega, ...extra });
    router.push(`/dashboard/rutas?${p}`);
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
    setOrdenSugerido(null);
    setOptInfo(null);
  };

  const marcarRevisados = async () => {
    const ids = [...seleccionBascula];
    if (ids.length === 0) return;
    setLoading(true);
    setActionError(null);
    try {
      const supabase = createClient();
      await marcarRevisadoBascula(supabase, ids, userId, fechaVenta);
      setSeleccionBascula(new Set());
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo guardar en báscula');
    } finally {
      setLoading(false);
    }
  };

  const sugerirOrden = async (ids: string[], pedidos: PedidoEntrega[]) => {
    if (ids.length < 2) {
      setActionError('Selecciona al menos 2 paradas para optimizar');
      return null;
    }
    setOptimizando(true);
    setActionError(null);
    setOptInfo(null);
    try {
      const byId = new Map(pedidos.map(p => [p.quote_id, p]));
      const res = await fetch('/api/optimizar-ruta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paradas: ids.map(id => {
            const p = byId.get(id)!;
            return {
              id,
              direccion: p.direccion,
              lat: p.lat,
              lng: p.lng,
            };
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo optimizar');

      setCoordsOpt(data.coords ?? {});
      setOrdenSugerido(data.order as string[]);
      const metodo = data.method === 'osrm' ? 'por calles (OSRM)' : 'por distancia aproximada';
      const km = data.kmAprox != null ? ` · ~${data.kmAprox.toFixed(1)} km` : '';
      const fallidas = (data.fallidas as string[] | undefined)?.length ?? 0;
      setOptInfo(
        `Orden sugerido ${metodo}${km}` +
          (fallidas > 0 ? ` · ${fallidas} dirección(es) sin ubicar (quedan al final)` : ''),
      );
      return { order: data.order as string[], coords: data.coords as Record<string, Coord> };
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al sugerir ruta');
      return null;
    } finally {
      setOptimizando(false);
    }
  };

  const crearRuta = async (usarOrdenGps: boolean) => {
    let ids = ordenSugerido?.filter(id => seleccionRuta.has(id)) ?? [...seleccionRuta];
    // Incluir seleccionados que no entraron en el orden (falló geocode)
    for (const id of seleccionRuta) {
      if (!ids.includes(id)) ids.push(id);
    }
    if (ids.length === 0) return;

    let coords = coordsOpt;
    if (usarOrdenGps && !ordenSugerido) {
      const result = await sugerirOrden(ids, pedidosPorProgramar);
      if (!result) return;
      ids = result.order;
      for (const id of seleccionRuta) {
        if (!ids.includes(id)) ids.push(id);
      }
      coords = result.coords;
    }

    setLoading(true);
    setActionError(null);
    try {
      const supabase = createClient();
      await programarRuta(supabase, ids, fechaEntrega, userId, coords);
      setSeleccionRuta(new Set());
      setOrdenSugerido(null);
      setCoordsOpt({});
      navegar('ruta');
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo programar la ruta');
    } finally {
      setLoading(false);
    }
  };

  const optimizarRutaExistente = async () => {
    const ids = ruta.map(p => p.quote_id);
    const result = await sugerirOrden(ids, ruta);
    if (!result) return;
    setLoading(true);
    try {
      const supabase = createClient();
      await reordenarRuta(supabase, result.order, userId, result.coords);
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo reordenar');
    } finally {
      setLoading(false);
    }
  };

  const imprimir = () => window.print();

  const pendientes = pedidosDia.filter(p => !p.revisado_bascula);
  const conRuta = pedidosDia.filter(p => p.para_ruta);
  const tabs = puedeProgramar ? allTabs : allTabs.filter(t => t.id === 'bascula');

  const ordenMap = useMemo(() => {
    if (!ordenSugerido) return new Map<string, number>();
    return new Map(ordenSugerido.map((id, i) => [id, i + 1]));
  }, [ordenSugerido]);

  const listaProgramar = useMemo(() => {
    if (!ordenSugerido) return pedidosPorProgramar;
    const byId = new Map(pedidosPorProgramar.map(p => [p.quote_id, p]));
    const ordered = ordenSugerido.map(id => byId.get(id)).filter(Boolean) as PedidoEntrega[];
    const rest = pedidosPorProgramar.filter(p => !ordenSugerido.includes(p.quote_id));
    return [...ordered, ...rest];
  }, [pedidosPorProgramar, ordenSugerido]);

  const marcadoresRuta = useMemo(
    () =>
      ruta
        .filter(p => p.lat != null && p.lng != null)
        .map(p => ({
          lat: p.lat!,
          lng: p.lng!,
          orden: p.orden_ruta ?? 0,
          label: p.cliente,
          direccion: p.direccion,
        })),
    [ruta],
  );

  const depot: Coord | null = (() => {
    const lat = Number(process.env.NEXT_PUBLIC_DEPOT_LAT);
    const lng = Number(process.env.NEXT_PUBLIC_DEPOT_LNG);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  })();

  const mapsUrl =
    marcadoresRuta.length > 0
      ? googleMapsDirectionsUrl(
          [...marcadoresRuta].sort((a, b) => a.orden - b.orden).map(m => ({ lat: m.lat, lng: m.lng })),
          depot,
        )
      : null;

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit print:hidden">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => navegar(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              vistaActiva === t.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* BÁSCULA */}
      {vistaActiva === 'bascula' && (
        <div className="space-y-4">
          {actionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}
          <div className="flex items-center gap-3 print:hidden">
            <label className="text-sm text-slate-600">Fecha de ventas:</label>
            <input
              type="date"
              value={fechaVenta}
              onChange={e => navegar('bascula', { fecha: e.target.value })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <span className="text-sm text-slate-500">
              {pedidosDia.length} venta{pedidosDia.length !== 1 ? 's' : ''}
              {conRuta.length > 0 && ` · ${conRuta.length} con ruta`}
              {sucursal && ` · ${sucursal}`}
              {pendientes.length > 0 && ` · ${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {pedidosDia.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
              <p>No hay ventas concretadas para {fmtDia(fechaVenta, 'long')}.</p>
              <p className="text-xs mt-2 text-slate-400">Prueba otra fecha o verifica ventas en portal-staff.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-2 w-8" />
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Teléfono</th>
                      <th className="px-3 py-2">Dirección</th>
                      <th className="px-3 py-2">Productos</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Báscula</th>
                      <th className="px-3 py-2">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosDia.map(p => (
                      <PedidoRow
                        key={p.quote_id}
                        pedido={p}
                        showEstado
                        showTipo
                        checked={seleccionBascula.has(p.quote_id)}
                        onToggle={p.revisado_bascula ? undefined : () => toggle(seleccionBascula, p.quote_id, setSeleccionBascula)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {pendientes.length > 0 && (
                <button
                  onClick={marcarRevisados}
                  disabled={loading || seleccionBascula.size === 0}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 print:hidden"
                >
                  {loading ? 'Guardando...' : `Marcar ${seleccionBascula.size || ''} como revisado en báscula`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* PROGRAMAR */}
      {vistaActiva === 'programar' && (
        <div className="space-y-4">
          {(actionError || optInfo) && (
            <div
              className={`rounded-lg px-4 py-2 text-sm ${
                actionError
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              {actionError ?? optInfo}
            </div>
          )}
          <div className="flex items-center gap-3 print:hidden flex-wrap">
            <label className="text-sm text-slate-600">Entrega para:</label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={e => navegar('programar', { entrega: e.target.value })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <span className="text-sm text-slate-500">
              {pedidosPorProgramar.length} pedido{pedidosPorProgramar.length !== 1 ? 's' : ''} listo
              {pedidosPorProgramar.length !== 1 ? 's' : ''}
            </span>
          </div>

          {pedidosPorProgramar.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
              <p className="text-amber-800 font-medium">No hay pedidos listos para programar.</p>
              <p className="text-amber-700 text-sm mt-1">Primero revisa los pedidos del día en báscula.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-2 w-8" />
                      {ordenSugerido && <th className="px-3 py-2">#</th>}
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Teléfono</th>
                      <th className="px-3 py-2">Dirección</th>
                      <th className="px-3 py-2">Productos</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaProgramar.map(p => (
                      <PedidoRow
                        key={p.quote_id}
                        pedido={p}
                        checked={seleccionRuta.has(p.quote_id)}
                        onToggle={() => toggle(seleccionRuta, p.quote_id, setSeleccionRuta)}
                        ordenSugerido={ordenMap.get(p.quote_id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => sugerirOrden([...seleccionRuta], pedidosPorProgramar)}
                  disabled={optimizando || seleccionRuta.size < 2}
                  className="px-4 py-2 border border-emerald-600 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                >
                  {optimizando ? 'Calculando GPS...' : 'Sugerir orden óptimo'}
                </button>
                <button
                  onClick={() => crearRuta(false)}
                  disabled={loading || optimizando || seleccionRuta.size === 0}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading
                    ? 'Guardando...'
                    : `Programar ${seleccionRuta.size || ''} pedido${seleccionRuta.size !== 1 ? 's' : ''} para ${fmtDia(fechaEntrega)}`}
                </button>
                {seleccionRuta.size >= 2 && !ordenSugerido && (
                  <button
                    onClick={() => crearRuta(true)}
                    disabled={loading || optimizando}
                    className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50"
                  >
                    Optimizar y programar
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                El orden de selección (o el sugerido por GPS) define las paradas 1…n. La optimización usa OpenStreetMap
                (sin costo de API).
              </p>
            </>
          )}
        </div>
      )}

      {/* VER RUTA */}
      {vistaActiva === 'ruta' && (
        <div className="space-y-4">
          {(actionError || optInfo) && (
            <div
              className={`rounded-lg px-4 py-2 text-sm print:hidden ${
                actionError
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              {actionError ?? optInfo}
            </div>
          )}
          <div className="flex items-center justify-between print:hidden flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Ruta del:</label>
              <input
                type="date"
                value={fechaEntrega}
                onChange={e => navegar('ruta', { entrega: e.target.value })}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            {ruta.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={optimizarRutaExistente}
                  disabled={optimizando || loading || ruta.length < 2}
                  className="px-4 py-2 border border-emerald-600 text-emerald-700 text-sm rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                >
                  {optimizando ? 'Optimizando...' : 'Reordenar por GPS'}
                </button>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    Abrir en Google Maps
                  </a>
                )}
                <button onClick={imprimir} className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50">
                  Imprimir ruta
                </button>
              </div>
            )}
          </div>

          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-bold">Ruta de entrega — {fmtDia(fechaEntrega, 'long')}</h2>
            <p className="text-sm text-slate-600">{ruta.length} paradas</p>
          </div>

          {ruta.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
              No hay pedidos programados para {fmtDia(fechaEntrega, 'long')}.
            </div>
          ) : (
            <>
              {marcadoresRuta.length > 0 ? (
                <RutaMapa
                  paradas={marcadoresRuta}
                  depot={depot}
                  depotLabel={process.env.NEXT_PUBLIC_DEPOT_LABEL || 'Bodega GCA'}
                />
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 print:hidden">
                  Aún no hay coordenadas. Usa <strong>Reordenar por GPS</strong> para ubicar las direcciones en el mapa.
                </div>
              )}
              <div className="space-y-3">
                {ruta.map(p => (
                  <div key={p.quote_id} className="bg-white rounded-xl border border-slate-200 p-4 print:break-inside-avoid">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {p.orden_ruta}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800">{p.cliente}</p>
                        {p.telefono && <p className="text-sm text-slate-600">{p.telefono}</p>}
                        <p className="text-sm text-slate-700 mt-1">📍 {p.direccion}</p>
                        {p.lat != null && p.lng != null && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline print:hidden"
                          >
                            Ver en mapa
                          </a>
                        )}
                        <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
                          {p.items.map((it, i) => (
                            <li key={i}>
                              · {it.description} — {it.quantity} {it.unit}
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm font-medium text-slate-800 mt-2">{fmtMoney(p.total)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
