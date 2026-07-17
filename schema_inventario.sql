-- ============================================================
-- Inventario de productos — Portal RH GCA
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'pza',
  stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(12, 2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad NUMERIC(12, 2) NOT NULL CHECK (cantidad > 0),
  stock_antes NUMERIC(12, 2) NOT NULL,
  stock_despues NUMERIC(12, 2) NOT NULL,
  referencia TEXT,
  notas TEXT,
  creado_por UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_producto ON public.inventario_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_created ON public.inventario_movimientos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON public.productos(activo);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_access_productos" ON public.productos;
CREATE POLICY "portal_access_productos" ON public.productos
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

DROP POLICY IF EXISTS "portal_access_inv_mov" ON public.inventario_movimientos;
CREATE POLICY "portal_access_inv_mov" ON public.inventario_movimientos
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

-- Entrada / salida / ajuste atómico
CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(
  p_producto_id UUID,
  p_tipo TEXT,
  p_cantidad NUMERIC,
  p_referencia TEXT DEFAULT NULL,
  p_notas TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS public.inventario_movimientos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock NUMERIC(12, 2);
  v_despues NUMERIC(12, 2);
  v_row public.inventario_movimientos;
BEGIN
  IF p_tipo NOT IN ('entrada', 'salida', 'ajuste') THEN
    RAISE EXCEPTION 'Tipo inválido';
  END IF;
  IF p_tipo = 'ajuste' THEN
    IF p_cantidad IS NULL OR p_cantidad < 0 THEN
      RAISE EXCEPTION 'Cantidad de ajuste debe ser >= 0';
    END IF;
  ELSIF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad debe ser > 0';
  END IF;

  SELECT stock INTO v_stock FROM public.productos WHERE id = p_producto_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF p_tipo = 'entrada' THEN
    v_despues := v_stock + p_cantidad;
  ELSIF p_tipo = 'salida' THEN
    IF v_stock < p_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente (disponible: %)', v_stock;
    END IF;
    v_despues := v_stock - p_cantidad;
  ELSE
    -- ajuste: cantidad = nuevo stock absoluto
    v_despues := p_cantidad;
  END IF;

  UPDATE public.productos
  SET stock = v_despues, updated_at = NOW()
  WHERE id = p_producto_id;

  INSERT INTO public.inventario_movimientos (
    producto_id, tipo, cantidad, stock_antes, stock_despues, referencia, notas, creado_por
  ) VALUES (
    p_producto_id,
    p_tipo,
    CASE
      WHEN p_tipo = 'ajuste' THEN GREATEST(ABS(v_despues - v_stock), 0.0001)
      ELSE p_cantidad
    END,
    v_stock,
    v_despues,
    p_referencia,
    p_notas,
    p_user_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_movimiento_inventario TO authenticated;
