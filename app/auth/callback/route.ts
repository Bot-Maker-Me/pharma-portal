import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientIp } from '@/lib/ip/request-ip'

/**
 * Records one sign-in decision for a session established via an email link or
 * OAuth callback. Mirrors the password sign-in handler: the decision is written
 * to the audit trail, and a refused sign-in is signed out and sent to the
 * restricted page. Fails open on any error.
 */
async function recordLoginAllowed(request: Request): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return true

    const service = createServiceClient()
    if (!service) return true

    const { data, error } = await service.rpc('ip_guard', {
      p_user_id: user.id,
      p_ip: resolveClientIp(request.headers),
      p_path: '/auth/callback',
      p_source: 'login',
    })
    if (error || !data || (data as { allowed?: boolean }).allowed !== false) return true

    await supabase.auth.signOut().catch(() => {})
    return false
  } catch {
    return true
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/workspace'
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (code && configured) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    if (!(await recordLoginAllowed(request))) {
      return NextResponse.redirect(new URL('/access-restricted', url.origin))
    }
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
