import type { ComponentType } from 'react'
import type { WorkspaceSectionKey } from '@/lib/workspace/sections'

/**
 * The feature catalog — the single source of truth for what a pharmacy can open.
 *
 * Every entry is a per-pharmacy switch. There is no "in every workspace" default
 * any more: a feature is OFF unless a row in public.tenant_features says it is
 * enabled, so the release of a module is one deliberate toggle at a time.
 *
 * The catalog mirrors into public.features (key/name/description) whenever an
 * administrator changes a switch — see setTenantFeature in lib/admin/data.ts.
 */
export const chatWithHomeFeatureKey = 'chat-with-home'
export const teamChatFeatureKey = 'team_chat'
export const employeeRequestsFeatureKey = 'employee_requests'

export type FeatureDefinition = {
  key: string
  name: string
  description: string
  /** Sidebar label and icon name (resolved to a lucide icon in the workspace). */
  sidebar: { label: string; icon: string }
  /**
   * Content-section modules read public.tenant_content for this section. The
   * key and the section are the same word, which is what lets the data-table
   * RLS gate call feature_enabled(section) directly.
   */
  section?: WorkspaceSectionKey
  /** Standalone page modules, reachable by URL and gated on the same key. */
  route?: string
  load?: () => Promise<{ default: ComponentType }>
}

export const featureRegistry: FeatureDefinition[] = [
  {
    key: 'formulary',
    name: 'Formulary',
    description: 'Preferred medicines and substitution rules.',
    sidebar: { label: 'Formulary', icon: 'table' },
  },
  {
    key: 'opening',
    name: 'Opening Procedure',
    description: 'Steps to complete when opening the pharmacy.',
    sidebar: { label: 'Opening Procedure', icon: 'sunrise' },
    section: 'opening',
  },
  {
    key: 'closing',
    name: 'Closing Procedure',
    description: 'Steps to complete before locking up.',
    sidebar: { label: 'Closing Procedure', icon: 'sunset' },
    section: 'closing',
  },
  {
    key: 'staff',
    name: 'Staff Schedule',
    description: 'Team members and their shifts.',
    sidebar: { label: 'Staff Schedule', icon: 'users' },
    section: 'staff',
  },
  {
    key: 'emergency',
    name: 'Emergency Contact List',
    description: 'After-hours, prescriber and manager contacts.',
    sidebar: { label: 'Emergency Contact List', icon: 'phone' },
    section: 'emergency',
  },
  {
    key: 'standards',
    name: 'Standards of Procedure',
    description: 'Standard operating procedures and policies.',
    sidebar: { label: 'Standards of Procedure', icon: 'document' },
    section: 'standards',
  },
  {
    key: 'support',
    name: 'Prescription Data Entry Support Resources',
    description: 'Prescription data-entry reference material.',
    sidebar: { label: 'Prescription Data Entry Support Resources', icon: 'lifebuoy' },
    section: 'support',
  },
  {
    key: 'forms',
    name: 'Third Party Forms',
    description: 'Claim forms, links and downloads.',
    sidebar: { label: 'Third Party Forms', icon: 'clipboard' },
    section: 'forms',
  },
  {
    key: chatWithHomeFeatureKey,
    name: 'Chat with Home',
    description: 'Secure messaging between the pharmacy and the nursing homes it serves.',
    sidebar: { label: 'Chat with Home', icon: 'message' },
    route: '/chat',
  },
  {
    // Shared with the Employee Portal's staff messaging. Pharmacy staff only ever
    // see channels belonging to their own pharmacy, and only while this is on.
    key: teamChatFeatureKey,
    name: 'Team Chat',
    description: 'Secure messaging between the staff at your pharmacy.',
    sidebar: { label: 'Team Chat', icon: 'chat' },
    route: '/workspace/team_chat',
    load: () => import('@/components/team/team-chat-route'),
  },
  {
    // The inbox for conversations started by employees in the Employee Portal.
    key: employeeRequestsFeatureKey,
    name: 'Employee Requests',
    description: 'An inbox for requests started by employees in the Employee Portal.',
    sidebar: { label: 'Employee Requests', icon: 'inbox' },
    route: '/workspace/employee_requests',
    load: () => import('@/components/requests/employee-requests-route'),
  },
]

/** What the workspace rail receives: the catalog, each with its on/off state. */
export type ClientFeature = {
  key: string
  name: string
  description: string
  sidebar: { label: string; icon: string }
  section?: WorkspaceSectionKey
  route?: string
  enabled: boolean
}

export function getFeature(featureKey: string): FeatureDefinition | undefined {
  return featureRegistry.find((feature) => feature.key === featureKey)
}

/** The whole catalog, each tagged with whether this pharmacy has it switched on. */
export function toClientFeatures(enabledKeys: Iterable<string>): ClientFeature[] {
  const enabled = new Set(enabledKeys)
  return featureRegistry.map((feature) => ({
    key: feature.key,
    name: feature.name,
    description: feature.description,
    sidebar: feature.sidebar,
    section: feature.section,
    route: feature.route,
    enabled: enabled.has(feature.key),
  }))
}

export function parseConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export type FeatureGrant = {
  feature_key: string
  enabled: boolean
  config: Record<string, unknown>
  granted_at: string
  notes: string | null
}
export type TenantContext = { userId: string; tenantId: string; role: 'owner' | 'admin' | 'staff' }
