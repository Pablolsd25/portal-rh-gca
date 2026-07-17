-- Fix RLS lista de precios: vendedores pueden VER y descargar Excel,
-- pero NO modificar. Solo RH/Admin escriben.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.lista_precios_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_access_lista_meta" ON public.lista_precios_meta;
DROP POLICY IF EXISTS "portal_select_lista_meta" ON public.lista_precios_meta;
DROP POLICY IF EXISTS "portal_write_lista_meta" ON public.lista_precios_meta;

CREATE POLICY "portal_select_lista_meta" ON public.lista_precios_meta
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND lower(su.role::text) IN ('rh', 'admin', 'vendedor', 'venta mostrador')
        AND su.is_active = true
    )
  );

CREATE POLICY "portal_write_lista_meta" ON public.lista_precios_meta
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND lower(su.role::text) IN ('rh', 'admin')
        AND su.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND lower(su.role::text) IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

DROP POLICY IF EXISTS "portal_access_materiales" ON public.materiales;
DROP POLICY IF EXISTS "portal_select_materiales" ON public.materiales;
DROP POLICY IF EXISTS "portal_write_materiales" ON public.materiales;

CREATE POLICY "portal_select_materiales" ON public.materiales
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND lower(su.role::text) IN ('rh', 'admin', 'vendedor', 'venta mostrador')
        AND su.is_active = true
    )
  );

CREATE POLICY "portal_write_materiales" ON public.materiales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND lower(su.role::text) IN ('rh', 'admin')
        AND su.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND lower(su.role::text) IN ('rh', 'admin')
        AND su.is_active = true
    )
  );
