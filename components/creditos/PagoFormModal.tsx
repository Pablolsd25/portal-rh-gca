'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';

type Props = {
  creditId: string;
  clientName: string;
  totalDue: number;
  balance: number;
  staffId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PagoFormModal({
  creditId,
  clientName,
  totalDue,
  balance,
  staffId,
  onClose,
  onSuccess,
}: Props) {
  const today = new Date().toLocaleDateString('en-CA');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paidAmount = parseFloat(amount);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      setError('El monto debe ser un número positivo.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const localDate = new Date(`${paymentDate}T00:00:00`);
      const supabase = createClient();
      const { error: insertError } = await supabase.from('payments').insert({
        credit_id: creditId,
        registered_by_staff_id: staffId,
        payment_date: localDate.toISOString(),
        amount_paid: paidAmount,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
      });
      if (insertError) throw insertError;

      const newBalance = balance - paidAmount;
      if (newBalance <= 0.01) {
        await supabase
          .from('credits')
          .update({ status: 'pagado', completed_at: new Date().toISOString() })
          .eq('id', creditId)
          .eq('status', 'activo');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Registrar abono</h2>
        <p className="text-sm text-slate-600 mb-1">Cliente: {clientName}</p>
        <p className="text-sm text-slate-600 mb-4">
          Total: {formatMoney(totalDue)} · Saldo: {formatMoney(balance)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={loading}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              disabled={loading}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Método</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              disabled={loading}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={loading}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Registrando…' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
