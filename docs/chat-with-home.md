# Chat with Home

Secure messaging between a pharmacy (Pharma Portal) and the nursing homes it serves
(Nursing Home Portal). **Both portals read and write the same Supabase tables**, so a
message sent in one appears instantly in the other.

## Shared tables

Defined in `supabase/migrations/20261001000000_chat_with_home.sql`. The migration is
idempotent — safe to apply to the existing Nursing Home Portal project.

| Table | Purpose |
| --- | --- |
| `homes` | Nursing homes. |
| `profiles` | `id → full_name`, `role` (`pharmacy` \| `home`), `organization`, `home_id`. |
| `pharmacy_home_access` | Which pharmacy users may serve which homes. **This is the scoping rule.** |
| `conversations` | One thread per home, with a denormalised last-message preview. |
| `messages` | `body`, `urgency`, optional `resident_id`, `sender_name`, `created_at`. |
| `conversation_reads` | `(conversation_id, user_id) → last_read_at` — powers read receipts + unread counts. |

Helpers: `can_access_home()`, `can_access_conversation()`, `pharmacy_has_home()`,
`user_home_id()`.

Realtime is enabled on `messages`, `conversations` and `conversation_reads`.

The Pharma Portal reads these tables **directly** — no database functions/RPCs — so it
only needs `SELECT`/`INSERT` grants plus the RLS policies. If the tables already existed
(they do in the Nursing Home Portal project) the migration adds any missing columns.

## Dates and archiving

- Day dividers spell the date out (`Today · Sat, Oct 12, 2026`) — see `formatDayLabel`
  in `lib/chat/format.ts`. Each bubble shows the time and carries the full timestamp
  in its `title` attribute.
- The archive button on a conversation row sets `chat_threads.archived_at` (migration
  `20261020000000_tenant_theme_and_chat_archive.sql`). It is never a delete: the
  nursing home keeps the thread, and the pharmacy can restore it from the *Archived*
  section at the bottom of the conversation list.

## Per-pharmacy themes

`public.tenants.theme` holds one brand key per pharmacy. `lib/tenant/theme.ts` resolves
it and the shell of every screen that pharmacy opens carries `.theme-<key>`, whose
design-token overrides live in `app/globals.css` (`.theme-pharmasave`). The Tailwind
colour utilities read those variables at use time, so a branded pharmacy gets its own
palette in the workspace, Chat with Home and the admin console — and no other pharmacy
is affected. Set it in Admin console → Pharmacies, or seed it in one go with
`supabase/add-pharmasave-west-hills.sql`.

Without Supabase credentials the app runs as the preview pharmacy — **Pharmasave West
Hills** (`lib/tenant/preview.ts`), with its sample workspace in
`lib/workspace/preview.ts` — so `/workspace` and `/chat` open as that branded pharmacy
instead of an empty setup screen. Live mode always reads the real tenant row instead.

## Access model

- A **pharmacy user** sees a home only if a `pharmacy_home_access` row exists for them.
- A **home user** sees a home when their `profiles.home_id` matches it.
- Only pharmacy users with a grant may create a conversation (`conversations_insert`).
- Both sides may read and post messages in conversations they can access.

## Going live

The Pharma Portal reads its Supabase credentials from the environment. Add the values
from the **existing Nursing Home Portal project**:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Until these are set, `Chat with Home` runs on sample data and shows a *Preview mode*
banner. No code change is needed to switch over.

## Nursing Home portal

No changes are required for the pharmacy login and existing chat to keep working. To
use this shared backend, the Nursing Home portal should:

1. Point at the same Supabase project.
2. Read/write the tables above (same column names).
3. Optionally subscribe to `messages` / `conversation_reads` via Realtime.
4. Set `profiles.home_id` for home users so the RLS policies resolve their home.

## Code map (Pharma Portal)

| Path | Role |
| --- | --- |
| `app/chat/page.tsx` | Route; server-side auth gate (redirects signed-out users). |
| `components/chat/chat-experience.tsx` | Two-pane shell + responsive behaviour. |
| `components/chat/conversation-list.tsx` | Left panel: homes + unread/urgent badges. |
| `components/chat/message-thread.tsx` | Right panel: thread, priority flags, read receipts. |
| `components/chat/message-composer.tsx` | Priority selector + resident ID reference. |
| `lib/chat/use-chat.ts` | All state: list, thread, realtime, sends, archiving. |
| `lib/tenant/theme.ts` | Per-pharmacy theme registry (`default`, `pharmasave`). |
| `lib/tenant/server.ts` | Server-side tenant name + theme lookup. |
| `lib/chat/supabase-backend.ts` | Live backend (shared tables). |
| `lib/chat/preview-backend.ts` | Sample-data backend used only when unconfigured. |

If the Nursing Home Portal already uses different table or column names, only
`lib/chat/supabase-backend.ts` needs to be remapped.
