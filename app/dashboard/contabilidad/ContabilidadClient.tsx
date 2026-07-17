'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import FilePreviewModal from '@/components/ventas/FilePreviewModal';
import PpdQuoteCard from '@/components/ventas/PpdQuoteCard';
import ProofsModal from '@/components/ventas/ProofsModal';
import QuoteTable from '@/components/ventas/QuoteTable';
import { generateQuotePDF } from '@/lib/ventas/pdfGenerator';
import {
  clientName,
  formatFechaMexico,
  formatMoney,
  getQuoteItems,
} from '@/lib/ventas/quotes';
import type { Quote } from '@/lib/ventas/types';

type Props = {
  userId: string;
  userName: string;
  userSucursal: string | null;
};

type Tab = 'pendientes' | 'completados';
const PAGE_SIZE = 10;

type ProcessedQuote = Quote & {
  totalPaid: number;
  isFullyPaid: boolean;
  complementsCount: number;
  totalProofsWithRef: number;
};

function needsComplement(q: Quote): boolean {
  if (q.ppd_descartado) return false;
  const proofs = q.quote_payment_proofs || [];
  if (proofs.length === 0) return true;
  return proofs.some(p => p.reference_number && !p.complement_file_url);
}

function isCompletado(q: Quote): boolean {
  if (q.ppd_descartado) return true;
  const proofs = q.quote_payment_proofs || [];
  if (proofs.length === 0) return false;
  return proofs.every(p => !p.reference_number || !!p.complement_file_url);
}

function processQuote(invoice: Quote): ProcessedQuote {
  const totalPaid = (invoice.quote_payment_proofs || []).reduce(
    (sum, proof) => sum + (Number(proof.amount_paid) || 0),
    0,
  );
  const totalPaidRounded = Math.round(totalPaid * 100) / 100;
  const totalAmountRounded = Math.round(Number(invoice.total_amount) * 100) / 100;
  const complementsCount = (invoice.quote_payment_proofs || []).filter(
    p => p.complement_file_url,
  ).length;
  const totalProofsWithRef = (invoice.quote_payment_proofs || []).filter(
    p => p.reference_number,
  ).length;

  return {
    ...invoice,
    totalPaid: totalPaidRounded,
    isFullyPaid: totalPaidRounded >= totalAmountRounded,
    complementsCount,
    totalProofsWithRef,
  };
}

function PaginationBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-sm text-slate-600">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );
}

