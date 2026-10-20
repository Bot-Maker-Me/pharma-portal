import 'server-only'

import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFeature, type FeatureDefinition, type FeatureGrant, type TenantContext } from './registry'

export async function getSessionTenant(): Promise<TenantContext | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: membership } = await supabase.from('tenant_members').select('tenant_id, role').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
  if (!membership) return null
  return { userId: user.id, tenantId: membership.tenant_id, role: membership.role }
}

/**
 * The feature keys switched on for one pharmacy.
 *
 * Memoised per request (so the sidebar, the page body and any guard agree without
 * re-querying), and FAILS CLOSED: a missing key, a query error or an unconfigured
 * client all return an empty list, which hides every feature rather than exposing
 * one that may not be paid for or approved.
 */
export const getTenantFeatureKeys = cache(async (tenantId: string): Promise<string[]> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tenant_features')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
  if (error) return []
  return ((data ?? []) as { feature_key: string }[]).map((row) => String(row.feature_key))
})

export async function getTenantEntitlements(tenantId: string): Promise<FeatureGrant[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from('tenant_features').select('feature_key, enabled, config, granted_at, notes').eq('tenant_id', tenantId).eq('enabled', true)
  if (error) return []
  return (data ?? []) as FeatureGrant[]
}

/** Whether a pharmacy has this feature switched on. Fails closed. */
export async function hasFeature(tenantId: string, featureKey: string): Promise<boolean> {
  return (await getTenantFeatureKeys(tenantId)).includes(featureKey)
}

export const isPlatformAdmin = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data } = await supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle()
  return Boolean(data)
})

export async function requireTenant() {
  const context = await getSessionTenant()
  if (!context) notFound()
  return context
}

export async function requirePlatformAdmin() {
  const context = await requireTenant()
  if (!(await isPlatformAdmin(context.userId))) notFound()
  return context
}

/**
 * How one feature should render for the current user.
 *
 *  - `no-tenant`     the visitor has no pharmacy workspace
 *  - `on`            switched on for their pharmacy
 *  - `admin-preview` off for their pharmacy, but they are a platform admin — they
 *                    may open it anyway, clearly labelled
 *  - `off`           off for their pharmacy and not an admin → the friendly
 *                    "not available yet" page
 */
export type FeatureGate =
  | { state: 'no-tenant' }
  | { state: 'on'; tenant: TenantContext; feature: FeatureDefinition }
  | { state: 'admin-preview'; tenant: TenantContext; feature: FeatureDefinition }
  | { state: 'off'; tenant: TenantContext; feature: FeatureDefinition }

export async function gateFeature(featureKey: string): Promise<FeatureGate> {
  const feature = getFeature(featureKey)
  if (!feature) notFound()
  const tenant = await getSessionTenant()
  if (!tenant) return { state: 'no-tenant' }
  if (await hasFeature(tenant.tenantId, feature.key)) return { state: 'on', tenant, feature }
  if (await isPlatformAdmin(tenant.userId)) return { state: 'admin-preview', tenant, feature }
  return { state: 'off', tenant, feature }
}

export type PlatformAdminGate =
  | { ok: true; userId: string }
  | { ok: false; reason: 'unconfigured' | 'not-admin'; email: string | null }

/**
 * Platform-admin gate that does NOT require tenant membership — used by the
 * admin console, which manages tenants rather than belonging to one.
 *
 * Signed-out visitors are redirected to sign-in. A signed-in visitor who is not
 * a platform admin gets a denied result instead of a bare 404, so the console can
 * say exactly why: which account is signed in and which Supabase project was
 * consulted. Access is refused either way — the difference is only that the
 * refusal is legible.
 */
export async function requirePlatformAdminOnly(): Promise<PlatformAdminGate> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, reason: 'unconfigured', email: null }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data } = await supabase.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!data) return { ok: false, reason: 'not-admin', email: user.email ?? null }

  return { ok: true, userId: user.id }
}

export async function writeFeatureAudit(input: { action: 'grant' | 'revoke' | 'config_change' | 'tenant_preview'; tenantId?: string; featureKey?: string; before?: unknown; after?: unknown }) {
  const context = await requirePlatformAdmin()
  const supabase = await createClient()
  await supabase.from('feature_audit_log').insert({ actor_id: context.userId, tenant_id: input.tenantId ?? null, feature_key: input.featureKey ?? null, action: input.action, before_state: input.before ?? null, after_state: input.after ?? null })
}
