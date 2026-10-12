// Per-pharmacy branding.
//
// A tenant's theme is a single key in public.tenants.theme (added by
// supabase/migrations/20261020000000_tenant_theme_and_chat_archive.sql). The key
// resolves to a block of design-token overrides in app/globals.css
// (`.theme-<key>`), so a branded pharmacy gets its own palette on every screen it
// opens while every other pharmacy keeps the default one.

export type TenantThemeKey = 'default' | 'pharmasave'

export type TenantTheme = {
  key: TenantThemeKey
  label: string
}

export const tenantThemes: TenantTheme[] = [
  { key: 'default', label: 'Default (Formulary)' },
  { key: 'pharmasave', label: 'Pharmasave' },
]

export const defaultTenantTheme: TenantTheme = {
  key: 'default',
  label: 'Default (Formulary)',
}

/** Reads a raw tenants.theme value (text, jsonb, or missing) without throwing. */
export function parseTenantTheme(value: unknown): TenantTheme {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? String((value as { key?: unknown }).key ?? '')
        : ''
  const key = raw.trim().toLowerCase()
  return tenantThemes.find((theme) => theme.key === key) ?? defaultTenantTheme
}

/** Wrapper class that re-points the palette; empty for the default theme. */
export function tenantThemeClass(theme: TenantTheme): string {
  return theme.key === 'default' ? '' : `theme-${theme.key}`
}
