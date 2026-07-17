'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import ProofsModal from '@/components/ventas/ProofsModal';
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

export default function ContabilidadClient({ userId, userName, userSucursal }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [proofsQuote, setProofsQuote] = useState<Quote | null>(null);

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

  const pendientes = useMemo(
    () => quotes.filter(q => !q.ppd_descartado && needsComplement(q)),
    [quotes],
  );

  const completados = useMemo(
    () => quotes.filter(q => isCompletado(q)),
    [quotes],
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

  const clearFilters = () => {
    setClientSearch('');
    setVendedorFilter('all');
    setReferenciaFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters =
    !!clientSearch ||
    vendedorFilter !== 'all' ||
    !!referenciaFilter ||
    !!dateFrom ||
    !!dateTo;

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

  const runPdf = async (quote: Quote) => {
    setPdfLoading(quote.id);
    setError(null);
    try {
      const supabase = createClient();
      const items = await getQuoteItems(supabase, quote.id);
      if (!items.length) throw new Error('No hay ítems para esta cotización');
      await generateQuotePDF({ ...quote, items }, userName, userSucursal || 'tecamac');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setTab('pendientes')}
            className={`flex-1 px-3 py-3 text-sm font-medium ${
              tab === 'pendientes'
                ? 'bg-white text-slate-900 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pendientes
            <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
              {pendientes.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('completados')}
            className={`flex-1 px-3 py-3 text-sm font-medium ${
              tab === 'completados'
                ? 'bg-white text-slate-900 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completados
            <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
              {completados.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-4 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            {loading ? '…' : 'Actualizar'}
          </button>
        </div>

        <div
          className={`px-4 py-3 border-b border-slate-200 ${
            tab === 'pendientes' ? 'bg-sky-50/60' : 'bg-emerald-50/60'
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs text-slate-600">
              Cliente / vendedor
              <input
                type="search"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Buscar…"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </label>
            <label className="text-xs text-slate-600">
              Vendedor
              <select
                value={vendedorFilter}
                onChange={e => setVendedorFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="all">Todos</option>
                {vendedoresUnicos.map(v => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Referencia
              <input
                type="search"
                value={referenciaFilter}
                onChange={e => setReferenciaFilter(e.target.value)}
                placeholder="Folio…"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </label>
            <div className="flex items-end">
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full px-3 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <label className="text-xs text-slate-600">
              Desde
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </label>
            <label className="text-xs text-slate-600">
              Hasta
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            <span className="font-medium">{filtered.length}</span> de {tabList.length} registros
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">Cargando…</p>
          ) : paginated.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No hay registros con estos filtros.
            </p>
          ) : (
            paginated.map(q => {
              const proofsCount = q.quote_payment_proofs?.length || 0;
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
                        {q.metodo_de_pago_cfdi === 'PPD' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">
                            PPD
                          </span>
                        )}
                        {q.ppd_descartado && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            Descartado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">
                        <span className="font-semibold text-slate-800">
                          {formatMoney(q.total_amount)}
                        </span>
                        {' · '}
                        {q.vendedor?.full_name || 'Sin vendedor'}
                        {' · '}
                        {formatFechaMexico(q.quote_date)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Factura: {q.numero_factura || '—'}
                        {' · '}
                        Comprobantes: {proofsCount}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setProofsQuote(q)}
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-white"
                      >
                        Comprobantes ({proofsCount})
                      </button>
                      <button
                        type="button"
                        disabled={pdfLoading === q.id}
                        onClick={() => void runPdf(q)}
                        className="px-3 py-1.5 text-xs border border-sky-200 text-sky-700 rounded-lg hover:bg-sky-50 disabled:opacity-50"
                      >
                        {pdfLoading === q.id ? 'PDF…' : 'PDF'}
                      </button>
                      {tab === 'pendientes' && !q.ppd_descartado && (
                        <button
                          type="button"
                          disabled={busy === q.id}
                          onClick={() => void descartar(q.id)}
                          className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          Descartar PPD
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
              Página {pageSafe} de {totalPages}
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
    </div>
  );
}
