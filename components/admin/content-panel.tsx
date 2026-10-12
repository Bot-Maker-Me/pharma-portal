'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  addContentItem,
  addFormularyItem,
  deleteContentItem,
  deleteFormularyItem,
  loadTenantContent,
  type ContentItem,
  type FormularyItem,
} from '@/lib/admin/data'
import type { WorkspaceSectionKey } from '@/lib/workspace/sections'

const emptyFormulary = {
  chemicalName: '',
  preferredGeneric: '',
  preferredDin: '',
  alternateGeneric: '',
  alternateDin: '',
  notes: '',
}

/** Shared loader: both editors read the same two tenant-scoped tables. */
function useTenantContent(tenantId: string) {
  const [content, setContent] = useState<ContentItem[]>([])
  const [formulary, setFormulary] = useState<FormularyItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!tenantId) return
    setStatus('loading')
    setError(null)
    try {
      const data = await loadTenantContent(tenantId)
      setContent(data.content)
      setFormulary(data.formulary)
      setStatus('ready')
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this pharmacy’s content.')
      setStatus('error')
    }
  }, [tenantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { content, formulary, status, error, refresh }
}

function Loading() {
  return (
    <div className="flex items-center gap-2 py-6 text-ink-soft">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span className="text-xs">Loading content…</span>
    </div>
  )
}

function FormularyPanel({ tenantId }: { tenantId: string }) {
  const { formulary, status, error, refresh } = useTenantContent(tenantId)
  const [form, setForm] = useState(emptyFormulary)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await action()
      await refresh()
      setNotice(message)
    } catch (failure: unknown) {
      setActionError(failure instanceof Error ? failure.message : 'That change did not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <h3 className="admin-card-title">Add a medicine</h3>
        <p className="admin-card-hint">
          Only this pharmacy sees these rows. Two pharmacies can store identical medicines and never see each
          other&apos;s — the database enforces that, not this screen.
        </p>
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
            }, 'Medicine added to this pharmacy’s formulary.')
          }
          className="admin-primary-button mt-4"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add medicine
        </button>
        {actionError && <p className="admin-error">{actionError}</p>}
        {notice && <p className="admin-success">{notice}</p>}
      </div>

      <div className="admin-card">
        <div className="flex items-baseline justify-between">
          <h3 className="admin-card-title">Formulary items</h3>
          <span className="admin-count">{formulary.length}</span>
        </div>

        {status === 'loading' && <Loading />}
        {status === 'error' && <p className="admin-error">{error}</p>}

        {status === 'ready' &&
          (formulary.length === 0 ? (
            <p className="admin-empty">No medicines yet for this pharmacy.</p>
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
                    disabled={busy}
                    onClick={() => void run(() => deleteFormularyItem(item.id), 'Medicine removed.')}
                    className="admin-danger-button"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  )
}

function SectionPanel({ tenantId, section }: { tenantId: string; section: WorkspaceSectionKey }) {
  const { content, status, error, refresh } = useTenantContent(tenantId)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      await action()
      await refresh()
      setNotice(message)
    } catch (failure: unknown) {
      setActionError(failure instanceof Error ? failure.message : 'That change did not save.')
    } finally {
      setBusy(false)
    }
  }

  const items = content.filter((item) => item.section === section)

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <h3 className="admin-card-title">Add an item</h3>
        <p className="admin-card-hint">
          Items you add here appear in this pharmacy&apos;s workspace sidebar — and nowhere else.
        </p>
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
              await addContentItem({ tenantId, section, title: title.trim(), body })
              setTitle('')
              setBody('')
            }, 'Item added.')
          }
          className="admin-primary-button mt-4"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add item
        </button>
        {actionError && <p className="admin-error">{actionError}</p>}
        {notice && <p className="admin-success">{notice}</p>}
      </div>

      <div className="admin-card">
        <div className="flex items-baseline justify-between">
          <h3 className="admin-card-title">Items in this section</h3>
          <span className="admin-count">{items.length}</span>
        </div>

        {status === 'loading' && <Loading />}
        {status === 'error' && <p className="admin-error">{error}</p>}

        {status === 'ready' &&
          (items.length === 0 ? (
            <p className="admin-empty">Nothing in this section yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col">
              {items.map((item) => (
                <li key={item.id} className="admin-row">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                    {item.body && <span className="block truncate text-[11px] text-ink-soft">{item.body}</span>}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => deleteContentItem(item.id), 'Item removed.')}
                    className="admin-danger-button"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  )
}

export { FormularyPanel, SectionPanel }
