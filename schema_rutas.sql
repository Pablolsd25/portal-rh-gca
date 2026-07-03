-- ============================================================
-- Rutas de entrega — Schema
-- IMPORTANTE: Ejecutar en DOS pasos separados en Supabase SQL Editor
-- PASO 1: Ejecutar SOLO la línea ALTER TYPE y esperar confirmación.
-- PASO 2: Ejecutar el resto del archivo (desde CREATE TABLE hasta el final).
-- ============================================================

-- *** PASO 1 — Ejecutar esto solo y confirmar antes de continuar ***
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'logistica';
-- *** FIN PASO 1 ***

-- ============================================================
-- PASO 2 — Tablas, políticas y usuario Humberto
-- ============================================================

CREATE TABLE IF NOT EXISTS public.entregas_programadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL UNIQUE REFERENCES public.quotes(id) ON DELETE CASCADE,
  fecha_venta DATE NOT NULL,
  revisado_bascula BOOLEAN NOT NULL DEFAULT false,
  revisado_por UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  revisado_at TIMESTAMPTZ,
  fecha_entrega DATE,
  orden_ruta INT,
  programado_por UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  programado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entregas_fecha_venta ON public.entregas_programadas(fecha_venta);
CREATE INDEX IF NOT EXISTS idx_entregas_fecha_entrega ON public.entregas_programadas(fecha_entrega);

ALTER TABLE public.entregas_programadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_access_entregas" ON public.entregas_programadas;
CREATE POLICY "portal_access_entregas" ON public.entregas_programadas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role::text IN ('rh', 'admin', 'logistica')
        AND su.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role::text IN ('rh', 'admin', 'logistica')
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "portal_read_quotes" ON public.quotes;
CREATE POLICY "portal_read_quotes" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin', 'logistica')
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "portal_read_clients" ON public.clients;
CREATE POLICY "portal_read_clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin', 'logistica')
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "portal_read_quote_items" ON public.quote_items;
CREATE POLICY "portal_read_quote_items" ON public.quote_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin', 'logistica')
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "staff_read_own_profile" ON public.staff_users;
CREATE POLICY "staff_read_own_profile" ON public.staff_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Humberto: embarques@castroacero.com.mx
INSERT INTO public.staff_users (id, full_name, email, role, is_active, sucursal)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', 'Humberto'),
  u.email,
  'logistica'::public.staff_role,
  true,
  'tecamac'
FROM auth.users u
WHERE u.email = 'embarques@castroacero.com.mx'
ON CONFLICT (id) DO UPDATE SET
  role = 'logistica'::public.staff_role,
  is_active = true,
  email = EXCLUDED.email,
  sucursal = COALESCE(public.staff_users.sucursal, 'tecamac');

-- ponytail: RPC bypass RLS — el SQL Editor ve todo, el portal no
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
  client_phone_temporary varchar(20),
  client_full_name text,
  client_phone varchar(20),
  client_address_street text,
  client_address_number varchar(50),
  client_address_neighborhood text,
  client_address_city text,
  client_address_postal_code varchar(10),
  total_amount numeric(12, 2),
  seller_name text,
  items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_users su
    WHERE su.id = auth.uid()
      AND su.role::text IN ('rh', 'admin', 'logistica')
      AND su.is_active = true
  ) THEN
    RAISE EXCEPTION 'sin_acceso';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.quote_date,
    q.payment_confirmed_at,
    q.delivery_address,
    q.sucursal,
    q.client_name_temporary,
    q.client_phone_temporary,
    c.full_name,
    c.phone_number::varchar(20),
    c.address_street,
    c.address_number::varchar(50),
    c.address_neighborhood,
    c.address_city,
    c.address_postal_code::varchar(10),
    q.total_amount,
    s.full_name,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'description', qi.description,
        'quantity', qi.quantity,
        'unit', qi.unit
      ) ORDER BY qi.created_at)
      FROM public.quote_items qi WHERE qi.quote_id = q.id),
      '[]'::jsonb
    )
  FROM public.quotes q
  LEFT JOIN public.clients c ON c.id = q.client_id
  LEFT JOIN public.staff_users s ON s.id = q.seller_id
  WHERE q.status = 'venta_concretada'
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
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quotes_entrega(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  quote_date timestamptz,
  payment_confirmed_at timestamptz,
  delivery_address text,
  sucursal text,
  client_name_temporary text,
  client_phone_temporary varchar(20),
  client_full_name text,
  client_phone varchar(20),
  client_address_street text,
  client_address_number varchar(50),
  client_address_neighborhood text,
  client_address_city text,
  client_address_postal_code varchar(10),
  total_amount numeric(12, 2),
  seller_name text,
  items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_users su
    WHERE su.id = auth.uid()
      AND su.role::text IN ('rh', 'admin', 'logistica')
      AND su.is_active = true
  ) THEN
    RAISE EXCEPTION 'sin_acceso';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.quote_date,
    q.payment_confirmed_at,
    q.delivery_address,
    q.sucursal,
    q.client_name_temporary,
    q.client_phone_temporary,
    c.full_name,
    c.phone_number::varchar(20),
    c.address_street,
    c.address_number::varchar(50),
    c.address_neighborhood,
    c.address_city,
    c.address_postal_code::varchar(10),
    q.total_amount,
    s.full_name,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'description', qi.description,
        'quantity', qi.quantity,
        'unit', qi.unit
      ) ORDER BY qi.created_at)
      FROM public.quote_items qi WHERE qi.quote_id = q.id),
      '[]'::jsonb
    )
  FROM public.quotes q
  LEFT JOIN public.clients c ON c.id = q.client_id
  LEFT JOIN public.staff_users s ON s.id = q.seller_id
  WHERE q.id = ANY(p_ids)
  ORDER BY q.quote_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ventas_dia_rutas(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quotes_entrega(uuid[]) TO authenticated;
