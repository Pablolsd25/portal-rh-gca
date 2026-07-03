-- Ejecutar en Supabase SQL Editor (reemplaza las funciones anteriores)
-- ponytail: sin check auth.uid() dentro — el portal ya valida rol al login

DROP FUNCTION IF EXISTS public.get_ventas_dia_rutas(date, text);
DROP FUNCTION IF EXISTS public.get_quotes_entrega(uuid[]);

CREATE OR REPLACE FUNCTION public.get_ventas_dia_rutas(p_fecha date, p_sucursal text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  quote_date timestamptz,
  payment_confirmed_at timestamptz,
  delivery_address text,
  sucursal text,
  client_name_temporary text,
  client_phone_temporary text,
  client_full_name text,
  client_phone text,
  client_address_street text,
  client_address_number text,
  client_address_neighborhood text,
  client_address_city text,
  client_address_postal_code text,
  total_amount numeric,
  seller_name text,
  items jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.quote_date,
    q.payment_confirmed_at,
    q.delivery_address,
    q.sucursal,
    q.client_name_temporary,
    q.client_phone_temporary::text,
    c.full_name,
    c.phone_number::text,
    c.address_street,
    c.address_number::text,
    c.address_neighborhood,
    c.address_city,
    c.address_postal_code::text,
    q.total_amount,
    s.full_name,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'description', qi.description,
        'quantity', qi.quantity,
        'unit', qi.unit
      ))
      FROM public.quote_items qi WHERE qi.quote_id = q.id),
      '[]'::jsonb
    )
  FROM public.quotes q
  LEFT JOIN public.clients c ON c.id = q.client_id
  LEFT JOIN public.staff_users s ON s.id = q.seller_id
  WHERE q.status::text = 'venta_concretada'
    AND (
      CASE WHEN q.payment_confirmed_at IS NOT NULL THEN
        (q.payment_confirmed_at AT TIME ZONE 'America/Mexico_City')::date
      ELSE
        (q.quote_date AT TIME ZONE 'America/Mexico_City')::date
      END
    ) = p_fecha
    AND (
      p_sucursal IS NULL
      OR q.sucursal IS NULL
      OR lower(trim(q.sucursal)) = lower(trim(p_sucursal))
    )
  ORDER BY q.quote_date;
$$;

CREATE OR REPLACE FUNCTION public.get_quotes_entrega(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  quote_date timestamptz,
  payment_confirmed_at timestamptz,
  delivery_address text,
  sucursal text,
  client_name_temporary text,
  client_phone_temporary text,
  client_full_name text,
  client_phone text,
  client_address_street text,
  client_address_number text,
  client_address_neighborhood text,
  client_address_city text,
  client_address_postal_code text,
  total_amount numeric,
  seller_name text,
  items jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.quote_date,
    q.payment_confirmed_at,
    q.delivery_address,
    q.sucursal,
    q.client_name_temporary,
    q.client_phone_temporary::text,
    c.full_name,
    c.phone_number::text,
    c.address_street,
    c.address_number::text,
    c.address_neighborhood,
    c.address_city,
    c.address_postal_code::text,
    q.total_amount,
    s.full_name,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'description', qi.description,
        'quantity', qi.quantity,
        'unit', qi.unit
      ))
      FROM public.quote_items qi WHERE qi.quote_id = q.id),
      '[]'::jsonb
    )
  FROM public.quotes q
  LEFT JOIN public.clients c ON c.id = q.client_id
  LEFT JOIN public.staff_users s ON s.id = q.seller_id
  WHERE q.id = ANY(p_ids)
  ORDER BY q.quote_date;
$$;

GRANT EXECUTE ON FUNCTION public.get_ventas_dia_rutas(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quotes_entrega(uuid[]) TO authenticated;

-- Sync y marcar báscula (bypass RLS)
DROP FUNCTION IF EXISTS public.sync_entregas_dia(date, uuid[]);
DROP FUNCTION IF EXISTS public.marcar_revisado_bascula(uuid[], date, uuid);

CREATE OR REPLACE FUNCTION public.sync_entregas_dia(p_fecha date, p_quote_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.entregas_programadas (quote_id, fecha_venta)
  SELECT unnest(p_quote_ids), p_fecha
  ON CONFLICT (quote_id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.marcar_revisado_bascula(
  p_quote_ids uuid[],
  p_fecha date,
  p_user_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.entregas_programadas (quote_id, fecha_venta, revisado_bascula, revisado_por, revisado_at)
  SELECT unnest(p_quote_ids), p_fecha, true, p_user_id, now()
  ON CONFLICT (quote_id) DO UPDATE SET
    revisado_bascula = true,
    revisado_por = EXCLUDED.revisado_por,
    revisado_at = EXCLUDED.revisado_at,
    fecha_venta = EXCLUDED.fecha_venta;
$$;

GRANT EXECUTE ON FUNCTION public.sync_entregas_dia(date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_revisado_bascula(uuid[], date, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
