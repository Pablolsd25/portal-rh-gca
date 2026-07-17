'use client';

import { useState } from 'react';
import FilePreviewModal from '@/components/ventas/FilePreviewModal';
import { createClient } from '@/lib/supabase/client';
import {
  clientName,
  formatMoney,
  proofPublicUrl,
  updatePaymentProof,
  updateQuoteStatus,
} from '@/lib/ventas/quotes';
import type { Quote, QuotePaymentProof } from '@/lib/ventas/types';

type Props = {
  quote: Quote;
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

function complementStoragePath(url: string | null | undefined): string | null {
  if (!url || !url.includes('complementos_pago')) return null;
  const part = url.split('/complementos_pago/')[1];
  return part ? decodeURIComponent(part.split('?')[0]) : null;
}

async function downloadUrl(url: string, fileName: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

export default function ProofsModal({ quote, userId, onClose, onSaved }: Props) {
  const supabase = createClient();
  const originals = quote.quote_payment_proofs || [];
  const [proofs, setProofs] = useState<QuotePaymentProof[]>(
    JSON.parse(JSON.stringify(originals)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complementFor, setComplementFor] = useState<string | null>(null);
  const [complementFile, setComplementFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isConfirmed = (proofId: string) =>
    !!originals.find(op => op.id === proofId)?.reference_number;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const newlyReferenced = proofs.filter(p => {
        const original = originals.find(op => op.id === p.id);
        return original && !original.reference_number && !!p.reference_number?.trim();
      });

      for (const p of proofs) {
        const original = originals.find(op => op.id === p.id);
        if (!original) continue;
        // Confirmed references stay locked; only amount may change
        if (original.reference_number) {
          if (Number(p.amount_paid) !== Number(original.amount_paid)) {
            await updatePaymentProof(supabase, p.id, { amount_paid: p.amount_paid });
          }
          continue;
        }
        await updatePaymentProof(supabase, p.id, {
          amount_paid: p.amount_paid,
          reference_number: p.reference_number?.trim() || null,
        });
      }

      if (newlyReferenced.length > 0) {
        await supabase
          .from('quotes')
          .update({
            payment_confirmed_by: userId,
            payment_confirmed_at: new Date().toISOString(),
          })
          .eq('id', quote.id);
      }

      const { data: allProofs, error: proofsErr } = await supabase
        .from('quote_payment_proofs')
        .select('amount_paid')
        .eq('quote_id', quote.id);
      if (proofsErr) throw proofsErr;

      const paid = (allProofs || []).reduce((a, p) => a + (Number(p.amount_paid) || 0), 0);
      const paidOk =
        Math.round(paid * 100) / 100 >= Math.round(Number(quote.total_amount) * 100) / 100;

      const isCreditOrPpd =
        quote.status === 'a_credito' ||
        quote.status === 'venta_concretada' ||
        quote.metodo_de_pago_cfdi === 'PPD' ||
        quote.payment_method === 'credito';

      if (isCreditOrPpd && paidOk && quote.status !== 'venta_concretada') {
        await updateQuoteStatus(supabase, quote.id, 'venta_concretada', {
          payment_confirmed_by: userId,
          payment_confirmed_at: new Date().toISOString(),
          quote_date: new Date().toISOString(),
        });
      }

      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const removeProof = async (p: QuotePaymentProof) => {
    if (!confirm('¿Eliminar este comprobante? Esta acción no se puede deshacer.')) return;
    setDeletingId(p.id);
    setError(null);
    try {
      if (p.file_path && !p.file_path.startsWith('http')) {
        await supabase.storage.from('documentos-creditos').remove([p.file_path]);
      }
      const compPath = complementStoragePath(p.complement_file_url);
      if (compPath) {
        await supabase.storage.from('complementos_pago').remove([compPath]);
      }
      const { error: delErr } = await supabase
        .from('quote_payment_proofs')
        .delete()
        .eq('id', p.id);
      if (delErr) throw delErr;
      setProofs(prev => prev.filter(x => x.id !== p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const removeComplement = async (proof: QuotePaymentProof) => {
    if (!confirm('¿Eliminar este complemento?')) return;
    setSaving(true);
    setError(null);
    try {
      const compPath = complementStoragePath(proof.complement_file_url);
      if (compPath) {
        await supabase.storage.from('complementos_pago').remove([compPath]);
      }
      const { error: updErr } = await supabase
        .from('quote_payment_proofs')
        .update({
          complement_file_url: null,
          complement_file_name: null,
          complement_uploaded_at: null,
        })
        .eq('id', proof.id);
      if (updErr) throw updErr;
      setProofs(prev =>
        prev.map(p =>
          p.id === proof.id
            ? {
                ...p,
                complement_file_url: null,
                complement_file_name: null,
                complement_uploaded_at: null,
              }
            : p,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el complemento');
    } finally {
      setSaving(false);
    }
  };

  const uploadComplement = async (proof: QuotePaymentProof) => {
    if (!proof.reference_number?.trim()) {
      setError('Asigna una referencia antes de subir el complemento.');
      return;
    }
    if (!complementFile) return;
    const ext = complementFile.name.slice(complementFile.name.lastIndexOf('.')).toLowerCase();
    if (!['.xml', '.pdf'].includes(ext)) {
      setError('Solo XML o PDF para complementos');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const clean = complementFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${proof.id}_${Date.now()}_${clean}`;
      const { error: upErr } = await supabase.storage
        .from('complementos_pago')
        .upload(fileName, complementFile, { upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('complementos_pago').getPublicUrl(fileName);
      const { error: updErr } = await supabase
        .from('quote_payment_proofs')
        .update({
          complement_file_url: urlData.publicUrl,
          complement_file_name: complementFile.name,
          complement_uploaded_at: new Date().toISOString(),
        })
        .eq('id', proof.id);
      if (updErr) throw updErr;
      setProofs(prev =>
        prev.map(p =>
          p.id === proof.id
            ? {
                ...p,
                complement_file_url: urlData.publicUrl,
                complement_file_name: complementFile.name,
                complement_uploaded_at: new Date().toISOString(),
              }
            : p,
        ),
      );
      setComplementFor(null);
      setComplementFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir complemento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-xl rounded-t-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <p className="font-semibold text-slate-800">Comprobantes de pago</p>
            <p className="text-xs text-slate-500">
              {clientName(quote)} · {formatMoney(quote.total_amount)}
              {quote.numero_factura ? ` · Fact. ${quote.numero_factura}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Cerrar
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {proofs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Sin comprobantes cargados.</p>
          )}

          {proofs.map(p => {
            const url = proofPublicUrl(supabase, p.file_path);
            const confirmed = isConfirmed(p.id);
            const hasRef = !!(p.reference_number?.trim() || confirmed);

            return (
              <div key={p.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {p.file_name || p.file_path?.split('/').pop() || 'Archivo'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {url && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPreview({
                              url,
                              name: p.file_name || 'Comprobante',
                            })
                          }
                          className="text-xs text-sky-700 hover:underline"
                        >
                          Vista previa
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadUrl(url, p.file_name || 'comprobante.pdf').catch(() =>
                              setError('No se pudo descargar el comprobante'),
                            )
                          }
                          className="text-xs text-rose-700 hover:underline"
                        >
                          Descargar
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === p.id || saving}
                      onClick={() => void removeProof(p)}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      {deletingId === p.id ? '…' : 'Eliminar'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs text-slate-600">
                    Monto pagado
                    <input
                      type="number"
                      step="any"
                      value={p.amount_paid ?? ''}
                      onChange={e =>
                        setProofs(prev =>
                          prev.map(x =>
                            x.id === p.id
                              ? {
                                  ...x,
                                  amount_paid: e.target.value === '' ? null : Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                      className="mt-0.5 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Referencia
                    <input
                      value={p.reference_number ?? ''}
                      disabled={confirmed || saving}
                      onChange={e =>
                        setProofs(prev =>
                          prev.map(x =>
                            x.id === p.id ? { ...x, reference_number: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder={confirmed ? 'Confirmada' : 'Folio…'}
                      className="mt-0.5 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </label>
                </div>

                {p.complement_file_url ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span>Complemento:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreview({
                          url: p.complement_file_url!,
                          name: p.complement_file_name || 'Complemento',
                        })
                      }
                      className="text-sky-700 hover:underline"
                    >
                      Vista previa
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadUrl(
                          p.complement_file_url!,
                          p.complement_file_name || 'complemento.xml',
                        ).catch(() => setError('No se pudo descargar el complemento'))
                      }
                      className="text-rose-700 hover:underline"
                    >
                      Descargar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void removeComplement(p)}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </div>
                ) : hasRef ? (
                  <div>
                    {complementFor === p.id ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="file"
                          accept=".xml,.pdf"
                          onChange={e => setComplementFile(e.target.files?.[0] ?? null)}
                          className="text-xs"
                        />
                        <button
                          type="button"
                          disabled={!complementFile || saving}
                          onClick={() => void uploadComplement(p)}
                          className="px-2 py-1 text-xs bg-slate-800 text-white rounded-lg disabled:opacity-50"
                        >
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setComplementFor(null);
                            setComplementFile(null);
                          }}
                          className="text-xs text-slate-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setComplementFor(p.id)}
                        className="text-xs text-sky-700 hover:underline"
                      >
                        + Subir complemento de pago
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Asigna referencia para subir complemento</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm border rounded-lg">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="px-3 py-2 text-sm bg-rose-800 text-white rounded-lg hover:bg-rose-900 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar referencias'}
          </button>
        </div>
      </div>

      {preview && (
        <FilePreviewModal
          fileUrl={preview.url}
          fileName={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
