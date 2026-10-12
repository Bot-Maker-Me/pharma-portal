import Link from 'next/link'
import { Lock, PlugZap } from 'lucide-react'

type Props = {
  reason: 'unconfigured' | 'not-admin'
  email: string | null
  projectRef: string | null
}

/**
 * Shown instead of a bare 404 when someone reaches /admin without the grant.
 * No admin data is exposed — it only reports who is signed in and which Supabase
 * project was consulted, which is what you need to fix the problem.
 */
export function AdminAccessDenied({ reason, email, projectRef }: Props) {
  const fixSql = email
    ? `insert into public.platform_admins (user_id)\nselect id from auth.users where email = '${email}';`
    : null

  return (
    <main className="ws-shell flex min-h-dvh items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-coral/10 text-coral">
            {reason === 'unconfigured' ? (
              <PlugZap className="size-5" aria-hidden="true" />
            ) : (
              <Lock className="size-5" aria-hidden="true" />
            )}
          </span>
          <h1 className="ws-title">
            {reason === 'unconfigured' ? 'Supabase is not configured' : 'Admin access denied'}
          </h1>
        </div>

        {reason === 'unconfigured' ? (
          <p className="ws-subtitle">
            This deployment has no <code>NEXT_PUBLIC_SUPABASE_URL</code> or{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, so the admin console cannot reach a
            database. Set both in the hosting environment and redeploy.
          </p>
        ) : (
          <p className="ws-subtitle">
            You are signed in, but that account is not listed in the{' '}
            <code>platform_admins</code> table of the Supabase project below — so the console
            refuses to open.
          </p>
        )}

        <dl className="mt-6 divide-y divide-line border border-line bg-surface text-xs">
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="shrink-0 text-ink-soft">Signed in as</dt>
            <dd className="truncate font-semibold text-ink">{email ?? '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="shrink-0 text-ink-soft">Supabase project</dt>
            <dd className="truncate font-mono font-semibold text-ink">{projectRef ?? '—'}</dd>
          </div>
        </dl>

        {reason === 'not-admin' && fixSql && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-ink">
              If that email is correct, run this in that project&rsquo;s SQL Editor:
            </p>
            <pre className="mt-2 overflow-x-auto border border-line bg-paper-deep p-3 font-mono text-[11px] leading-relaxed text-ink">
              {fixSql}
            </pre>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
              If the email is <strong className="font-semibold text-ink">not</strong> the one you
              expected, you are signed in as the wrong account — sign out and back in. And if the
              project reference above does not match the project you ran the SQL in, that is the
              problem: this deployment points somewhere else.
            </p>
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 rounded-md bg-evergreen px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-evergreen/90"
          >
            Back to workspace
          </Link>
          <Link href="/" className="text-xs font-semibold text-evergreen underline">
            Sign in as a different account
          </Link>
        </div>
      </div>
    </main>
  )
}
