import type { ComponentType } from 'react'

// Base features are part of every pharmacy's workspace. Custom features stay
// switched off until a platform administrator grants them to a specific
// pharmacy from the admin console — see public.tenant_features.
export type FeatureType = 'base' | 'custom'

export type FeatureDefinition = {
  key: string
  name: string
  description: string
  type: FeatureType
  sidebar: { label: string; icon: string; route: string }
  route: string
  load?: () => Promise<{ default: ComponentType }>
  defaults?: Record<string, unknown>
}

export const featureRegistry: FeatureDefinition[] = [
  { key: 'formulary', name: 'Formulary', description: 'Preferred medicines and substitution rules.', type: 'base', sidebar: { label: 'Formulary', icon: 'table', route: '/workspace/formulary' }, route: '/workspace/formulary' },
  { key: 'sops', name: 'SOPs & Policies', description: 'Searchable procedures and policy versions.', type: 'base', sidebar: { label: 'SOPs & Policies', icon: 'document', route: '/workspace/sops' }, route: '/workspace/sops' },
  { key: 'opening-closing', name: 'Opening / Closing', description: 'Daily opening and closing checklists.', type: 'base', sidebar: { label: 'Opening / Closing', icon: 'check', route: '/workspace/procedures' }, route: '/workspace/procedures' },
  { key: 'blister-pack-tracker', name: 'Blister Pack Tracker', description: 'Track blister pack preparation.', type: 'base', sidebar: { label: 'Blister Pack Tracker', icon: 'box', route: '/workspace/blister-packs' }, route: '/workspace/blister-packs' },
  { key: 'delivery-slips', name: 'Delivery Slips', description: 'Prepare and manage delivery slips.', type: 'base', sidebar: { label: 'Delivery Slips', icon: 'truck', route: '/workspace/delivery-slips' }, route: '/workspace/delivery-slips' },
  { key: 'signing-sheet', name: 'Signing Sheet', description: 'Daily sign-off records.', type: 'base', sidebar: { label: 'Signing Sheet', icon: 'pen', route: '/workspace/signing-sheet' }, route: '/workspace/signing-sheet' },
  { key: 'vaccine-wait-list', name: 'Vaccine Wait List', description: 'Manage vaccine requests and wait lists.', type: 'base', sidebar: { label: 'Vaccine Wait List', icon: 'syringe', route: '/workspace/vaccine-wait-list' }, route: '/workspace/vaccine-wait-list' },
  { key: 'chat-with-pharmacy', name: 'Chat with Pharmacy', description: 'Secure messaging between the pharmacy and the nursing homes it serves. Granted per pharmacy by an administrator.', type: 'custom', sidebar: { label: 'Chat with Pharmacy', icon: 'message', route: '/chat' }, route: '/chat' },
]

export function getFeature(featureKey: string) { return featureRegistry.find((feature) => feature.key === featureKey) }
export function getBaseFeatures() { return featureRegistry.filter((feature) => feature.type === 'base') }
export function getCustomFeatures() { return featureRegistry.filter((feature) => feature.type === 'custom') }

export function getVisibleFeatures(enabledKeys: Iterable<string>) {
  const enabled = new Set(enabledKeys)
  return featureRegistry.filter((feature) => feature.type === 'base' || enabled.has(feature.key))
}

export function registerCustomFeature(feature: FeatureDefinition) {
  if (feature.type !== 'custom') throw new Error('Only custom features can be registered dynamically.')
  if (featureRegistry.some((item) => item.key === feature.key)) throw new Error(`Feature already registered: ${feature.key}`)
  featureRegistry.push(feature)
}

export function hasRegisteredFeature(featureKey: string) { return Boolean(getFeature(featureKey)) }

export type FeatureGrant = { feature_key: string; enabled: boolean; config: Record<string, unknown>; granted_at: string; notes: string | null }
export type TenantContext = { userId: string; tenantId: string; role: 'owner' | 'admin' | 'staff' }

export const featureKeys = featureRegistry.map((feature) => feature.key)

export function featureToClient(feature: FeatureDefinition) {
  return { key: feature.key, name: feature.name, description: feature.description, type: feature.type, sidebar: feature.sidebar, route: feature.route }
}

export function featuresToClient(features: FeatureDefinition[]) { return features.map(featureToClient) }

export function parseConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
