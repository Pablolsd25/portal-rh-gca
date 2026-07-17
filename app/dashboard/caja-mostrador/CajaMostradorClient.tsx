'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BanknotesIcon,
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import AbrirCajaModal from '@/components/ventas/AbrirCajaModal';
import MovimientoCajaModal from '@/components/ventas/MovimientoCajaModal';
import CorteCajaModal from '@/components/ventas/CorteCajaModal';
import { formatMoney } from '@/lib/ventas/quotes';

type Sesion = {
  id: string;
  sucursal: string | null;
  fondo_inicial: number;
  opened_at: string;
  numero_caja: number;
  denominaciones_apertura?: unknown;
};

type Movimiento = {
  id: string;
  tipo: string;
  monto: number;
  concepto: string | null;
  metodo_pago: string | null;
  created_at: string;
};

const CAJA_HINT = `Ejecuta schema_caja.sql en Supabase (caja_sesiones / caja_movimientos).`;

function isMissingTable(msg: string) {
  return /caja_sesiones|caja_movimientos|does not exist|schema cache|column/i.test(msg);
}

function isTarjeta(method: string | null | undefined) {
  return (method || '').toLowerCase().includes('tarjeta');
}

function isEfectivo(method: string | null | undefined) {
  const m = (method || '').toLowerCase();
  return !m || m === 'efectivo' || m.includes('efectivo');
}

