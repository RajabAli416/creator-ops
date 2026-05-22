-- Google OAuth credentials per workspace (owner configures their Google Cloud project)
create table if not exists public.team_google_config (
  team_id uuid primary key references public.teams(id) on delete cascade,
  client_id text not null,
  client_secret text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.team_google_config enable row level security;

create policy "team_google_config_select_owner"
  on public.team_google_config for select
  using (
    exists (
      select 1 from public.team_members
      where team_id = team_google_config.team_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

create policy "team_google_config_insert_owner"
  on public.team_google_config for insert
  with check (
    exists (
      select 1 from public.team_members
      where team_id = team_google_config.team_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

create policy "team_google_config_update_owner"
  on public.team_google_config for update
  using (
    exists (
      select 1 from public.team_members
      where team_id = team_google_config.team_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

create policy "team_google_config_delete_owner"
  on public.team_google_config for delete
  using (
    exists (
      select 1 from public.team_members
      where team_id = team_google_config.team_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- integrations table (if not already in your project)
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

-- Owners only: tokens must not be readable by other team members
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

create policy "integrations_insert_owner"
  on public.integrations for insert
  with check (
    exists (
      select 1 from public.team_members
      where team_id = integrations.team_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

create policy "integrations_update_owner"
  on public.integrations for update
  using (
    exists (
      select 1 from public.team_members
      where team_id = integrations.team_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

create policy "integrations_delete_owner"
  on public.integrations for delete
  using (
    exists (
      select 1 from public.team_members
      where team_id = integrations.team_id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );
