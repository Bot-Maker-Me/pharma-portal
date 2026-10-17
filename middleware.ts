import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { enforceIpGate } from '@/lib/security/ip-gate'

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  return enforceIpGate(request, response, user)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
