import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EntregaBadge,
  EntregaProgramada,
  FrequentClient,
  Quote,
  QuoteInput,
  QuoteItem,
  QuoteItemInput,
  QuoteStatus,
} from './types';

const TZ = 'America/Mexico_City';

const QUOTE_SELECT = `
  id, quote_date, client_id, client_name_temporary, client_phone_temporary,
  subtotal, iva_amount, total_amount, status, payment_method, requires_invoice,
  sucursal, payment_profile_type, delivery_address, notes, seller_id,
  metodo_de_pago_cfdi, forma_de_pago_cfdi, uso_cfdi, numero_factura,
  payment_confirmed_at, payment_confirmed_by, created_at, updated_at,
  clients (full_name, phone_number, address_street, address_number, address_neighborhood, address_city, address_state, address_postal_code),
  vendedor:seller_id (full_name),
  confirmador:payment_confirmed_by (full_name),
  quote_payment_proofs ( * ),
  entregas_programadas (revisado_bascula, fecha_entrega)
`;

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function hoyMexicoISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

export function formatFechaMexico(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' },
): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('es-MX', { timeZone: TZ, ...opts });
}

export function fechaVentaMexicoISO(quote: {
  payment_confirmed_at?: string | null;
  quote_date: string;
}): string {
  if (quote.payment_confirmed_at) {
    return new Date(quote.payment_confirmed_at).toLocaleDateString('en-CA', { timeZone: TZ });
  }
  const solo = quote.quote_date?.slice(0, 10);
  if (solo && /^\d{4}-\d{2}-\d{2}$/.test(solo)) return solo;
  return new Date(quote.quote_date).toLocaleDateString('en-CA', { timeZone: TZ });
}

export function clientName(q: Quote): string {
  return q.clients?.full_name || q.client_name_temporary || 'Sin nombre';
}

export function entregaBadge(q: Quote): EntregaBadge | null {
  if (q.status !== 'venta_concretada') return null;
  const e = first(q.entregas_programadas as EntregaProgramada | EntregaProgramada[] | null);
  if (!e) return 'pendiente_bascula';
  if (e.fecha_entrega) return 'en_ruta';
  if (e.revisado_bascula) return 'programada';
  return 'pendiente_bascula';
}

export const ENTREGA_BADGE_LABELS: Record<EntregaBadge, string> = {
  pendiente_bascula: 'Pendiente báscula',
  programada: 'Revisado báscula',
  en_ruta: 'Ruta programada',
};

export function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

const QUOTE_SELECT_NO_ENTREGA = QUOTE_SELECT.replace(
  /,\s*entregas_programadas \(revisado_bascula, fecha_entrega\)/,
  '',
);

