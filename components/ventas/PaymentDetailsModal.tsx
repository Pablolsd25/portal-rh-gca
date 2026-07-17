'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'documentos-creditos';

type CurrentUser = { id: string; sucursal?: string | null };

type ProofDraft = { file: File; amount_paid: string };

type Props = {
  quoteId: string;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: CurrentUser;
  isCashRegisterMode?: boolean;
};

export default function PaymentDetailsModal({
  quoteId,
  onClose,
  onSuccess,
  currentUser,
  isCashRegisterMode = false,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState(
    isCashRegisterMode ? 'efectivo' : 'transferencia',
  );
  const [paymentProofs, setPaymentProofs] = useState<ProofDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSucursal, setSelectedSucursal] = useState(currentUser.sucursal || '');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    for (const file of newFiles) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`El archivo "${file.name}" es muy grande (máx. 5MB).`);
        e.target.value = '';
        return;
      }
    }
    setPaymentProofs(prev => [...prev, ...newFiles.map(file => ({ file, amount_paid: '' }))]);
    setError(null);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      let newStatus = '';
      let finalPaymentMethod = paymentMethod;

      if (isCashRegisterMode) {
        const needsCaja =
          paymentMethod === 'efectivo' ||
          paymentMethod === 'tarjeta_credito' ||
          paymentMethod === 'tarjeta_debito';
        if (needsCaja) {
          const { data: sessionData, error: sessionError } = await supabase
            .from('caja_sesiones')
            .select('id')
            .eq('user_id', currentUser.id)
            .is('closed_at', null)
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (sessionError || !sessionData) {
            throw new Error('No tienes una sesión de caja abierta. Abre tu caja primero.');
          }
          const { data: quoteData, error: quoteError } = await supabase
            .from('quotes')
            .select('total_amount')
            .eq('id', quoteId)
            .single();
          if (quoteError) throw quoteError;
          const { error: movErr } = await supabase.from('caja_movimientos').insert({
            sesion_id: sessionData.id,
            tipo: 'ingreso_venta',
            monto: quoteData.total_amount,
            concepto: `Venta de cotización ${quoteId.substring(0, 8)}`,
            metodo_pago: paymentMethod,
            quote_id: quoteId,
            created_by: currentUser.id,
          });
          if (movErr) throw movErr;
        }
        newStatus = 'venta_concretada';
      } else {
        switch (paymentMethod) {
          case 'transferencia':
          case 'deposito':
            newStatus = 'en_revision_pago';
            break;
          case 'tarjeta_credito':
          case 'tarjeta_debito':
            newStatus = 'venta_concretada';
            break;
          case 'pago_en_mostrador':
            if (!selectedSucursal) throw new Error('Selecciona una sucursal para pago en mostrador.');
            newStatus = 'pendiente_pago_mostrador';
            finalPaymentMethod = 'efectivo';
            break;
          case 'credito':
            newStatus = 'a_credito';
            finalPaymentMethod = 'credito';
            break;
          case 'por_definir':
            newStatus = 'por_definir';
            finalPaymentMethod = 'por_definir';
            break;
          default:
            throw new Error('Método de pago no reconocido.');
        }
      }

      if (paymentMethod === 'transferencia' || paymentMethod === 'deposito') {
        if (paymentProofs.length === 0) {
          throw new Error('Debes adjuntar al menos un comprobante de pago.');
        }
        for (const proof of paymentProofs) {
          if (!proof.amount_paid || parseFloat(proof.amount_paid) <= 0) {
            throw new Error(`Monto inválido para "${proof.file.name}".`);
          }
          const fileExt = proof.file.name.split('.').pop() || 'bin';
          const filePath = `payment_proofs/${quoteId}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, proof.file);
          if (uploadError) {
            throw new Error(`Error al subir ${proof.file.name}: ${uploadError.message}`);
          }
          const { error: insertErr } = await supabase.from('quote_payment_proofs').insert({
            quote_id: quoteId,
            file_path: filePath,
            file_name: proof.file.name,
            uploaded_by: currentUser.id,
            amount_paid: parseFloat(proof.amount_paid),
          });
          if (insertErr) throw insertErr;
        }
      }

      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        payment_method: finalPaymentMethod,
      };
      if (newStatus === 'venta_concretada' || newStatus === 'pagada') {
        updatePayload.quote_date = new Date().toISOString();
        updatePayload.payment_confirmed_at = new Date().toISOString();
        updatePayload.payment_confirmed_by = currentUser.id;
      }
      if (paymentMethod === 'pago_en_mostrador') {
        updatePayload.sucursal = selectedSucursal.toLowerCase();
      }

      const { error: updateError } = await supabase
        .from('quotes')
        .update(updatePayload)
        .eq('id', quoteId);
      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl relative p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 text-sm"
        >
          Cerrar
        </button>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Registrar detalles del pago</h2>
        <p className="text-xs text-slate-500 mb-4 font-mono">ID {quoteId.slice(0, 8)}…</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Método de pago *</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
              disabled={loading}
            >
              {isCashRegisterMode ? (
                <>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta_credito">Tarjeta de crédito</option>
                  <option value="tarjeta_debito">Tarjeta de débito</option>
                </>
              ) : (
                <>
                  <option value="transferencia">Transferencia (enviar a revisión)</option>
                  <option value="deposito">Depósito (enviar a revisión)</option>
                  <option value="tarjeta_credito">Tarjeta de crédito (venta directa)</option>
                  <option value="tarjeta_debito">Tarjeta de débito (venta directa)</option>
                  <option value="pago_en_mostrador">Pago en mostrador</option>
                  <option value="por_definir">Por definir</option>
                  <option value="credito">Crédito</option>
                </>
              )}
            </select>
          </div>

          {paymentMethod === 'pago_en_mostrador' && !isCashRegisterMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sucursal *</label>
              <select
                value={selectedSucursal}
                onChange={e => setSelectedSucursal(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                disabled={loading}
              >
                <option value="" disabled>
                  — Selecciona —
                </option>
                <option value="Tecamac">Tecámac</option>
                <option value="Peralvillo">Peralvillo</option>
              </select>
            </div>
          )}

          {!isCashRegisterMode &&
            (paymentMethod === 'transferencia' || paymentMethod === 'deposito') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Comprobantes de pago *
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="block w-full text-sm text-slate-600"
                />
                {paymentProofs.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {paymentProofs.map((proof, index) => (
                      <div
                        key={`${proof.file.name}-${index}`}
                        className="grid grid-cols-12 gap-2 items-center p-2 border rounded-lg bg-slate-50"
                      >
                        <div className="col-span-7 truncate text-xs text-slate-700" title={proof.file.name}>
                          {proof.file.name}
                        </div>
                        <div className="col-span-4">
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Monto *"
                            value={proof.amount_paid}
                            onChange={e => {
                              const next = [...paymentProofs];
                              next[index] = { ...next[index], amount_paid: e.target.value };
                              setPaymentProofs(next);
                            }}
                            className="w-full p-1 text-sm text-right border rounded text-slate-900"
                            disabled={loading}
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => setPaymentProofs(paymentProofs.filter((_, i) => i !== index))}
                            className="text-red-500 text-xs"
                            disabled={loading}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading
                ? 'Procesando…'
                : isCashRegisterMode
                  ? 'Confirmar venta'
                  : paymentMethod === 'pago_en_mostrador'
                    ? 'Enviar a caja'
                    : paymentMethod === 'credito'
                      ? "Marcar a crédito"
                      : paymentMethod === 'por_definir'
                        ? 'Guardar'
                        : paymentMethod === 'transferencia' || paymentMethod === 'deposito'
                          ? 'Enviar a revisión'
                          : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
