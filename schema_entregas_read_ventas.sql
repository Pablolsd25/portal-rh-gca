-- Permite a ventas ver estado de entrega (badge en cotizaciones)
-- Ejecutar en Supabase después de schema_rutas.sql

DROP POLICY IF EXISTS "portal_read_entregas_ventas" ON public.entregas_programadas;
CREATE POLICY "portal_read_entregas_ventas" ON public.entregas_programadas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role::text IN ('admin', 'rh', 'logistica', 'vendedor', 'venta mostrador')
        AND su.is_active = true
    )
  );