export default function CajaMostradorClient({
  userId,
  sucursal,
}: {
  userId: string;
  sucursal: string | null;
}) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAbrir, setShowAbrir] = useState(false);
  const [showGasto, setShowGasto] = useState(false);
  const [showRetiro, setShowRetiro] = useState(false);
  const [showCorte, setShowCorte] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('caja_sesiones')
        .select('id, sucursal, fondo_inicial, opened_at, numero_caja, denominaciones_apertura')
        .eq('user_id', userId)
        .is('closed_at', null)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) {
        if (isMissingTable(err.message)) {
          setMissing(true);
          setSesion(null);
          setMovs([]);
          return;
        }
        throw err;
      }

      setSesion(data as Sesion | null);
      if (data?.id) {
        const { data: m, error: mErr } = await supabase
          .from('caja_movimientos')
          .select('id, tipo, monto, concepto, metodo_pago, created_at')
          .eq('sesion_id', data.id)
          .order('created_at', { ascending: false });
        if (mErr) {
          if (isMissingTable(mErr.message)) {
            setMissing(true);
            return;
          }
          throw mErr;
        }
        setMovs((m as Movimiento[]) || []);
      } else {
        setMovs([]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar caja';
      if (isMissingTable(msg)) setMissing(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sessionDetails = useMemo(() => {
    const inicial = Number(sesion?.fondo_inicial) || 0;
    let totalVentasEfectivo = 0;
    let totalVentasTarjeta = 0;
    let totalGastos = 0;
    let totalRetiros = 0;
    for (const m of movs) {
      const monto = Number(m.monto) || 0;
      if (m.tipo === 'ingreso_venta') {
        if (isTarjeta(m.metodo_pago)) totalVentasTarjeta += monto;
        else if (isEfectivo(m.metodo_pago)) totalVentasEfectivo += monto;
        else totalVentasEfectivo += monto;
      } else if (m.tipo === 'gasto') totalGastos += monto;
      else if (m.tipo === 'retiro') totalRetiros += monto;
    }
    const saldoEsperado =
      Math.round((inicial + totalVentasEfectivo - totalGastos - totalRetiros) * 100) / 100;
    return {
      totalVentas: Math.round((totalVentasEfectivo + totalVentasTarjeta) * 100) / 100,
      totalVentasEfectivo: Math.round(totalVentasEfectivo * 100) / 100,
      totalVentasTarjeta: Math.round(totalVentasTarjeta * 100) / 100,
      totalGastos: Math.round(totalGastos * 100) / 100,
      totalRetiros: Math.round(totalRetiros * 100) / 100,
      saldoEsperado,
    };
  }, [sesion, movs]);

  if (missing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
        <p className="font-medium">Tablas de caja no encontradas</p>
        <p className="mt-1">{CAJA_HINT}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Gestión de Caja</h1>
        <p className="text-sm text-slate-500 mt-1">Apertura, gastos, retiros y corte</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : !sesion ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-lg mx-auto space-y-4">
          <BanknotesIcon className="w-14 h-14 text-rose-700 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">No hay caja abierta</h2>
          <p className="text-sm text-slate-500">
            Abre una sesión con conteo de denominaciones para empezar a registrar movimientos.
          </p>
          <button
            type="button"
            disabled={!sucursal}
            onClick={() => setShowAbrir(true)}
            className="px-5 py-2.5 bg-rose-800 hover:bg-rose-900 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            Abrir caja
          </button>
          {!sucursal && (
            <p className="text-xs text-amber-700">Tu usuario no tiene sucursal asignada en staff_users.</p>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap gap-6 justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Sesión abierta</p>
                <span className="px-2.5 py-0.5 bg-rose-800 text-white text-xs font-bold rounded-lg">
                  Caja {sesion.numero_caja || 1}
                </span>
              </div>
              <p className="text-sm text-slate-700 mt-1">
                {sesion.sucursal} · desde {new Date(sesion.opened_at).toLocaleString('es-MX')}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Fondo inicial {formatMoney(sesion.fondo_inicial)}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                <span>Efectivo {formatMoney(sessionDetails.totalVentasEfectivo)}</span>
                {sessionDetails.totalVentasTarjeta > 0 && (
                  <span>Tarjeta {formatMoney(sessionDetails.totalVentasTarjeta)}</span>
                )}
                <span>Gastos {formatMoney(sessionDetails.totalGastos)}</span>
                <span>Retiros {formatMoney(sessionDetails.totalRetiros)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Saldo esperado (efectivo)</p>
              <p className="text-2xl font-bold text-rose-800">
                {formatMoney(sessionDetails.saldoEsperado)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setShowGasto(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold text-sm"
            >
              <ArrowDownCircleIcon className="w-5 h-5" />
              Registrar gasto
            </button>
            <button
              type="button"
              onClick={() => setShowRetiro(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-800 hover:bg-rose-900 text-white rounded-xl font-semibold text-sm"
            >
              <ArrowUpCircleIcon className="w-5 h-5" />
              Realizar retiro
            </button>
            <button
              type="button"
              onClick={() => setShowCorte(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-sm"
            >
              <LockClosedIcon className="w-5 h-5" />
              Corte de caja
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Movimientos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase text-left">
                  <tr>
                    <th className="px-4 py-2">Hora</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Concepto</th>
                    <th className="px-4 py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        Sin movimientos
                      </td>
                    </tr>
                  ) : (
                    movs.map(m => (
                      <tr key={m.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                          {new Date(m.created_at).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-2 capitalize">{m.tipo.replace('_', ' ')}</td>
                        <td className="px-4 py-2">
                          {m.concepto || '—'}
                          {m.metodo_pago ? (
                            <span className="text-[11px] text-slate-400"> · {m.metodo_pago}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{formatMoney(m.monto)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAbrir && sucursal && (
        <AbrirCajaModal
          userId={userId}
          sucursal={sucursal}
          onClose={() => setShowAbrir(false)}
          onSuccess={load}
        />
      )}
      {showGasto && sesion && (
        <MovimientoCajaModal
          tipo="gasto"
          sesionId={sesion.id}
          userId={userId}
          onClose={() => setShowGasto(false)}
          onSuccess={load}
        />
      )}
      {showRetiro && sesion && (
        <MovimientoCajaModal
          tipo="retiro"
          sesionId={sesion.id}
          userId={userId}
          onClose={() => setShowRetiro(false)}
          onSuccess={load}
        />
      )}
      {showCorte && sesion && (
        <CorteCajaModal
          session={sesion}
          sessionDetails={sessionDetails}
          userId={userId}
          onClose={() => setShowCorte(false)}
          onSuccess={async () => {
            setShowCorte(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
