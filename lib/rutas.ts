import type { SupabaseClient } from '@supabase/supabase-js';

export interface PedidoEntrega {
  quote_id: string;
  fecha_venta: string;
  revisado_bascula: boolean;
  fecha_entrega: string | null;
  orden_ruta: number | null;
  lat: number | null;
  lng: number | null;
  cliente: string;
  telefono: string | null;
  direccion: string;
  para_ruta: boolean;
  total: number;
  items: { description: string; quantity: number; unit: string }[];
  vendedor: string | null;
  sucursal: string | null;
}

type ClientRow = {
  full_name: string;
  phone_number: string;
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_postal_code?: string | null;
};

type RpcQuote = {
  id: string;
  quote_date: string;
  payment_confirmed_at?: string | null;
  delivery_address: string | null;
  sucursal?: string | null;
  client_name_temporary: string | null;
  client_phone_temporary: string | null;
  client_full_name?: string | null;
  client_phone?: string | null;
  client_address_street?: string | null;
  client_address_number?: string | null;
  client_address_neighborhood?: string | null;
  client_address_city?: string | null;
  client_address_postal_code?: string | null;
  total_amount: number;
  seller_name?: string | null;
  items?: { description: string; quantity: number; unit: string }[];
};

type QuoteRow = {
  id: string;
  quote_date: string;
  payment_confirmed_at?: string | null;
  delivery_address: string | null;
  client_name_temporary: string | null;
  client_phone_temporary: string | null;
  total_amount: number;
  sucursal?: string | null;
  clients?: ClientRow | ClientRow[] | null;
  seller?: { full_name: string } | { full_name: string }[] | null;
  quote_items?: { description: string; quantity: number; unit: string }[];
};

type EstadoEntrega = {
  quote_id: string;
  revisado_bascula: boolean;
  fecha_entrega: string | null;
  orden_ruta: number | null;
  lat?: number | null;
  lng?: number | null;
};

