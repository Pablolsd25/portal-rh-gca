'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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

const DENOMINATIONS = [
  { value: 1000, label: '$1000 (billete)' },
  { value: 500, label: '$500 (billete)' },
  { value: 200, label: '$200 (billete)' },
  { value: 100, label: '$100 (billete)' },
  { value: 50, label: '$50 (billete)' },
  { value: 20, label: '$20 (billete)' },
  { value: 10, label: '$10 (moneda)' },
  { value: 5, label: '$5 (moneda)' },
  { value: 2, label: '$2 (moneda)' },
  { value: 1, label: '$1 (moneda)' },
  { value: 0.5, label: '$0.50 (moneda)' },
];

const CAJA_HINT = `Ejecuta schema_caja.sql en Supabase (caja_sesiones / caja_movimientos).
Campos clave: user_id, numero_caja, opened_at/closed_at, fondo_inicial,
denominaciones_apertura/cierre, metodo_pago, concepto.`;

function isMissingTable(msg: string) {
  return /caja_sesiones|caja_movimientos|does not exist|schema cache|column/i.test(msg);
}

function isTarjeta(method: string | null | undefined) {
  const m = (method || '').toLowerCase();
  return m.includes('tarjeta');
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
  const [busy, setBusy] = useState(false);
  const [showCorte, setShowCorte] = useState(false);
  const [numeroCaja, setNumeroCaja] = useState<1 | 2 | 3>(1);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoDesc, setGastoDesc] = useState('');
  const [retiroMonto, setRetiroMonto] = useState('');
  const [retiroDesc, setRetiroDesc] = useState('');

  const fondoInicial = useMemo(
    () => DENOMINATIONS.reduce((t, d) => t + d.value * (counts[d.value] || 0), 0),
    [counts],
  );

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
    totalVentasEfectivo = Math.round(totalVentasEfectivo * 100) / 100;
    totalVentasTarjeta = Math.round(totalVentasTarjeta * 100) / 100;
    totalGastos = Math.round(totalGastos * 100) / 100;
    totalRetiros = Math.round(totalRetiros * 100) / 100;
    const saldoEsperado =
      Math.round((inicial + totalVentasEfectivo - totalGastos - totalRetiros) * 100) / 100;
    return {
      totalVentasEfectivo,
      totalVentasTarjeta,
      totalGastos,
      totalRetiros,
      saldoEsperado,
    };
  }, [sesion, movs]);

  const abrir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sucursal) {
      setError('Sin sucursal en staff_users');
      return;
    }
    if (!(fondoInicial > 0)) {
      setError('El fondo inicial debe ser mayor a cero (usa el desglose)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from('caja_sesiones')
        .select('id')
        .eq('user_id', userId)
        .eq('numero_caja', numeroCaja)
        .is('closed_at', null)
        .maybeSingle();
      if (existing) {
        throw new Error(`Ya tienes la caja ${numeroCaja} abierta. Ciérrala primero.`);
      }

      const denominaciones_apertura = DENOMINATIONS.map(d => ({
        value: d.value,
        label: d.label,
        count: counts[d.value] || 0,
      })).filter(d => d.count > 0);

      const { error: err } = await supabase.from('caja_sesiones').insert({
        user_id: userId,
        sucursal,
        numero_caja: numeroCaja,
        fondo_inicial: fondoInicial,
        denominaciones_apertura,
      });
      if (err) throw err;

      setCounts({});
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo abrir caja';
      if (isMissingTable(msg)) setMissing(true);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const registrar = async (tipo: 'gasto' | 'retiro', montoStr: string, desc: string) => {
    if (!sesion) return;
    const monto = parseFloat(montoStr);
    if (!(monto > 0) || !desc.trim()) {
      setError('Monto y descripción requeridos');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('caja_movimientos').insert({
        sesion_id: sesion.id,
        tipo,
        monto,
        concepto: desc.trim(),
        created_by: userId,
      });
      if (err) throw err;
      if (tipo === 'gasto') {
        setGastoMonto('');
        setGastoDesc('');
      } else {
        setRetiroMonto('');
        setRetiroDesc('');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar');
    } finally {
      setBusy(false);
    }
  };

  if (missing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
        <p className="font-medium">Tablas de caja no encontradas o esquema distinto</p>
        <p className="mt-1 text-amber-800">{CAJA_HINT}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : !sesion ? (
        <form onSubmit={abrir} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 max-w-lg">
          <h2 className="text-sm font-semibold text-slate-800">Abrir sesión de caja</h2>
          <label className="block text-xs text-slate-600">
            Número de caja
            <select
              value={numeroCaja}
              onChange={e => setNumeroCaja(Number(e.target.value) as 1 | 2 | 3)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value={1}>Caja 1</option>
              <option value={2}>Caja 2</option>
              <option value={3}>Caja 3</option>
            </select>
          </label>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Desglose de apertura</p>
            <div className="max-h-56 overflow-y-auto border rounded-lg p-2">
              <table className="w-full text-sm">
                <tbody>
                  {DENOMINATIONS.map(d => (
                    <tr key={d.value} className="border-b border-slate-50">
                      <td className="py-1 text-slate-700">{d.label}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          onChange={e => {
                            const n = parseInt(e.target.value, 10);
                            setCounts(prev => {
                              const next = { ...prev };
                              if (!n) delete next[d.value];
                              else next[d.value] = n;
                              return next;
                            });
                          }}
                          className="w-20 px-2 py-1 border rounded"
                          disabled={busy}
                        />
                      </td>
                      <td className="text-right text-slate-600">
                        {formatMoney((counts[d.value] || 0) * d.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm font-semibold text-right text-slate-800">
              Fondo inicial: {formatMoney(fondoInicial)}
            </p>
          </div>

          <button
            type="submit"
            disabled={busy || fondoInicial <= 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            Abrir caja {numeroCaja}
          </button>
        </form>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap gap-6 justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Sesión abierta</p>
                <span className="px-2.5 py-0.5 bg-sky-600 text-white text-xs font-bold rounded-lg">
                  Caja {sesion.numero_caja || 1}
                </span>
              </div>
              <p className="text-sm text-slate-700 mt-1">
                {sesion.sucursal} · desde{' '}
                {new Date(sesion.opened_at).toLocaleString('es-MX')}
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
            <div className="text-right space-y-2">
              <div>
                <p className="text-xs text-slate-500">Saldo esperado (efectivo)</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatMoney(sessionDetails.saldoEsperado)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCorte(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg"
              >
                Corte de caja
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <form
              onSubmit={e => {
                e.preventDefault();
                void registrar('gasto', gastoMonto, gastoDesc);
              }}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
            >
              <h3 className="text-sm font-semibold text-slate-800">Registrar gasto</h3>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={gastoMonto}
                onChange={e => setGastoMonto(e.target.value)}
              />
              <input
                placeholder="Concepto"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={gastoDesc}
                onChange={e => setGastoDesc(e.target.value)}
              />
              <button
                type="submit"
                disabled={busy}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
              >
                Guardar gasto
              </button>
            </form>

            <form
              onSubmit={e => {
                e.preventDefault();
                void registrar('retiro', retiroMonto, retiroDesc);
              }}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-2"
            >
              <h3 className="text-sm font-semibold text-slate-800">Registrar retiro</h3>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={retiroMonto}
                onChange={e => setRetiroMonto(e.target.value)}
              />
              <input
                placeholder="Concepto"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={retiroDesc}
                onChange={e => setRetiroDesc(e.target.value)}
              />
              <button
                type="submit"
                disabled={busy}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded-lg"
              >
                Guardar retiro
              </button>
            </form>
          </div>

          <section>
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Movimientos</h2>
            {movs.length === 0 ? (
              <p className="text-sm text-slate-500">Sin movimientos.</p>
            ) : (
              <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {movs.map(m => (
                  <li key={m.id} className="px-4 py-2.5 flex justify-between gap-3 text-sm">
                    <div>
                      <span className="font-medium text-slate-800 capitalize">
                        {m.tipo.replace('_', ' ')}
                      </span>
                      {m.metodo_pago && (
                        <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {m.metodo_pago}
                        </span>
                      )}
                      <span className="text-slate-500 ml-2">{m.concepto}</span>
                      <p className="text-xs text-slate-400">
                        {new Date(m.created_at).toLocaleString('es-MX')}
                      </p>
                    </div>
                    <span
                      className={
                        m.tipo === 'gasto' || m.tipo === 'retiro'
                          ? 'text-red-600 font-medium'
                          : 'text-emerald-700 font-medium'
                      }
                    >
                      {m.tipo === 'gasto' || m.tipo === 'retiro' ? '−' : '+'}
                      {formatMoney(m.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {showCorte && (
            <CorteCajaModal
              session={{
                id: sesion.id,
                fondo_inicial: sesion.fondo_inicial,
                numero_caja: sesion.numero_caja,
              }}
              sessionDetails={sessionDetails}
              userId={userId}
              onClose={() => setShowCorte(false)}
              onSuccess={() => {
                setShowCorte(false);
                void load();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
