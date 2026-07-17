'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';
import type { QuotePaymentProof } from '@/lib/ventas/types';

const BUCKET_NAME = 'documentos-creditos';

type AbonoQuote = {
  id: string;
  total_amount: number;
  quote_payment_proofs?: QuotePaymentProof[] | null;
};

type ProofDraft = { file: File; amount_paid: string };

type Props = {
  quote: AbonoQuote;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AbonoCreditoModal({ quote, userId, onClose, onSuccess }: Props) {
  const [paymentProofs, setPaymentProofs] = useState<ProofDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaid = useMemo(
    () =>
      quote.quote_payment_proofs?.reduce(
        (sum, proof) => sum + (Number(proof.amount_paid) || 0),
        0,
      ) || 0,
    [quote.quote_payment_proofs],
  );

  const balanceDue = quote.total_amount - totalPaid;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    if (newFiles.length > 0) {
      setPaymentProofs(prev => [
        ...prev,
        ...newFiles.map(file => ({ file, amount_paid: '' })),
      ]);
      e.target.value = '';
    }
  };

  const handleProofChange = (index: number, value: string) => {
    setPaymentProofs(prev =>
      prev.map((p, i) => (i === index ? { ...p, amount_paid: value } : p)),
    );
  };

  const handleRemoveProof = (index: number) => {
    setPaymentProofs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (paymentProofs.length === 0) {
        throw new Error('Debes adjuntar al menos un comprobante de pago.');
      }

      const supabase = createClient();

      for (const proof of paymentProofs) {
        if (!proof.amount_paid || parseFloat(proof.amount_paid) <= 0) {
          throw new Error(
            `Debes especificar un monto válido para el archivo "${proof.file.name}".`,
          );
        }

        const fileExt = proof.file.name.split('.').pop();
        const filePath = `payment_proofs/${quote.id}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, proof.file);
        if (uploadError) throw uploadError;

        // reference_number null — admin la llena en aprobación; status stays a_credito
        const { error: insertError } = await supabase.from('quote_payment_proofs').insert({
          quote_id: quote.id,
          file_path: filePath,
          file_name: proof.file.name,
          uploaded_by: userId,
          amount_paid: parseFloat(proof.amount_paid),
          reference_number: null,
        });
        if (insertError) throw insertError;
      }

      alert(
        'Abono(s) enviado(s) a revisión. Pendiente de aprobación por administrador.',
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        `Error al registrar el abono: ${err instanceof Error ? err.message : 'Error desconocido'}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl p-4 md:p-6 bg-white rounded-lg shadow-xl relative my-auto max-h-[95vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 text-slate-500"
          aria-label="Cerrar"
        >
          ✕
        </button>
        <h2 className="text-lg md:text-xl font-bold mb-4 pr-8 text-slate-900">
          Registrar Abono a Crédito
        </h2>

        <div className="p-3 md:p-4 mb-4 bg-sky-50 border border-sky-200 rounded-md grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-center">
          <div>
            <p className="text-sm text-slate-600">Monto Total</p>
            <p className="text-lg font-bold text-slate-900">{formatMoney(quote.total_amount)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Total Abonado</p>
            <p className="text-lg font-bold text-emerald-600">{formatMoney(totalPaid)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Saldo Pendiente</p>
            <p className="text-lg font-bold text-red-600">{formatMoney(balanceDue)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nuevos Comprobantes de Pago
            </label>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,application/pdf"
              onChange={handleFileChange}
              disabled={loading}
              className="block w-full text-sm text-slate-600"
            />
          </div>

          {paymentProofs.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 px-2">
                <div className="col-span-7">Archivo</div>
                <div className="col-span-4 text-right">Monto</div>
                <div className="col-span-1" />
              </div>
              {paymentProofs.map((proof, index) => (
                <div
                  key={`${proof.file.name}-${index}`}
                  className="grid grid-cols-12 gap-2 items-center p-2 border rounded-md bg-slate-50"
                >
                  <div className="col-span-7 truncate text-sm text-slate-700" title={proof.file.name}>
                    {proof.file.name}
                  </div>
                  <div className="col-span-4">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Monto *"
                      value={proof.amount_paid}
                      onChange={e => handleProofChange(index, e.target.value)}
                      className="w-full p-1 text-sm text-right border rounded-md text-slate-900"
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveProof(index)}
                      disabled={loading}
                      className="text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-slate-200 rounded-md hover:bg-slate-300 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || paymentProofs.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Enviando…' : 'Enviar a Revisión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
