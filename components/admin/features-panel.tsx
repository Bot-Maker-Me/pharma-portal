'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadTenantFeatureKeys, setTenantFeature, type AdminTenant } from '@/lib/admin/data'
import { getCustomFeatures } from '@/lib/features/registry'

/**
 * Grants custom features — the ones that are not part of every workspace — to
 * one pharmacy at a time. This panel is the only place a grant can be made.
 */
export function FeaturesPanel({
  tenants,
  tenantId,
  onChanged,
}: {
  tenants: AdminTenant[]
  tenantId: string
  onChanged: () => Promise<void>
}) {
  const customFeatures = getCustomFeatures()
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tenant = tenants.find((item) => item.id === tenantId) ?? null

  const load = useCallback(async () => {
    if (!tenantId) {
      setGranted(new Set())
      setStatus('ready')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      setGranted(new Set(await loadTenantFeatureKeys(tenantId)))
      setStatus('ready')
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Could not read this pharmacy’s features.')
      setStatus('error')
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleToggle(featureKey: string, next: boolean) {
    setBusyKey(featureKey)
    setError(null)
    try {
      await setTenantFeature({ tenantId, featureKey, enabled: next })
      setGranted((current) => {
        const copy = new Set(current)
        if (next) copy.add(featureKey)
        else copy.delete(featureKey)
        return copy
      })
      await onChanged()
    } catch (toggleError: unknown) {
      setError(toggleError instanceof Error ? toggleError.message : 'Could not change this feature.')
    } finally {
      setBusyKey(null)
    }
  }

  if (!tenant) {
    return (
      <div className="admin-panel">
        <div className="admin-card">
          <h3 className="admin-card-title">No pharmacy selected</h3>
          <p className="admin-card-hint">
            Pick a pharmacy in the rail to see and change what it has access to.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <h3 className="admin-card-title">Extra features</h3>
        <p className="admin-card-hint">
          These are not part of the standard workspace. Nothing here is switched on for {tenant.name} until you turn it
          on, and your choice never affects another pharmacy.
        </p>

        {status === 'loading' ? (
          <div className="flex items-center gap-2 py-6 text-xs text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Reading entitlements…
          </div>
        ) : (
          <ul className="mt-3 flex flex-col">
            {customFeatures.map((feature) => {
              const isOn = granted.has(feature.key)
              const isBusy = busyKey === feature.key
              return (
                <li key={feature.key} className="admin-row">
                  <span className="flex min-w-0 items-start gap-2.5">
                    {isOn ? (
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-evergreen" aria-hidden="true" />
                    ) : (
                      <Lock className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{feature.name}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{feature.description}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        isOn ? 'text-evergreen' : 'text-ink-soft',
                      )}
                    >
                      {isOn ? 'Granted' : 'Not granted'}
                    </span>
                    {isOn ? (
                      <button
                        type="button"
                        className="admin-danger-button"
                        disabled={isBusy}
                        onClick={() => void handleToggle(feature.key, false)}
                      >
                        {isBusy ? 'Saving…' : 'Revoke'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-primary-button"
                        disabled={isBusy}
                        onClick={() => void handleToggle(feature.key, true)}
                      >
                        {isBusy ? 'Saving…' : 'Grant access'}
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {error && <p className="admin-error">{error}</p>}
        {error && /relation|does not exist|schema cache/i.test(error) && (
          <p className="admin-card-hint">
            Grants live in the <code className="font-mono">tenant_features</code> table. Run{' '}
            <code className="font-mono">20260929000000_feature_entitlements.sql</code> in the Supabase SQL Editor.
          </p>
        )}
      </div>

      <div className="admin-card">
        <h3 className="admin-card-title">How access works</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-ink-soft">
          <li>· A pharmacy sees only the features granted to it; no other pharmacy is affected.</li>
          <li>· The workspace rail shows a custom feature the moment it is granted, and hides it again on revoke.</li>
          <li>· Opening a gated route by its address does not bypass this — access is checked on the server too.</li>
          <li>· Every grant and revoke is written to the audit log with your account and the time.</li>
        </ul>
      </div>
    </div>
  )
}
