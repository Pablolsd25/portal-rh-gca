'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';

type Props = {
  sesionId: string;
  userId: string;
  tipo: 'gasto' | 'retiro';
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
};

export default function MovimientoCajaModal({
  sesionId,
  userId,
  tipo,
  onClose,
  onSuccess,
}: Props) {
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = tipo === 'gasto' ? 'Registrar Gasto' : 'Realizar Retiro';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(monto);
    if (!(amount > 0) || !concepto.trim()) {
      setError('Monto y concepto son obligatorios');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('caja_movimientos').insert({
        sesion_id: sesionId,
        tipo,
        monto: amount,
        concepto: concepto.trim(),
        metodo_pago: 'efectivo',
        created_by: userId,
      });
      if (err) throw err;
      await onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        <form onSubmit={e => void submit(e)} className="p-5 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 pr-8">{title}</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <label className="block text-sm font-medium text-gray-700">
            Monto
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={monto}
              onChange={e => setMonto(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Concepto / descripción
            <input
              required
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder={tipo === 'gasto' ? 'Ej. Refacciones' : 'Ej. Depósito banco'}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 ${
                tipo === 'gasto' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-rose-800 hover:bg-rose-900'
              }`}
            >
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
