-- Caja mostrador (paridad portal-staff / UI actual)
-- Ejecutar en Supabase si las tablas aún no existen.

create table if not exists public.caja_sesiones (
  id uuid primary key default gen_random_uuid(),
  sucursal text not null,
  numero_caja text not null default '1',
  fecha_apertura timestamptz not null default now(),
  fecha_cierre timestamptz,
  monto_inicial numeric(12,2) not null default 0,
  fondo_inicial numeric(12,2),
  monto_final_esperado numeric(12,2),
  monto_final_real numeric(12,2),
  diferencia numeric(12,2),
  denominaciones_apertura jsonb,
  denominaciones_cierre jsonb,
  abierto_por uuid not null references public.staff_users(id),
  cerrado_por uuid references public.staff_users(id),
  user_id uuid references public.staff_users(id),
  estado text not null default 'abierta',
  notas_cierre text,
  created_at timestamptz not null default now()
);

create unique index if not exists caja_sesiones_open_user_caja_unique
  on public.caja_sesiones (abierto_por, numero_caja)
  where estado = 'abierta' and fecha_cierre is null;

create table if not exists public.caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.caja_sesiones(id) on delete cascade,
  tipo text not null,
  monto numeric(12,2) not null,
  descripcion text,
  concepto text,
  metodo_pago text,
  quote_id uuid references public.quotes(id) on delete set null,
  creado_por uuid references public.staff_users(id),
  created_by uuid references public.staff_users(id),
  fecha_movimiento timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists caja_movimientos_sesion_idx on public.caja_movimientos (sesion_id);

alter table public.caja_sesiones enable row level security;
alter table public.caja_movimientos enable row level security;
