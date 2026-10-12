import { parseTenantTheme, type TenantIdentity } from './theme'

/**
 * The pharmacy the app runs as when Supabase credentials are absent (local
 * preview / first run) — Pharmasave West Hills, carrying its own Pharmasave
 * theme. Live mode never uses this: it reads the real tenant from
 * `public.tenants` (see lib/tenant/server.ts), so the branding stays tied to the
 * pharmacy that actually holds it.
 */
export const previewTenant: TenantIdentity = {
  name: 'Pharmasave West Hills',
  theme: parseTenantTheme('pharmasave'),
}
