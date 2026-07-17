-- Bitácora comercial: permitir seguimientos ligados a cliente (además de prospecto).
-- Ejecutar en Supabase si follow_ups aún no tiene client_id.

alter table public.follow_ups
  add column if not exists client_id uuid references public.clients(id) on delete set null;

-- En esquemas viejos prospect_id puede ser NOT NULL; hacerlo nullable para visitas a clientes.
do $$
begin
  alter table public.follow_ups alter column prospect_id drop not null;
exception
  when others then null;
end $$;

create index if not exists follow_ups_client_id_idx on public.follow_ups (client_id);
create index if not exists follow_ups_prospect_id_idx on public.follow_ups (prospect_id);
