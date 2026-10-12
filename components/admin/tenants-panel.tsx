'use client'

import { useState } from 'react'
import { Building, Trash2 } from 'lucide-react'
import { createTenant, deleteTenant, type AdminTenant } from '@/lib/admin/data'

export function TenantsPanel({
  tenants,
  onChanged,
}: {
  tenants: AdminTenant[]
  onChanged: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await createTenant(trimmed)
      setName('')
      await onChanged()
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'Could not create the pharmacy.')
    } finally {
      setBusy(false)
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
          keeps two pharmacies&apos; data completely separate even when the contents are identical.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="admin-field flex-1">
            Pharmacy name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Maple Street Pharmacy"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleCreate()
                }
              }}
            />
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
                <span className="flex items-center gap-2.5">
                  <Building className="size-4 text-sage" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink">{tenant.name}</span>
                  <span className="text-[11px] text-ink-soft">{tenant.plan}</span>
                </span>
                <button type="button" onClick={() => void handleDelete(tenant)} className="admin-danger-button">
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
