'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadHomes, loadTenants, loadUsers, type AdminHome, type AdminTenant, type AdminUser } from '@/lib/admin/data'
import { parseTenantTheme, tenantThemeClass } from '@/lib/tenant/theme'
import { workspaceSections, type WorkspaceSectionKey } from '@/lib/workspace/sections'
import { UsersPanel } from '@/components/admin/users-panel'
import { HomesPanel } from '@/components/admin/homes-panel'
import { TenantsPanel } from '@/components/admin/tenants-panel'
import { FeaturesPanel } from '@/components/admin/features-panel'
import { FormularyPanel, SectionPanel } from '@/components/admin/content-panel'

type View =
  | { kind: 'formulary' }
  | { kind: 'section'; section: WorkspaceSectionKey }
  | { kind: 'features' }
  | { kind: 'users' }
  | { kind: 'homes' }
  | { kind: 'tenants' }

const headings: Record<View['kind'], { title: string; subtitle: string }> = {
  formulary: {
    title: 'Formulary',
    subtitle: 'Preferred generics and substitution rules for the selected pharmacy.',
  },
  section: { title: '', subtitle: '' },
  features: {
    title: 'Features',
    subtitle: 'Extras granted per pharmacy. A pharmacy only gets one when you grant it here.',
  },
  users: {
    title: 'Users & access',
    subtitle: 'Every account, the pharmacy it belongs to, and which nursing homes it can chat with.',
  },
  homes: {
    title: 'Nursing homes',
    subtitle: 'The homes your pharmacy team serves. Grant a user access from Users & access.',
  },
  tenants: {
    title: 'Pharmacies',
    subtitle: 'Each pharmacy is its own workspace. Content never crosses between them.',
  },
}