/** Fecha de venta en zona México (misma lógica que portal-staff-gca) */
export function fechaVentaISO(quote: { payment_confirmed_at?: string | null; quote_date: string }): string {
  if (quote.payment_confirmed_at) {
    return new Date(quote.payment_confirmed_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  }
  // ponytail: YYYY-MM-DD sin hora = ese día en México, no UTC (evita desfase de 1 día)
  const soloFecha = quote.quote_date?.slice(0, 10);
  if (soloFecha && /^\d{4}-\d{2}-\d{2}$/.test(soloFecha)) return soloFecha;
  return new Date(quote.quote_date).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

export function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

export function mananaISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

/** Dirección de entrega: delivery_address o domicilio del cliente */
export function direccionEntrega(q: QuoteRow): string | null {
  const directa = q.delivery_address?.trim();
  if (directa) return directa;
  const c = first(q.clients);
  if (!c) return null;
  const partes = [
    c.address_street,
    c.address_number,
    c.address_neighborhood,
    c.address_city,
    c.address_postal_code,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(', ') : null;
}

function rpcToQuoteRow(r: RpcQuote): QuoteRow {
  const hasClientAddr = r.client_address_street || r.client_address_neighborhood;
  return {
    id: r.id,
    quote_date: r.quote_date,
    payment_confirmed_at: r.payment_confirmed_at,
    delivery_address: r.delivery_address,
    client_name_temporary: r.client_name_temporary,
    client_phone_temporary: r.client_phone_temporary,
    total_amount: r.total_amount,
    sucursal: r.sucursal,
    clients: r.client_full_name || hasClientAddr ? {
      full_name: r.client_full_name ?? '',
      phone_number: r.client_phone ?? '',
      address_street: r.client_address_street,
      address_number: r.client_address_number,
      address_neighborhood: r.client_address_neighborhood,
      address_city: r.client_address_city,
      address_postal_code: r.client_address_postal_code,
    } : null,
    seller: r.seller_name ? { full_name: r.seller_name } : null,
    quote_items: Array.isArray(r.items) ? r.items : [],
  };
}

function quoteAPedido(q: QuoteRow, fecha: string, estado?: EstadoEntrega): PedidoEntrega {
  const clients = first(q.clients);
  const seller = first(q.seller);
  const dir = direccionEntrega(q) ?? '';
  return {
    quote_id: q.id,
    fecha_venta: fecha,
    revisado_bascula: estado?.revisado_bascula ?? false,
    fecha_entrega: estado?.fecha_entrega ?? null,
    orden_ruta: estado?.orden_ruta ?? null,
    lat: estado?.lat ?? null,
    lng: estado?.lng ?? null,
    cliente: clients?.full_name ?? q.client_name_temporary ?? 'Sin nombre',
    telefono: clients?.phone_number ?? q.client_phone_temporary ?? null,
    direccion: dir,
    para_ruta: dir.length > 0,
    total: Number(q.total_amount),
    items: q.quote_items ?? [],
    vendedor: seller?.full_name ?? null,
    sucursal: q.sucursal ?? null,
  };
}

function supabaseErr(error: { message: string; details?: string; hint?: string; code?: string }): Error {
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return new Error(parts.join(' — ') || 'Error de Supabase');
}

async function fetchVentasDelDia(
  supabase: SupabaseClient,
  fecha: string,
  sucursal?: string | null,
): Promise<QuoteRow[]> {
  const { data, error } = await supabase.rpc('get_ventas_dia_rutas', {
    p_fecha: fecha,
    p_sucursal: sucursal ?? null,
  });

  if (error) throw supabaseErr(error);
  return (data as RpcQuote[] ?? []).map(rpcToQuoteRow);
}

async function fetchQuotesByIds(supabase: SupabaseClient, ids: string[]): Promise<Map<string, QuoteRow>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc('get_quotes_entrega', { p_ids: ids });
  if (error) throw supabaseErr(error);
  return new Map((data as RpcQuote[] ?? []).map(r => [r.id, rpcToQuoteRow(r)]));
}

async function fetchEstadoEntregas(
  supabase: SupabaseClient,
  quoteIds: string[],
): Promise<Map<string, EstadoEntrega>> {
  if (quoteIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('entregas_programadas')
    .select('quote_id, revisado_bascula, fecha_entrega, orden_ruta, lat, lng')
    .in('quote_id', quoteIds);
  if (error) throw supabaseErr(error);
  return new Map((data ?? []).map(e => [e.quote_id, e as EstadoEntrega]));
}

/** Trae ventas del día desde portal-staff y sincroniza estado local */
export async function syncPedidosDelDia(
  supabase: SupabaseClient,
  fecha: string,
  sucursal?: string | null,
): Promise<PedidoEntrega[]> {
  const ventas = await fetchVentasDelDia(supabase, fecha, sucursal);

  if (ventas.length > 0) {
    const { error: syncErr } = await supabase.rpc('sync_entregas_dia', {
      p_fecha: fecha,
      p_quote_ids: ventas.map(v => v.id),
    });
    if (syncErr) {
      return ventas.map(q => quoteAPedido(q, fecha));
    }
  }

  const estado = await fetchEstadoEntregas(supabase, ventas.map(v => v.id));
  return ventas.map(q => quoteAPedido(q, fecha, estado.get(q.id)));
}

export async function getPedidosDelDia(
  supabase: SupabaseClient,
  fecha: string,
  sucursal?: string | null,
): Promise<PedidoEntrega[]> {
  return syncPedidosDelDia(supabase, fecha, sucursal);
}

/** Pedidos revisados en báscula, aún sin fecha de entrega */
export async function getPedidosPorProgramar(supabase: SupabaseClient): Promise<PedidoEntrega[]> {
  const { data, error } = await supabase
    .from('entregas_programadas')
    .select('quote_id, fecha_venta, revisado_bascula, fecha_entrega, orden_ruta, lat, lng')
    .eq('revisado_bascula', true)
    .is('fecha_entrega', null)
    .order('fecha_venta', { ascending: true });

  if (error) throw supabaseErr(error);
  const rows = data ?? [];
  const quotes = await fetchQuotesByIds(supabase, rows.map(r => r.quote_id));

  return rows
    .map(r => {
      const q = quotes.get(r.quote_id);
      if (!q) return null;
      return quoteAPedido(q, r.fecha_venta, r as EstadoEntrega);
    })
    .filter((p): p is PedidoEntrega => p != null && p.para_ruta);
}

export async function marcarRevisadoBascula(
  supabase: SupabaseClient,
  quoteIds: string[],
  userId: string,
  fechaVenta: string,
): Promise<void> {
  if (quoteIds.length === 0) return;
  const { error } = await supabase.rpc('marcar_revisado_bascula', {
    p_quote_ids: quoteIds,
    p_fecha: fechaVenta,
    p_user_id: userId,
  });
  if (error) throw supabaseErr(error);
}

export async function programarRuta(
  supabase: SupabaseClient,
  quoteIds: string[],
  fechaEntrega: string,
  userId: string,
  coords?: Record<string, { lat: number; lng: number }>,
): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < quoteIds.length; i++) {
    const id = quoteIds[i];
    const c = coords?.[id];
    const { error } = await supabase
      .from('entregas_programadas')
      .update({
        fecha_entrega: fechaEntrega,
        orden_ruta: i + 1,
        programado_por: userId,
        programado_at: now,
        ...(c
          ? { lat: c.lat, lng: c.lng, geocoded_at: now }
          : {}),
      })
      .eq('quote_id', id);
    if (error) throw supabaseErr(error);
  }
}

/** Reordena una ruta ya programada y opcionalmente guarda coords. */
export async function reordenarRuta(
  supabase: SupabaseClient,
  quoteIds: string[],
  userId: string,
  coords?: Record<string, { lat: number; lng: number }>,
): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < quoteIds.length; i++) {
    const id = quoteIds[i];
    const c = coords?.[id];
    const { error } = await supabase
      .from('entregas_programadas')
      .update({
        orden_ruta: i + 1,
        programado_por: userId,
        programado_at: now,
        ...(c ? { lat: c.lat, lng: c.lng, geocoded_at: now } : {}),
      })
      .eq('quote_id', id);
    if (error) throw supabaseErr(error);
  }
}

export async function getRutaEntrega(supabase: SupabaseClient, fechaEntrega: string): Promise<PedidoEntrega[]> {
  const { data, error } = await supabase
    .from('entregas_programadas')
    .select('quote_id, fecha_venta, revisado_bascula, fecha_entrega, orden_ruta, lat, lng')
    .eq('fecha_entrega', fechaEntrega)
    .order('orden_ruta', { ascending: true });

  if (error) throw supabaseErr(error);
  const rows = data ?? [];
  const quotes = await fetchQuotesByIds(supabase, rows.map(r => r.quote_id));

  return rows
    .map(r => {
      const q = quotes.get(r.quote_id);
      if (!q) return null;
      return quoteAPedido(q, r.fecha_venta, r as EstadoEntrega);
    })
    .filter((p): p is PedidoEntrega => p != null);
}

// ponytail: self-check mínimo
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  console.assert(fechaVentaISO({ quote_date: '2026-07-03', payment_confirmed_at: null }) === '2026-07-03', 'fecha date-only sin desfase');
  console.assert(
    direccionEntrega({ id: '1', quote_date: '', delivery_address: '  Calle 1  ', client_name_temporary: null, client_phone_temporary: null, total_amount: 0 }) === 'Calle 1',
    'direccionEntrega usa delivery_address',
  );
}
