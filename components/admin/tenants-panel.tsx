'use client'

import { useState } from 'react'
import { Building, Palette, Trash2 } from 'lucide-react'
import { createTenant, deleteTenant, setTenantTheme, type AdminTenant } from '@/lib/admin/data'
import { parseTenantTheme, tenantThemes, type TenantThemeKey } from '@/lib/tenant/theme'

const themeMigrationHint =
  'Pharmacy themes need the tenants.theme column — run 20261020000000_tenant_theme_and_chat_archive.sql in the Supabase SQL Editor.'

export function TenantsPanel({
  tenants,
  onChanged,
}: {
  tenants: AdminTenant[]
  onChanged: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [theme, setTheme] = useState<TenantThemeKey>('default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [themingId, setThemingId] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await createTenant(trimmed, theme)
      setName('')
      setTheme('default')
      await onChanged()
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'Could not create the pharmacy.')
    } finally {
      setBusy(false)
    }
  }

  async function handleThemeChange(tenant: AdminTenant, nextTheme: TenantThemeKey) {
    setThemingId(tenant.id)
    setError(null)
    try {
      await setTenantTheme(tenant.id, nextTheme)
      await onChanged()
    } catch (themeError: unknown) {
      setError(themeError instanceof Error ? themeError.message : 'Could not save the theme.')
    } finally {
      setThemingId(null)
    }
  }

  async function handleDelete(tenant: AdminTenant) {
    if (
      !window.confirm(
        `Delete "${tenant.name}"? Every user, medicine and content item belonging to it is removed too.`,
      )
    )
      return
    setError(null)
    try {
      await deleteTenant(tenant.id)
      await onChanged()
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the pharmacy.')
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <h3 className="admin-card-title">Add a pharmacy</h3>
        <p className="admin-card-hint">
          One pharmacy is one tenant. Everything — users, formulary, procedures — belongs to a tenant, which is what
          keeps two pharmacies&apos; data completely separate even when the contents are identical. A theme brands
          that pharmacy&apos;s own screens, and nobody else&apos;s.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="admin-field flex-1">
            Pharmacy name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Pharmasave West Hills"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleCreate()
                }
              }}
            />
          </label>
          <label className="admin-field">
            Theme
            <select value={theme} onChange={(event) => setTheme(parseTenantTheme(event.target.value).key)}>
              {tenantThemes.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={busy || !name.trim()}
            className="admin-primary-button"
          >
            {busy ? 'Adding…' : 'Add pharmacy'}
          </button>
        </div>
        {error && <p className="admin-error">{error}</p>}
        {error && /theme/i.test(error) && <p className="admin-card-hint">{themeMigrationHint}</p>}
      </div>

      <div className="admin-card">
        <div className="flex items-baseline justify-between">
          <h3 className="admin-card-title">All pharmacies</h3>
          <span className="admin-count">{tenants.length}</span>
        </div>
        {tenants.length === 0 ? (
          <p className="admin-empty">No pharmacies yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {tenants.map((tenant) => (
              <li key={tenant.id} className="admin-row">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Building className="size-4 shrink-0 text-sage" aria-hidden="true" />
                  <span className="truncate text-sm font-semibold text-ink">{tenant.name}</span>
                  <span className="shrink-0 text-[11px] text-ink-soft">{tenant.plan}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="flex items-center gap-1.5 text-ink-soft">
                    <Palette className="size-3.5" aria-hidden="true" />
                    <label className="sr-only" htmlFor={`theme-${tenant.id}`}>
                      Theme for {tenant.name}
                    </label>
                    <select
                      id={`theme-${tenant.id}`}
                      value={parseTenantTheme(tenant.theme).key}
                      disabled={themingId === tenant.id}
                      onChange={(event) =>
                        void handleThemeChange(tenant, parseTenantTheme(event.target.value).key)
                      }
                      className="admin-select"
                    >
                      {tenantThemes.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </span>
                  <button type="button" onClick={() => void handleDelete(tenant)} className="admin-danger-button">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
