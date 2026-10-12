-- Chat with Home — the shared messaging backend used by BOTH the Nursing Home Portal
-- and the Pharma Portal. Both apps read and write these exact tables, so a conversation
-- started in one portal is instantly visible in the other.
--
-- Apply this migration to the shared Supabase project that the Nursing Home Portal uses.
-- Every statement is idempotent so it is safe to run against an existing project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Nursing homes
-- ---------------------------------------------------------------------------
create table if not exists public.homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles: links an auth user to a display name and which side they sit on.
-- 'pharmacy' users live in the Pharma Portal, 'home' users live in the Nursing Home Portal.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Team member',
  role text not null default 'pharmacy',
  organization text,
  home_id uuid references public.homes(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Defensive: if a profiles table already existed without our columns, add them.
alter table public.profiles add column if not exists full_name text not null default 'Team member';
alter table public.profiles add column if not exists role text not null default 'pharmacy';
alter table public.profiles add column if not exists organization text;
alter table public.profiles add column if not exists home_id uuid references public.homes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Authorization: which pharmacy users are allowed to serve which homes.
-- This is what keeps a pharmacy user scoped to their own homes.
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_home_access (
  pharmacy_user_id uuid not null references auth.users(id) on delete cascade,
  home_id uuid not null references public.homes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pharmacy_user_id, home_id)
);

-- ---------------------------------------------------------------------------
-- Conversations: one thread between a home and the pharmacy team.
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  title text,
  last_message_body text,
  last_message_sender_name text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_home_idx on public.conversations (home_id, last_message_at desc);

-- ---------------------------------------------------------------------------
-- Messages. Residents are referenced by ID only — never a full name.
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default 'Team member',
  body text not null check (char_length(body) between 1 and 4000),
  urgency text not null default 'routine',
  resident_id text,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Read receipts: the last time each participant opened a conversation.
-- A sent message counts as "read" once another participant's last_read_at passes it.
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so they can be used inside RLS without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.pharmacy_has_home(target_home uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pharmacy_home_access a
    where a.home_id = target_home and a.pharmacy_user_id = (select auth.uid())
  );
$$;

create or replace function public.user_home_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.home_id from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.can_access_home(target_home uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.pharmacy_has_home(target_home) or public.user_home_id() = target_home;
$$;

create or replace function public.can_access_conversation(conv uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and public.can_access_home(c.home_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Keep conversation previews fresh whenever a message lands.
-- ---------------------------------------------------------------------------
create or replace function public.touch_conversation_on_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations
     set last_message_body = new.body,
         last_message_sender_name = new.sender_name,
         last_message_at = new.created_at,
         updated_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_on_message();

-- ---------------------------------------------------------------------------
-- Conversation summaries for the left-hand list: preview text, unread count and
-- whether anything urgent is still unread. Runs as the caller so RLS still applies.
-- ---------------------------------------------------------------------------
create or replace function public.chat_conversation_summaries()
returns table (
  conversation_id uuid,
  home_id uuid,
  home_name text,
  last_message_body text,
  last_message_sender_name text,
  last_message_at timestamptz,
  unread_count bigint,
  has_urgent boolean
)
language sql stable security invoker set search_path = '' as $$
  select
    c.id,
    c.home_id,
    h.name,
    c.last_message_body,
    c.last_message_sender_name,
    c.last_message_at,
    coalesce((
      select count(*) from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> (select auth.uid())
        and m.created_at > coalesce(
          (select r.last_read_at from public.conversation_reads r
            where r.conversation_id = c.id and r.user_id = (select auth.uid())),
          'epoch'::timestamptz)
    ), 0)::bigint as unread_count,
    exists (
      select 1 from public.messages m
      where m.conversation_id = c.id
        and m.urgency in ('urgent', 'emergency')
        and m.sender_id <> (select auth.uid())
        and m.created_at > coalesce(
          (select r.last_read_at from public.conversation_reads r
            where r.conversation_id = c.id and r.user_id = (select auth.uid())),
          'epoch'::timestamptz)
    ) as has_urgent
  from public.conversations c
  join public.homes h on h.id = c.home_id
  order by c.last_message_at desc;
$$;

grant execute on function public.chat_conversation_summaries() to authenticated;
grant execute on function public.can_access_home(uuid) to authenticated;
grant execute on function public.can_access_conversation(uuid) to authenticated;
grant execute on function public.pharmacy_has_home(uuid) to authenticated;
grant execute on function public.user_home_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.homes enable row level security;
alter table public.profiles enable row level security;
alter table public.pharmacy_home_access enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;

-- Homes: only homes you serve (pharmacy) or belong to (home).
drop policy if exists homes_access_read on public.homes;
create policy homes_access_read on public.homes
  for select to authenticated using (public.can_access_home(id));

-- Profiles: read and maintain your own.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Access grants: a pharmacy user can see their own assignments.
drop policy if exists pharmacy_access_read on public.pharmacy_home_access;
create policy pharmacy_access_read on public.pharmacy_home_access
  for select to authenticated using (pharmacy_user_id = (select auth.uid()));

-- Conversations: visible to anyone who can access the home.
drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations
  for select to authenticated using (public.can_access_home(home_id));

-- Only pharmacy users with a grant may start a conversation.
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated with check (public.pharmacy_has_home(home_id));

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using (public.can_access_home(home_id))
  with check (public.can_access_home(home_id));

-- Messages: readable/writable by participants of the conversation.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select to authenticated using (public.can_access_conversation(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.can_access_conversation(conversation_id));

-- Read receipts: only your own row, only in conversations you can access.
drop policy if exists reads_read on public.conversation_reads;
create policy reads_read on public.conversation_reads
  for select to authenticated using (public.can_access_conversation(conversation_id));

drop policy if exists reads_write on public.conversation_reads;
create policy reads_write on public.conversation_reads
  for all to authenticated
  using (user_id = (select auth.uid()) and public.can_access_conversation(conversation_id))
  with check (user_id = (select auth.uid()) and public.can_access_conversation(conversation_id));

-- ---------------------------------------------------------------------------
-- Realtime: broadcast inserts/updates so both portals stay in sync.
-- ---------------------------------------------------------------------------
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
alter table public.conversation_reads replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.conversations;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.conversation_reads;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
