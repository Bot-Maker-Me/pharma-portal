'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Building2, LayoutList, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  loadHomes,
  loadTenants,
  loadUsers,
  type AdminHome,
  type AdminTenant,
  type AdminUser,
} from '@/lib/admin/data'
import { UsersPanel } from './users-panel'
import { HomesPanel } from './homes-panel'
import { ContentPanel } from './content-panel'

type Tab = 'users' | 'homes' | 'content'

const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'users', label: 'Users & access', icon: Users },
  { key: 'homes', label: 'Nursing homes', icon: Building2 },
  { key: 'content', label: 'Workspace content', icon: LayoutList },
]

export function AdminConsole({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [homes, setHomes] = useState<AdminHome[]>([])
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [nextUsers, nextHomes, nextTenants] = await Promise.all([loadUsers(), loadHomes(), loadTenants()])
      setUsers(nextUsers)
      setHomes(nextHomes)
      setTenants(nextTenants)
      setStatus('ready')
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the console.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="admin-shell">
      <header className="admin-shell-header">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center bg-evergreen text-sm font-bold text-white">+</span>
          <div>
            <p className="text-sm font-bold tracking-tight text-ink">Admin console</p>
            <p className="text-[11px] text-ink-soft">Signed in as {adminEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/workspace" className="admin-ghost-button">
            Open workspace
          </Link>
          <Link href="/chat" className="admin-ghost-button">
            Chat with Home
          </Link>
        </div>
      </header>

      <nav className="admin-shell-tabs" aria-label="Admin sections">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'page' : undefined}
            className={cn('admin-shell-tab', tab === key && 'is-active')}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      <main className="admin-shell-body">
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
            <button type="button" onClick={() => void reload()} className="admin-primary-button">
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && tab === 'users' && (
          <UsersPanel users={users} homes={homes} tenants={tenants} onChanged={reload} />
        )}
        {status === 'ready' && tab === 'homes' && <HomesPanel homes={homes} onChanged={reload} />}
        {status === 'ready' && tab === 'content' && <ContentPanel tenants={tenants} onChanged={reload} />}
      </main>
    </div>
  )
}
