'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircleIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  FolderOpenIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import ProofsModal from '@/components/ventas/ProofsModal';
import PendingQuoteCard from '@/components/ventas/PendingQuoteCard';
import ApprovedQuoteCard from '@/components/ventas/ApprovedQuoteCard';
import PpdQuoteCard from '@/components/ventas/PpdQuoteCard';
import {
  clientName,
  esPpdOCredito,
  esVentaAprobada,
  formatFechaMexico,
  formatMoney,
  getQuoteItems,
  listQuotesForAprobacion,
  updateQuoteStatus,
} from '@/lib/ventas/quotes';
import { generateQuotePDF } from '@/lib/ventas/pdfGenerator';
import type { Quote } from '@/lib/ventas/types';

type Props = {
  initialQuotes: Quote[];
  userId: string;
  userName: string;
  userSucursal: string | null;
};

type Tab = 'pendientes' | 'aprobados' | 'ppd';
const PAGE_SIZE = 20;

function totalPaid(q: Quote): number {
  const sum = (q.quote_payment_proofs || []).reduce(
    (acc, p) => acc + (Number(p.amount_paid) || 0),
    0,
  );
  return Math.round(sum * 100) / 100;
}

export default function AprobacionPagosClient({
  initialQuotes,
  userId,
  userName,
  userSucursal,
}: Props) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [proofsQuote, setProofsQuote] = useState<Quote | null>(null);

  // filtros
  const [vendedorFilter, setVendedorFilter] = useState('all');
  const [refFilter, setRefFilter] = useState('');
  const [clienteFilter, setClienteFilter] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      setQuotes(await listQuotesForAprobacion(supabase));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Siempre recargar al montar: el SSR a veces llega incompleto / cacheado
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('aprobacion-pagos-gca')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_payment_proofs' }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const pendingQuotes = useMemo(
    () => quotes.filter(q => q.status === 'en_revision_pago'),
    [quotes],
  );

  const approvedQuotes = useMemo(
    () =>
      quotes
        .filter(esVentaAprobada)
        .sort((a, b) => {
          const da = a.payment_confirmed_at
            ? new Date(a.payment_confirmed_at).getTime()
            : new Date(a.quote_date).getTime();
          const db = b.payment_confirmed_at
            ? new Date(b.payment_confirmed_at).getTime()
            : new Date(b.quote_date).getTime();
          return db - da;
        }),
    [quotes],
  );

  const ppdQuotes = useMemo(
    () =>
      quotes
        .filter(q => esPpdOCredito(q) && (q.status === 'a_credito' || q.status === 'venta_concretada'))
        .map(q => {
          const paid = totalPaid(q);
          return {
            ...q,
            totalPaid: paid,
            isFullyPaid: paid >= Math.round(Number(q.total_amount) * 100) / 100,
          };
        })
        .sort((a, b) => {
          const da = new Date(a.updated_at || a.quote_date).getTime();
          const db = new Date(b.updated_at || b.quote_date).getTime();
          return db - da;
        }),
    [quotes],
  );

  const filteredList = useMemo(() => {
    const base =
      tab === 'pendientes' ? pendingQuotes : tab === 'aprobados' ? approvedQuotes : ppdQuotes;

    return base.filter(q => {
      const vendOk =
        vendedorFilter === 'all' || q.vendedor?.full_name === vendedorFilter;
      const cliOk =
        !clienteFilter ||
        clientName(q).toLowerCase().includes(clienteFilter.toLowerCase());
      const refOk =
        !refFilter ||
        (q.quote_payment_proofs || []).some(p =>
          (p.reference_number || '').toLowerCase().includes(refFilter.toLowerCase()),
        );
      if (tab === 'pendientes') return true;
      if (tab === 'aprobados') return vendOk && refOk;
      return vendOk && cliOk && refOk;
    });
  }, [tab, pendingQuotes, approvedQuotes, ppdQuotes, vendedorFilter, clienteFilter, refFilter]);

  const vendedores = useMemo(() => {
    const src = tab === 'aprobados' ? approvedQuotes : ppdQuotes;
    return [...new Set(src.map(q => q.vendedor?.full_name).filter(Boolean))] as string[];
  }, [tab, approvedQuotes, ppdQuotes]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const pageItems = filteredList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tab, vendedorFilter, clienteFilter, refFilter]);

  const decide = async (quoteId: string, approve: boolean) => {
    setProcessing(quoteId);
    setError(null);
    try {
      const supabase = createClient();
      if (approve) {
        await updateQuoteStatus(supabase, quoteId, 'venta_concretada', {
          payment_confirmed_by: userId,
          payment_confirmed_at: new Date().toISOString(),
          quote_date: new Date().toISOString(),
        });
      } else {
        await updateQuoteStatus(supabase, quoteId, 'aceptada');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setProcessing(null);
    }
  };

  const runPdf = async (quote: Quote, preview: boolean) => {
    setPdfLoading(quote.id);
    setError(null);
    try {
      const supabase = createClient();
      const items = await getQuoteItems(supabase, quote.id);
      if (!items.length) throw new Error('No hay ítems para esta cotización');
      const doc = await generateQuotePDF(
        { ...quote, items },
        userName,
        userSucursal || 'tecamac',
        preview,
      );
      if (preview && doc) {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'pendientes', label: 'Pendientes', count: pendingQuotes.length },
    { id: 'aprobados', label: 'Aprobados', count: approvedQuotes.length },
    { id: 'ppd', label: 'PPD / Crédito', count: ppdQuotes.length },
  ];

  const pagination = filteredList.length > PAGE_SIZE && (
    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(p => p - 1)}
        className="px-3 py-1 border rounded-lg disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-slate-500">
        Página {page} de {totalPages} · {filteredList.length} registros
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => setPage(p => p + 1)}
        className="px-3 py-1 border rounded-lg disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[120px] px-3 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white text-slate-900 border-b-2 border-rose-800'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                {t.count}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="px-4 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            {loading ? '…' : 'Actualizar'}
          </button>
        </div>

        {tab !== 'pendientes' && (
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={vendedorFilter}
              onChange={e => setVendedorFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
            >
              <option value="all">Todos los vendedores</option>
              {vendedores.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            {tab === 'ppd' && (
              <input
                value={clienteFilter}
                onChange={e => setClienteFilter(e.target.value)}
                placeholder="Buscar cliente…"
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
            )}
            <input
              value={refFilter}
              onChange={e => setRefFilter(e.target.value)}
              placeholder="Buscar referencia…"
              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900"
            />
          </div>
        )}

        {/* Vista de lista para desktop */}
        <div className="hidden md:block divide-y divide-slate-100">
          {pageItems.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No hay registros en esta pestaña.
            </p>
          )}

          {pageItems.map(q => {
            const paid = totalPaid(q);
            const isPpd = tab === 'ppd';
            const fully = paid >= Math.round(Number(q.total_amount) * 100) / 100;
            return (
              <div key={q.id} className="p-4 sm:p-5 hover:bg-slate-50/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">{clientName(q)}</p>
                      {q.requires_invoice && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                          Factura
                        </span>
                      )}
                      {q.numero_factura && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800">
                          Fact. {q.numero_factura}
                        </span>
                      )}
                      {isPpd && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            fully ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {fully ? 'Pagado' : 'Saldo pendiente'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      <span className="font-semibold text-slate-800">{formatMoney(q.total_amount)}</span>
                      {' · '}
                      {q.vendedor?.full_name || 'Sin vendedor'}
                      {' · '}
                      {formatFechaMexico(q.quote_date)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Método: {q.payment_method || '—'}
                      {q.metodo_de_pago_cfdi ? ` · CFDI ${q.metodo_de_pago_cfdi}` : ''}
                      {q.forma_de_pago_cfdi ? ` / ${q.forma_de_pago_cfdi}` : ''}
                      {q.uso_cfdi ? ` · Uso ${q.uso_cfdi}` : ''}
                      {tab === 'aprobados' && q.confirmador?.full_name
                        ? ` · Aprobó: ${q.confirmador.full_name}`
                        : ''}
                    </p>
                    {isPpd && (
                      <p className="text-xs text-slate-600 mt-1">
                        Abonado: <strong>{formatMoney(paid)}</strong>
                        {' · '}
                        Restante:{' '}
                        <strong>{formatMoney(Math.max(0, Number(q.total_amount) - paid))}</strong>
                      </p>
                    )}
                    {q.delivery_address && (
                      <p className="text-xs text-slate-500 mt-1 truncate" title={q.delivery_address}>
                        📍 {q.delivery_address}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setProofsQuote(q)}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-white inline-flex items-center gap-1"
                    >
                      <FolderOpenIcon className="w-4 h-4" />
                      Comprobantes ({q.quote_payment_proofs?.length || 0})
                    </button>
                    <button
                      type="button"
                      disabled={pdfLoading === q.id}
                      onClick={() => void runPdf(q, true)}
                      className="px-3 py-1.5 text-xs border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <EyeIcon className="w-4 h-4" />
                      Ver PDF
                    </button>
                    <button
                      type="button"
                      disabled={pdfLoading === q.id}
                      onClick={() => void runPdf(q, false)}
                      className="px-3 py-1.5 text-xs border border-sky-200 text-sky-700 rounded-lg hover:bg-sky-50 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4" />
                      Descargar PDF
                    </button>
                    {tab === 'pendientes' && (
                      <>
                        <button
                          type="button"
                          disabled={processing === q.id}
                          onClick={() => void decide(q.id, false)}
                          className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <XCircleIcon className="w-4 h-4" />
                          Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={processing === q.id}
                          onClick={() => void decide(q.id, true)}
                          className="px-3 py-1.5 text-xs bg-rose-800 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          {processing === q.id ? '…' : 'Aprobar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vista de tarjetas para móvil */}
        <div className="md:hidden p-3 space-y-3">
          {pageItems.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay registros en esta pestaña.
            </p>
          )}
          {pageItems.map(q => {
            if (tab === 'pendientes') {
              return (
                <PendingQuoteCard
                  key={q.id}
                  quote={q}
                  onApprove={id => void decide(id, true)}
                  onReject={id => void decide(id, false)}
                  onViewProofs={setProofsQuote}
                  onDownloadPDF={q2 => void runPdf(q2, false)}
                  onPreviewPDF={q2 => void runPdf(q2, true)}
                  processingId={processing}
                  pdfLoadingQuoteId={pdfLoading}
                />
              );
            }
            if (tab === 'aprobados') {
              return (
                <ApprovedQuoteCard
                  key={q.id}
                  quote={q}
                  onViewProofs={setProofsQuote}
                  onDownloadPDF={q2 => void runPdf(q2, false)}
                  onPreviewPDF={q2 => void runPdf(q2, true)}
                  pdfLoadingQuoteId={pdfLoading}
                />
              );
            }
            return (
              <PpdQuoteCard
                key={q.id}
                quote={q}
                onViewProofs={setProofsQuote}
                onDownloadPDF={q2 => void runPdf(q2, false)}
                onPreviewPDF={q2 => void runPdf(q2, true)}
                pdfLoadingQuoteId={pdfLoading}
              />
            );
          })}
        </div>

        {pagination}
      </div>

      {proofsQuote && (
        <ProofsModal
          quote={proofsQuote}
          userId={userId}
          onClose={() => setProofsQuote(null)}
          onSaved={async () => {
            await refresh();
            setProofsQuote(null);
          }}
        />
      )}
    </div>
  );
}
