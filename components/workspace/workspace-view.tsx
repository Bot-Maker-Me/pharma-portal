'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { NotificationSettings } from '@/components/push/notification-settings'
import { ChatExperience } from '@/components/chat/chat-experience'
import { TeamChat } from '@/components/team/team-chat'
import { EmployeeRequests } from '@/components/requests/employee-requests'
import {
  chatWithHomeFeatureKey,
  employeeRequestsFeatureKey,
  teamChatFeatureKey,
  type ClientFeature,
} from '@/lib/features/registry'
import { tenantThemeClass, type TenantTheme } from '@/lib/tenant/theme'
import type { ChatIdentity } from '@/lib/chat/types'
import type { WorkspaceData } from '@/lib/workspace/types'

// One icon per feature, keyed by the `sidebar.icon` name in the registry.
const featureIcons: Record<string, LucideIcon> = {
  table: Table2,
  document: FileText,
  sunrise: Sunrise,
  sunset: Sunset,
  users: Users,
  phone: PhoneCall,
  lifebuoy: LifeBuoy,
  clipboard: ClipboardList,
  message: MessagesSquare,
  chat: MessagesSquare,
  inbox: Inbox,
}

/** The feature keys whose page owns the whole main column (like Chat with Home). */
const fullPaneFeatureKeys = new Set([chatWithHomeFeatureKey, teamChatFeatureKey, employeeRequestsFeatureKey])

