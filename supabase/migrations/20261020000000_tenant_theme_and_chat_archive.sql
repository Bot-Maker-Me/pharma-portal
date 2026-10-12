-- Pharmacy themes + archiving conversations.
--
-- Two columns, both additive and safe to apply to the shared project the Nursing
-- Home portal uses:
--
--   tenants.theme            Which brand a pharmacy runs under. The app resolves
--                            the key in lib/tenant/theme.ts and re-points its
--                            design tokens in app/globals.css (`.theme-<key>`), so
--                            a branded pharmacy gets its own palette on every
--                            screen it opens while every other pharmacy keeps the
--                            default one.
--
--   chat_threads.archived_at When the pharmacy filed a thread away. NULL means it
--                            sits in the inbox. Archiving never deletes anything:
--                            the messages stay, and the nursing home side keeps
--                            seeing the conversation.
--
-- Every statement is idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- Theme
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists theme text not null default 'default';

comment on column public.tenants.theme is
  'Brand key resolved in lib/tenant/theme.ts; app/globals.css holds the `.theme-<key>` tokens. ''default'' keeps the standard palette.';

-- ---------------------------------------------------------------------------
-- Archive flag on conversations
-- ---------------------------------------------------------------------------
alter table public.chat_threads
  add column if not exists archived_at timestamptz;

comment on column public.chat_threads.archived_at is
  'When the pharmacy archived the thread; NULL = in the inbox. Archiving never deletes messages.';

-- The inbox reads unarchived threads newest-first; the archived section reads the
-- opposite direction. One index serves both.
create index if not exists chat_threads_archived_last_idx
  on public.chat_threads (archived_at, last_message_at desc);
