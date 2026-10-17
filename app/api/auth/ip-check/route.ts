import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientIp } from '@/lib/ip/request-ip'

export const dynamic = 'force-dynamic'

// Every `sb-<ref>-auth-token` cookie, including chunked `.0`/`.1` parts and the
// `-code-verifier` companion.
const AUTH_COOKIE = /^sb-.*auth-token/

/**
 * Records one sign-in decision against the organisation IP allowlist.
 *
 * Called by the sign-in handler immediately after Supabase authenticates the
 * user, so an accepted login and a refused login both land in the audit trail.
 * Runs under /api/auth, which the middleware gate skips — this route makes its
 * own decision so the sign-in itself is not gated by the session it just made.
 *
 * Fails open: any error reports `allowed: true` so a broken allowlist cannot
 * lock an organisation out.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ allowed: true })

    const service = createServiceClient()
    if (!service) return NextResponse.json({ allowed: true })

    const { data, error } = await service.rpc('ip_guard', {
      p_user_id: user.id,
      p_ip: resolveClientIp(request.headers),
      p_path: '/api/auth/ip-check',
      p_source: 'login',
    })
    if (error || !data || (data as { allowed?: boolean }).allowed !== false) {
      return NextResponse.json({ allowed: true })
    }

    // Refused: end the session and expire its cookies so it does not linger.
    await supabase.auth.signOut().catch(() => {})
    const cookieStore = await cookies()
    for (const cookie of cookieStore.getAll()) {
      if (AUTH_COOKIE.test(cookie.name)) cookieStore.delete(cookie.name)
    }
    return NextResponse.json({ allowed: false })
  } catch {
    return NextResponse.json({ allowed: true })
  }
}
