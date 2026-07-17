'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';

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

type Props = {
  session: {
    id: string;
    fondo_inicial: number;
    numero_caja?: number | null;
  };
  sessionDetails: {
    totalVentasEfectivo: number;
    totalVentasTarjeta: number;
    totalGastos: number;
    totalRetiros: number;
    saldoEsperado: number;
  };
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function CorteCajaModal({
  session,
  sessionDetails,
  userId,
  onClose,
  onSuccess,
}: Props) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoReal = useMemo(
    () => DENOMINATIONS.reduce((t, d) => t + d.value * (counts[d.value] || 0), 0),
    [counts],
  );

  const diferencia = useMemo(() => {
    if (montoReal === 0 && Object.keys(counts).length === 0) return 0;
    return Math.round((montoReal - sessionDetails.saldoEsperado) * 100) / 100;
  }, [montoReal, sessionDetails.saldoEsperado, counts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const denominaciones_cierre = DENOMINATIONS.map(d => ({
        value: d.value,
        label: d.label,
        count: counts[d.value] || 0,
      })).filter(d => d.count > 0);

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('caja_sesiones')
        .update({
          closed_at: new Date().toISOString(),
          total_esperado: sessionDetails.saldoEsperado,
          total_contado: montoReal,
          diferencia,
          denominaciones_cierre,
          notas_cierre: notas.trim() || null,
        })
        .eq('id', session.id)
        .eq('user_id', userId)
        .is('closed_at', null);
      if (updateError) throw updateError;
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl p-5 relative my-4 max-h-[95vh] overflow-y-auto">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-sm text-slate-500">
          Cerrar
        </button>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Realizar corte de caja</h2>
        {session.numero_caja != null && (
          <p className="text-xs text-slate-500 mb-4">Caja {session.numero_caja}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
            <h3 className="font-semibold text-slate-800 mb-2">Resumen de sesión</h3>
            <div className="flex justify-between">
              <span className="text-slate-600">Fondo inicial</span>
              <span className="font-medium">{formatMoney(session.fondo_inicial)}</span>
            </div>
            <div className="flex justify-between text-rose-700">
              <span>(+) Ventas efectivo</span>
              <span className="font-medium">{formatMoney(sessionDetails.totalVentasEfectivo)}</span>
            </div>
            {sessionDetails.totalVentasTarjeta > 0 && (
              <div className="flex justify-between text-sky-700">
                <span>Ventas tarjeta (fuera de caja)</span>
                <span className="font-medium">{formatMoney(sessionDetails.totalVentasTarjeta)}</span>
              </div>
            )}
            <div className="flex justify-between text-red-600">
              <span>(−) Gastos</span>
              <span className="font-medium">{formatMoney(sessionDetails.totalGastos)}</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>(−) Retiros</span>
              <span className="font-medium">{formatMoney(sessionDetails.totalRetiros)}</span>
            </div>
            <hr className="border-slate-200" />
            <div className="flex justify-between text-base font-bold text-slate-900">
              <span>(=) Saldo esperado</span>
              <span>{formatMoney(sessionDetails.saldoEsperado)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Desglose contado *</p>
            <div className="max-h-64 overflow-y-auto border rounded-lg p-2">
              <table className="w-full text-sm">
                <tbody>
                  {DENOMINATIONS.map(d => (
                    <tr key={d.value} className="border-b border-slate-50">
                      <td className="py-1.5 text-slate-700">{d.label}</td>
                      <td className="py-1.5">
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
                          className="w-20 px-2 py-1 border rounded text-slate-900"
                          disabled={loading}
                        />
                      </td>
                      <td className="py-1.5 text-right text-slate-600">
                        {formatMoney((counts[d.value] || 0) * d.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="block text-xs text-slate-600">
              Notas de cierre
              <input
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 border rounded-lg text-sm"
                disabled={loading}
              />
            </label>

            <div
              className={`p-3 rounded-lg text-center font-bold ${
                diferencia === 0
                  ? 'bg-slate-100 text-slate-800'
                  : diferencia > 0
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              Diferencia: {formatMoney(diferencia)}
              {diferencia > 0 ? ' (sobrante)' : ''}
              {diferencia < 0 ? ' (faltante)' : ''}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-sm border rounded-lg">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-2 text-sm bg-rose-600 text-white rounded-lg disabled:opacity-50"
              >
                {loading ? 'Cerrando…' : 'Cerrar caja'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
