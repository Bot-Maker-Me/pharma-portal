import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionTenant, getVisibleTenantFeatures } from '@/lib/features/server'
import { featuresToClient, getCustomFeatures, getVisibleFeatures } from '@/lib/features/registry'
import { loadWorkspaceData } from '@/lib/workspace/data'
import { previewWorkspace } from '@/lib/workspace/preview'
import { loadTenantIdentity } from '@/lib/tenant/server'
import { previewTenant } from '@/lib/tenant/preview'
import { WorkspaceView } from '@/components/workspace/workspace-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workspace · Pharma Portal',
  description: 'Your pharmacy workspace.',
}

// The sample pharmacy models a fully granted workspace, so every screen stays
// reachable while Supabase is unconfigured. A real pharmacy starts with no
// grants at all — they are given one at a time in Admin console → Features.
const previewFeatures = featuresToClient(getVisibleFeatures(getCustomFeatures().map((feature) => feature.key)))

export default async function WorkspacePage() {
  // The preview environment can be missing Supabase credentials. Say so plainly
  // instead of throwing "Your project's URL and Key are required to create a
  // Supabase client!" from inside the Supabase SDK.
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!configured) {
    // No credentials yet: open the sample workspace of the preview pharmacy —
    // Pharmasave West Hills — wearing its own theme, rather than a dead end.
    return (
      <WorkspaceView
        tenantName={previewTenant.name ?? 'Your pharmacy'}
        theme={previewTenant.theme}
        userEmail="preview@pharmaportal.local"
        isPlatformAdmin={false}
        data={previewWorkspace}
        features={previewFeatures}
        preview
      />
    )
  }

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

  // Signed in, but not attached to a pharmacy workspace. Never a 404 — a signed-in
  // user needs to be told what to do, not shown a dead end.
  if (!context) {
    return (
      <main className="ws-shell flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
          {isPlatformAdmin ? (
            <ShieldCheck className="size-5" aria-hidden="true" />
          ) : (
            <Wrench className="size-5" aria-hidden="true" />
          )}
        </span>
        <div>
          <h1 className="ws-title">
            {isPlatformAdmin ? 'No workspace assigned' : 'Your account isn’t set up yet'}
          </h1>
          <p className="ws-subtitle">
            {isPlatformAdmin
              ? 'You are a platform admin, but you are not a member of any pharmacy tenant yet.'
              : 'You are signed in, but no pharmacy workspace has been assigned to you yet. Ask your administrator to add you to one.'}
          </p>
        </div>
        {isPlatformAdmin ? (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-md bg-evergreen px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-evergreen/90"
          >
            Open the admin console
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md bg-evergreen px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-evergreen/90"
          >
            Back to home
          </Link>
        )}
      </main>
    )
  }

  const [tenant, data, grantedFeatures] = await Promise.all([
    loadTenantIdentity(context.tenantId),
    loadWorkspaceData(context.tenantId),
    getVisibleTenantFeatures(context.tenantId),
  ])

  return (
    <WorkspaceView
      tenantName={tenant.name ?? 'Your pharmacy'}
      theme={tenant.theme}
      userEmail={user.email ?? ''}
      isPlatformAdmin={isPlatformAdmin}
      data={data}
      features={featuresToClient(grantedFeatures)}
    />
  )
}
