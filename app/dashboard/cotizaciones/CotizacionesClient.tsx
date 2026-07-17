'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AbonoCreditoModal from '@/components/ventas/AbonoCreditoModal';
import PaymentDetailsModal from '@/components/ventas/PaymentDetailsModal';
import { generateQuotePDF } from '@/lib/ventas/pdfGenerator';
import {
  clientName,
  ENTREGA_BADGE_LABELS,
  entregaBadge,
  formatFechaMexico,
  formatMoney,
  getQuoteItems,
  listQuotes,
  updateQuoteStatus,
} from '@/lib/ventas/quotes';
import {
  QUOTE_STATUS_LABELS,
  STATUS_BADGE_CLASS,
  type Quote,
  type QuoteItem,
  type QuoteStatus,
} from '@/lib/ventas/types';

type Props = {
  initialQuotes: Quote[];
  userId: string;
  userRole: string;
  userName: string;
  userSucursal: string | null;
};

const STATUS_FILTERS: Array<QuoteStatus | 'all'> = [
  'all',
  'enviada',
  'aceptada',
  'en_revision_pago',
  'venta_concretada',
  'pendiente_pago_mostrador',
  'a_credito',
  'rechazada',
];

export default function CotizacionesClient({
  initialQuotes,
  userId,
  userRole,
  userName,
  userSucursal,
}: Props) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [payQuoteId, setPayQuoteId] = useState<string | null>(null);
  const [abonoQuote, setAbonoQuote] = useState<Quote | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByQuote, setItemsByQuote] = useState<Record<string, QuoteItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);
  const [facturaDrafts, setFacturaDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const role = userRole.trim().toLowerCase();
  const isAdmin = role === 'admin';
  const canRegisterPayment =
    role === 'vendedor' || role === 'venta mostrador' || role === 'admin';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await listQuotes(supabase, { userId, role: userRole, status: 'all' });
      setQuotes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recargar');
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('cotizaciones-gca')
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter(quote => {
      if (statusFilter !== 'all' && quote.status !== statusFilter) return false;
      if (!q) return true;
      const name = clientName(quote).toLowerCase();
      const seller = (quote.vendedor?.full_name || '').toLowerCase();
      const addr = (quote.delivery_address || '').toLowerCase();
      const id = quote.id.toLowerCase();
      const factura = (quote.numero_factura || '').toLowerCase();
      return (
        name.includes(q) ||
        seller.includes(q) ||
        addr.includes(q) ||
        id.includes(q) ||
        factura.includes(q)
      );
    });
  }, [quotes, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe, PAGE_SIZE]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const canDelete = (quote: Quote) => {
    if (isAdmin) return true;
    if (role === 'vendedor' && quote.seller_id === userId) return true;
    return false;
  };

  const canEditFactura = (status: QuoteStatus) =>
    status === 'venta_concretada' || status === 'en_revision_pago';

  const toggleExpand = async (quote: Quote) => {
    if (expandedId === quote.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(quote.id);
    if (itemsByQuote[quote.id]) return;
    setItemsLoading(quote.id);
    try {
      const supabase = createClient();
      const items = await getQuoteItems(supabase, quote.id);
      setItemsByQuote(prev => ({ ...prev, [quote.id]: items }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar ítems');
    } finally {
      setItemsLoading(null);
    }
  };

  const acceptQuote = async (quote: Quote) => {
    setBusyId(quote.id);
    setError(null);
    try {
      const supabase = createClient();
      await updateQuoteStatus(supabase, quote.id, 'aceptada');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aceptar');
    } finally {
      setBusyId(null);
    }
  };

  const deleteQuote = async (quote: Quote) => {
    if (!confirm(`¿Eliminar cotización de ${clientName(quote)}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setBusyId(quote.id);
    setError(null);
    try {
      const supabase = createClient();
      await supabase.from('quote_items').delete().eq('quote_id', quote.id);
      await supabase.from('quote_payment_proofs').delete().eq('quote_id', quote.id);
      const { error: delErr } = await supabase.from('quotes').delete().eq('id', quote.id);
      if (delErr) throw delErr;
      setQuotes(prev => prev.filter(q => q.id !== quote.id));
      if (expandedId === quote.id) setExpandedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setBusyId(null);
    }
  };

  const saveFactura = async (quote: Quote) => {
    if (!canEditFactura(quote.status)) return;
    const value = (facturaDrafts[quote.id] ?? quote.numero_factura ?? '').trim();
    const current = (quote.numero_factura || '').trim();
    if (value === current) return;
    setBusyId(quote.id);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updErr } = await supabase
        .from('quotes')
        .update({ numero_factura: value || null })
        .eq('id', quote.id);
      if (updErr) throw updErr;
      setQuotes(prev =>
        prev.map(q => (q.id === quote.id ? { ...q, numero_factura: value || null } : q)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar factura');
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (quote: Quote) => {
    setPdfId(quote.id);
    setError(null);
    try {
      const supabase = createClient();
      const items = itemsByQuote[quote.id] || (await getQuoteItems(supabase, quote.id));
      if (!items.length) throw new Error('Sin ítems para el PDF');
      if (!itemsByQuote[quote.id]) {
        setItemsByQuote(prev => ({ ...prev, [quote.id]: items }));
      }
      await generateQuotePDF({ ...quote, items }, userName, userSucursal || 'tecamac');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setPdfId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          placeholder="Buscar cliente, vendedor, dirección, factura..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as QuoteStatus | 'all')}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          {STATUS_FILTERS.map(s => (
            <option key={s} value={s}>
              {s === 'all' ? 'Todos los estados' : QUOTE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
        <Link
          href="/dashboard/cotizador"
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
        >
          Nueva cotización
        </Link>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-3 py-3 font-medium w-8" />
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Entrega</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No hay cotizaciones
                  </td>
                </tr>
              )}
              {paginated.map(quote => {
                const badge = entregaBadge(quote);
                const canPay =
                  canRegisterPayment &&
                  (quote.status === 'enviada' ||
                    quote.status === 'aceptada' ||
                    quote.status === 'por_definir');
                const proofsCount = quote.quote_payment_proofs?.length || 0;
                const isExpanded = expandedId === quote.id;
                const facturaValue = facturaDrafts[quote.id] ?? quote.numero_factura ?? '';

                return (
                  <Fragment key={quote.id}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => void toggleExpand(quote)}
                          className="text-slate-400 hover:text-slate-700 text-xs"
                          aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{clientName(quote)}</p>
                        {quote.delivery_address && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {quote.delivery_address}
                          </p>
                        )}
                        {canEditFactura(quote.status) && (
                          <input
                            type="text"
                            placeholder="Nº factura"
                            value={facturaValue}
                            onChange={e =>
                              setFacturaDrafts(prev => ({ ...prev, [quote.id]: e.target.value }))
                            }
                            onBlur={() => void saveFactura(quote)}
                            disabled={busyId === quote.id}
                            className="mt-1 w-full max-w-[140px] px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                          />
                        )}
                        {!canEditFactura(quote.status) && quote.numero_factura && (
                          <p className="text-[11px] font-mono text-indigo-700 mt-0.5">
                            Fact. {quote.numero_factura}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {formatMoney(quote.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLASS[quote.status] || 'bg-slate-100 text-slate-600'}`}
                        >
                          {QUOTE_STATUS_LABELS[quote.status] || quote.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {quote.vendedor?.full_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatFechaMexico(quote.quote_date)}
                      </td>
                      <td className="px-4 py-3">
                        {badge ? (
                          <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {ENTREGA_BADGE_LABELS[badge]}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/dashboard/cotizador?id=${quote.id}`}
                            className="text-xs text-emerald-700 hover:underline"
                          >
                            Editar
                          </Link>
                          {quote.status === 'enviada' && (
                            <button
                              type="button"
                              disabled={busyId === quote.id}
                              onClick={() => void acceptQuote(quote)}
                              className="text-xs text-sky-700 hover:underline disabled:opacity-50"
                            >
                              Aceptar
                            </button>
                          )}
                          {canPay && (
                            <button
                              type="button"
                              onClick={() => setPayQuoteId(quote.id)}
                              className="text-xs text-amber-700 hover:underline"
                            >
                              Registrar pago
                            </button>
                          )}
                          {canRegisterPayment && quote.status === 'a_credito' && (
                            <button
                              type="button"
                              onClick={() => setAbonoQuote(quote)}
                              className="text-xs text-emerald-700 hover:underline"
                            >
                              Registrar abono
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void downloadPdf(quote)}
                            disabled={pdfId === quote.id}
                            className="text-xs text-slate-600 hover:underline disabled:opacity-50"
                          >
                            {pdfId === quote.id ? 'PDF...' : 'PDF'}
                          </button>
                          {canDelete(quote) && (
                            <button
                              type="button"
                              disabled={busyId === quote.id}
                              onClick={() => void deleteQuote(quote)}
                              className="text-xs text-red-600 hover:underline disabled:opacity-50"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                Ítems
                              </p>
                              {itemsLoading === quote.id ? (
                                <p className="text-slate-400 text-xs">Cargando…</p>
                              ) : (itemsByQuote[quote.id] || []).length === 0 ? (
                                <p className="text-slate-400 text-xs">Sin ítems</p>
                              ) : (
                                <ul className="space-y-1">
                                  {(itemsByQuote[quote.id] || []).map((item, i) => (
                                    <li key={item.id || i} className="text-xs text-slate-700">
                                      {item.quantity} {item.unit} · {item.description}{' '}
                                      <span className="text-slate-500">
                                        ({formatMoney(item.subtotal_item)})
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                Pago y CFDI
                              </p>
                              <dl className="space-y-1 text-xs text-slate-700">
                                <div className="flex justify-between gap-2">
                                  <dt className="text-slate-500">Método</dt>
                                  <dd className="capitalize">{quote.payment_method || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-slate-500">Método CFDI</dt>
                                  <dd>{quote.metodo_de_pago_cfdi || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-slate-500">Forma CFDI</dt>
                                  <dd>{quote.forma_de_pago_cfdi || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-slate-500">Uso CFDI</dt>
                                  <dd>{quote.uso_cfdi || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-slate-500">Factura</dt>
                                  <dd className="font-mono">{quote.numero_factura || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt className="text-slate-500">Requiere factura</dt>
                                  <dd>{quote.requires_invoice ? 'Sí' : 'No'}</dd>
                                </div>
                              </dl>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                Comprobantes
                              </p>
                              <p className="text-xs text-slate-700">
                                {proofsCount === 0
                                  ? 'Sin comprobantes'
                                  : `${proofsCount} archivo${proofsCount === 1 ? '' : 's'}`}
                              </p>
                              {proofsCount > 0 && (
                                <ul className="mt-1 space-y-1">
                                  {(quote.quote_payment_proofs || []).map(p => (
                                    <li key={p.id} className="text-xs text-slate-600">
                                      <span className="truncate block">
                                        {p.file_name || 'Archivo'}
                                        {p.amount_paid != null
                                          ? ` · ${formatMoney(p.amount_paid)}`
                                          : ''}
                                      </span>
                                      {p.reference_number && (
                                        <span className="text-indigo-700 font-mono text-[11px]">
                                          Ref: {p.reference_number}
                                        </span>
                                      )}
                                      {p.complement_file_url && (
                                        <span className="block text-emerald-700 text-[11px]">
                                          Complemento OK
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                                Entrega
                              </p>
                              {quote.delivery_address ? (
                                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                  {quote.delivery_address}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400">Sin dirección</p>
                              )}
                              {badge && (
                                <p className="text-xs text-slate-600 mt-1">
                                  Estado: {ENTREGA_BADGE_LABELS[badge]}
                                </p>
                              )}
                              {quote.notes && (
                                <p className="text-xs text-slate-500 mt-2">Notas: {quote.notes}</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm">
            <button
              type="button"
              disabled={pageSafe <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-slate-600">
              {filtered.length} cotizaciones · Página {pageSafe} de {totalPages}
            </span>
            <button
              type="button"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {payQuoteId && (
        <PaymentDetailsModal
          quoteId={payQuoteId}
          currentUser={{ id: userId, sucursal: userSucursal }}
          onClose={() => setPayQuoteId(null)}
          onSuccess={() => {
            setPayQuoteId(null);
            void refresh();
          }}
        />
      )}

      {abonoQuote && (
        <AbonoCreditoModal
          quote={abonoQuote}
          userId={userId}
          onClose={() => setAbonoQuote(null)}
          onSuccess={() => {
            setAbonoQuote(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
