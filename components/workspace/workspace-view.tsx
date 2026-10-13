'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  ClipboardList,
  FileText,
  Inbox,
  Info,
  LifeBuoy,
  LogOut,
  MessagesSquare,
  PhoneCall,
  Search,
  ShieldCheck,
  Sunrise,
  Sunset,
  Table2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { workspaceSections } from '@/lib/workspace/sections'
import { tenantThemeClass, type TenantTheme } from '@/lib/tenant/theme'
import type { WorkspaceData } from '@/lib/workspace/types'

// One icon per content section, so the rail reads at a glance.
const sectionIcons: Record<string, LucideIcon> = {
  opening: Sunrise,
  closing: Sunset,
  staff: Users,
  emergency: PhoneCall,
  standards: FileText,
  support: LifeBuoy,
  forms: ClipboardList,
}

// The `sidebar.icon` names the feature registry uses, resolved to real icons.
const featureIcons: Record<string, LucideIcon> = {
  table: Table2,
  document: FileText,
  check: ClipboardList,
  box: Inbox,
  message: MessagesSquare,
}

function initials(value: string): string {
  const parts = value.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** One entry of the rail: a feature this pharmacy is allowed to open. */
export type WorkspaceFeature = {
  key: string
  name: string
  type: string
  sidebar: { label: string; icon: string; route: string }
}

type WorkspaceViewProps = {
  tenantName: string
  /** The pharmacy's branded theme (`tenants.theme`). */
  theme: TenantTheme
  userEmail: string
  isPlatformAdmin: boolean
  data: WorkspaceData
  /**
   * Everything this pharmacy may open. Custom features are only in here once an
   * administrator has granted them, so the rail is the visible half of that
   * gate — the routes check it again on the server.
   */
  features: WorkspaceFeature[]
  /** True when this is the sample workspace shown before Supabase is connected. */
  preview?: boolean
}

export function WorkspaceView({
  tenantName,
  theme,
  userEmail,
  isPlatformAdmin,
  data,
  features,
  preview,
}: WorkspaceViewProps) {
  const router = useRouter()
  const [section, setSection] = useState<string>('formulary')
  const [query, setQuery] = useState('')

  const formulary = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return data.formulary
    return data.formulary.filter((item) =>
      [item.chemicalName, item.preferredGeneric, item.preferredDin, item.alternateGeneric, item.alternateDin, item.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [data.formulary, query])

  // Extras are the gated half of the rail: a pharmacy only sees one here once an
  // administrator has granted it.
  const customFeatures = features.filter((feature) => feature.type === 'custom')
  const chatFeature = customFeatures.find((feature) => feature.key === 'chat-with-pharmacy') ?? null

  const sectionContent = data.content.filter((item) => item.section === section)
  const activeSection = workspaceSections.find((item) => item.key === section)
  const displayName = userEmail ? userEmail.split('@')[0].replace(/[._-]+/g, ' ') : 'signed in'

  async function handleSignOut() {
    const supabase = createSupabaseClient()
    if (supabase) await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className={cn('ws-shell ws-frame bg-paper', tenantThemeClass(theme))}>
      <aside className="ws-sidebar">
        <div className="ws-sidebar-head">
          <span className="ws-brand-mark" aria-hidden="true">
            +
          </span>
          <div className="ws-brand-name">
            <strong>Pharma</strong>
            <span>Portal</span>
          </div>
          {chatFeature && (
            <Link className="ws-bell" href={chatFeature.sidebar.route} aria-label="Messages and notifications">
              <Bell className="ws-nav-icon" aria-hidden="true" />
            </Link>
          )}
        </div>

        <p className="ws-sidebar-label">HOME</p>
        <div className="ws-tenant-card">{tenantName}</div>

        <nav className="ws-sidebar-nav" aria-label="Workspace sections">
          <button
            type="button"
            onClick={() => setSection('formulary')}
            aria-current={section === 'formulary' ? 'true' : undefined}
            className={cn('ws-nav-row', section === 'formulary' && 'is-active')}
          >
            <Table2 className="ws-nav-icon" aria-hidden="true" />
            <span className="truncate">Formulary</span>
            <span className="ws-nav-count">{data.formulary.length}</span>
          </button>

          {workspaceSections.map((item) => {
            const Icon = sectionIcons[item.key] ?? FileText
            const count = data.content.filter((row) => row.section === item.key).length
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                aria-current={section === item.key ? 'true' : undefined}
                className={cn('ws-nav-row', section === item.key && 'is-active')}
              >
                <Icon className="ws-nav-icon" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                <span className="ws-nav-count">{count}</span>
              </button>
            )
          })}

          {customFeatures.map((feature) => {
            const Icon = featureIcons[feature.sidebar.icon] ?? MessagesSquare
            return (
              <Link key={feature.key} className="ws-nav-row" href={feature.sidebar.route}>
                <Icon className="ws-nav-icon" aria-hidden="true" />
                <span className="truncate">{feature.sidebar.label}</span>
              </Link>
            )
          })}

          {isPlatformAdmin && (
            <Link className="ws-nav-row" href="/admin">
              <ShieldCheck className="ws-nav-icon" aria-hidden="true" />
              <span className="truncate">Admin console</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setSection('account')}
            aria-current={section === 'account' ? 'true' : undefined}
            className={cn('ws-nav-row', section === 'account' && 'is-active')}
          >
            <UserRound className="ws-nav-icon" aria-hidden="true" />
            <span className="truncate">Account</span>
          </button>
        </nav>

        <div className="ws-sidebar-foot">
          <span className="ws-foot-avatar" aria-hidden="true">
            {initials(displayName)}
          </span>
          <div className="ws-foot-name">
            <strong className="truncate">{displayName}</strong>
            <span>Authorized partner</span>
          </div>
          <button type="button" className="ws-signout" onClick={handleSignOut} aria-label="Sign out">
            <LogOut className="ws-nav-icon" aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="ws-main">
        {preview && (
          <div className="mb-5 flex items-start gap-2 border border-line bg-sage/10 p-3 text-xs text-ink-soft">
            <Info className="mt-0.5 size-3.5 shrink-0 text-evergreen" aria-hidden="true" />
            <p>
              <strong className="font-semibold text-ink">Sample workspace for {tenantName}.</strong> This is the preview
              pharmacy, shown until Supabase is connected. Add{' '}
              <code className="rounded bg-paper-deep px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-paper-deep px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — then sign in to load
              the real pharmacy and its live content.
            </p>
          </div>
        )}

        {section === 'formulary' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="ws-title">Formulary</h1>
              <span className="ws-count">
                {formulary.length} of {data.formulary.length} medicines
              </span>
            </div>
            <label className="ws-search mt-4">
              <Search className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chemical, brand or DIN…"
                aria-label="Search formulary"
              />
            </label>

            {data.formulary.length === 0 ? (
              <EmptySection
                title="No medicines for this workspace yet"
                hint="Add them in the Admin console → Workspace content → Formulary."
              />
            ) : (
              <div className="ws-table-wrap mt-4">
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th>Chemical name</th>
                      <th>Preferred generic</th>
                      <th>Preferred DIN</th>
                      <th>Alternate generic</th>
                      <th>Alternate DIN</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formulary.map((item) => (
                      <tr key={item.id}>
                        <td className="font-semibold text-ink">{item.chemicalName}</td>
                        <td>{item.preferredGeneric ?? '—'}</td>
                        <td className="ws-mono">{item.preferredDin ?? '—'}</td>
                        <td>{item.alternateGeneric ?? '—'}</td>
                        <td className="ws-mono">{item.alternateDin ?? '—'}</td>
                        <td>{item.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {section === 'account' && (
          <>
            <h1 className="ws-title">Account</h1>
            <p className="ws-subtitle">The team member signed in and the workspace they are attached to.</p>
            <dl className="ws-account-list">
              <div>
                <dt>Signed in as</dt>
                <dd>{userEmail || 'Not available'}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{tenantName}</dd>
              </div>
              <div>
                <dt>Brand theme</dt>
                <dd>{theme.label}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{isPlatformAdmin ? 'Platform admin' : 'Authorized partner'}</dd>
              </div>
            </dl>
            <button type="button" className="ws-signout-button" onClick={handleSignOut}>
              <LogOut className="ws-nav-icon" aria-hidden="true" />
              Sign out
            </button>
          </>
        )}

        {section !== 'formulary' && section !== 'account' && (
          <>
            <h1 className="ws-title">{activeSection?.label ?? section}</h1>
            {activeSection && <p className="ws-subtitle">{activeSection.hint}</p>}

            {sectionContent.length === 0 ? (
              <EmptySection
                title={`Nothing in ${activeSection?.label ?? 'this section'} yet`}
                hint="Add items in the Admin console → Workspace content."
              />
            ) : (
              <ul className="mt-5 flex flex-col gap-2">
                {sectionContent.map((item) => (
                  <li key={item.id} className="border border-line bg-surface p-4">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    {item.body && <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function EmptySection({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 border border-dashed border-line bg-surface px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
        <Inbox className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-sm text-xs text-ink-soft">{hint}</p>
      </div>
    </div>
  )
}
