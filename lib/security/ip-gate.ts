import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { resolveClientIp } from '@/lib/ip/request-ip'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * The organisation IP gate, run in middleware before a route handler executes.
 *
 * The decision is made by public.ip_guard, which both evaluates the request and
 * records it in the audit log in one round trip. That function is granted to
 * `service_role` only, so it is called through a service-role client — the
 * allowlist itself is never sent to, or reachable from, the browser.
 *
 * This helper NEVER throws and NEVER blocks on error: any failure (missing
 * service key, RPC error, unexpected result) allows the request. A broken
 * allowlist must not lock an organisation out.
 */

// Paths that must stay reachable even from a blocked network: the sign-in page,
// the restricted page itself, health probes, and the PWA assets the browser
// requests before any app code runs.
const EXEMPT_EXACT = new Set(['/', '/access-restricted', '/api/health', '/sw.js', '/manifest.json'])

// The auth routes are how a session is established in the first place, so they
// can never be gated by the session they are trying to create.
const EXEMPT_PREFIXES = ['/auth', '/api/auth']

// Every `sb-<ref>-auth-token` cookie — including the chunked `.0`, `.1`… parts
// and the `-code-verifier` companion.
const AUTH_COOKIE = /^sb-.*auth-token/

export function isExemptPath(pathname: string): boolean {
  if (EXEMPT_EXACT.has(pathname)) return true
  return EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

// Drop the session cookies on a response we are about to hand back, so a blocked
// user's session does not linger after they are turned away.
function expireAuthCookies(request: NextRequest, response: NextResponse): void {
  for (const { name } of request.cookies.getAll()) {
    if (AUTH_COOKIE.test(name)) {
      response.cookies.set(name, '', { path: '/', maxAge: 0, expires: new Date(0) })
    }
  }
}

export async function enforceIpGate(
  request: NextRequest,
  response: NextResponse,
  user: User | null,
): Promise<NextResponse> {
  try {
    // Only signed-in requests are gated; the allowlist is a property of a user.
    if (!user) return response

    const { pathname } = request.nextUrl
    if (isExemptPath(pathname)) return response

    const service = createServiceClient()
    if (!service) return response

    const source = pathname.startsWith('/api/') ? 'api' : 'page'
    const { data, error } = await service.rpc('ip_guard', {
      p_user_id: user.id,
      p_ip: resolveClientIp(request.headers),
      p_path: pathname,
      p_source: source,
    })

    // Fail open on any RPC problem, and on any shape we don't recognise.
    if (error || !data) return response
    if ((data as { allowed?: boolean }).allowed !== false) return response

    if (source === 'api') {
      const blocked = NextResponse.json({ error: 'Access restricted' }, { status: 403 })
      expireAuthCookies(request, blocked)
      return blocked
    }

    const blocked = NextResponse.redirect(new URL('/access-restricted', request.url), 307)
    expireAuthCookies(request, blocked)
    return blocked
  } catch {
    return response
  }
}