export async function listQuotes(
  supabase: SupabaseClient,
  opts: { userId: string; role: string; status?: QuoteStatus | 'all' },
): Promise<Quote[]> {
  const role = opts.role.trim().toLowerCase();

  const applyFilters = (select: string) => {
    let query = supabase
      .from('quotes')
      .select(select)
      .order('quote_date', { ascending: false });
    if (role === 'vendedor' || role === 'venta mostrador') {
      query = query.eq('seller_id', opts.userId);
    }
    if (opts.status && opts.status !== 'all') {
      query = query.eq('status', opts.status);
    }
    return query;
  };

  let { data, error } = await applyFilters(QUOTE_SELECT);
  if (error) {
    const retry = await applyFilters(QUOTE_SELECT_NO_ENTREGA);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return (data as unknown as Quote[]) || [];
}

export async function getQuote(supabase: SupabaseClient, id: string): Promise<Quote | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select(`${QUOTE_SELECT}, quote_items (*)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const quote = data as unknown as Quote;
  quote.items = (quote.quote_items as QuoteItem[]) || [];
  return quote;
}

export async function saveQuote(
  supabase: SupabaseClient,
  payload: QuoteInput,
  items: QuoteItemInput[],
): Promise<Quote> {
  const { data, error } = await supabase
    .from('quotes')
    .insert(payload)
    .select('*, clients(*), vendedor:seller_id(full_name)')
    .single();
  if (error) throw new Error(error.message);

  if (items.length > 0) {
    const rows = items.map(i => ({ ...i, quote_id: data.id }));
    const { data: inserted, error: itemsErr } = await supabase
      .from('quote_items')
      .insert(rows)
      .select();
    if (itemsErr) throw new Error(itemsErr.message);
    return { ...data, items: inserted || [] } as Quote;
  }
  return { ...data, items: [] } as Quote;
}

export async function updateQuote(
  supabase: SupabaseClient,
  id: string,
  payload: Partial<QuoteInput>,
  items?: QuoteItemInput[],
): Promise<Quote> {
  const { data, error } = await supabase
    .from('quotes')
    .update(payload)
    .eq('id', id)
    .select('*, clients(*), vendedor:seller_id(full_name)')
    .single();
  if (error) throw new Error(error.message);

  if (items) {
    await supabase.from('quote_items').delete().eq('quote_id', id);
    if (items.length > 0) {
      const rows = items.map(i => ({ ...i, quote_id: id }));
      const { data: inserted, error: itemsErr } = await supabase
        .from('quote_items')
        .insert(rows)
        .select();
      if (itemsErr) throw new Error(itemsErr.message);
      return { ...data, items: inserted || [] } as Quote;
    }
    return { ...data, items: [] } as Quote;
  }
  return data as Quote;
}

export async function updateQuoteStatus(
  supabase: SupabaseClient,
  id: string,
  status: QuoteStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .update({ status, ...extra })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function registerPayment(
  supabase: SupabaseClient,
  opts: {
    quoteId: string;
    paymentMethod: string;
    userId: string;
    sucursal?: string | null;
  },
): Promise<QuoteStatus> {
  const method = opts.paymentMethod;
  let status: QuoteStatus;
  let finalMethod = method;

  switch (method) {
    case 'efectivo':
    case 'tarjeta_credito':
    case 'tarjeta_debito':
      status = 'venta_concretada';
      break;
    case 'transferencia':
    case 'deposito':
      status = 'en_revision_pago';
      break;
    case 'pago_en_mostrador':
      status = 'pendiente_pago_mostrador';
      finalMethod = 'efectivo';
      break;
    case 'credito':
      status = 'a_credito';
      finalMethod = 'credito';
      break;
    case 'por_definir':
      status = 'por_definir';
      break;
    default:
      throw new Error('Método de pago no reconocido');
  }

  const payload: Record<string, unknown> = {
    status,
    payment_method: finalMethod,
  };
  if (status === 'venta_concretada') {
    payload.quote_date = new Date().toISOString();
    payload.payment_confirmed_at = new Date().toISOString();
    payload.payment_confirmed_by = opts.userId;
  }
  if (method === 'pago_en_mostrador' && opts.sucursal) {
    payload.sucursal = opts.sucursal.toLowerCase();
  }

  await updateQuoteStatus(supabase, opts.quoteId, status, payload);
  return status;
}

export async function listFrequentClients(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<FrequentClient[]> {
  const { data, error } = await supabase
    .from('frequent_clients')
    .select('*')
    .eq('seller_id', sellerId)
    .order('full_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as FrequentClient[]) || [];
}

export async function listQuotesForAprobacion(supabase: SupabaseClient): Promise<Quote[]> {
  const selectFull = `
    id, quote_date, total_amount, subtotal, iva_amount, client_name_temporary, client_phone_temporary,
    payment_method, requires_invoice, status, sucursal, payment_confirmed_by, payment_confirmed_at,
    uso_cfdi, metodo_de_pago_cfdi, forma_de_pago_cfdi, numero_factura, created_at, updated_at,
    ppd_descartado, delivery_address, payment_profile_type, seller_id,
    clients (full_name, phone_number, address_street, address_number, address_neighborhood, address_city, address_state, address_postal_code),
    vendedor:seller_id (full_name),
    confirmador:payment_confirmed_by (full_name),
    quote_payment_proofs (*)
  `;
  const selectLite = `
    id, quote_date, total_amount, subtotal, iva_amount, client_name_temporary, client_phone_temporary,
    payment_method, requires_invoice, status, sucursal, payment_confirmed_by, payment_confirmed_at,
    uso_cfdi, metodo_de_pago_cfdi, forma_de_pago_cfdi, numero_factura, created_at, updated_at,
    ppd_descartado, delivery_address, payment_profile_type, seller_id,
    clients (full_name, phone_number),
    vendedor:seller_id (full_name),
    confirmador:payment_confirmed_by (full_name),
    quote_payment_proofs (id, quote_id, file_path, file_name, amount_paid, reference_number, uploaded_at, complement_uploaded_at, complement_file_url, complement_file_name)
  `;

  async function fetchStatus(status: string, orderCol: string): Promise<Quote[]> {
    const full = await supabase
      .from('quotes')
      .select(selectFull)
      .eq('status', status)
      .order(orderCol, { ascending: false })
      .limit(1000);
    if (!full.error && full.data) return full.data as unknown as Quote[];

    const lite = await supabase
      .from('quotes')
      .select(selectLite)
      .eq('status', status)
      .order(orderCol, { ascending: false })
      .limit(1000);
    if (lite.error) throw new Error(lite.error.message || full.error?.message || 'Error al cargar');
    return (lite.data as unknown as Quote[]) || [];
  }

  // Consultas separadas: un solo .in() se corta a 1000 filas y se pierden PPD/aprobados viejos
  const [pendientes, concretadas, creditos] = await Promise.all([
    fetchStatus('en_revision_pago', 'quote_date'),
    fetchStatus('venta_concretada', 'payment_confirmed_at'),
    fetchStatus('a_credito', 'updated_at'),
  ]);

  const byId = new Map<string, Quote>();
  for (const q of [...pendientes, ...concretadas, ...creditos]) {
    const proofs = q.quote_payment_proofs;
    byId.set(q.id, {
      ...q,
      quote_payment_proofs: Array.isArray(proofs) ? proofs : proofs ? [proofs] : [],
      clients: (Array.isArray(q.clients) ? q.clients[0] : q.clients) ?? null,
      vendedor: (Array.isArray(q.vendedor) ? q.vendedor[0] : q.vendedor) ?? null,
      confirmador: (Array.isArray(q.confirmador) ? q.confirmador[0] : q.confirmador) ?? null,
    });
  }
  return [...byId.values()];
}

/** Crédito / PPD (va a la pestaña PPD) */
export function esPpdOCredito(q: Quote): boolean {
  const method = (q.payment_method || '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const cfdi = (q.metodo_de_pago_cfdi || '').trim().toUpperCase();
  if (q.status === 'a_credito') return true;
  if (cfdi === 'PPD') return true;
  if (method === 'credito' || method.includes('credito')) return true;
  return false;
}

/** Venta concretada que no es PPD/crédito (pestaña Aprobados) */
export function esVentaAprobada(q: Quote): boolean {
  if (q.status !== 'venta_concretada') return false;
  return !esPpdOCredito(q);
}

export async function updatePaymentProof(
  supabase: SupabaseClient,
  proofId: string,
  patch: { amount_paid?: number | null; reference_number?: string | null },
): Promise<void> {
  const { error } = await supabase.from('quote_payment_proofs').update(patch).eq('id', proofId);
  if (error) throw new Error(error.message);
}

export async function deletePaymentProof(
  supabase: SupabaseClient,
  proofId: string,
  filePath: string | null,
  opts?: { complementFileUrl?: string | null; complementFileName?: string | null },
): Promise<void> {
  if (filePath && !filePath.startsWith('http')) {
    await supabase.storage.from('documentos-creditos').remove([filePath]);
  }

  // Limpiar complemento en bucket complementos_pago si existe
  const complementUrl = opts?.complementFileUrl;
  if (complementUrl) {
    try {
      const marker = '/complementos_pago/';
      const idx = complementUrl.indexOf(marker);
      if (idx >= 0) {
        const path = decodeURIComponent(complementUrl.slice(idx + marker.length));
        if (path) await supabase.storage.from('complementos_pago').remove([path]);
      } else if (opts?.complementFileName) {
        await supabase.storage.from('complementos_pago').remove([opts.complementFileName]);
      }
    } catch {
      /* best-effort */
    }
  }

  const { error } = await supabase.from('quote_payment_proofs').delete().eq('id', proofId);
  if (error) throw new Error(error.message);
}

export function proofPublicUrl(supabase: SupabaseClient, filePath: string | null): string | null {
  if (!filePath) return null;
  if (filePath.startsWith('http')) return filePath;
  const { data } = supabase.storage.from('documentos-creditos').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getQuoteItems(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<QuoteItem[]> {
  const { data, error } = await supabase.from('quote_items').select('*').eq('quote_id', quoteId);
  if (error) throw new Error(error.message);
  return (data as QuoteItem[]) || [];
}

export async function countVentasConcretadas(
  supabase: SupabaseClient,
  opts: { userId: string; role: string; sinceDays?: number },
): Promise<number> {
  let query = supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'venta_concretada');

  const role = opts.role.trim().toLowerCase();
  if (role === 'vendedor' || role === 'venta mostrador') {
    query = query.eq('seller_id', opts.userId);
  }
  if (opts.sinceDays) {
    const d = new Date();
    d.setDate(d.getDate() - opts.sinceDays);
    query = query.gte('payment_confirmed_at', d.toISOString());
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
