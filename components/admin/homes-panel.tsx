'use client'

import { useState } from 'react'
import { Building2, Trash2 } from 'lucide-react'
import { createHome, deleteHome, type AdminHome } from '@/lib/admin/data'

export function HomesPanel({ homes, onChanged }: { homes: AdminHome[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await createHome(trimmed)
      setName('')
      await onChanged()
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'Could not create the home.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(home: AdminHome) {
    if (!window.confirm(`Delete "${home.name}"? This also removes it from every user's access list.`)) return
    setError(null)
    try {
      await deleteHome(home.id)
      await onChanged()
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the home.')
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <h2 className="admin-card-title">Add a nursing home</h2>
        <p className="admin-card-hint">
          Homes appear in Chat with Home for every user you grant access to. Grant access from the Users tab.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="admin-field flex-1">
            Home name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Cedarview Residence"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleCreate()
                }
              }}
            />
          </label>
          <button type="button" onClick={() => void handleCreate()} disabled={busy || !name.trim()} className="admin-primary-button">
            {busy ? 'Adding…' : 'Add home'}
          </button>
        </div>
        {error && <p className="admin-error">{error}</p>}
      </div>

      <div className="admin-card">
        <div className="flex items-baseline justify-between">
          <h2 className="admin-card-title">All nursing homes</h2>
          <span className="admin-count">{homes.length}</span>
        </div>
        {homes.length === 0 ? (
          <p className="admin-empty">No nursing homes yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col">
            {homes.map((home) => (
              <li key={home.id} className="admin-row">
                <span className="flex items-center gap-2.5">
                  <Building2 className="size-4 text-sage" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink">{home.name}</span>
                </span>
                <button type="button" onClick={() => void handleDelete(home)} className="admin-danger-button">
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
