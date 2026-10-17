/**
 * Server startup hook. Runs once per server process (Node runtime only).
 *
 * Logs the Supabase project HOST so the server half can be compared against the
 * browser half — the reply header `Sb-Project-Ref` that Supabase's edge sets on
 * every request. The host is safe to print; the key never is, so only the host
 * is logged.
 *
 * If the service-role key is missing the organisation IP gate cannot call
 * public.ip_guard (granted to `service_role` only) and therefore fails open, so
 * that condition is surfaced loudly rather than silently.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  let host = 'unset'
  if (url) {
    try {
      host = new URL(url).host
    } catch {
      host = 'invalid'
    }
  }

  console.log(`[ip-gate] Supabase project host: ${host}`)

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '[ip-gate] SUPABASE_SERVICE_ROLE_KEY is not set — the organisation IP gate will fail open.',
    )
  }
}
