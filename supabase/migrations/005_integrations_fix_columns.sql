-- Run this if Google connect fails with:
-- "Could not find the 'metadata' column of 'integrations' in the schema cache"
--
-- Your integrations table likely existed before migration 002; CREATE TABLE IF NOT EXISTS
-- does not add missing columns to an old table.

alter table public.integrations add column if not exists service_name text;
alter table public.integrations add column if not exists access_token text;
alter table public.integrations add column if not exists refresh_token text;
alter table public.integrations add column if not exists token_expires_at timestamptz;
alter table public.integrations add column if not exists is_active boolean default true;
alter table public.integrations add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.integrations add column if not exists created_at timestamptz default now();
alter table public.integrations add column if not exists updated_at timestamptz default now();

-- Backfill metadata for existing rows
update public.integrations set metadata = '{}'::jsonb where metadata is null;
update public.integrations set is_active = true where is_active is null;

-- Upsert key used by the API
create unique index if not exists integrations_team_id_service_name_key
  on public.integrations (team_id, service_name);

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

drop policy if exists "integrations_insert_owner" on public.integrations;
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

drop policy if exists "integrations_update_owner" on public.integrations;
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

drop policy if exists "integrations_delete_owner" on public.integrations;
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
