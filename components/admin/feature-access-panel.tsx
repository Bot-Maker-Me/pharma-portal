'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { featureRegistry } from '@/lib/features/registry'
import { loadAllTenantFeatures, setFeatureForAll, setTenantFeature, type AdminTenant } from '@/lib/admin/data'

type View = 'pharmacy' | 'feature'

/**
 * Feature access — the release control for the whole platform.
 *
 * Every feature is OFF until it is switched on for a pharmacy, so shipping a
 * module to one customer is one toggle. This panel is the only place a switch can
 * be flipped, and every flip writes an audit entry (who, which pharmacy, which
 * feature, when, and the before/after value).
 */
export function FeatureAccessPanel({
  tenants,
  tenantId,
  onChanged,
}: {
  tenants: AdminTenant[]
  tenantId: string
  onChanged: () => Promise<void>
}) {
  const [view, setView] = useState<View>('pharmacy')
  const [matrix, setMatrix] = useState<Set<string>>(new Set())
  const [featureKey, setFeatureKey] = useState(featureRegistry[0]?.key ?? '')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const tenant = tenants.find((item) => item.id === tenantId) ?? null
  const feature = featureRegistry.find((item) => item.key === featureKey) ?? null

  const reload = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const rows = await loadAllTenantFeatures()
      setMatrix(new Set(rows.map((row) => `${row.tenantId}:${row.featureKey}`)))
      setStatus('ready')
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not read the feature matrix.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const isOn = (forTenant: string, forFeature: string) => matrix.has(`${forTenant}:${forFeature}`)

  async function handleToggle(forTenant: string, forFeature: string, next: boolean) {
    setBusy(`${forTenant}:${forFeature}`)
    setError(null)
    try {
      await setTenantFeature({ tenantId: forTenant, featureKey: forFeature, enabled: next })
      setMatrix((current) => {
        const copy = new Set(current)
        const cell = `${forTenant}:${forFeature}`
        if (next) copy.add(cell)
        else copy.delete(cell)
        return copy
      })
      await onChanged()
    } catch (toggleError: unknown) {
      setError(toggleError instanceof Error ? toggleError.message : 'Could not change this feature.')
    } finally {
      setBusy(null)
    }
  }

  async function handleToggleAll(next: boolean) {
    if (!feature || tenants.length === 0) return
    const verb = next ? 'Enable' : 'Disable'
    if (
      !window.confirm(
        `${verb} “${feature.name}” for all ${tenants.length} pharmacies?\n\nEvery pharmacy is written and audited separately.`,
      )
    )
      return
    setBusy(`all:${feature.key}`)
    setError(null)
    try {
      await setFeatureForAll({ featureKey: feature.key, enabled: next, tenantIds: tenants.map((item) => item.id) })
      await reload()
      await onChanged()
    } catch (bulkError: unknown) {
      setError(bulkError instanceof Error ? bulkError.message : 'Could not change this feature for every pharmacy.')
    } finally {
      setBusy(null)
    }
  }

  const enabledForFeature = feature ? tenants.filter((item) => isOn(item.id, feature.key)).length : 0

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="admin-card-title">Feature access</h3>
            <p className="admin-card-hint">
              Every feature is off until you switch it on, one pharmacy at a time. A missing switch is OFF.
            </p>
          </div>
          <div className="inline-flex overflow-hidden rounded-md border border-line">
            <button
              type="button"
              onClick={() => setView('pharmacy')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition',
                view === 'pharmacy' ? 'bg-evergreen text-white' : 'bg-surface text-ink-soft hover:bg-paper-deep',
              )}
            >
              By pharmacy
            </button>
            <button
              type="button"
              onClick={() => setView('feature')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition',
                view === 'feature' ? 'bg-evergreen text-white' : 'bg-surface text-ink-soft hover:bg-paper-deep',
              )}
            >
              By feature
            </button>
          </div>
        </div>

        {error && <p className="admin-error">{error}</p>}

        {status === 'loading' ? (
          <div className="flex items-center gap-2 py-6 text-xs text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Reading feature access…
          </div>
        ) : view === 'pharmacy' ? (
          !tenant ? (
            <p className="admin-empty mt-4">Pick a pharmacy in the rail to see and change what it has access to.</p>
          ) : (
            <>
              <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-ink">
                <Building2 className="size-3.5 text-sage" aria-hidden="true" />
                {tenant.name}
              </p>
              <ul className="mt-2 flex flex-col">
                {featureRegistry.map((item) => {
                  const on = isOn(tenant.id, item.key)
                  const cellBusy = busy === `${tenant.id}:${item.key}`
                  return (
                    <li key={item.key} className="admin-row">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{item.name}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{item.description}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className={cn('text-[11px] font-semibold', on ? 'text-evergreen' : 'text-ink-soft')}>
                          {on ? 'On' : 'Off'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${item.name} for ${tenant.name}`}
                          disabled={cellBusy}
                          onClick={() => void handleToggle(tenant.id, item.key, !on)}
                          className={cn(
                            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
                            on ? 'bg-evergreen' : 'bg-line',
                            cellBusy && 'opacity-60',
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block size-4 rounded-full bg-white shadow transition',
                              on ? 'translate-x-4' : 'translate-x-0.5',
                            )}
                          />
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )
        ) : (
          <>
            <label className="admin-field mt-4">
              Feature
              <select value={featureKey} onChange={(event) => setFeatureKey(event.target.value)}>
                {featureRegistry.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            {feature && (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-ink-soft">
                    <strong className="font-semibold text-ink">{enabledForFeature}</strong> of {tenants.length}{' '}
                    pharmacies have this on.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="admin-primary-button"
                      disabled={busy !== null || tenants.length === 0}
                      onClick={() => void handleToggleAll(true)}
                    >
                      {busy === `all:${feature.key}` ? 'Working…' : 'Enable for all'}
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      disabled={busy !== null || tenants.length === 0}
                      onClick={() => void handleToggleAll(false)}
                    >
                      {busy === `all:${feature.key}` ? 'Working…' : 'Disable for all'}
                    </button>
                  </div>
                </div>

                {tenants.length === 0 ? (
                  <p className="admin-empty mt-3">No pharmacies yet.</p>
                ) : (
                  <ul className="mt-3 flex flex-col">
                    {tenants.map((item) => {
                      const on = isOn(item.id, feature.key)
                      const cellBusy = busy === `${item.id}:${feature.key}`
                      return (
                        <li key={item.id} className="admin-row">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Building2 className="size-4 shrink-0 text-sage" aria-hidden="true" />
                            <span className="truncate text-sm font-semibold text-ink">{item.name}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className={cn('text-[11px] font-semibold', on ? 'text-evergreen' : 'text-ink-soft')}>
                              {on ? 'On' : 'Off'}
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={on}
                              aria-label={`${feature.name} for ${item.name}`}
                              disabled={cellBusy}
                              onClick={() => void handleToggle(item.id, feature.key, !on)}
                              className={cn(
                                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
                                on ? 'bg-evergreen' : 'bg-line',
                                cellBusy && 'opacity-60',
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block size-4 rounded-full bg-white shadow transition',
                                  on ? 'translate-x-4' : 'translate-x-0.5',
                                )}
                              />
                            </button>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="admin-card">
        <h3 className="admin-card-title">How feature access works</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-ink-soft">
          <li>· A feature is hidden until it is switched on for that pharmacy; there is no default.</li>
          <li>· The rail shows only enabled features. A disabled route shows a “not available yet” page, not the content.</li>
          <li>
            · Platform admins can open every feature for testing — a feature that is off for their pharmacy is labelled
            “Admin preview”.
          </li>
          <li>· Every change is written to the audit log with your account, the time, and the before/after value.</li>
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-soft">
          <ShieldCheck className="size-3.5 text-evergreen" aria-hidden="true" />
          Data tables are additionally protected by row-level security, so a feature is never reachable by its data alone.
          <Sparkles className="size-3.5 text-sage" aria-hidden="true" />
        </p>
      </div>
    </div>
  )
}
