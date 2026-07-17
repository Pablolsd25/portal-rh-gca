'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PaymentDetailsModal from '@/components/ventas/PaymentDetailsModal';
import { generateQuotePDF } from '@/lib/ventas/pdfGenerator';
import { formatMoney, getQuoteItems } from '@/lib/ventas/quotes';
import { IVA_RATE as IVA, type Quote } from '@/lib/ventas/types';

type QuoteRow = {
  id: string;
  quote_date: string;
  total_amount: number;
  payment_method: string | null;
  client_name_temporary: string | null;
  clients: { full_name: string } | null;
  status: string;
};

type CorteSesion = {
  id: string;
  numero_caja: number | null;
  fondo_inicial: number;
  total_esperado: number | null;
  total_contado: number | null;
  diferencia: number | null;
  closed_at: string | null;
};

type DailySale = { day: string | number; sales: number; amount: number };

type Line = { id: string; description: string; quantity: string; unit: string; unitPrice: string };

const emptyLine = (): Line => ({
  id: crypto.randomUUID(),
  description: '',
  quantity: '1',
  unit: 'KG',
  unitPrice: '',
});

function clientLabel(q: QuoteRow) {
  return q.clients?.full_name || q.client_name_temporary || 'Sin nombre';
}

export default function VentaMostradorClient({
  userId,
  userName,
  sucursal,
}: {
  userId: string;
  userName: string;
  sucursal: string | null;
  role: string;
}) {
  const [pendientes, setPendientes] = useState<QuoteRow[]>([]);
  const [cortes, setCortes] = useState<CorteSesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [payQuoteId, setPayQuoteId] = useState<string | null>(null);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [showCortes, setShowCortes] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'week' | 'month'>('week');
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalAmount: 0,
    dailySales: [] as DailySale[],
  });

  const [nombre, setNombre] = useState('Cliente Mostrador');
  const [telefono, setTelefono] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [statusDestino, setStatusDestino] = useState<'venta_concretada' | 'pendiente_pago_mostrador'>(
    'pendiente_pago_mostrador',
  );

  const flash = (msg: string) => {
    setOk(msg);
    setTimeout(() => setOk(null), 2500);
  };

  const loadMetrics = useCallback(
    async (period: 'week' | 'month') => {
      if (!sucursal) return;
      try {
        const supabase = createClient();
        const today = new Date();
        const startDate = new Date(today);
        if (period === 'week') {
          startDate.setDate(today.getDate() - today.getDay());
        } else {
          startDate.setDate(1);
        }
        startDate.setHours(0, 0, 0, 0);

        let q = supabase
          .from('quotes')
          .select('total_amount, quote_date, status, payment_method')
          .in('status', ['pagada', 'venta_concretada'])
          .gte('quote_date', startDate.toISOString());
        q = q.ilike('sucursal', sucursal);

        const { data, error: metricsError } = await q;
        if (metricsError) throw metricsError;

        const totalSales = data?.length || 0;
        const totalAmount =
          data?.reduce((sum, row) => sum + (parseFloat(String(row.total_amount)) || 0), 0) || 0;

        const dailySales: DailySale[] = [];
        const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const daysToShow = period === 'week' ? 7 : 30;
        for (let i = 0; i < daysToShow; i++) {
          const dayDate = new Date(startDate);
          dayDate.setDate(startDate.getDate() + i);
          const daySales =
            data?.filter(
              row => new Date(row.quote_date).toDateString() === dayDate.toDateString(),
            ) || [];
          if (period === 'week' || daySales.length > 0) {
            dailySales.push({
              day: period === 'week' ? daysOfWeek[dayDate.getDay()] : dayDate.getDate(),
              sales: daySales.length,
              amount: daySales.reduce(
                (sum, row) => sum + (parseFloat(String(row.total_amount)) || 0),
                0,
              ),
            });
          }
        }
        setMetrics({ totalSales, totalAmount, dailySales });
      } catch {
        setMetrics({ totalSales: 0, totalAmount: 0, dailySales: [] });
      }
    },
    [sucursal],
  );

  const loadCortes = useCallback(async () => {
    try {
      const supabase = createClient();
      let q = supabase
        .from('caja_sesiones')
        .select(
          'id, numero_caja, fondo_inicial, total_esperado, total_contado, diferencia, closed_at',
        )
        .eq('user_id', userId)
        .not('closed_at', 'is', null)
        .order('closed_at', { ascending: false })
        .limit(10);

      if (sucursal) {
        q = q.ilike('sucursal', sucursal);
      }

      const { data, error: err } = await q;
      if (err) {
        if (/caja_sesiones|does not exist|schema cache|column/i.test(err.message)) {
          setCortes([]);
          return;
        }
        throw err;
      }
      setCortes((data as unknown as CorteSesion[]) || []);
    } catch {
      setCortes([]);
    }
  }, [userId, sucursal]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let q = supabase
        .from('quotes')
        .select(
          'id, quote_date, total_amount, payment_method, client_name_temporary, status, clients(full_name)',
        )
        .eq('status', 'pendiente_pago_mostrador')
        .order('quote_date', { ascending: false });

      if (sucursal) {
        q = q.ilike('sucursal', sucursal);
      }

      const { data, error: err } = await q;
      if (err) throw err;
      setPendientes((data as unknown as QuoteRow[]) || []);
      await Promise.all([loadCortes(), loadMetrics(periodFilter)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [sucursal, loadCortes, loadMetrics, periodFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDailyAmount = useMemo(
    () => Math.max(1, ...metrics.dailySales.map(d => d.amount)),
    [metrics.dailySales],
  );

  const filteredPendientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendientes;
    return pendientes.filter(row => {
      const name = clientLabel(row).toLowerCase();
      return name.includes(q) || row.id.toLowerCase().includes(q);
    });
  }, [pendientes, search]);

  const totals = (() => {
    const total = lines.reduce((s, l) => {
      const qty = parseFloat(l.quantity) || 0;
      const price = parseFloat(l.unitPrice) || 0;
      return s + qty * price;
    }, 0);
    const subtotal = total / (1 + IVA);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      iva: Math.round((total - subtotal) * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  })();

  const downloadPdf = async (row: QuoteRow) => {
    setPdfId(row.id);
    setError(null);
    try {
      const supabase = createClient();
      const items = await getQuoteItems(supabase, row.id);
      if (!items.length) throw new Error('Sin ítems para el PDF');
      const quoteLike = {
        id: row.id,
        quote_date: row.quote_date,
        total_amount: row.total_amount,
        payment_method: row.payment_method,
        client_name_temporary: row.client_name_temporary,
        clients: row.clients,
        status: row.status as Quote['status'],
        subtotal: row.total_amount / (1 + IVA),
        iva_amount: row.total_amount - row.total_amount / (1 + IVA),
        client_id: null,
        client_phone_temporary: null,
        delivery_address: null,
        payment_profile_type: null,
        seller_id: null,
        notes: null,
        requires_invoice: false,
        uso_cfdi: null,
        metodo_de_pago_cfdi: null,
        forma_de_pago_cfdi: null,
        sucursal,
        payment_confirmed_at: null,
        payment_confirmed_by: null,
        items,
      } satisfies Quote;
      await generateQuotePDF(quoteLike, userName, sucursal || 'tecamac');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setPdfId(null);
    }
  };

  const rejectQuote = async (quoteId: string) => {
    if (
      !confirm(
        '¿Estás seguro de rechazar esta cotización? El vendedor será notificado.',
      )
    ) {
      return;
    }
    setRejectingId(quoteId);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updErr } = await supabase
        .from('quotes')
        .update({ status: 'rechazada' })
        .eq('id', quoteId);
      if (updErr) throw updErr;
      flash('Cotización rechazada');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al rechazar');
    } finally {
      setRejectingId(null);
    }
  };

  const crearVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = lines.filter(
      l => l.description.trim() && (parseFloat(l.quantity) || 0) > 0,
    );
    if (!nombre.trim() || valid.length === 0) {
      setError('Nombre y al menos un concepto válido');
      return;
    }
    if (!sucursal) {
      setError('Tu usuario no tiene sucursal asignada en staff_users');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        client_name_temporary: nombre.trim(),
        client_phone_temporary: telefono.trim() || null,
        created_by_staff_id: userId,
        seller_id: userId,
        sucursal: sucursal.toLowerCase(),
        subtotal: totals.subtotal,
        iva_amount: totals.iva,
        total_amount: totals.total,
        status: statusDestino,
        payment_method: 'efectivo',
      };
      if (statusDestino === 'venta_concretada') {
        payload.quote_date = now;
        payload.payment_confirmed_at = now;
        payload.payment_confirmed_by = userId;
      }

      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .insert(payload)
        .select('id')
        .single();
      if (qErr) throw qErr;

      const items = valid.map(l => {
        const qty = parseFloat(l.quantity) || 0;
        const price = parseFloat(l.unitPrice) || 0;
        return {
          quote_id: quote.id,
          description: l.description.trim(),
          quantity: qty,
          unit: l.unit.trim() || 'KG',
          unit_price: price,
          subtotal_item: Math.round(qty * price * 100) / 100,
        };
      });
      const { error: iErr } = await supabase.from('quote_items').insert(items);
      if (iErr) throw iErr;

      setNombre('Cliente Mostrador');
      setTelefono('');
      setLines([emptyLine()]);

      if (statusDestino === 'pendiente_pago_mostrador') {
        flash('Venta pendiente — abre cobro');
        setPayQuoteId(quote.id);
      } else {
        flash('Venta concretada');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear venta');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {ok && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
          {ok}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Ventas {periodFilter === 'week' ? 'de la semana' : 'del mes'}
          </h2>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => {
                setPeriodFilter('week');
                void loadMetrics('week');
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                periodFilter === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodFilter('month');
                void loadMetrics('month');
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                periodFilter === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Mes
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide">Ventas</p>
            <p className="text-xl font-bold text-slate-900">{metrics.totalSales}</p>
          </div>
          <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
            <p className="text-[11px] text-rose-700 uppercase tracking-wide">Monto</p>
            <p className="text-xl font-bold text-rose-800">{formatMoney(metrics.totalAmount)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-amber-700 uppercase tracking-wide">Ticket prom.</p>
            <p className="text-xl font-bold text-amber-900">
              {formatMoney(metrics.totalSales ? metrics.totalAmount / metrics.totalSales : 0)}
            </p>
          </div>
        </div>
        {metrics.dailySales.length > 0 && (
          <div className="flex items-end gap-1.5 h-24">
            {metrics.dailySales.map((d, i) => (
              <div key={`${d.day}-${i}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className="w-full bg-rose-500/80 rounded-t min-h-[2px]"
                  style={{ height: `${Math.max(4, (d.amount / maxDailyAmount) * 100)}%` }}
                  title={formatMoney(d.amount)}
                />
                <span className="text-[10px] text-slate-500 truncate w-full text-center">{d.day}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Venta rápida</h2>
        <form onSubmit={crearVenta} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del cliente"
              required
            />
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="Teléfono (opcional)"
            />
          </div>

          {lines.map((l, idx) => (
            <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-12 sm:col-span-5 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Descripción"
                value={l.description}
                onChange={e =>
                  setLines(prev =>
                    prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)),
                  )
                }
              />
              <input
                className="col-span-3 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                type="number"
                min="0"
                step="any"
                placeholder="Cant."
                value={l.quantity}
                onChange={e =>
                  setLines(prev =>
                    prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)),
                  )
                }
              />
              <input
                className="col-span-3 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Unidad"
                value={l.unit}
                onChange={e =>
                  setLines(prev =>
                    prev.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)),
                  )
                }
              />
              <input
                className="col-span-4 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                type="number"
                min="0"
                step="any"
                placeholder="P. unit."
                value={l.unitPrice}
                onChange={e =>
                  setLines(prev =>
                    prev.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)),
                  )
                }
              />
              <button
                type="button"
                className="col-span-2 sm:col-span-1 text-xs text-red-600 hover:underline"
                onClick={() =>
                  setLines(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [emptyLine()]))
                }
              >
                Quitar
              </button>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setLines(prev => [...prev, emptyLine()])}
              className="text-sm text-rose-700 hover:underline"
            >
              + Agregar concepto
            </button>
            <p className="text-sm font-semibold text-slate-800">
              Total {formatMoney(totals.total)}
              <span className="text-xs font-normal text-slate-500 ml-2">
                (IVA incl. · {formatMoney(totals.iva)})
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm text-slate-600 flex items-center gap-2">
              <input
                type="radio"
                checked={statusDestino === 'venta_concretada'}
                onChange={() => setStatusDestino('venta_concretada')}
              />
              Concretar (pagada)
            </label>
            <label className="text-sm text-slate-600 flex items-center gap-2">
              <input
                type="radio"
                checked={statusDestino === 'pendiente_pago_mostrador'}
                onChange={() => setStatusDestino('pendiente_pago_mostrador')}
              />
              Dejar pendiente
            </label>
            <button
              type="submit"
              disabled={busy}
              className="ml-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {busy ? 'Guardando…' : 'Crear venta'}
            </button>
          </div>
        </form>
      </section>

      {cortes.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <button
            type="button"
            onClick={() => setShowCortes(v => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-sm font-semibold text-slate-800">
              Historial de cortes de caja ({cortes.length})
            </h2>
            <span className="text-xs text-slate-500">{showCortes ? 'Ocultar' : 'Mostrar'}</span>
          </button>
          {showCortes && (
            <ul className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {cortes.map(corte => {
                const diff = Number(corte.diferencia);
                return (
                  <li
                    key={corte.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">
                        Caja {corte.numero_caja || 1}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">
                          {formatMoney(corte.total_contado)}
                        </p>
                        {corte.diferencia != null && diff !== 0 && (
                          <p
                            className={
                              diff >= 0 ? 'text-rose-600 font-medium' : 'text-red-600 font-medium'
                            }
                          >
                            {diff >= 0 ? '+' : ''}
                            {formatMoney(diff)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <span>Inicial: {formatMoney(corte.fondo_inicial)}</span>
                      <span>Esperado: {formatMoney(corte.total_esperado)}</span>
                      {corte.closed_at && (
                        <span className="col-span-2">
                          {new Date(corte.closed_at).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Pendientes de cobro ({filteredPendientes.length})
          </h2>
          <input
            type="search"
            placeholder="Buscar cliente o ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white min-w-[180px]"
          />
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : filteredPendientes.length === 0 ? (
          <p className="text-sm text-slate-500">No hay cotizaciones pendientes en esta sucursal.</p>
        ) : (
          <ul className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl overflow-hidden">
            {filteredPendientes.map(q => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{clientLabel(q)}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(q.quote_date).toLocaleString('es-MX')} · {q.id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {formatMoney(q.total_amount)}
                  </span>
                  <button
                    type="button"
                    disabled={pdfId === q.id}
                    onClick={() => void downloadPdf(q)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    {pdfId === q.id ? 'PDF…' : 'PDF'}
                  </button>
                  <button
                    type="button"
                    disabled={rejectingId === q.id || busy}
                    onClick={() => void rejectQuote(q.id)}
                    className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    {rejectingId === q.id ? '…' : 'Rechazar'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPayQuoteId(q.id)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                  >
                    Cobrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {payQuoteId && (
        <PaymentDetailsModal
          quoteId={payQuoteId}
          currentUser={{ id: userId, sucursal }}
          isCashRegisterMode
          onClose={() => setPayQuoteId(null)}
          onSuccess={() => {
            setPayQuoteId(null);
            flash('Cobro registrado');
            void load();
          }}
        />
      )}
    </div>
  );
}