function initials(value: string): string {
  const parts = value.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type WorkspaceViewProps = {
  tenantName: string
  /** The pharmacy's branded theme (`tenants.theme`). */
  theme: TenantTheme
  userEmail: string
  isPlatformAdmin: boolean
  data: WorkspaceData
  /**
   * The whole feature catalog, each tagged with whether this pharmacy has it on.
   * Only enabled features reach the rail — a platform admin additionally sees the
   * disabled ones, labelled as a preview.
   */
  features: ClientFeature[]
  /** True when this is the sample workspace shown before Supabase is connected. */
  preview?: boolean
  /**
   * Unread totals for the messaging features, shown as badges on their rail items.
   * They arrive precomputed from the server and are kept live by the open pane.
   */
  unread?: { teamChat: number; employeeRequests: number }
}

export function WorkspaceView({
  tenantName,
  theme,
  userEmail,
  isPlatformAdmin,
  data,
  features,
  preview,
  unread: unreadProp,
}: WorkspaceViewProps) {
  const router = useRouter()
  const [section, setSection] = useState<string>('')
  const [query, setQuery] = useState('')
  const [unread, setUnread] = useState(unreadProp ?? { teamChat: 0, employeeRequests: 0 })

  // Keep the badges in step with the server-rendered totals, then let the open
  // pane report changes as messages arrive.
  const teamUnread = unreadProp?.teamChat
  const requestsUnread = unreadProp?.employeeRequests
  useEffect(() => {
    if (teamUnread === undefined && requestsUnread === undefined) return
    setUnread({ teamChat: teamUnread ?? 0, employeeRequests: requestsUnread ?? 0 })
  }, [teamUnread, requestsUnread])

  const onTeamUnread = useCallback((count: number) => {
    setUnread((current) => (current.teamChat === count ? current : { ...current, teamChat: count }))
  }, [])
  const onRequestsUnread = useCallback((count: number) => {
    setUnread((current) =>
      current.employeeRequests === count ? current : { ...current, employeeRequests: count },
    )
  }, [])

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

  // A platform admin may open anything; everyone else sees only what is switched
  // on for their pharmacy. A missing feature simply is not in the rail.
  const shown = features.filter((feature) => feature.enabled || isPlatformAdmin)
  const shownKeys = new Set(shown.map((feature) => feature.key))
  const defaultKey = shownKeys.has('formulary') ? 'formulary' : (shown[0]?.key ?? 'account')
  const activeKey = section === 'account' || shownKeys.has(section) ? section : defaultKey
  const activeFeature = features.find((feature) => feature.key === activeKey) ?? null
  const adminPreviewing = Boolean(activeFeature && !activeFeature.enabled && isPlatformAdmin)

  // Chat with Home, Team Chat and Employee Requests each own the whole main column.
  const fullPane = fullPaneFeatureKeys.has(activeKey)
  // The messaging panes show their own "Admin preview" marker, so the workspace
  // does not draw a second one above them.
  const inlinePreview = Boolean(adminPreviewing && activeFeature && !fullPaneFeatureKeys.has(activeFeature.key))

  const chatVisible = shownKeys.has(chatWithHomeFeatureKey)
  const teamChatVisible = shownKeys.has(teamChatFeatureKey)
  const requestsVisible = shownKeys.has(employeeRequestsFeatureKey)
  const unreadFor = (featureKey: string) =>
    featureKey === teamChatFeatureKey
      ? unread.teamChat
      : featureKey === employeeRequestsFeatureKey
        ? unread.employeeRequests
        : 0
  const countFor = (feature: ClientFeature) =>
    feature.section ? data.content.filter((row) => row.section === feature.section).length : 0

  const displayName = userEmail ? userEmail.split('@')[0].replace(/[._-]+/g, ' ') : 'signed in'

  // Chat with Home runs *inside* the workspace rather than as a separate page, so
  // the pharmacy keeps its rail and never bounces out to a new tab. Its identity
  // is assembled from what the workspace already holds.
  const chatIdentity: ChatIdentity = {
    configured: !preview,
    signedIn: !preview,
    userId: null,
    displayName,
    organization: tenantName,
    theme,
  }

  async function handleSignOut() {
    const supabase = createSupabaseClient()
    if (supabase) await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div
      className={cn(
        'ws-shell ws-frame bg-paper',
        // Locking the frame to one viewport while a messaging pane is open is what
        // makes the message list scroll instead of the whole page.
        fullPane && 'ws-frame--chat',
        tenantThemeClass(theme),
      )}
    >
      <aside className="ws-sidebar">
        <div className="ws-sidebar-head">
          <span className="ws-brand-mark" aria-hidden="true">
            +
          </span>
          <div className="ws-brand-name">
            <strong>Pharma</strong>
            <span>Portal</span>
          </div>
          {chatVisible && (
            <button
              type="button"
              className="ws-bell"
              onClick={() => setSection(chatWithHomeFeatureKey)}
              aria-label="Messages and notifications"
            >
              <Bell className="ws-nav-icon" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="ws-sidebar-label">HOME</p>
        <div className="ws-tenant-card">{tenantName}</div>

        <nav className="ws-sidebar-nav" aria-label="Workspace sections">
          {shown.map((feature) => {
            const Icon = featureIcons[feature.sidebar.icon] ?? FileText
            return (
              <button
                key={feature.key}
                type="button"
                onClick={() => setSection(feature.key)}
                aria-current={activeKey === feature.key ? 'true' : undefined}
                className={cn('ws-nav-row', activeKey === feature.key && 'is-active')}
              >
                <Icon className="ws-nav-icon" aria-hidden="true" />
                <span className="truncate">{feature.sidebar.label}</span>
                {!feature.enabled && (
                  <span className="ml-auto shrink-0 rounded-full bg-sage/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-soft">
                    Preview
                  </span>
                )}
                {feature.key === 'formulary' ? (
                  <span className="ws-nav-count">{data.formulary.length}</span>
                ) : feature.key === teamChatFeatureKey || feature.key === employeeRequestsFeatureKey ? (
                  unreadFor(feature.key) > 0 ? (
                    <span
                      className={cn(
                        'ml-auto shrink-0 rounded-full px-1.5 text-[11px] font-bold leading-5',
                        activeKey === feature.key ? 'bg-white text-evergreen' : 'bg-evergreen text-white',
                      )}
                    >
                      {unreadFor(feature.key)}
                    </span>
                  ) : null
                ) : feature.section ? (
                  <span className="ws-nav-count">{countFor(feature)}</span>
                ) : null}
              </button>
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
            aria-current={activeKey === 'account' ? 'true' : undefined}
            className={cn('ws-nav-row', activeKey === 'account' && 'is-active')}
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

      <main className={cn('ws-main', fullPane && 'ws-chat-main')}>
        {preview && !fullPane && (
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

        {inlinePreview && activeFeature && (
          <div className="mb-5 flex items-center gap-2 border border-line bg-sage/10 px-3 py-2 text-xs text-ink-soft">
            <ShieldCheck className="size-3.5 shrink-0 text-evergreen" aria-hidden="true" />
            <p>
              <strong className="font-semibold text-ink">Admin preview.</strong> {activeFeature.name} is off for this
              pharmacy. Only platform admins can see this.
            </p>
          </div>
        )}

        {activeKey === 'formulary' && (
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

        {activeKey === 'account' && (
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
            <NotificationSettings isPlatformAdmin={isPlatformAdmin} />
            <button type="button" className="ws-signout-button mt-4" onClick={handleSignOut}>
              <LogOut className="ws-nav-icon" aria-hidden="true" />
              Sign out
            </button>
          </>
        )}

        {activeKey === chatWithHomeFeatureKey && chatVisible && (
          <ChatExperience identity={chatIdentity} embedded onExit={() => setSection(defaultKey)} />
        )}

        {activeKey === teamChatFeatureKey && teamChatVisible && (
          <TeamChat
            embedded
            adminPreview={adminPreviewing}
            onExit={() => setSection(defaultKey)}
            onUnreadChange={onTeamUnread}
          />
        )}

        {activeKey === employeeRequestsFeatureKey && requestsVisible && (
          <EmployeeRequests
            embedded
            adminPreview={adminPreviewing}
            onExit={() => setSection(defaultKey)}
            onUnreadChange={onRequestsUnread}
          />
        )}

        {!fullPane && activeKey !== 'formulary' && activeKey !== 'account' && activeFeature && (
          <>
            <h1 className="ws-title">{activeFeature.name}</h1>
            <p className="ws-subtitle">{activeFeature.description}</p>

            {countFor(activeFeature) === 0 ? (
              <EmptySection
                title={`Nothing in ${activeFeature.name} yet`}
                hint="Add items in the Admin console → Workspace content."
              />
            ) : (
              <ul className="mt-5 flex flex-col gap-2">
                {data.content
                  .filter((item) => item.section === activeFeature.section)
                  .map((item) => (
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
