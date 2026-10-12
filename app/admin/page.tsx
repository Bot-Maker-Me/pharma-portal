import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requirePlatformAdminOnly } from '@/lib/features/server'
import { AdminConsole } from '@/components/admin/admin-console'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin console · Formulary',
  description: 'Manage tenants, users, nursing home access and workspace content.',
}

export default async function AdminPage() {
  // Signed-out visitors are redirected; everyone who is not a platform admin gets a 404.
  const { userId } = await requirePlatformAdminOnly()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <AdminConsole adminEmail={user?.email ?? userId} />
}
