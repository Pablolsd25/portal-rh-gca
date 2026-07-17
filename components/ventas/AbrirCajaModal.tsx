'use client';

import { useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
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
  userId: string;
  sucursal: string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
};

export default function AbrirCajaModal({ userId, sucursal, onClose, onSuccess }: Props) {
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [numeroCaja, setNumeroCaja] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoInicial = useMemo(
    () => DENOMINATIONS.reduce((t, d) => t + d.value * (counts[d.value] || 0), 0),
    [counts],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (montoInicial <= 0) {
      setError('El monto inicial debe ser mayor a cero.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from('caja_sesiones')
        .select('id')
        .eq('user_id', userId)
        .eq('numero_caja', Number(numeroCaja))
        .is('closed_at', null)
        .maybeSingle();
      if (existing) throw new Error('Ya tienes esa caja abierta. Ciérrala primero.');

      const denominaciones_apertura = DENOMINATIONS.map(d => ({
        value: d.value,
        label: d.label,
        count: counts[d.value] || 0,
      })).filter(d => d.count > 0);

      const { data: sesion, error: err } = await supabase
        .from('caja_sesiones')
        .insert({
          user_id: userId,
          sucursal,
          numero_caja: Number(numeroCaja),
          fondo_inicial: montoInicial,
          denominaciones_apertura,
          opened_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (err) throw err;

      await supabase.from('caja_movimientos').insert({
        sesion_id: sesion.id,
        tipo: 'fondo_inicial',
        monto: montoInicial,
        concepto: 'Fondo de caja inicial',
        metodo_pago: 'efectivo',
        created_by: userId,
      });

      await onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al abrir caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg my-auto max-h-[95vh] overflow-y-auto relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        <form onSubmit={e => void submit(e)} className="p-5 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 pr-8">Abrir Caja</h2>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

          <label className="block text-sm font-medium text-gray-700">
            Número de caja
            <select
              value={numeroCaja}
              onChange={e => setNumeroCaja(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="1">Caja 1</option>
              <option value="2">Caja 2</option>
              <option value="3">Caja 3</option>
            </select>
          </label>

          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
            <p className="text-xs font-semibold text-gray-600 uppercase">Conteo de denominaciones</p>
            {DENOMINATIONS.map(d => (
              <div key={d.value} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-700">{d.label}</span>
                <input
                  type="number"
                  min={0}
                  className="w-20 border rounded px-2 py-1 text-right"
                  value={counts[d.value] || ''}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10);
                    setCounts(prev => {
                      const next = { ...prev };
                      if (!n || n <= 0) delete next[d.value];
                      else next[d.value] = n;
                      return next;
                    });
                  }}
                />
              </div>
            ))}
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-center">
            <p className="text-xs text-rose-700">Fondo inicial</p>
            <p className="text-2xl font-bold text-rose-900">{formatMoney(montoInicial)}</p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-rose-800 hover:bg-rose-900 text-white rounded-md disabled:opacity-50"
            >
              {loading ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
