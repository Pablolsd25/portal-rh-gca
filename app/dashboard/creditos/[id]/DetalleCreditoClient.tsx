'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';
import PagoFormModal from '@/components/creditos/PagoFormModal';
import {
  calcConsolidatedBalance,
  isEligibleForRefinancing,
  outstandingBalance,
} from '@/lib/creditos/calc';
import { UPLOADABLE_DOCS } from '@/lib/creditos/constants';
import { docPublicUrl, uploadCreditDocuments } from '@/lib/creditos/docs';
import { generateCreditPDF } from '@/lib/creditos/pdf';
import type { Credit, CreditDocument, CreditPayment, CreditProduct } from '@/lib/creditos/types';

export default function DetalleCreditoClient({
  creditId,
  userId,
}: {
  creditId: string;
  userId: string;
}) {
  const [credit, setCredit] = useState<Credit | null>(null);
  const [items, setItems] = useState<CreditProduct[]>([]);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [docs, setDocs] = useState<CreditDocument[]>([]);
  const [originalCredit, setOriginalCredit] = useState<Credit | null>(null);
  const [originalItems, setOriginalItems] = useState<CreditProduct[]>([]);
  const [originalPayments, setOriginalPayments] = useState<CreditPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPago, setShowPago] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOriginalCredit(null);
    setOriginalItems([]);
    setOriginalPayments([]);
    try {
      const supabase = createClient();
      const { data: creditData, error: creditErr } = await supabase
        .from('credits')
        .select('*, clients(id, full_name, phone_number)')
        .eq('id', creditId)
        .single();
      if (creditErr) throw creditErr;
      const creditRow = creditData as Credit;
      setCredit(creditRow);

      const [itemsRes, docsRes] = await Promise.all([
        supabase.from('credit_products').select('*').eq('credit_id', creditId),
        supabase
          .from('documents')
          .select(
            'id, client_id, credit_id, document_type, file_name, file_path, verification_status, created_at',
          )
          .eq('credit_id', creditId)
          .order('created_at', { ascending: false }),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      setItems((itemsRes.data as CreditProduct[]) || []);
      if (!docsRes.error) setDocs((docsRes.data as CreditDocument[]) || []);

      if (creditRow.refinanced_from_credit_id) {
        const { data: orig } = await supabase
          .from('credits')
          .select('*, clients(id, full_name, phone_number)')
          .eq('id', creditRow.refinanced_from_credit_id)
          .single();
        if (orig) {
          setOriginalCredit(orig as Credit);
          const [oi, op] = await Promise.all([
            supabase
              .from('credit_products')
              .select('*')
              .eq('credit_id', creditRow.refinanced_from_credit_id),
            supabase
              .from('payments')
              .select('*, staff_users(full_name)')
              .eq('credit_id', creditRow.refinanced_from_credit_id)
              .order('payment_date', { ascending: false }),
          ]);
          setOriginalItems((oi.data as CreditProduct[]) || []);
          setOriginalPayments((op.data as CreditPayment[]) || []);
        }
      }

      if (creditRow.status === 'activo' || creditRow.status === 'pagado') {
        const { data: payData, error: payErr } = await supabase
          .from('payments')
          .select('*, staff_users(full_name)')
          .eq('credit_id', creditId)
          .order('payment_date', { ascending: false });
        if (payErr) throw payErr;
        setPayments((payData as CreditPayment[]) || []);
      } else {
        setPayments([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar crédito');
    } finally {
      setLoading(false);
    }
  }, [creditId]);

  useEffect(() => {
    void load();
  }, [load]);

  const outstandingOriginal = useMemo(
    () =>
      originalCredit
        ? outstandingBalance(originalCredit.total_amount_due, originalPayments)
        : 0,
    [originalCredit, originalPayments],
  );

  const combinedPayments = useMemo(() => {
    return [...originalPayments, ...payments].sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
    );
  }, [payments, originalPayments]);

  const balance = useMemo(() => {
    if (!credit) return 0;
    return calcConsolidatedBalance({
      credit,
      payments,
      originalCredit,
      originalPayments,
    });
  }, [credit, payments, originalCredit, originalPayments]);

  const eligibleRefinance = useMemo(
    () => isEligibleForRefinancing(credit, payments.length),
    [credit, payments.length],
  );

  const decidir = async (status: 'activo' | 'rechazado') => {
    if (!credit || credit.status !== 'pendiente') return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const updates: Record<string, unknown> = {
        status,
        approved_by_staff_id: userId,
        approved_or_rejected_at: new Date().toISOString(),
      };
      if (status === 'activo') {
        updates.start_date = new Date().toISOString().slice(0, 10);
      }
      const { error: err } = await supabase
        .from('credits')
        .update(updates)
        .eq('id', creditId)
        .eq('status', 'pendiente');
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusy(false);
    }
  };

  const handleDocUpload = async (docType: string, file: File | null) => {
    if (!file || !credit) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const supabase = createClient();
      const errs = await uploadCreditDocuments(supabase, {
        clientId: credit.client_id,
        creditId,
        staffId: userId,
        files: { [docType]: file },
      });
      if (errs.length) throw new Error(errs.join('; '));
      setUploadMsg('Documento subido.');
      await load();
    } catch (e) {
      setUploadMsg(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  };

  const handlePdf = async () => {
    if (!credit) return;
    setPdfLoading(true);
    try {
      await generateCreditPDF({
        credit,
        clientName: credit.clients?.full_name || 'Cliente',
        items,
        payments,
        originalCredit,
        originalItems,
        originalPayments,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-800',
      activo: 'bg-emerald-100 text-emerald-800',
      rechazado: 'bg-red-100 text-red-800',
      pagado: 'bg-blue-100 text-blue-800',
      refinanciado: 'bg-slate-100 text-slate-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  const renderMaterials = (title: string, rows: CreditProduct[]) => (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <h3 className="px-4 py-3 text-sm font-semibold text-slate-800 border-b border-slate-100">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Cant.</th>
              <th className="px-4 py-2 text-left">Unid.</th>
              <th className="px-4 py-2 text-left">Descripción</th>
              <th className="px-4 py-2 text-right">P. unit.</th>
              <th className="px-4 py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                  Sin materiales
                </td>
              </tr>
            ) : (
              rows.map(item => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{item.quantity}</td>
                  <td className="px-4 py-2">{item.unit}</td>
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(item.unit_price)}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatMoney(item.subtotal)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return <p className="text-sm text-slate-500">Cargando…</p>;
  if (error && !credit) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }
  if (!credit) return <p className="text-sm text-slate-500">Crédito no encontrado.</p>;

  const totalDue = Number(credit.total_amount_due) || 0;
  const newCharges = originalCredit ? totalDue - outstandingOriginal : 0;

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {credit.clients?.full_name || 'Cliente'}
            </h2>
            {credit.clients?.phone_number && (
              <p className="text-sm text-slate-500 mt-0.5">{credit.clients.phone_number}</p>
            )}
            <p className="text-xs text-slate-400 mt-1 font-mono">{credit.id}</p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadge(credit.status)}`}
          >
            {credit.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
          {originalCredit ? (
            <>
              <div>
                <p className="text-slate-500">Saldo anterior (A)</p>
                <p className="font-semibold text-slate-800">
                  {formatMoney(outstandingOriginal)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Nuevos cargos (B)</p>
                <p className="font-semibold text-slate-800">{formatMoney(newCharges)}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="text-slate-500">Solicitado</p>
              <p className="font-semibold text-slate-800">
                {formatMoney(credit.requested_amount)}
              </p>
            </div>
          )}
          <div>
            <p className="text-slate-500">Total a pagar</p>
            <p className="font-semibold text-slate-800">{formatMoney(totalDue)}</p>
          </div>
          <div>
            <p className="text-slate-500">Pago semanal</p>
            <p className="font-semibold text-slate-800">
              {formatMoney(credit.weekly_payment_amount || 0)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Plazo</p>
            <p className="font-semibold text-slate-800">
              {credit.payment_term_weeks ?? '—'} semanas
            </p>
          </div>
          <div>
            <p className="text-slate-500">Tipo</p>
            <p className="font-semibold text-slate-800 capitalize">
              {(credit.credit_type || 'por_plazo').replace('_', ' ')}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Interés</p>
            <p className="font-semibold text-slate-800">
              {credit.credit_type === 'mensual'
                ? `${credit.monthly_interest_rate ?? 0}%/mes`
                : `${credit.interest_rate ?? 0}%`}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Inicio</p>
            <p className="font-semibold text-slate-800">{credit.start_date || '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Creado</p>
            <p className="font-semibold text-slate-800">
              {new Date(credit.created_at).toLocaleDateString('es-MX')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={pdfLoading}
            onClick={() => void handlePdf()}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {pdfLoading ? 'Generando PDF…' : 'Imprimir resumen'}
          </button>
          {credit.status === 'pendiente' && (
            <>
              <Link
                href={`/dashboard/creditos/${creditId}/editar`}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Editar
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void decidir('activo')}
                className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg disabled:opacity-50"
              >
                Aprobar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void decidir('rechazado')}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50"
              >
                Rechazar
              </button>
            </>
          )}
          {credit.status === 'activo' && (
            <button
              type="button"
              onClick={() => setShowPago(true)}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg"
            >
              Registrar abono
            </button>
          )}
          {eligibleRefinance && (
            <Link
              href={`/dashboard/creditos/nuevo?clientId=${credit.client_id}&refinanceFrom=${credit.id}`}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Refinanciar crédito
            </Link>
          )}
        </div>
      </div>

      {originalCredit && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">
            Crédito original refinanciado
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-slate-500">ID original</p>
              <Link
                href={`/dashboard/creditos/${originalCredit.id}`}
                className="font-mono text-blue-700 hover:underline text-xs"
              >
                {originalCredit.id.substring(0, 8)}…
              </Link>
            </div>
            <div>
              <p className="text-slate-500">Monto total original</p>
              <p className="font-semibold">{formatMoney(originalCredit.total_amount_due)}</p>
            </div>
            <div>
              <p className="text-slate-500">Saldo pendiente anterior</p>
              <p className="font-semibold text-red-700">
                {formatMoney(outstandingOriginal)}
              </p>
            </div>
          </div>
          {renderMaterials('Materiales del crédito original', originalItems)}
        </div>
      )}

      {renderMaterials(
        originalCredit ? 'Nuevos materiales del refinanciamiento' : 'Materiales',
        items.filter(i => i.unit !== 'saldo'),
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Documentos</h3>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500">Sin documentos aún.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {docs.map(d => (
              <li key={d.id} className="px-3 py-2 flex justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium text-slate-700 capitalize">
                    {d.document_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-400">{d.file_name}</p>
                </div>
                <a
                  href={docPublicUrl(d.file_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 text-xs font-medium hover:underline self-center"
                >
                  Abrir
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <p className="text-xs text-slate-500">Subir documento</p>
          {UPLOADABLE_DOCS.map(doc => (
            <div key={doc.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-600 min-w-[180px] text-xs">{doc.label}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={uploading}
                onChange={e => {
                  void handleDocUpload(doc.id, e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
                className="text-xs"
              />
            </div>
          ))}
          {uploadMsg && <p className="text-xs text-slate-600">{uploadMsg}</p>}
        </div>
      </div>

      {(credit.status === 'activo' || credit.status === 'pagado') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Historial de pagos{originalCredit ? ' (consolidado)' : ''}
            </h3>
            <div className="text-sm text-slate-600">
              Saldo:{' '}
              <strong className={balance > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                {formatMoney(Math.max(0, balance))}
              </strong>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-right">Monto</th>
                  <th className="px-4 py-2 text-left">Método</th>
                  <th className="px-4 py-2 text-left">Registró</th>
                  <th className="px-4 py-2 text-left">Crédito</th>
                  <th className="px-4 py-2 text-left">Notas</th>
                </tr>
              </thead>
              <tbody>
                {combinedPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                      Sin pagos registrados
                    </td>
                  </tr>
                ) : (
                  combinedPayments.map(p => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        {new Date(p.payment_date).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatMoney(p.amount_paid)}
                      </td>
                      <td className="px-4 py-2 capitalize">{p.payment_method}</td>
                      <td className="px-4 py-2">{p.staff_users?.full_name || '—'}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/dashboard/creditos/${p.credit_id}`}
                          className="text-emerald-700 hover:underline font-mono text-xs"
                        >
                          {p.credit_id.substring(0, 7)}…
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{p.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPago && (
        <PagoFormModal
          creditId={creditId}
          clientName={credit.clients?.full_name || 'Cliente'}
          totalDue={credit.total_amount_due}
          balance={balance}
          staffId={userId}
          onClose={() => setShowPago(false)}
          onSuccess={() => void load()}
        />
      )}
    </div>
  );
}
