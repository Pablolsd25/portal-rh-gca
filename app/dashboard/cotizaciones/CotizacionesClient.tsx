'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import AbonoCreditoModal from '@/components/ventas/AbonoCreditoModal';
import PaymentDetailsModal from '@/components/ventas/PaymentDetailsModal';
import FilePreviewModal from '@/components/ventas/FilePreviewModal';
import { generateQuotePDF } from '@/lib/ventas/pdfGenerator';
import {
  clientName,
  ENTREGA_BADGE_LABELS,
  entregaBadge,
  formatFechaMexico,
  formatMoney,
  getQuoteItems,
  listQuotes,
  proofPublicUrl,
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
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [itemsByQuote, setItemsByQuote] = useState<Record<string, QuoteItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);
  const [facturaDrafts, setFacturaDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

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

  const openPreview = async (quote: Quote) => {
    setPreviewQuote(quote);
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
      if (previewQuote?.id === quote.id) setPreviewQuote(null);
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
      setPreviewQuote(prev =>
        prev && prev.id === quote.id ? { ...prev, numero_factura: value || null } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar factura');
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (quote: Quote, forcedItems?: QuoteItem[]) => {
    setPdfId(quote.id);
    setError(null);
    try {
      const supabase = createClient();
      const items =
        forcedItems || itemsByQuote[quote.id] || (await getQuoteItems(supabase, quote.id));
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

  const statusPill = (status: QuoteStatus) => (
    <span
      className={`inline-flex text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE_CLASS[status] || 'bg-slate-100 text-slate-600'}`}
    >
      {QUOTE_STATUS_LABELS[status] || status}
    </span>
  );

  const renderPreviewModal = () => {
    if (!previewQuote) return null;
    const quote = previewQuote;
    const items = itemsByQuote[quote.id] || [];
    const proofs = quote.quote_payment_proofs || [];
    const supabase = createClient();
    const badge = entregaBadge(quote);
    const facturaValue = facturaDrafts[quote.id] ?? quote.numero_factura ?? '';
    const totalPaid = proofs.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Vista Previa de Cotización</h2>
              <p className="text-xs text-gray-500 mt-0.5">ID: {quote.id.substring(0, 8)}</p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewQuote(null)}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Información del cliente */}
            <div className="bg-gradient-to-r from-rose-50 to-slate-50 rounded-lg p-4 border border-rose-100">
              <h3 className="text-sm font-semibold text-rose-900 mb-3 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5" />
                Información del Cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Cliente</p>
                  <p className="font-medium text-gray-900">{clientName(quote)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Vendedor</p>
                  <p className="font-medium text-gray-900">{quote.vendedor?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Fecha</p>
                  <p className="font-medium text-gray-900">{formatFechaMexico(quote.quote_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Estado</p>
                  {statusPill(quote.status)}
                  {badge && (
                    <span className="ml-2 inline-flex text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {ENTREGA_BADGE_LABELS[badge]}
                    </span>
                  )}
                </div>
                {quote.delivery_address && (
                  <div className="col-span-1 sm:col-span-2">
                    <p className="text-xs text-gray-600 mb-1">📍 Dirección de Entrega</p>
                    <address className="font-medium text-gray-900 not-italic text-sm leading-relaxed">
                      {quote.delivery_address}
                    </address>
                  </div>
                )}
                {quote.notes && (
                  <div className="col-span-1 sm:col-span-2">
                    <p className="text-xs text-gray-600 mb-1">Notas</p>
                    <p className="text-sm text-gray-800">{quote.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Datos de facturación */}
            {quote.requires_invoice && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="text-sm font-semibold text-green-900 mb-3">📄 Datos de Facturación</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-green-700 mb-1">Método CFDI</p>
                    <p className="font-medium text-gray-900">{quote.metodo_de_pago_cfdi || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-700 mb-1">Forma de Pago CFDI</p>
                    <p className="font-medium text-gray-900">{quote.forma_de_pago_cfdi || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-700 mb-1">Uso CFDI</p>
                    <p className="font-medium text-gray-900">{quote.uso_cfdi || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Número de factura */}
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <p className="text-xs text-indigo-700 font-semibold mb-2">📋 Número de Factura</p>
              {canEditFactura(quote.status) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ej: A-12345"
                    value={facturaValue}
                    onChange={e =>
                      setFacturaDrafts(prev => ({ ...prev, [quote.id]: e.target.value }))
                    }
                    className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
                  />
                  <button
                    type="button"
                    disabled={busyId === quote.id}
                    onClick={() => void saveFactura(quote)}
                    className="px-3 py-2 text-xs font-medium text-white bg-rose-800 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                  >
                    {busyId === quote.id ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              ) : quote.numero_factura ? (
                <p className="font-mono text-base font-bold text-indigo-900">{quote.numero_factura}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">No asignado</p>
              )}
            </div>

            {/* Conceptos */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">📦 Conceptos</h3>
              {itemsLoading === quote.id ? (
                <p className="text-sm text-gray-500 text-center py-4">Cargando conceptos…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No hay conceptos para mostrar</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={item.id || index} className="bg-white rounded p-3 border border-gray-200">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-sm text-gray-900">
                          {item.description || 'Sin descripción'}
                        </p>
                        <p className="font-bold text-sm text-rose-800 ml-2 whitespace-nowrap">
                          {formatMoney(item.subtotal_item)}
                        </p>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>
                          Cant: {item.quantity} {item.unit}
                        </span>
                        <span>P.U: {formatMoney(item.unit_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totales */}
            <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
              <h3 className="text-sm font-semibold text-rose-900 mb-3">💰 Resumen de Montos</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="font-medium text-gray-900">{formatMoney(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">IVA:</span>
                  <span className="font-medium text-gray-900">{formatMoney(quote.iva_amount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-rose-200">
                  <span className="font-bold text-gray-900">Total:</span>
                  <span className="font-bold text-lg text-rose-800">
                    {formatMoney(quote.total_amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Información de pago */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">💳 Información de Pago</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-blue-700 mb-1">Método de Pago</p>
                  <p className="font-medium text-gray-900 capitalize">{quote.payment_method || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 mb-1">Sucursal</p>
                  <p className="font-medium text-gray-900 capitalize">{quote.sucursal || '-'}</p>
                </div>
              </div>
            </div>

            {/* Comprobantes de pago */}
            {proofs.length > 0 ? (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <h3 className="text-sm font-semibold text-yellow-900 mb-3">
                  📎 Comprobantes de Pago ({proofs.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {proofs.map((proof, index) => {
                    const fileUrl = proofPublicUrl(supabase, proof.file_path);
                    const displayName = proof.file_name || 'Comprobante';
                    return (
                      <div
                        key={proof.id}
                        className="bg-white rounded-lg border border-yellow-300 overflow-hidden shadow-sm"
                      >
                        <div className="bg-yellow-100 px-3 py-2 border-b border-yellow-200 flex items-center gap-2">
                          <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            #{index + 1}
                          </span>
                          <p className="text-sm font-bold text-gray-900">
                            {formatMoney(proof.amount_paid)}
                          </p>
                        </div>
                        <div className="p-3 space-y-2">
                          <p className="text-xs text-gray-600 truncate" title={displayName}>
                            📎 {displayName}
                          </p>
                          {proof.reference_number && (
                            <p className="text-xs text-gray-700">
                              Ref:{' '}
                              <span className="font-mono font-medium">{proof.reference_number}</span>
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            {fileUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewFile({ url: fileUrl, name: displayName })}
                                className="px-2 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center justify-center gap-1.5 border border-blue-200"
                              >
                                <EyeIcon className="w-4 h-4" />
                                Ver
                              </button>
                            )}
                            {fileUrl && (
                              <a
                                href={fileUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-2 text-xs font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition flex items-center justify-center gap-1.5 border border-rose-200"
                              >
                                <DocumentArrowDownIcon className="w-4 h-4" />
                                Descargar
                              </a>
                            )}
                            {proof.complement_file_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewFile({
                                    url: proof.complement_file_url!,
                                    name: proof.complement_file_name || 'Complemento',
                                  })
                                }
                                className="col-span-2 px-2 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition flex items-center justify-center gap-1.5 border border-green-200"
                              >
                                <DocumentTextIcon className="w-4 h-4" />
                                Ver Complemento
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {quote.status === 'a_credito' && (
                  <div className="bg-orange-100 rounded-lg p-3 mt-3 border border-orange-300">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-orange-900">Total Abonado:</span>
                      <span className="font-bold text-orange-900">{formatMoney(totalPaid)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="font-medium text-red-900">Saldo Pendiente:</span>
                      <span className="font-bold text-red-900">
                        {formatMoney(Math.max(0, Number(quote.total_amount) - totalPaid))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 text-center">
                <DocumentTextIcon className="w-12 h-12 mx-auto text-yellow-400 mb-2" />
                <p className="text-sm text-yellow-800">
                  No hay comprobantes registrados para esta cotización
                </p>
              </div>
            )}
          </div>

          {/* Footer con acciones */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 py-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void downloadPdf(quote)}
              disabled={pdfId === quote.id}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-800 rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
            >
              {pdfId === quote.id ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  Descargar PDF
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPreviewQuote(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const tabClass = (status: QuoteStatus | 'all') => {
    if (statusFilter !== status) {
      return 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
    }
    const map: Record<string, string> = {
      all: 'border-rose-800 text-rose-800',
      pendiente_pago_mostrador: 'border-yellow-600 text-yellow-600',
      enviada: 'border-blue-600 text-blue-600',
      aceptada: 'border-green-600 text-green-600',
      en_revision_pago: 'border-cyan-600 text-cyan-600',
      venta_concretada: 'border-purple-600 text-purple-600',
      a_credito: 'border-orange-600 text-orange-600',
      rechazada: 'border-red-600 text-red-600',
    };
    return map[status] || 'border-rose-800 text-rose-800';
  };

  return (
    <div className="container px-2 py-3 mx-auto min-h-screen bg-slate-50 md:px-4 max-w-7xl">
      <div className="flex flex-col items-start justify-between pb-3 mb-3 border-b border-slate-200 sm:flex-row sm:items-center gap-2">
        <h1 className="text-lg font-bold text-slate-800 md:text-xl">Lista de Cotizaciones</h1>
        <Link
          href="/dashboard/cotizador"
          className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-white bg-rose-800 rounded-md shadow-sm hover:bg-rose-900 w-full sm:w-auto"
        >
          <PlusCircleIcon className="w-4 h-4 mr-1" /> Nueva Cotización
        </Link>
      </div>

      <div className="mb-3 bg-white rounded-lg shadow-md">
        <div className="hidden md:block border-b border-gray-200">
          <nav className="flex overflow-x-auto scrollbar-hide -mb-px">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap flex-shrink-0 ${tabClass(s)}`}
              >
                {s === 'all' ? 'Todas' : QUOTE_STATUS_LABELS[s]}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-3 space-y-2">
          <div className="md:hidden">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filtrar por Estado
            </label>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value as QuoteStatus | 'all');
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
            >
              {STATUS_FILTERS.map(s => (
                <option key={s} value={s}>
                  {s === 'all' ? 'Todas las Cotizaciones' : QUOTE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 md:hidden">
              Buscar Cliente
            </label>
            <input
              type="search"
              placeholder="Buscar por nombre de cliente..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-rose-800"
            >
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Vista de tabla para desktop */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-3 py-3 font-medium">Cliente / Vendedor</th>
                <th className="px-3 py-3 font-medium text-right">Monto</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium">N.º factura</th>
                <th className="px-3 py-3 font-medium">N.º referencia</th>
                <th className="px-3 py-3 font-medium">Aprobó pago</th>
                <th className="px-3 py-3 font-medium text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No hay cotizaciones
                  </td>
                </tr>
              )}
              {paginated.map(quote => {
                const canPay =
                  canRegisterPayment &&
                  (quote.status === 'enviada' ||
                    quote.status === 'aceptada' ||
                    quote.status === 'por_definir');
                const facturaValue = facturaDrafts[quote.id] ?? quote.numero_factura ?? '';
                const paymentReferences = (quote.quote_payment_proofs || [])
                  .map(p => p.reference_number)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <tr key={quote.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-xs text-slate-800">{clientName(quote)}</p>
                      <p className="text-[11px] text-slate-500">
                        {quote.vendedor?.full_name || '—'}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {quote.id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-right text-slate-800 whitespace-nowrap">
                      {formatMoney(quote.total_amount)}
                    </td>
                    <td className="px-3 py-2.5">{statusPill(quote.status)}</td>
                    <td className="px-3 py-2.5">
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
                          className="w-24 px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                        />
                      )}
                      {!canEditFactura(quote.status) && quote.numero_factura && (
                        <span className="text-[11px] font-mono font-medium text-indigo-700">
                          {quote.numero_factura}
                        </span>
                      )}
                      {!canEditFactura(quote.status) && !quote.numero_factura && (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {paymentReferences ? (
                        <span className="text-[11px] font-mono font-medium text-blue-700">
                          {paymentReferences}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {quote.confirmador?.full_name ? (
                        <span className="text-xs font-medium text-slate-700">
                          {quote.confirmador.full_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {canPay && (
                          <button
                            type="button"
                            onClick={() => setPayQuoteId(quote.id)}
                            title="Registrar pago"
                            className="p-1.5 text-sky-600 hover:bg-sky-100 rounded-md"
                          >
                            <CurrencyDollarIcon className="w-4 h-4" />
                          </button>
                        )}
                        {canRegisterPayment && quote.status === 'a_credito' && (
                          <button
                            type="button"
                            onClick={() => setAbonoQuote(quote)}
                            title="Registrar abono a crédito"
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded-md"
                          >
                            <CreditCardIcon className="w-4 h-4" />
                          </button>
                        )}
                        {quote.status === 'enviada' && (
                          <button
                            type="button"
                            disabled={busyId === quote.id}
                            onClick={() => void acceptQuote(quote)}
                            title="Marcar como aceptada"
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded-md disabled:text-gray-300"
                          >
                            {busyId === quote.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckBadgeIcon className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void openPreview(quote)}
                          title="Ver detalles"
                          className="p-1.5 text-rose-800 hover:bg-rose-100 rounded-md"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadPdf(quote)}
                          disabled={pdfId === quote.id}
                          title="Descargar PDF"
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md disabled:text-gray-300"
                        >
                          {pdfId === quote.id ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <DocumentArrowDownIcon className="w-4 h-4" />
                          )}
                        </button>
                        <Link
                          href={`/dashboard/cotizador?id=${quote.id}`}
                          title="Editar cotización"
                          className="p-1.5 text-yellow-500 hover:bg-yellow-100 rounded-md"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </Link>
                        {canDelete(quote) && (
                          <button
                            type="button"
                            disabled={busyId === quote.id}
                            onClick={() => void deleteQuote(quote)}
                            title="Eliminar cotización"
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-md disabled:text-gray-300"
                          >
                            {busyId === quote.id ? (
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <TrashIcon className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
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

      {/* Vista de tarjetas para móvil */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-center text-slate-500 text-sm">No hay cotizaciones</p>
          </div>
        )}
        {paginated.map(quote => {
          const canPay =
            canRegisterPayment &&
            (quote.status === 'enviada' ||
              quote.status === 'aceptada' ||
              quote.status === 'por_definir');
          const proofs = quote.quote_payment_proofs || [];
          const totalPaid = proofs.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
          const paymentReferences = proofs
            .map(p => p.reference_number)
            .filter(Boolean)
            .join(', ');

          return (
            <div key={quote.id} className="bg-white rounded-lg shadow-md p-3">
              {/* Header */}
              <div className="flex items-start justify-between mb-2 pb-2 border-b">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-semibold text-sm text-slate-800 truncate">
                    {clientName(quote)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {quote.vendedor?.full_name || 'N/A'} · {formatFechaMexico(quote.quote_date)}
                  </p>
                  <p className="text-[9px] font-mono text-gray-400">{quote.id.slice(0, 8)}</p>
                </div>
                {statusPill(quote.status)}
              </div>

              {/* Monto destacado */}
              <div className="bg-rose-50 rounded-lg p-2.5 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-rose-800">Monto Total</span>
                  <span className="text-lg font-bold text-rose-900">
                    {formatMoney(quote.total_amount)}
                  </span>
                </div>
              </div>

              {/* Detalles en grid */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">
                    Método de Pago
                  </p>
                  <p className="font-medium text-gray-900 capitalize truncate">
                    {quote.payment_method || '-'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">
                    Requiere Factura
                  </p>
                  <p className="font-medium text-gray-900">
                    {quote.requires_invoice ? (
                      <span className="text-green-700">✓ Sí</span>
                    ) : (
                      <span className="text-gray-500">✗ No</span>
                    )}
                  </p>
                </div>
              </div>

              {quote.numero_factura && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 mb-2">
                  <p className="text-[9px] text-indigo-700 uppercase tracking-wide mb-0.5">
                    Número de Factura
                  </p>
                  <p className="font-mono text-sm font-bold text-indigo-900">
                    {quote.numero_factura}
                  </p>
                </div>
              )}

              {paymentReferences && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
                  <p className="text-[9px] text-blue-700 uppercase tracking-wide mb-0.5">
                    Número de Referencia
                  </p>
                  <p className="font-mono text-sm font-bold text-blue-900">{paymentReferences}</p>
                </div>
              )}

              {quote.confirmador?.full_name && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-2">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">
                    Aprobó pago
                  </p>
                  <p className="text-xs font-semibold text-slate-800">
                    {quote.confirmador.full_name}
                  </p>
                </div>
              )}

              {quote.status === 'a_credito' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-2">
                  <p className="text-[9px] text-orange-700 uppercase tracking-wide mb-1 font-semibold">
                    Estado del Crédito
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-800">Abonado:</span>
                    <span className="text-sm font-bold text-orange-900">
                      {formatMoney(totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-orange-800">Pendiente:</span>
                    <span className="text-sm font-bold text-red-700">
                      {formatMoney(Math.max(0, Number(quote.total_amount) - totalPaid))}
                    </span>
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="pt-2 border-t space-y-2">
                {canPay && (
                  <button
                    type="button"
                    onClick={() => setPayQuoteId(quote.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
                  >
                    <CurrencyDollarIcon className="w-5 h-5" />
                    Registrar Pago
                  </button>
                )}
                {canRegisterPayment && quote.status === 'a_credito' && (
                  <button
                    type="button"
                    onClick={() => setAbonoQuote(quote)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                  >
                    <CreditCardIcon className="w-5 h-5" />
                    Registrar Abono
                  </button>
                )}
                {quote.status === 'enviada' && (
                  <button
                    type="button"
                    disabled={busyId === quote.id}
                    onClick={() => void acceptQuote(quote)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {busyId === quote.id ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckBadgeIcon className="w-5 h-5" />
                    )}
                    Marcar como Aceptada
                  </button>
                )}

                <div className={`grid ${canDelete(quote) ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
                  <button
                    type="button"
                    onClick={() => void openPreview(quote)}
                    className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-rose-800 bg-rose-50 hover:bg-rose-100"
                  >
                    <EyeIcon className="w-6 h-6" />
                    <span className="text-[9px] font-medium">Ver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadPdf(quote)}
                    disabled={pdfId === quote.id}
                    className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {pdfId === quote.id ? (
                      <ArrowPathIcon className="w-6 h-6 animate-spin" />
                    ) : (
                      <DocumentArrowDownIcon className="w-6 h-6" />
                    )}
                    <span className="text-[9px] font-medium">PDF</span>
                  </button>
                  <Link
                    href={`/dashboard/cotizador?id=${quote.id}`}
                    className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-yellow-600 bg-yellow-50 hover:bg-yellow-100"
                  >
                    <PencilSquareIcon className="w-6 h-6" />
                    <span className="text-[9px] font-medium">Editar</span>
                  </Link>
                  {canDelete(quote) && (
                    <button
                      type="button"
                      disabled={busyId === quote.id}
                      onClick={() => void deleteQuote(quote)}
                      className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                    >
                      {busyId === quote.id ? (
                        <ArrowPathIcon className="w-6 h-6 animate-spin" />
                      ) : (
                        <TrashIcon className="w-6 h-6" />
                      )}
                      <span className="text-[9px] font-medium">Eliminar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length > PAGE_SIZE && (
          <div className="bg-white rounded-lg shadow-md p-3 flex items-center justify-between text-sm">
            <button
              type="button"
              disabled={pageSafe <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-slate-600 text-xs">
              Pág. {pageSafe} / {totalPages}
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

      {renderPreviewModal()}

      {previewFile && (
        <FilePreviewModal
          fileUrl={previewFile.url}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}

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
