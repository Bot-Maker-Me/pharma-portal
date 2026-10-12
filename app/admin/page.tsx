import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requirePlatformAdminOnly } from '@/lib/features/server'
import { AdminConsole } from '@/components/admin/admin-console'
import { AdminAccessDenied } from '@/components/admin/access-denied'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin console · Formulary',
  description: 'Manage tenants, users, nursing home access and workspace content.',
}

/** Public part of the Supabase URL — enough to tell which project this build talks to. */
function supabaseProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  return url.replace(/^https?:\/\//, '').split('.')[0] || null
}

export default async function AdminPage() {
  // Signed-out visitors are redirected to sign-in; signed-in non-admins get an
  // explicit refusal that explains why, rather than an indistinguishable 404.
  const gate = await requirePlatformAdminOnly()

  if (!gate.ok) {
    return (
      <AdminAccessDenied
        reason={gate.reason}
        email={gate.email}
        projectRef={supabaseProjectRef()}
      />
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <AdminConsole adminEmail={user?.email ?? gate.userId} />
}
