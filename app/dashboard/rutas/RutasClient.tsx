'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { marcarRevisadoBascula, programarRuta, type PedidoEntrega } from '@/lib/rutas';
import { fmtDia, fmtMoney } from '@/lib/semana';

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
}: {
  pedido: PedidoEntrega;
  checked?: boolean;
  onToggle?: () => void;
  showEstado?: boolean;
  showTipo?: boolean;
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      {onToggle && (
        <td className="px-3 py-2">
          <input type="checkbox" checked={checked} onChange={onToggle} className="rounded" />
        </td>
      )}
      {pedido.orden_ruta != null && (
        <td className="px-3 py-2 text-sm font-bold text-emerald-700">{pedido.orden_ruta}</td>
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [seleccionBascula, setSeleccionBascula] = useState<Set<string>>(new Set());
  const [seleccionRuta, setSeleccionRuta] = useState<Set<string>>(new Set());

  const navegar = (vista: string, extra?: Record<string, string>) => {
    const p = new URLSearchParams({ vista, fecha: fechaVenta, entrega: fechaEntrega, ...extra });
    router.push(`/dashboard/rutas?${p}`);
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
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

  const crearRuta = async () => {
    const ids = [...seleccionRuta];
    if (ids.length === 0) return;
    setLoading(true);
    setActionError(null);
    try {
      const supabase = createClient();
      await programarRuta(supabase, ids, fechaEntrega, userId);
      setSeleccionRuta(new Set());
      navegar('ruta');
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo programar la ruta');
    } finally {
      setLoading(false);
    }
  };

  const imprimir = () => window.print();

  const pendientes = pedidosDia.filter(p => !p.revisado_bascula);
  const conRuta = pedidosDia.filter(p => p.para_ruta);
  const tabs = puedeProgramar ? allTabs : allTabs.filter(t => t.id === 'bascula');

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
          <div className="flex items-center gap-3 print:hidden">
            <label className="text-sm text-slate-600">Entrega para:</label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={e => navegar('programar', { entrega: e.target.value })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <span className="text-sm text-slate-500">
              {pedidosPorProgramar.length} pedido{pedidosPorProgramar.length !== 1 ? 's' : ''} listo{pedidosPorProgramar.length !== 1 ? 's' : ''}
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
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Teléfono</th>
                      <th className="px-3 py-2">Dirección</th>
                      <th className="px-3 py-2">Productos</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosPorProgramar.map(p => (
                      <PedidoRow
                        key={p.quote_id}
                        pedido={p}
                        checked={seleccionRuta.has(p.quote_id)}
                        onToggle={() => toggle(seleccionRuta, p.quote_id, setSeleccionRuta)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={crearRuta}
                disabled={loading || seleccionRuta.size === 0}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Programar {seleccionRuta.size || ''} pedido{seleccionRuta.size !== 1 ? 's' : ''} para {fmtDia(fechaEntrega)}
              </button>
            </>
          )}
        </div>
      )}

      {/* VER RUTA */}
      {vistaActiva === 'ruta' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between print:hidden">
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
              <button onClick={imprimir} className="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50">
                Imprimir ruta
              </button>
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
                      <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
                        {p.items.map((it, i) => (
                          <li key={i}>· {it.description} — {it.quantity} {it.unit}</li>
                        ))}
                      </ul>
                      <p className="text-sm font-medium text-slate-800 mt-2">{fmtMoney(p.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
