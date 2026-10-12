import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionTenant } from '@/lib/features/server'
import { loadWorkspaceData } from '@/lib/workspace/data'
import { WorkspaceView } from '@/components/workspace/workspace-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workspace · Formulary',
  description: 'Your pharmacy workspace.',
}

export default async function WorkspacePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [context, adminResult] = await Promise.all([
    getSessionTenant(),
    supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
  ])
  const isPlatformAdmin = Boolean(adminResult.data)

  if (!context) {
    // A platform admin with no tenant still needs a way back to the console.
    if (!isPlatformAdmin) notFound()

    return (
      <main className="ws-shell flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="ws-title">No workspace assigned</h1>
          <p className="ws-subtitle">
            You are a platform admin, but you are not a member of any pharmacy tenant yet.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-md bg-evergreen px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-evergreen/90"
        >
          Open the admin console
        </Link>
      </main>
    )
  }

  const [tenantResult, data] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', context.tenantId).maybeSingle(),
    loadWorkspaceData(context.tenantId),
  ])

  return (
    <WorkspaceView
      tenantName={tenantResult.data?.name ?? 'Your pharmacy'}
      userEmail={user.email ?? ''}
      isPlatformAdmin={isPlatformAdmin}
      data={data}
    />
  )
}
