// send-push — the ONE server-side notifier for "Chat with Home".
//
// WHERE THIS BELONGS
//   It must live in the SHARED Supabase project — the one BOTH portals read
//   (public.chat_threads / public.portal_messages / public.profiles /
//   public.pharmacy_home_access). That is normally the Nursing Home Portal's
//   project. Deploying it anywhere else sends to nobody.
//
// HOW IT IS TRIGGERED
//   A Database Webhook on INSERT into public.portal_messages, POSTing the new row
//   to this function. See supabase/send-push-webhook.sql for the trigger.
//
// WHAT IT DOES
//   It notifies the OTHER side of the thread:
//     sender_role = 'pharmacy'  -> the nursing home's users
//     sender_role = 'home'      -> the pharmacy users who serve that home
//   The previous setup only did the first line, which is exactly why pharmacy
//   messages alerted the home but home messages never alerted the pharmacy.
//
// SECRETS (Supabase -> Edge Functions -> Manage Secrets)
//   VAPID_PUBLIC_KEY    the public half of the key pair the clients subscribe with
//   VAPID_PRIVATE_KEY   the private half (never goes near the apps)
//   VAPID_SUBJECT       optional; defaults to mailto:admin@example.com
//   PUSH_WEBHOOK_SECRET optional; if set, the webhook must send it in the
//                       x-webhook-secret header. Strongly recommended.
//
// PRIVACY: a notification never carries message text, a resident, or a medicine.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

const SENDER_ROLE_HOME = 'home'

type PortalMessageRow = {
  id?: string
  user_id?: string | null
  thread_id?: string | null
  sender_role?: string | null
}

type SubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Optional shared-secret auth: the callers are Postgres webhooks, not users, so
  // there is no JWT to verify. When the secret is configured, require it.
  const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (expectedSecret && req.headers.get('x-webhook-secret') !== expectedSecret) {
    console.error('[send-push] rejected: bad or missing x-webhook-secret')
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = await req.json().catch(() => null)
    // Supabase Database Webhooks send { type, table, schema, record, old_record }.
    const record: PortalMessageRow = (body?.record ?? body) as PortalMessageRow

    if (body?.type && body.type !== 'INSERT') return json({ skipped: 'not an insert' })
    if (!record?.thread_id) {
      console.error('[send-push] no thread_id on the row', { record })
      return json({ skipped: 'no thread_id' })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('id, home_id')
      .eq('id', record.thread_id)
      .maybeSingle()
    if (threadError) throw threadError
    const homeId = thread?.home_id ?? null
    if (!homeId) {
      console.error('[send-push] thread has no home_id; cannot pick recipients', {
        threadId: record.thread_id,
      })
      return json({ skipped: 'thread has no home_id' })
    }

    const fromHome = record.sender_role === SENDER_ROLE_HOME

    // Recipients — the side that did NOT write the message.
    let recipientIds: string[] = []
    if (fromHome) {
      // Pharmacy users authorized to serve this home.
      const { data, error } = await supabase
        .from('pharmacy_home_access')
        .select('pharmacy_user_id')
        .eq('home_id', homeId)
      if (error) throw error
      recipientIds = (data ?? []).map((row) => row.pharmacy_user_id as string)
    } else {
      // The home's own users.
      const { data, error } = await supabase.from('profiles').select('id').eq('home_id', homeId)
      if (error) throw error
      recipientIds = (data ?? []).map((row) => row.id as string)
    }

    // Never notify the author (the same account can be signed into both portals).
    recipientIds = Array.from(new Set(recipientIds.filter((id) => id && id !== record.user_id)))

    if (recipientIds.length === 0) {
      console.warn('[send-push] no recipients for thread', { threadId: record.thread_id, fromHome })
      return json({ sent: 0, reason: 'no recipients' })
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', recipientIds)
    if (subsError) throw subsError

    const rows = (subscriptions ?? []) as SubscriptionRow[]
    if (rows.length === 0) {
      console.warn('[send-push] recipients have no push subscriptions', {
        recipients: recipientIds.length,
        fromHome,
      })
      return json({ sent: 0, reason: 'no subscriptions' })
    }

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const payload = JSON.stringify({
      title: 'New message',
      body: fromHome
        ? 'You have a new message from the nursing home'
        : 'You have a new message from the pharmacy',
      url: '/chat',
      tag: 'pharma-portal-message',
    })

    let sent = 0
    for (const row of rows) {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
        )
        sent += 1
      } catch (sendError: unknown) {
        const status = (sendError as { statusCode?: number })?.statusCode
        // 404/410 mean the browser threw the subscription away — prune it.
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
          console.warn('[send-push] pruned a dead subscription', { status })
        } else {
          console.error('[send-push] send failed', { status, error: sendError })
        }
      }
    }

    console.log('[send-push] done', { fromHome, recipients: recipientIds.length, sent })
    return json({ sent })
  } catch (error) {
    console.error('[send-push] unexpected error', { error })
    return json({ error: 'Internal error' }, 500)
  }
})
