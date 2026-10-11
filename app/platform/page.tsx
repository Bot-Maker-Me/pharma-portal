import { requirePlatformAdmin, getTenantEntitlements } from '@/lib/features/server'
import { getBaseFeatures, getCustomFeatures } from '@/lib/features/registry'

export default async function PlatformPage() {
  const isConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!isConfigured) {
    return <main className="platform-shell"><header className="platform-header"><div><span className="panel-kicker">PLATFORM CONSOLE</span><h1>Pharma-Portal administration</h1><p>Connect Supabase to enable tenant-aware platform administration.</p></div><span className="today-badge">Setup required</span></header><section className="platform-section"><span className="panel-kicker">READY FOR YOUR PROJECT</span><h2>Supabase is intentionally not connected yet.</h2><p>Once you add the Supabase URL and publishable key, this route will enforce session, tenant membership, platform-admin access, feature entitlements, and audit logging.</p></section></main>
  }
  const context = await requirePlatformAdmin()
  const entitlements = await getTenantEntitlements(context.tenantId)
  const baseFeatures = getBaseFeatures()
  const customFeatures = getCustomFeatures()

  return (
    <main className="platform-shell">
      <header className="platform-header">
        <div><span className="panel-kicker">PLATFORM CONSOLE</span><h1>Pharma-Portal administration</h1><p>Manage tenants, feature access, and audit history from a separate platform surface.</p></div>
        <span className="today-badge">Platform admin</span>
      </header>
      <section className="platform-grid">
        <article className="module-panel"><span className="panel-kicker">CURRENT TENANT</span><h2>{context.tenantId}</h2><p>{entitlements.length} enabled custom entitlements.</p></article>
        <article className="module-panel"><span className="panel-kicker">TENANTS</span><h2>Tenant directory</h2><p>Tenant membership and plan information belongs here once the migration is applied.</p><button className="ghost-button">Manage tenants</button></article>
      </section>
      <section className="platform-section"><div className="module-heading"><div><span className="panel-kicker">FEATURE CATALOG</span><h2>Base and custom features</h2></div><button className="dark-button">+ Add feature</button></div><div className="feature-catalog">{baseFeatures.map((feature) => <article className="catalog-row" key={feature.key}><div><strong>{feature.name}</strong><p>{feature.description}</p></div><span className="current-badge">BASE · ACTIVE</span></article>)}{customFeatures.map((feature) => <article className="catalog-row" key={feature.key}><div><strong>{feature.name}</strong><p>{feature.description}</p></div><span className="ghost-badge">CUSTOM</span></article>)}</div></section>
      <section className="platform-section"><div className="module-heading"><div><span className="panel-kicker">AUDIT TRAIL</span><h2>Recent entitlement events</h2><p>Grant, revoke, config-change, and tenant-preview events are recorded server-side.</p></div><button className="ghost-button">View all audit events</button></div></section>
    </main>
  )
}
