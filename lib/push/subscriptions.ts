'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * The tenant the signed-in user belongs to.
 *
 * Mirrors `getSessionTenant()` in lib/features/server.ts, but on the client, so
 * that saving a subscription does not need the tenant threaded through the chat
 * or workspace props. Subscriptions work without it (the column is nullable); it
 * is recorded so a future notifier can scope a send to one pharmacy.
 */
export async function resolveTenantId(): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  return (data?.tenant_id as string | undefined) ?? null
}

async function currentUserId(): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Stores one device's push subscription against the signed-in user.
 *
 * `endpoint` is unique across the table, so enabling notifications again on the
 * same device refreshes its row instead of stacking a duplicate that would make
 * every message arrive twice.
 */
export async function saveSubscription(input: {
  subscription: PushSubscription
  tenantId: string | null
}): Promise<void> {
  const supabase = createClient()
  if (!supabase) {
    throw new Error('Supabase is not connected in this deployment, so notifications cannot be registered.')
  }

  const userId = await currentUserId()
  if (!userId) throw new Error('Sign in first — a subscription is stored against your account.')

  const json = input.subscription.toJSON()
  const keys = json.keys ?? {}
  if (!json.endpoint || !keys.p256dh || !keys.auth) {
    throw new Error('The browser returned an incomplete subscription. Try disabling and enabling again.')
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      tenant_id: input.tenantId,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    console.error('[push] failed to save subscription to push_subscriptions:', error)
    throw new Error(error.message)
  }
}

/** Removes this device's row. Best effort — the browser subscription is what matters. */
export async function deleteSubscriptionRow(endpoint: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

/** True when this device's endpoint is already on file for the signed-in user. */
export async function isEndpointStored(endpoint: string): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false
  const { data } = await supabase.from('push_subscriptions').select('id').eq('endpoint', endpoint).limit(1)
  return (data ?? []).length > 0
}
