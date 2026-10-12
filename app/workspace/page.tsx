import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSessionTenant } from '@/lib/features/server'
import { loadWorkspaceData } from '@/lib/workspace/data'
import { loadTenantIdentity } from '@/lib/tenant/server'
import { WorkspaceView } from '@/components/workspace/workspace-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workspace · Formulary',
  description: 'Your pharmacy workspace.',
}

export default async function WorkspacePage() {
  // The preview environment can be missing Supabase credentials. Say so plainly
  // instead of throwing "Your project's URL and Key are required to create a
  // Supabase client!" from inside the Supabase SDK.
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!configured) {
    return (
      <main className="ws-shell flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
          <Wrench className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="ws-title">Connect Supabase to open the workspace</h1>
          <p className="ws-subtitle">
            This environment has no Supabase credentials, so there is no account to sign in to yet.
          </p>
        </div>
        <div className="w-full max-w-md border border-line bg-surface px-4 py-3 text-left">
          <p className="text-xs font-semibold text-ink">
            Add both variables, then restart the app.
          </p>
          <p className="mt-1 text-[11px] text-ink-soft">
            In <code className="rounded bg-paper-deep px-1">.env.local</code> for this preview, and in Vercel →
            Settings → Environment Variables for the deployed site:
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-evergreen">
            {'NEXT_PUBLIC_SUPABASE_URL=…\nNEXT_PUBLIC_SUPABASE_ANON_KEY=…'}
          </pre>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 rounded-md bg-evergreen px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-evergreen/90"
          >
            See Chat with Home in preview mode
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep"
          >
            Back to the home page
          </Link>
        </div>
      </main>
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
            href="/chat"
            className="inline-flex items-center gap-1.5 rounded-md bg-evergreen px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-evergreen/90"
          >
            Go to Chat with Home
          </Link>
        )}
      </main>
    )
  }

  const [tenant, data] = await Promise.all([
    loadTenantIdentity(context.tenantId),
    loadWorkspaceData(context.tenantId),
  ])

  return (
    <WorkspaceView
      tenantName={tenant.name ?? 'Your pharmacy'}
      theme={tenant.theme}
      userEmail={user.email ?? ''}
      isPlatformAdmin={isPlatformAdmin}
      data={data}
    />
  )
}
