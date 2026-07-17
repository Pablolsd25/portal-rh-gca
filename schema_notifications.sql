-- Notificaciones (paridad portal-staff). Ejecutar si la tabla no existe.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general',
  related_id uuid,
  related_type text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Habilitar realtime en el dashboard de Supabase para la tabla notifications.
