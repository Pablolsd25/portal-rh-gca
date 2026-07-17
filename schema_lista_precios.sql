-- ============================================================
-- Lista de precios / materiales
-- Ejecutar en Supabase SQL Editor, luego seed_lista_precios.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lista_precios_meta (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  empresa TEXT NOT NULL DEFAULT 'ACEROS Y MATERIALES SIGLO XXI, S.A. DE C.V.',
  fecha_vigencia DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.materiales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden INT NOT NULL DEFAULT 0,
  descripcion TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'KG',
  -- Precios sin IVA (columna PRECIO del Excel)
  precio_materialista NUMERIC(14, 4),
  precio_edo_mex NUMERIC(14, 4),
  precio_cdmx NUMERIC(14, 4),
  destacado BOOLEAN NOT NULL DEFAULT false, -- sombra amarilla = cambio reciente
  disponible BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materiales_orden ON public.materiales(orden);

ALTER TABLE public.lista_precios_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_access_lista_meta" ON public.lista_precios_meta;
CREATE POLICY "portal_access_lista_meta" ON public.lista_precios_meta
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role::text IN ('rh', 'admin')
        AND su.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role::text IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "portal_access_materiales" ON public.materiales;
CREATE POLICY "portal_access_materiales" ON public.materiales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role::text IN ('rh', 'admin')
        AND su.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role::text IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

INSERT INTO public.lista_precios_meta (id, empresa, fecha_vigencia, notas)
VALUES (
  1,
  'ACEROS Y MATERIALES SIGLO XXI, S.A. DE C.V.',
  '2026-04-20',
  'Precios sujetos a cambio sin previo aviso. Flete en el área metropolitana sin cargo. Los cambios aparecen en sombra.'
)
ON CONFLICT (id) DO NOTHING;
