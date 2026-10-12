'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Inbox, LayoutList, MessagesSquare, Search, ShieldCheck, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { workspaceSections } from '@/lib/workspace/sections'
import type { WorkspaceData } from '@/lib/workspace/types'

type WorkspaceViewProps = {
  tenantName: string
  userEmail: string
  isPlatformAdmin: boolean
  data: WorkspaceData
}

export function WorkspaceView({ tenantName, userEmail, isPlatformAdmin, data }: WorkspaceViewProps) {
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

  const sectionContent = data.content.filter((item) => item.section === section)
  const activeSection = workspaceSections.find((item) => item.key === section)

  return (
    <div className="ws-shell flex min-h-dvh flex-col bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center bg-evergreen text-sm font-bold text-white">+</span>
          <div>
            <p className="text-sm font-bold tracking-tight text-ink">{tenantName}</p>
            <p className="text-[11px] text-ink-soft">Workspace · signed in as {userEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 rounded-md bg-evergreen px-3 py-2 text-xs font-semibold text-white transition hover:bg-evergreen/90"
          >
            <MessagesSquare className="size-3.5" aria-hidden="true" />
            Chat with Home
          </Link>
          {isPlatformAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Admin console
            </Link>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[15rem_1fr]">
        <aside className="min-h-0 border-line md:border-r">
          <nav className="flex flex-col gap-0.5 p-3" aria-label="Workspace sections">
            <button
              type="button"
              onClick={() => setSection('formulary')}
              aria-current={section === 'formulary' ? 'true' : undefined}
              className={cn('ws-nav-item', section === 'formulary' && 'is-active')}
            >
              <Table2 className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Formulary</span>
              <span className="ws-nav-count">{data.formulary.length}</span>
            </button>
            {workspaceSections.map((item) => {
              const count = data.content.filter((row) => row.section === item.key).length
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  aria-current={section === item.key ? 'true' : undefined}
                  className={cn('ws-nav-item', section === item.key && 'is-active')}
                >
                  <LayoutList className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                  <span className="ws-nav-count">{count}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {section === 'formulary' ? (
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
          ) : (
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
