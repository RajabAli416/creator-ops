-- Team chat: general room + direct messages + per-member general chat permissions
-- Order: tables first, then functions that reference them, then RLS.

-- Rooms (one general room per team; many direct rooms)
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  type text not null check (type in ('general', 'direct')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists chat_rooms_one_general_per_team
  on public.chat_rooms(team_id) where type = 'general';

create index if not exists chat_rooms_team_id_idx on public.chat_rooms(team_id);

-- Direct message participants (general room has no rows here)
create table if not exists public.chat_room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists chat_room_participants_room_id_idx on public.chat_room_participants(room_id);
create index if not exists chat_room_participants_user_id_idx on public.chat_room_participants(user_id);

-- Per-member general chat permission (owner/manager always allowed via helper)
create table if not exists public.team_member_chat_permissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  general_chat_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists team_member_chat_permissions_team_id_idx
  on public.team_member_chat_permissions(team_id);

-- Messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_id_created_at_idx
  on public.chat_messages(room_id, created_at desc);
create index if not exists chat_messages_team_id_idx on public.chat_messages(team_id);

-- Helpers (after tables exist)
create or replace function public.is_team_privileged(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.can_use_general_chat(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_team_privileged(p_team_id)
    or coalesce(
      (
        select p.general_chat_enabled
        from public.team_member_chat_permissions p
        where p.team_id = p_team_id and p.user_id = auth.uid()
      ),
      true
    );
$$;

create or replace function public.is_chat_room_participant(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_room_participants
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

-- Ensure each team has a general room (backfill existing teams)
insert into public.chat_rooms (team_id, type)
select t.id, 'general'
from public.teams t
where not exists (
  select 1 from public.chat_rooms r
  where r.team_id = t.id and r.type = 'general'
);

-- Auto-create general room for new teams
create or replace function public.ensure_team_general_chat_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.chat_rooms
    where team_id = new.id and type = 'general'
  ) then
    insert into public.chat_rooms (team_id, type)
    values (new.id, 'general');
  end if;
  return new;
end;
$$;

drop trigger if exists on_team_created_general_chat on public.teams;
create trigger on_team_created_general_chat
  after insert on public.teams
  for each row execute function public.ensure_team_general_chat_room();

-- RLS
alter table public.chat_rooms enable row level security;
alter table public.chat_room_participants enable row level security;
alter table public.team_member_chat_permissions enable row level security;
alter table public.chat_messages enable row level security;

-- chat_rooms
drop policy if exists "chat_rooms_select" on public.chat_rooms;
create policy "chat_rooms_select" on public.chat_rooms
  for select using (
    public.is_team_member(team_id)
    and (
      type = 'general'
      or public.is_team_privileged(team_id)
      or public.is_chat_room_participant(id)
    )
  );

drop policy if exists "chat_rooms_insert_direct" on public.chat_rooms;
create policy "chat_rooms_insert_direct" on public.chat_rooms
  for insert with check (
    type = 'direct'
    and public.is_team_privileged(team_id)
    and auth.uid() = created_by
  );

-- chat_room_participants
drop policy if exists "chat_room_participants_select" on public.chat_room_participants;
create policy "chat_room_participants_select" on public.chat_room_participants
  for select using (
    exists (
      select 1 from public.chat_rooms r
      where r.id = room_id and public.is_team_member(r.team_id)
    )
  );

drop policy if exists "chat_room_participants_insert" on public.chat_room_participants;
create policy "chat_room_participants_insert" on public.chat_room_participants
  for insert with check (
    exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and r.type = 'direct'
        and public.is_team_privileged(r.team_id)
    )
  );

-- team_member_chat_permissions
drop policy if exists "chat_permissions_select" on public.team_member_chat_permissions;
create policy "chat_permissions_select" on public.team_member_chat_permissions
  for select using (public.is_team_member(team_id));

drop policy if exists "chat_permissions_insert" on public.team_member_chat_permissions;
create policy "chat_permissions_insert" on public.team_member_chat_permissions
  for insert with check (public.is_team_privileged(team_id));

drop policy if exists "chat_permissions_update" on public.team_member_chat_permissions;
create policy "chat_permissions_update" on public.team_member_chat_permissions
  for update using (public.is_team_privileged(team_id));

-- chat_messages
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages
  for select using (
    public.is_team_member(team_id)
    and exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and (
          r.type = 'general'
          or public.is_team_privileged(team_id)
          or public.is_chat_room_participant(r.id)
        )
    )
  );

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_team_member(team_id)
    and exists (
      select 1 from public.chat_rooms r
      where r.id = room_id
        and r.team_id = team_id
        and (
          (r.type = 'general' and public.can_use_general_chat(team_id))
          or (
            r.type = 'direct'
            and (
              public.is_team_privileged(team_id)
              or public.is_chat_room_participant(r.id)
            )
          )
        )
    )
  );

-- Realtime
alter table public.chat_messages replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_messages'
    ) then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
  end if;
end $$;
