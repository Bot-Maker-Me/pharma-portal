import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { parseTenantTheme, type TenantIdentity } from './theme'

export type { TenantIdentity }

/**
 * Reads a tenant's display name and its branded theme.
 *
 * `tenants.theme` arrives with 20261020000000_tenant_theme_and_chat_archive.sql.
 * Until that migration is applied the same query is retried without the column
 * so a pharmacy still gets a working (default-themed) app instead of an error.
 */
export async function loadTenantIdentity(tenantId: string): Promise<TenantIdentity> {
  const supabase = await createClient()

  const themed = await supabase.from('tenants').select('name, theme').eq('id', tenantId).maybeSingle()
  if (!themed.error) {
    return {
      name: themed.data?.name ?? null,
      theme: parseTenantTheme(themed.data?.theme),
    }
  }

  const plain = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle()
  return { name: plain.data?.name ?? null, theme: parseTenantTheme(null) }
}
