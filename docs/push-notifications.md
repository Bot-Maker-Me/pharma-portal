# Push notifications (Chat with Home)

Two halves have to line up for a message to raise a notification. Only one of them
lives in this repo.

## Where each half lives

| Half | Lives in | Repo here? |
| --- | --- | --- |
| Service worker, Enable UI, subscription rows | this app | yes |
| `send-push` Edge Function + webhook on `portal_messages` | the **shared** Supabase project (the Nursing Home project both portals read) | copied in `supabase/functions/send-push` |

The shared project is the one in `NEXT_PUBLIC_SUPABASE_URL`. Everything server-side
sits next to `public.chat_threads` / `public.portal_messages`, so **one** `send-push`
serves both directions.

## Why the pharmacy got nothing (home → pharmacy)

`send-push` decided who to notify from `portal_messages.sender_role`. If it only
handled `'pharmacy'` (notify the home) it never *notified the pharmacy for a message
that came from the home* — the exact symptom: home users got alerts, pharmacy users
did not. The corrected `supabase/functions/send-push/index.ts` handles both:

- `sender_role = 'pharmacy'` → notify the home's users (`profiles.home_id`).
- `sender_role = 'home'` → notify the pharmacy users for that home (`pharmacy_home_access`).

## Client-side safety net (this app)

`components/push/message-notifier.tsx` (mounted in `app/layout.tsx`) also watches
`portal_messages` inserts over Realtime and raises a system notification for incoming
home messages when the portal is not the focused tab. It needs only notification
permission — not a stored subscription — so a device that never registered still gets
alerts while the portal is open. Server push and this path share one notification
`tag`, so they collapse into a single alert.

## Setup checklist

1. **This app** — set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the public key) locally and on the
   host. Never the private key.
2. **Shared Supabase project** — set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
   optionally `VAPID_SUBJECT` and `PUSH_WEBHOOK_SECRET` as Edge Function secrets.
3. **Shared Supabase project** — deploy `send-push` (copy `supabase/functions/send-push`).
4. **Shared Supabase project** — Database → Webhooks → **Create a new hook**:
   - Table: `portal_messages`
   - Events: `Insert`
   - Type: Supabase Edge Function → `send-push`
   - If you set `PUSH_WEBHOOK_SECRET`, add header `x-webhook-secret: <the secret>`.
   The hook fires for **every** insert, on both sides — which is what makes the
   pharmacy direction work.
5. **Each browser** — Account → Notifications → **Enable notifications** (once per device).

## Testing

Send from the home app, then from the pharmacy app, into the same thread:

- the nursing home device should alert for the pharmacy's message;
- the pharmacy device should alert for the home's message.

If the pharmacy still gets nothing, check the `send-push` logs. `no recipients` or
`no subscriptions` says the rows are missing for that side (for example no
`pharmacy_home_access` row for the home, or no `push_subscriptions` row for the
pharmacy user); `send failed` with status 404/410 means the subscription is dead and
should be re-enabled on that device.