export default function ContabilidadClient({ userId, userName, userSucursal }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [proofsQuote, setProofsQuote] = useState<Quote | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null);

  const [clientSearch, setClientSearch] = useState('');
  const [vendedorFilter, setVendedorFilter] = useState('all');
  const [referenciaFilter, setReferenciaFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const selectFull = `
        id, quote_date, total_amount, subtotal, iva_amount, client_name_temporary, client_phone_temporary,
        payment_method, requires_invoice, status, sucursal, payment_confirmed_by, payment_confirmed_at,
        uso_cfdi, metodo_de_pago_cfdi, forma_de_pago_cfdi, numero_factura, created_at, updated_at,
        ppd_descartado, delivery_address, payment_profile_type, seller_id, notes, client_id,
        clients (full_name, phone_number),
        vendedor:seller_id (full_name),
        confirmador:payment_confirmed_by (full_name),
        quote_payment_proofs (*)
      `;
      const { data, error: err } = await supabase
        .from('quotes')
        .select(selectFull)
        .eq('status', 'venta_concretada')
        .or('metodo_de_pago_cfdi.eq.PPD,requires_invoice.eq.true')
        .order('quote_date', { ascending: false })
        .limit(300);
      if (err) throw err;

      const rows = ((data as unknown as Quote[]) || []).map(q => ({
        ...q,
        quote_payment_proofs: Array.isArray(q.quote_payment_proofs)
          ? q.quote_payment_proofs
          : q.quote_payment_proofs
            ? [q.quote_payment_proofs]
            : [],
        clients: (Array.isArray(q.clients) ? q.clients[0] : q.clients) ?? null,
        vendedor: (Array.isArray(q.vendedor) ? q.vendedor[0] : q.vendedor) ?? null,
        confirmador: (Array.isArray(q.confirmador) ? q.confirmador[0] : q.confirmador) ?? null,
      }));
      setQuotes(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allProcessed = useMemo(
    () =>
      quotes
        .filter(q => q.quote_payment_proofs && q.quote_payment_proofs.length > 0)
        .map(processQuote),
    [quotes],
  );

  const pendientes = useMemo(
    () =>
      allProcessed.filter(invoice => {
        const hasReferences = invoice.totalProofsWithRef > 0;
        const missingComplements = invoice.complementsCount < invoice.totalProofsWithRef;
        return hasReferences && missingComplements && !invoice.ppd_descartado;
      }),
    [allProcessed],
  );

  const completados = useMemo(
    () =>
      allProcessed.filter(invoice => {
        const hasReferences = invoice.totalProofsWithRef > 0;
        const allHaveComplements = invoice.complementsCount === invoice.totalProofsWithRef;
        return hasReferences && allHaveComplements;
      }),
    [allProcessed],
  );

  const tabList = tab === 'pendientes' ? pendientes : completados;

  const vendedoresUnicos = useMemo(() => {
    const names = tabList
      .map(q => q.vendedor?.full_name || 'Sin vendedor')
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort();
    return names;
  }, [tabList]);

  const filtered = useMemo(() => {
    let list = [...tabList];
    const clientQ = clientSearch.trim().toLowerCase();
    if (clientQ) {
      list = list.filter(q => {
        const name = clientName(q).toLowerCase();
        const vendor = (q.vendedor?.full_name || '').toLowerCase();
        return name.includes(clientQ) || vendor.includes(clientQ);
      });
    }
    if (vendedorFilter !== 'all') {
      list = list.filter(
        q => (q.vendedor?.full_name || 'Sin vendedor') === vendedorFilter,
      );
    }
    const refQ = referenciaFilter.trim().toLowerCase();
    if (refQ) {
      list = list.filter(q =>
        (q.quote_payment_proofs || []).some(p =>
          (p.reference_number || '').toLowerCase().includes(refQ),
        ),
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter(q => new Date(q.created_at || q.quote_date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter(q => new Date(q.created_at || q.quote_date) <= to);
    }
    return list;
  }, [tabList, clientSearch, vendedorFilter, referenciaFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [tab, clientSearch, vendedorFilter, referenciaFilter, dateFrom, dateTo]);

  const hasFilters =
    !!clientSearch ||
    vendedorFilter !== 'all' ||
    !!referenciaFilter ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setClientSearch('');
    setVendedorFilter('all');
    setReferenciaFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const descartar = async (id: string) => {
    if (!confirm('¿Descartar este PPD / factura? No pedirá complemento.')) return;
    setBusy(id);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from('quotes')
        .update({ ppd_descartado: true })
        .eq('id', id);
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descartar');
    } finally {
      setBusy(null);
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
        setPdfPreview({
          url,
          name: `Cotizacion_${quote.id.substring(0, 8)}.pdf`,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  const emptyMessage =
    tab === 'pendientes'
      ? 'No hay facturas PPD para mostrar.'
      : 'No hay facturas con complementos completos.';

  const renderDesktopRow = (q: ProcessedQuote) => (
    <tr key={q.id} className="border-b hover:bg-slate-50">
      <td className="px-3 py-2">
        <p className="font-medium text-sm">{clientName(q)}</p>
        <p className="text-xs text-slate-500">{q.vendedor?.full_name || '—'}</p>
      </td>
      <td className="px-3 py-2 text-xs">
        {formatMoney(q.totalPaid)} / {formatMoney(q.total_amount)}
      </td>
      <td className="px-3 py-2 text-xs">{q.quote_payment_proofs?.length || 0}</td>
      <td className="px-3 py-2 text-xs">
        {q.complementsCount} / {q.totalProofsWithRef}
      </td>
      <td className="px-3 py-2 text-xs">{q.confirmador?.full_name || '—'}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProofsQuote(q)}
            className="text-xs text-sky-700 hover:underline"
          >
            Abonos
          </button>
          <button
            type="button"
            disabled={pdfLoading === q.id}
            onClick={() => void runPdf(q, true)}
            className="text-xs text-violet-700 hover:underline disabled:opacity-50"
          >
            Ver PDF
          </button>
          <button
            type="button"
            disabled={pdfLoading === q.id}
            onClick={() => void runPdf(q, false)}
            className="text-xs text-sky-700 hover:underline disabled:opacity-50"
          >
            Descargar
          </button>
          {tab === 'pendientes' && !q.ppd_descartado && (
            <button
              type="button"
              disabled={busy === q.id}
              onClick={() => void descartar(q.id)}
              className="text-xs text-red-700 hover:underline disabled:opacity-50"
            >
              Ocultar
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-3 sm:p-4">
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTab('pendientes')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              tab === 'pendientes'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Facturas Pendientes ({pendientes.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('completados')}
            className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              tab === 'completados'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Complementos Completos ({completados.length})
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div
          className={`px-3 py-3 border-b border-gray-200 ${
            tab === 'pendientes' ? 'bg-blue-50' : 'bg-green-50'
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-gray-700">
              🔍 Cliente / Vendedor
              <input
                type="search"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Buscar..."
                className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 ${
                  tab === 'pendientes'
                    ? 'focus:ring-blue-500 focus:border-blue-500'
                    : 'focus:ring-green-500 focus:border-green-500'
                }`}
              />
            </label>
            <label className="text-xs text-gray-700">
              👤 Vendedor
              <select
                value={vendedorFilter}
                onChange={e => setVendedorFilter(e.target.value)}
                className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 ${
                  tab === 'pendientes'
                    ? 'focus:ring-blue-500 focus:border-blue-500'
                    : 'focus:ring-green-500 focus:border-green-500'
                }`}
              >
                <option value="all">Todos</option>
                {vendedoresUnicos.map(v => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-700">
              📋 Referencia
              <input
                type="search"
                value={referenciaFilter}
                onChange={e => setReferenciaFilter(e.target.value)}
                placeholder="Buscar referencia..."
                className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 ${
                  tab === 'pendientes'
                    ? 'focus:ring-blue-500 focus:border-blue-500'
                    : 'focus:ring-green-500 focus:border-green-500'
                }`}
              />
            </label>
            <div className="flex items-end">
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center w-full px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
                >
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <label className="text-xs text-gray-700">
              📅 Desde
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
              />
            </label>
            <label className="text-xs text-gray-700">
              📅 Hasta
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            <span className="font-medium">{filtered.length}</span> de {tabList.length} facturas
          </p>
        </div>

        {/* Desktop */}
        <div className="hidden md:block max-h-[calc(100vh-420px)] overflow-y-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-400">Cargando…</p>
          ) : (
            <QuoteTable
              headers={[
                'Cliente / Vendedor',
                'Progreso de Pago',
                'Abonos',
                'Complemento(s)',
                'Asignado Por',
                'Acciones',
              ]}
              rows={paginated.map(q => renderDesktopRow(q))}
              emptyMessage={emptyMessage}
            />
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden max-h-[calc(100vh-380px)] overflow-y-auto p-3 space-y-3">
          {loading ? (
            <p className="text-center py-8 text-gray-500 text-sm">Cargando…</p>
          ) : paginated.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">{emptyMessage}</div>
          ) : (
            paginated.map(q => (
              <PpdQuoteCard
                key={q.id}
                quote={q}
                pdfLoadingQuoteId={pdfLoading}
                onViewProofs={setProofsQuote}
                onDownloadPDF={q2 => void runPdf(q2, false)}
                onPreviewPDF={q2 => void runPdf(q2, true)}
                showDiscardButton={tab === 'pendientes'}
                onDiscard={() => descartar(q.id)}
              />
            ))
          )}
        </div>

        <PaginationBar page={pageSafe} totalPages={totalPages} onChange={setPage} />
      </div>

      {proofsQuote && (
        <ProofsModal
          quote={proofsQuote}
          userId={userId}
          onClose={() => setProofsQuote(null)}
          onSaved={async () => {
            await load();
            setProofsQuote(null);
          }}
        />
      )}

      {pdfPreview && (
        <FilePreviewModal
          fileUrl={pdfPreview.url}
          fileName={pdfPreview.name}
          onClose={() => {
            URL.revokeObjectURL(pdfPreview.url);
            setPdfPreview(null);
          }}
        />
      )}
    </div>
  );
}
