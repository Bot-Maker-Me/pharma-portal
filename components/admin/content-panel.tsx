'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  addContentItem,
  addFormularyItem,
  createTenant,
  deleteContentItem,
  deleteFormularyItem,
  loadTenantContent,
  type AdminTenant,
  type ContentItem,
  type FormularyItem,
} from '@/lib/admin/data'
import { workspaceSections, type WorkspaceSectionKey } from '@/lib/workspace/sections'

type ContentPanelProps = {
  tenants: AdminTenant[]
  onChanged: () => Promise<void>
}

type SectionChoice = 'formulary' | WorkspaceSectionKey

const emptyFormulary = {
  chemicalName: '',
  preferredGeneric: '',
  preferredDin: '',
  alternateGeneric: '',
  alternateDin: '',
  notes: '',
}

export function ContentPanel({ tenants, onChanged }: ContentPanelProps) {
  const [tenantId, setTenantId] = useState('')
  const [section, setSection] = useState<SectionChoice>('formulary')
  const [content, setContent] = useState<ContentItem[]>([])
  const [formulary, setFormulary] = useState<FormularyItem[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [form, setForm] = useState(emptyFormulary)

  const [newTenant, setNewTenant] = useState('')

  useEffect(() => {
    if (!tenantId && tenants.length > 0) setTenantId(tenants[0].id)
  }, [tenants, tenantId])

  const refreshContent = useCallback(async (id: string) => {
    setStatus('loading')
    setError(null)
    try {
      const data = await loadTenantContent(id)
      setContent(data.content)
      setFormulary(data.formulary)
      setStatus('ready')
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this tenant’s content.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!tenantId) {
      setStatus('idle')
      setContent([])
      setFormulary([])
      return
    }
    void refreshContent(tenantId)
  }, [tenantId, refreshContent])

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      if (tenantId) await refreshContent(tenantId)
      setNotice(message)
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : 'That change did not save.')
    } finally {
      setBusy(false)
    }
  }

  if (tenants.length === 0) {
    return (
      <div className="admin-panel">
        <div className="admin-card">
          <h2 className="admin-card-title">Create your first tenant</h2>
          <p className="admin-card-hint">
            A tenant is one pharmacy workspace. Every user and every piece of content belongs to a tenant, which is
            what keeps one pharmacy&apos;s data completely separate from another&apos;s.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="admin-field flex-1">
              Tenant name
              <input
                value={newTenant}
                onChange={(event) => setNewTenant(event.target.value)}
                placeholder="e.g. Pharma Strategies"
              />
            </label>
            <button
              type="button"
              disabled={busy || !newTenant.trim()}
              onClick={() =>
                void run(async () => {
                  await createTenant(newTenant.trim())
                  setNewTenant('')
                  await onChanged()
                }, 'Tenant created.')
              }
              className="admin-primary-button"
            >
              Create tenant
            </button>
          </div>
          {error && <p className="admin-error">{error}</p>}
        </div>
      </div>
    )
  }

  const sectionItems = content.filter((item) => item.section === section)

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <h2 className="admin-card-title">Workspace content</h2>
        <p className="admin-card-hint">
          Pick a tenant and a section, then add the data that tenant&apos;s users will see. Nothing here is shared
          between tenants.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="admin-field">
            Tenant
            <select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            Section
            <select value={section} onChange={(event) => setSection(event.target.value as SectionChoice)}>
              <option value="formulary">Formulary</option>
              {workspaceSections.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="admin-card">
        <div className="flex items-baseline justify-between">
          <h2 className="admin-card-title">
            {section === 'formulary' ? 'Formulary items' : workspaceSections.find((s) => s.key === section)?.label}
          </h2>
          <span className="admin-count">
            {section === 'formulary' ? formulary.length : sectionItems.length}
          </span>
        </div>

        {status === 'loading' && (
          <div className="flex items-center gap-2 py-6 text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="text-xs">Loading content…</span>
          </div>
        )}

        {status === 'error' && <p className="admin-error">{error}</p>}

        {status === 'ready' && section === 'formulary' && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="admin-field">
                Chemical name
                <input
                  value={form.chemicalName}
                  onChange={(event) => setForm({ ...form, chemicalName: event.target.value })}
                  placeholder="e.g. Atorvastatin"
                />
              </label>
              <label className="admin-field">
                Preferred generic
                <input
                  value={form.preferredGeneric}
                  onChange={(event) => setForm({ ...form, preferredGeneric: event.target.value })}
                />
              </label>
              <label className="admin-field">
                Preferred DIN
                <input
                  value={form.preferredDin}
                  onChange={(event) => setForm({ ...form, preferredDin: event.target.value })}
                />
              </label>
              <label className="admin-field">
                Alternate generic
                <input
                  value={form.alternateGeneric}
                  onChange={(event) => setForm({ ...form, alternateGeneric: event.target.value })}
                />
              </label>
              <label className="admin-field">
                Alternate DIN
                <input
                  value={form.alternateDin}
                  onChange={(event) => setForm({ ...form, alternateDin: event.target.value })}
                />
              </label>
              <label className="admin-field">
                Notes
                <input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || !form.chemicalName.trim()}
              onClick={() =>
                void run(async () => {
                  await addFormularyItem({ tenantId, ...form })
                  setForm(emptyFormulary)
                }, 'Medicine added to this tenant’s formulary.')
              }
              className="admin-primary-button mt-4"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add medicine
            </button>

            {formulary.length === 0 ? (
              <p className="admin-empty">No medicines yet for this tenant.</p>
            ) : (
              <ul className="mt-4 flex flex-col">
                {formulary.map((item) => (
                  <li key={item.id} className="admin-row">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{item.chemicalName}</span>
                      <span className="block truncate text-[11px] text-ink-soft">
                        {[item.preferredGeneric, item.preferredDin].filter(Boolean).join(' · ') || 'No preferred generic'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void run(() => deleteFormularyItem(item.id), 'Medicine removed.')}
                      className="admin-danger-button"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {status === 'ready' && section !== 'formulary' && (
          <>
            <div className="mt-4 grid gap-3">
              <label className="admin-field">
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Check refrigerator temperature"
                />
              </label>
              <label className="admin-field">
                Details (optional)
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={3}
                  className="admin-textarea"
                  placeholder="Extra instructions, contact numbers, links…"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() =>
                void run(async () => {
                  await addContentItem({ tenantId, section: section as WorkspaceSectionKey, title: title.trim(), body })
                  setTitle('')
                  setBody('')
                }, 'Item added.')
              }
              className="admin-primary-button mt-4"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add item
            </button>

            {sectionItems.length === 0 ? (
              <p className="admin-empty">Nothing in this section yet.</p>
            ) : (
              <ul className="mt-4 flex flex-col">
                {sectionItems.map((item) => (
                  <li key={item.id} className="admin-row">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                      {item.body && <span className="block truncate text-[11px] text-ink-soft">{item.body}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => void run(() => deleteContentItem(item.id), 'Item removed.')}
                      className="admin-danger-button"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {notice && <p className="admin-success">{notice}</p>}
      </div>
    </div>
  )
}
