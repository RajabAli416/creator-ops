-- Run this in the Supabase SQL Editor after your tables exist.

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is member of team
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

-- PROFILES
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_team" on public.profiles
  for select using (
    exists (
      select 1 from public.team_members tm1
      join public.team_members tm2 on tm1.team_id = tm2.team_id
      where tm1.user_id = auth.uid() and tm2.user_id = profiles.id
    )
  );

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- TEAMS
alter table public.teams enable row level security;

create policy "teams_select_member" on public.teams
  for select using (public.is_team_member(id) or created_by = auth.uid());

create policy "teams_insert" on public.teams
  for insert with check (auth.uid() = created_by);

create policy "teams_update_member" on public.teams
  for update using (public.is_team_member(id));

create policy "teams_delete_owner" on public.teams
  for delete using (created_by = auth.uid());

-- TEAM MEMBERS
alter table public.team_members enable row level security;

create policy "team_members_select" on public.team_members
  for select using (public.is_team_member(team_id));

create policy "team_members_insert" on public.team_members
  for insert with check (
    auth.uid() = user_id
    or public.is_team_member(team_id)
  );

create policy "team_members_update" on public.team_members
  for update using (public.is_team_member(team_id));

create policy "team_members_delete" on public.team_members
  for delete using (public.is_team_member(team_id));

-- CONTENT ITEMS
alter table public.content_items enable row level security;

create policy "content_select" on public.content_items
  for select using (public.is_team_member(team_id));

create policy "content_insert" on public.content_items
  for insert with check (public.is_team_member(team_id) and auth.uid() = created_by);

create policy "content_update" on public.content_items
  for update using (public.is_team_member(team_id));

create policy "content_delete" on public.content_items
  for delete using (public.is_team_member(team_id));

-- TASKS
alter table public.tasks enable row level security;

create policy "tasks_select" on public.tasks
  for select using (public.is_team_member(team_id));

create policy "tasks_insert" on public.tasks
  for insert with check (public.is_team_member(team_id) and auth.uid() = created_by);

create policy "tasks_update" on public.tasks
  for update using (public.is_team_member(team_id));

create policy "tasks_delete" on public.tasks
  for delete using (public.is_team_member(team_id));

-- AUDIT LOGS
alter table public.audit_logs enable row level security;

create policy "audit_select" on public.audit_logs
  for select using (public.is_team_member(team_id));

create policy "audit_insert" on public.audit_logs
  for insert with check (public.is_team_member(team_id));

create policy "audit_delete" on public.audit_logs
  for delete using (public.is_team_member(team_id));

-- NOTIFICATIONS
alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications_insert" on public.notifications
  for insert with check (auth.uid() is not null);

create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

-- Allow authenticated users to look up teams by slug when joining (read slug only)
create policy "teams_select_by_slug_join" on public.teams
  for select using (auth.uid() is not null);
