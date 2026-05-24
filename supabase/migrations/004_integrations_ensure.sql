-- Ensure integrations table exists (safe to re-run)
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  service_name text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (team_id, service_name)
);

alter table public.integrations enable row level security;

drop policy if exists "integrations_select_owner" on public.integrations;
create policy "integrations_select_owner"
  on public.integrations for select
  using (
    exists (
      select 1 from public.team_members
      where team_id = integrations.team_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );
