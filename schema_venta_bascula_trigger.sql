-- ============================================================
-- Trigger: al concretar una venta, crear fila en entregas_programadas
-- Ejecutar en Supabase SQL Editor (una sola vez).
-- Requiere: public.entregas_programadas (schema_rutas.sql)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_quote_venta_to_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha date;
BEGIN
  IF NEW.status IS DISTINCT FROM 'venta_concretada' THEN
    RETURN NEW;
  END IF;

  -- Solo al pasar a venta_concretada (INSERT o cambio de status)
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'venta_concretada' THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_confirmed_at IS NOT NULL THEN
    v_fecha := (NEW.payment_confirmed_at AT TIME ZONE 'America/Mexico_City')::date;
  ELSIF NEW.quote_date IS NOT NULL THEN
    -- quote_date suele ser DATE (sin hora); usar tal cual
    v_fecha := NEW.quote_date::date;
  ELSE
    v_fecha := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
  END IF;

  INSERT INTO public.entregas_programadas (quote_id, fecha_venta)
  VALUES (NEW.id, v_fecha)
  ON CONFLICT (quote_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_venta_to_entrega ON public.quotes;
CREATE TRIGGER trg_quote_venta_to_entrega
  AFTER INSERT OR UPDATE OF status, payment_confirmed_at, quote_date
  ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_quote_venta_to_entrega();

COMMENT ON FUNCTION public.fn_quote_venta_to_entrega() IS
  'Al pasar quotes.status a venta_concretada, upsert entregas_programadas (ON CONFLICT quote_id DO NOTHING). Fecha = payment_confirmed_at o quote_date en America/Mexico_City.';
