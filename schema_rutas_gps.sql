-- ============================================================
-- Rutas GPS — coordenadas en entregas programadas
-- Ejecutar en Supabase SQL Editor (una sola vez).
-- ============================================================

ALTER TABLE public.entregas_programadas
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.entregas_programadas.lat IS 'Latitud geocodificada de la dirección de entrega';
COMMENT ON COLUMN public.entregas_programadas.lng IS 'Longitud geocodificada de la dirección de entrega';
