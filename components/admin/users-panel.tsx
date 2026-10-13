'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, Check, Search, ShieldCheck, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  saveProfile,
  setHomeAccess,
  setPlatformAdmin,
  setUserTenant,
  type AdminHome,
  type AdminTenant,
  type AdminUser,
} from '@/lib/admin/data'

type UsersPanelProps = {
  users: AdminUser[]
  homes: AdminHome[]
  tenants: AdminTenant[]
  onChanged: () => Promise<void>
}

export function UsersPanel({ users, homes, tenants, onChanged }: UsersPanelProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [organization, setOrganization] = useState('')
  const [profileRole, setProfileRole] = useState('pharmacy')
  const [tenantId, setTenantId] = useState('')
  const [tenantRole, setTenantRole] = useState('staff')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selected = users.find((user) => user.userId === selectedId) ?? null
  const selectedUserId = selected?.userId ?? null

  useEffect(() => {
    if (!selected) return
    setFullName(selected.fullName)
    setOrganization(selected.organization ?? '')
    setProfileRole(selected.profileRole)
    setTenantId(selected.tenantId ?? '')
    setTenantRole(selected.tenantRole ?? 'staff')
    setError(null)
    setNotice(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) =>
      `${user.email} ${user.fullName} ${user.tenantName ?? ''}`.toLowerCase().includes(term),
    )
  }, [users, query])

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      await onChanged()
      setNotice(message)
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : 'That change did not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-split">
      <section className="admin-split-list">
        <div className="admin-split-list-header">
          <label className="admin-search">
            <Search className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users…"
              aria-label="Search users"
            />
          </label>
          <span className="admin-count">{filtered.length} of {users.length}</span>
        </div>

        {filtered.length === 0 ? (
          <p className="admin-empty">No users match “{query}”.</p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((user) => (
              <li key={user.userId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(user.userId)}
                  aria-current={user.userId === selectedId ? 'true' : undefined}
                  className={cn('admin-user-row', user.userId === selectedId && 'is-active')}
                >
                  <span className="admin-user-avatar" aria-hidden="true">
                    {user.email.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink">{user.email}</span>
                      {user.isPlatformAdmin && (
                        <ShieldCheck className="size-3.5 shrink-0 text-coral" aria-label="Platform admin" />
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-soft">
                      {user.tenantName ?? 'No tenant'} · {user.homeIds.length} home
                      {user.homeIds.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-split-detail">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-ink">Select a user</p>
            <p className="max-w-xs text-xs text-ink-soft">
              Choose someone on the left to set their tenant, role and which nursing homes they can chat with.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 p-5">
            <div>
              <h2 className="admin-card-title">{selected.email}</h2>
              <p className="admin-card-hint">
                {selected.isPlatformAdmin ? 'Platform admin' : 'Standard user'}
                {selected.tenantName ? ` · ${selected.tenantName}` : ''}
              </p>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Tenant &amp; role</h3>
              <p className="admin-card-hint">
                The tenant decides which workspace content this user sees. Users in different tenants never share
                data, even when the content is identical.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="admin-field">
                  Tenant
                  <select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
                    <option value="">— none —</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  Role in tenant
                  <select value={tenantRole} onChange={(event) => setTenantRole(event.target.value)}>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="admin-field">
                  Display name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" />
                </label>
                <label className="admin-field">
                  Organization
                  <input
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                    placeholder="e.g. Pharma Strategies"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => saveProfile(selected.userId, { fullName, organization, profileRole }).then(() =>
                      setUserTenant(selected.userId, tenantId || null, tenantRole),
                    ),
                    'Tenant and profile saved.',
                  )
                }
                className="admin-primary-button mt-4"
              >
                Save tenant &amp; profile
              </button>
            </div>

            <div className="admin-card">
              <div className="flex items-baseline justify-between">
                <h3 className="admin-card-title">Nursing home access</h3>
                <span className="admin-count">{selected.homeIds.length} assigned</span>
              </div>
              <p className="admin-card-hint">
                Ticked homes appear in this user&apos;s Chat with Pharmacy. Changes apply immediately.
              </p>
              {homes.length === 0 ? (
                <p className="admin-empty">No nursing homes exist yet — add some in the Nursing homes tab.</p>
              ) : (
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {homes.map((home) => {
                    const granted = selected.homeIds.includes(home.id)
                    return (
                      <li key={home.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => setHomeAccess(selected.userId, home.id, !granted),
                              granted ? `Removed access to ${home.name}.` : `Granted access to ${home.name}.`,
                            )
                          }
                          aria-pressed={granted}
                          className={cn('admin-check-row', granted && 'is-on')}
                        >
                          <span className={cn('admin-check-box', granted && 'is-on')}>
                            {granted && <Check className="size-3" aria-hidden="true" />}
                          </span>
                          <Building2 className="size-3.5 shrink-0 text-sage" aria-hidden="true" />
                          <span className="truncate">{home.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Platform admin</h3>
              <p className="admin-card-hint">
                Platform admins can open this console and manage every tenant. Grant this sparingly.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => setPlatformAdmin(selected.userId, !selected.isPlatformAdmin),
                    selected.isPlatformAdmin ? 'Platform admin removed.' : 'Platform admin granted.',
                  )
                }
                className={selected.isPlatformAdmin ? 'admin-danger-button mt-3' : 'admin-primary-button mt-3'}
              >
                {selected.isPlatformAdmin ? 'Remove platform admin' : 'Make platform admin'}
              </button>
            </div>

            {error && <p className="admin-error">{error}</p>}
            {notice && <p className="admin-success">{notice}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
