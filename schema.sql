-- ============================================================
-- Portal RH — Schema de base de datos
-- IMPORTANTE: Ejecutar en DOS pasos separados en Supabase SQL Editor
-- PASO 1: Ejecutar SOLO la línea ALTER TYPE de abajo y esperar confirmación.
-- PASO 2: Ejecutar el resto del archivo (desde "2. Empleados" hasta el final).
-- ============================================================

-- *** PASO 1 — Ejecutar esto solo y confirmar antes de continuar ***
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'rh';
-- *** FIN PASO 1 ***

-- ============================================================
-- 2. Empleados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  puesto TEXT NOT NULL DEFAULT 'Operador',
  sueldo_base_semanal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. Periodos de nómina (siempre viernes → jueves)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.periodos_nomina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_inicio DATE NOT NULL, -- viernes
  fecha_fin DATE NOT NULL,    -- jueves siguiente
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  creado_por UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  cerrado_por UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT periodos_nomina_fechas_unicas UNIQUE (fecha_inicio, fecha_fin)
);

-- ============================================================
-- 4. Bitácora de embarques (vueltas / fletes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bitacora_embarques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES public.periodos_nomina(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo_unidad TEXT NOT NULL CHECK (tipo_unidad IN ('freightliner', 'isuzu', 'ford')),
  operador_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
  ayudante1_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  ayudante2_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  -- importes calculados y guardados para auditoría
  importe_operador NUMERIC(10, 2) NOT NULL DEFAULT 0,
  importe_ayudante1 NUMERIC(10, 2) NOT NULL DEFAULT 0,
  importe_ayudante2 NUMERIC(10, 2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. Bonos — Doblado de varilla
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bonos_doblado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES public.periodos_nomina(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  toneladas INTEGER NOT NULL DEFAULT 0 CHECK (toneladas >= 0), -- enteros, sin medias
  importe NUMERIC(10, 2) NOT NULL DEFAULT 0, -- toneladas * 30
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. Bonos — Enderezado de varilla
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bonos_enderezado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES public.periodos_nomina(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  kilos NUMERIC(10, 2) NOT NULL DEFAULT 0,
  califica BOOLEAN NOT NULL DEFAULT false, -- true si kilos > 330
  importe NUMERIC(10, 2) NOT NULL DEFAULT 0, -- 50 si califica, 0 si no
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. Bonos — Anillos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bonos_anillos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES public.periodos_nomina(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  kilos NUMERIC(10, 2) NOT NULL DEFAULT 0,
  importe NUMERIC(10, 2) NOT NULL DEFAULT 0, -- kilos * 0.50
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. Bonos — Descargas de vehículo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bonos_descargas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES public.periodos_nomina(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  tipo_vehiculo TEXT NOT NULL CHECK (tipo_vehiculo IN ('trailer', 'rabon', 'camioneta')),
  importe NUMERIC(10, 2) NOT NULL DEFAULT 0, -- 25/20/15 según tipo
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. Producción extra / observaciones generales por día
-- ============================================================
CREATE TABLE IF NOT EXISTS public.produccion_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES public.periodos_nomina(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  importe NUMERIC(10, 2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. Índices de performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bitacora_periodo ON public.bitacora_embarques(periodo_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON public.bitacora_embarques(fecha);
CREATE INDEX IF NOT EXISTS idx_bonos_doblado_periodo ON public.bonos_doblado(periodo_id, fecha);
CREATE INDEX IF NOT EXISTS idx_bonos_enderezado_periodo ON public.bonos_enderezado(periodo_id, fecha);
CREATE INDEX IF NOT EXISTS idx_bonos_anillos_periodo ON public.bonos_anillos(periodo_id, fecha);
CREATE INDEX IF NOT EXISTS idx_bonos_descargas_periodo ON public.bonos_descargas(periodo_id, fecha);
CREATE INDEX IF NOT EXISTS idx_produccion_extra_periodo ON public.produccion_extra(periodo_id, fecha);

-- ============================================================
-- 11. RLS — Habilitar Row Level Security
-- ============================================================
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_nomina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitacora_embarques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonos_doblado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonos_enderezado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonos_anillos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonos_descargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produccion_extra ENABLE ROW LEVEL SECURITY;

-- Políticas: solo usuarios con rol 'rh' o 'admin' en staff_users
CREATE POLICY "rh_access_empleados" ON public.empleados
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

CREATE POLICY "rh_access_periodos" ON public.periodos_nomina
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

CREATE POLICY "rh_access_bitacora" ON public.bitacora_embarques
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

CREATE POLICY "rh_access_bonos_doblado" ON public.bonos_doblado
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

CREATE POLICY "rh_access_bonos_enderezado" ON public.bonos_enderezado
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

CREATE POLICY "rh_access_bonos_anillos" ON public.bonos_anillos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

CREATE POLICY "rh_access_bonos_descargas" ON public.bonos_descargas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin')
        AND su.is_active = true
    )
  );

CREATE POLICY "rh_access_produccion_extra" ON public.produccion_extra
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users su
      WHERE su.id = auth.uid()
        AND su.role IN ('rh', 'admin')
        AND su.is_active = true
    )
  );
