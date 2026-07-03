-- Fix RLS: INSERT en entregas_programadas bloqueado para logística
-- Ejecutar en Supabase SQL Editor

DROP POLICY IF EXISTS "rh_access_entregas" ON public.entregas_programadas;
DROP POLICY IF EXISTS "portal_access_entregas" ON public.entregas_programadas;

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

-- Confirmar rol de Humberto
UPDATE public.staff_users
SET role = 'logistica'::public.staff_role, is_active = true
WHERE email = 'embarques@castroacero.com.mx';
