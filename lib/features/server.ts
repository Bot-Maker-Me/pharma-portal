import 'server-only'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getVisibleFeatures, type FeatureDefinition, type FeatureGrant, type TenantContext } from './registry'

// Mirrors `type: 'base'` in the registry. A feature listed here is part of every
// pharmacy's workspace; anything else has to be granted in tenant_features.
const baseFeatureKeys = new Set(['formulary', 'sops', 'opening-closing', 'blister-pack-tracker', 'delivery-slips', 'signing-sheet', 'vaccine-wait-list'])

export async function getSessionTenant(): Promise<TenantContext | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: membership } = await supabase.from('tenant_members').select('tenant_id, role').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
  if (!membership) return null
  return { userId: user.id, tenantId: membership.tenant_id, role: membership.role }
}

export async function getTenantEntitlements(tenantId: string): Promise<FeatureGrant[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return []
  const supabase = await createClient()
  const { data } = await supabase.from('tenant_features').select('feature_key, enabled, config, granted_at, notes').eq('tenant_id', tenantId).eq('enabled', true)
  return (data ?? []) as FeatureGrant[]
}

export async function hasFeature(tenantId: string, featureKey: string) {
  if (baseFeatureKeys.has(featureKey)) return true
  const grants = await getTenantEntitlements(tenantId)
  return grants.some((grant) => grant.feature_key === featureKey && grant.enabled)
}

/**
 * Everything a pharmacy's workspace should show: all base features, plus the
 * custom ones an administrator has granted it. A custom feature that has never
 * been granted simply is not in the list, so nothing renders for it.
 */
export async function getVisibleTenantFeatures(tenantId: string): Promise<FeatureDefinition[]> {
  const grants = await getTenantEntitlements(tenantId)
  return getVisibleFeatures(grants.map((grant) => grant.feature_key))
}

export async function requireTenant() {
  const context = await getSessionTenant()
  if (!context) notFound()
  return context
}

export async function requireFeature(featureKey: string) {
  const context = await requireTenant()
  if (!(await hasFeature(context.tenantId, featureKey))) notFound()
  return context
}

export async function requirePlatformAdmin() {
  const context = await requireTenant()
  const supabase = await createClient()
  const { data } = await supabase.from('platform_admins').select('user_id').eq('user_id', context.userId).maybeSingle()
  if (!data) notFound()
  return context
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
