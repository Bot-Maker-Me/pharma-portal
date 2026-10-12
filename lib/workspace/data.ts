import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { ContentRow, FormularyRow, WorkspaceData } from './types'

/**
 * Loads everything the workspace shows for one tenant. RLS guarantees the query
 * only ever returns rows belonging to that tenant, so two pharmacies with
 * identical content never see each other's data.
 */
export async function loadWorkspaceData(tenantId: string): Promise<WorkspaceData> {
  const supabase = await createClient()

  const [formularyResult, contentResult] = await Promise.all([
    supabase
      .from('formulary_items')
      .select('id, chemical_name, preferred_generic, preferred_din, alternate_generic, alternate_din, notes')
      .eq('tenant_id', tenantId)
      .order('chemical_name', { ascending: true }),
    supabase
      .from('tenant_content')
      .select('id, section, title, body')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true }),
  ])

  const formulary: FormularyRow[] = ((formularyResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    chemicalName: String(row.chemical_name ?? ''),
    preferredGeneric: (row.preferred_generic as string | null) ?? null,
    preferredDin: (row.preferred_din as string | null) ?? null,
    alternateGeneric: (row.alternate_generic as string | null) ?? null,
    alternateDin: (row.alternate_din as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }))

  const content: ContentRow[] = ((contentResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    section: String(row.section ?? ''),
    title: String(row.title ?? ''),
    body: (row.body as string | null) ?? null,
  }))

  return { formulary, content }
}
