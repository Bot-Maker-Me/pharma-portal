import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * A Supabase client using the SERVICE-ROLE key. RLS is bypassed, and the key
 * grants access to functions reserved for `service_role` (notably
 * public.ip_guard).
 *
 * The key must never reach the browser: it is read here from a server-only
 * environment variable, never from a NEXT_PUBLIC_* one, and this module is
 * marked `server-only` so a client component that imports it fails to build.
 *
 * Returns null when the URL or key is absent, so callers can fail open rather
 * than throw.
 */
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
