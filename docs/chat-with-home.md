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
| `lib/chat/use-chat.ts` | All state: list, thread, realtime, sends. |
| `lib/chat/supabase-backend.ts` | Live backend (shared tables). |
| `lib/chat/preview-backend.ts` | Sample-data backend used only when unconfigured. |

If the Nursing Home Portal already uses different table or column names, only
`lib/chat/supabase-backend.ts` needs to be remapped.