export function AdminConsole({ adminEmail }: { adminEmail: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [homes, setHomes] = useState<AdminHome[]>([])
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [view, setView] = useState<View>({ kind: 'formulary' })
  const [tenantId, setTenantId] = useState('')

  const reload = useCallback(async () => {
    setError('')
    try {
      const [nextUsers, nextHomes, nextTenants] = await Promise.all([loadUsers(), loadHomes(), loadTenants()])
      setUsers(nextUsers)
      setHomes(nextHomes)
      setTenants(nextTenants)
      setStatus('ready')
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the admin console.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Keep the selected pharmacy valid as tenants are added or removed.
  useEffect(() => {
    if (tenants.length === 0) {
      setTenantId('')
      return
    }
    setTenantId((current) => (tenants.some((tenant) => tenant.id === current) ? current : tenants[0].id))
  }, [tenants])

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId) ?? null,
    [tenants, tenantId],
  )

  const sectionMeta = view.kind === 'section' ? workspaceSections.find((item) => item.key === view.section) : null

  const heading = sectionMeta
    ? { title: sectionMeta.label, subtitle: sectionMeta.hint }
    : headings[view.kind]

  const needsTenant = view.kind === 'formulary' || view.kind === 'section' || view.kind === 'features'

  return (
    // The console wears the selected pharmacy's theme, so managing a branded
    // pharmacy looks like that pharmacy — and nothing changes for the rest.
    <div className={cn('admin-shell', tenantThemeClass(parseTenantTheme(selectedTenant?.theme)))}>
      <aside className="admin-rail">
        <div className="admin-rail-wordmark">
          <span className="wordmark-mark" aria-hidden="true">
            +
          </span>
          Pharma Portal
        </div>

        <p className="admin-rail-eyebrow">TEAM ADMINISTRATION</p>
        <h1 className="admin-rail-title">Client setup</h1>
        <p className="admin-rail-sub">Configure each pharmacy independently.</p>

        <label className="admin-rail-label" htmlFor="admin-pharmacy">
          Selected pharmacy
        </label>
        <select
          id="admin-pharmacy"
          className="admin-rail-select"
          value={tenantId}
          onChange={(event) => setTenantId(event.target.value)}
          disabled={tenants.length === 0}
        >
          {tenants.length === 0 ? (
            <option value="">No pharmacies yet</option>
          ) : (
            tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))
          )}
        </select>

        <nav className="admin-rail-nav" aria-label="Workspace sections">
          <button
            type="button"
            className={cn('admin-rail-item', view.kind === 'formulary' && 'is-on')}
            onClick={() => setView({ kind: 'formulary' })}
          >
            Formulary
          </button>
          {workspaceSections.map((section) => (
            <button
              key={section.key}
              type="button"
              className={cn(
                'admin-rail-item',
                view.kind === 'section' && view.section === section.key && 'is-on',
              )}
              onClick={() => setView({ kind: 'section', section: section.key })}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <p className="admin-rail-group">PLATFORM</p>
        <nav className="admin-rail-nav admin-rail-nav--platform" aria-label="Platform administration">
          <button
            type="button"
            className={cn('admin-rail-item', view.kind === 'features' && 'is-on')}
            onClick={() => setView({ kind: 'features' })}
          >
            Features
          </button>
          <button
            type="button"
            className={cn('admin-rail-item', view.kind === 'users' && 'is-on')}
            onClick={() => setView({ kind: 'users' })}
          >
            Users &amp; access
          </button>
          <button
            type="button"
            className={cn('admin-rail-item', view.kind === 'homes' && 'is-on')}
            onClick={() => setView({ kind: 'homes' })}
          >
            Nursing homes
          </button>
          <button
            type="button"
            className={cn('admin-rail-item', view.kind === 'tenants' && 'is-on')}
            onClick={() => setView({ kind: 'tenants' })}
          >
            Pharmacies
          </button>
        </nav>

        <Link className="admin-rail-back" href="/workspace">
          Back to workspace
        </Link>
      </aside>

      <main className="admin-main">
        <header className="admin-main-head">
          <div>
            <p className="admin-main-eyebrow">
              {(selectedTenant?.name ?? adminEmail).toUpperCase()}
            </p>
            <h2 className="admin-main-title">{heading.title}</h2>
            <p className="admin-main-sub">{heading.subtitle}</p>
          </div>
          <div className="admin-main-actions">
            <Link className="admin-ghost-button" href="/workspace">
              Open workspace
            </Link>
            <Link className="admin-ghost-button" href="/chat">
              <MessagesSquare className="size-3.5" aria-hidden="true" />
              Chat with Home
            </Link>
          </div>
        </header>

        <div className="admin-main-body">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-soft">
              <Loader2 className="size-5 animate-spin text-evergreen" aria-hidden="true" />
              <p className="text-sm">Loading console…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-coral/10 text-coral">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Could not load the admin console</p>
                <p className="mt-1 text-xs text-ink-soft">{error}</p>
              </div>
              {(error.includes('admin_list_users') ||
                error.includes('schema cache') ||
                error.includes('does not exist')) && (
                <p className="text-xs leading-relaxed text-ink-soft">
                  The database is missing objects this console needs — usually because{' '}
                  <code className="font-mono">20261003000000_tenant_workspace.sql</code> has not been
                  applied to this project yet. Run it in the Supabase SQL Editor, then try again.
                </p>
              )}
              <button type="button" onClick={() => void reload()} className="admin-primary-button">
                Try again
              </button>
            </div>
          )}

          {status === 'ready' && view.kind === 'users' && (
            <UsersPanel users={users} homes={homes} tenants={tenants} onChanged={reload} />
          )}
          {status === 'ready' && view.kind === 'homes' && <HomesPanel homes={homes} onChanged={reload} />}
          {status === 'ready' && view.kind === 'tenants' && <TenantsPanel tenants={tenants} onChanged={reload} />}

          {status === 'ready' && needsTenant && !tenantId && (
            <div className="admin-panel">
              <div className="admin-card">
                <h3 className="admin-card-title">No pharmacy selected</h3>
                <p className="admin-card-hint">
                  Create a pharmacy workspace first. Every user and every piece of content belongs to one, which is
                  what keeps them separate.
                </p>
                <button
                  type="button"
                  className="admin-primary-button mt-4"
                  onClick={() => setView({ kind: 'tenants' })}
                >
                  Go to Pharmacies
                </button>
              </div>
            </div>
          )}

          {status === 'ready' && view.kind === 'features' && (
            <FeaturesPanel tenants={tenants} tenantId={tenantId} onChanged={reload} />
          )}
          {status === 'ready' && view.kind === 'formulary' && tenantId && <FormularyPanel tenantId={tenantId} />}
          {status === 'ready' && view.kind === 'section' && tenantId && (
            <SectionPanel tenantId={tenantId} section={view.section} />
          )}
        </div>
      </main>
    </div>
  )
}
