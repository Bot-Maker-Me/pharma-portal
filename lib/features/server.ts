import 'server-only'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { FeatureGrant, TenantContext } from './registry'

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

export async function writeFeatureAudit(input: { action: 'grant' | 'revoke' | 'config_change' | 'tenant_preview'; tenantId?: string; featureKey?: string; before?: unknown; after?: unknown }) {
  const context = await requirePlatformAdmin()
  const supabase = await createClient()
  await supabase.from('feature_audit_log').insert({ actor_id: context.userId, tenant_id: input.tenantId ?? null, feature_key: input.featureKey ?? null, action: input.action, before_state: input.before ?? null, after_state: input.after ?? null })
}
