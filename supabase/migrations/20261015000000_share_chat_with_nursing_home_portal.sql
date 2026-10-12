-- Make "Chat with Home" talk to the SAME tables the Nursing Home portal uses.
--
-- The Nursing Home portal has always stored its messaging in
-- public.chat_threads (one row per thread) and public.portal_messages (one row
-- per message). The earlier chat_with_home migration created a parallel, empty
-- pair (public.conversations / public.messages), which is why the two portals
-- could each send happily and never see the other's messages.
--
-- This migration does NOT create or restructure the home portal's tables. It
-- only: grants table access, makes sure row level security lets a signed-in
-- pharmacy user read/write (the policies stay inert while RLS is disabled),
-- adds the tables to the realtime publication, and back-fills the home link on
-- threads that were stored without one. Every statement is idempotent.

-- ---------------------------------------------------------------------------
-- Privileges. RLS decides *which rows* are visible; grants decide whether the
-- role may touch the table at all. Without them PostgREST returns 403.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select on public.chat_threads, public.portal_messages, public.pharmacies
  to authenticated;

grant insert, update on public.chat_threads, public.portal_messages
  to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security policies.
--
-- These are written permissively (any signed-in portal user) so behaviour is
-- unchanged where RLS is already disabled — a policy on a table with RLS off is
-- simply ignored. If RLS is switched on later, they keep both portals working
-- rather than locking the pharmacy out.
-- ---------------------------------------------------------------------------
drop policy if exists chat_threads_read on public.chat_threads;
create policy chat_threads_read on public.chat_threads
  for select to authenticated using (true);

drop policy if exists chat_threads_write on public.chat_threads;
create policy chat_threads_write on public.chat_threads
  for all to authenticated using (true) with check (true);

drop policy if exists portal_messages_read on public.portal_messages;
create policy portal_messages_read on public.portal_messages
  for select to authenticated using (true);

drop policy if exists portal_messages_write on public.portal_messages;
create policy portal_messages_write on public.portal_messages
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Indexes that keep both portals fast as the tables grow.
-- ---------------------------------------------------------------------------
create index if not exists chat_threads_home_last_idx
  on public.chat_threads (home_id, last_message_at desc);
create index if not exists portal_messages_thread_created_idx
  on public.portal_messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Back-fill the home link.
--
-- Threads written by the home portal were stored with home_id = null, so the
-- pharmacy could not group them under a nursing home. Resolve the home from the
-- participants' profiles: first from whoever replied on the home side, then
-- from whoever created the thread.
-- ---------------------------------------------------------------------------
update public.chat_threads t
   set home_id = s.home_id
  from (
    select m.thread_id,
           (array_agg(p.home_id) filter (where p.home_id is not null))[1] as home_id
      from public.portal_messages m
      join public.profiles p on p.id = m.user_id
     where m.sender_role = 'home'
     group by m.thread_id
  ) s
 where t.id = s.thread_id
   and t.home_id is null
   and s.home_id is not null;

update public.chat_threads t
   set home_id = p.home_id
  from public.profiles p
 where t.home_id is null
   and p.id = t.created_by
   and p.home_id is not null;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast inserts/updates so both portals stay in sync.
-- ---------------------------------------------------------------------------
alter table public.chat_threads replica identity full;
alter table public.portal_messages replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.chat_threads;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.portal_messages;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The abandoned pair from the earlier migration. Nothing reads or writes these
-- any more; drop them once both portals are confirmed working:
--
--   drop table if exists public.messages;
--   drop table if exists public.conversations;
-- ---------------------------------------------------------------------------
