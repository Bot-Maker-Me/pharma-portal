-- Chat with Home — the shared messaging backend used by BOTH the Nursing Home Portal
-- and the Pharma Portal. Both apps read and write these exact tables, so a conversation
-- started in one portal is instantly visible in the other.
--
-- Every statement is idempotent and defensive: it is safe to re-run, and it will add
-- any missing columns if these tables already existed in your project.

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
-- 'pharmacy' users live in the Pharma Portal, 'home' users in the Nursing Home Portal.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Team member',
  role text not null default 'pharmacy',
  organization text,
  home_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Authorization: which pharmacy users are allowed to serve which homes.
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
  home_id uuid,
  title text,
  last_message_body text,
  last_message_sender_name text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Messages. Residents are referenced by ID only — never a full name.
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  urgency text,
  resident_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Read receipts: the last time each participant opened a conversation.
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_reads (
  conversation_id uuid,
  user_id uuid,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Defensive: if these tables already existed (e.g. from the Nursing Home Portal)
-- make sure every column the chat feature uses is present.
-- ---------------------------------------------------------------------------
alter table public.homes add column if not exists name text;
alter table public.homes add column if not exists address text;
alter table public.homes add column if not exists created_at timestamptz not null default now();

alter table public.profiles add column if not exists full_name text not null default 'Team member';
alter table public.profiles add column if not exists role text not null default 'pharmacy';
alter table public.profiles add column if not exists organization text;
alter table public.profiles add column if not exists home_id uuid;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

alter table public.conversations add column if not exists home_id uuid;
alter table public.conversations add column if not exists title text;
alter table public.conversations add column if not exists last_message_body text;
alter table public.conversations add column if not exists last_message_sender_name text;
alter table public.conversations add column if not exists last_message_at timestamptz;
alter table public.conversations add column if not exists created_at timestamptz not null default now();
alter table public.conversations add column if not exists updated_at timestamptz not null default now();

alter table public.messages add column if not exists conversation_id uuid;
alter table public.messages add column if not exists sender_id uuid;
alter table public.messages add column if not exists sender_name text;
alter table public.messages add column if not exists body text;
alter table public.messages add column if not exists urgency text;
alter table public.messages add column if not exists resident_id text;
alter table public.messages add column if not exists created_at timestamptz not null default now();

alter table public.conversation_reads add column if not exists last_read_at timestamptz not null default now();

create index if not exists conversations_home_idx on public.conversations (home_id, created_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_created_idx on public.messages (created_at desc);

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
-- Keep the denormalised preview fresh whenever a message lands.
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
-- Remove the earlier summary helper — the apps now read the tables directly,
-- so there is one less thing to grant.
-- ---------------------------------------------------------------------------
drop function if exists public.chat_conversation_summaries();

-- ---------------------------------------------------------------------------
-- Privileges. RLS decides *which rows* are visible; these grants decide whether
-- the role may touch the table at all. Without them PostgREST returns 403.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.homes, public.profiles, public.pharmacy_home_access,
                 public.conversations, public.messages, public.conversation_reads
  to authenticated;

grant insert, update on public.profiles, public.conversations,
                        public.messages, public.conversation_reads
  to authenticated;

grant execute on function public.pharmacy_has_home(uuid) to anon, authenticated;
grant execute on function public.user_home_id() to anon, authenticated;
grant execute on function public.can_access_home(uuid) to anon, authenticated;
grant execute on function public.can_access_conversation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.homes enable row level security;
alter table public.profiles enable row level security;
alter table public.pharmacy_home_access enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;

drop policy if exists homes_access_read on public.homes;
create policy homes_access_read on public.homes
  for select to authenticated using (public.can_access_home(id));

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists pharmacy_access_read on public.pharmacy_home_access;
create policy pharmacy_access_read on public.pharmacy_home_access
  for select to authenticated using (pharmacy_user_id = (select auth.uid()));

drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations
  for select to authenticated using (public.can_access_home(home_id));

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated with check (public.pharmacy_has_home(home_id));

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using (public.can_access_home(home_id))
  with check (public.can_access_home(home_id));

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select to authenticated using (public.can_access_conversation(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.can_access_conversation(conversation_id));

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
