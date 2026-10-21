'use client'

import { useMemo, useState } from 'react'
import { Building2, Inbox, Loader2, Search, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatConversationTime } from '@/lib/chat/format'
import type { RequestStatus, RequestThread } from '@/lib/requests/types'
import type { LoadStatus } from '@/lib/requests/use-requests'

type RequestsListProps = {
  threads: RequestThread[]
  activeThreadId: string | null
  onSelect: (threadId: string) => void
  status: LoadStatus
  error: string | null
  onRetry: () => void
}

function previewText(thread: RequestThread): string {
  if (!thread.lastMessageBody) return 'No messages yet'
  const sender = thread.lastMessageSide === 'pharmacy' ? 'You' : 'Employee'
  return `${sender}: ${thread.lastMessageBody}`
}

export function RequestsList({
  threads,
  activeThreadId,
  onSelect,
  status,
  error,
  onRetry,
}: RequestsListProps) {
  const [statusFilter, setStatusFilter] = useState<RequestStatus>('open')
  const [category, setCategory] = useState('all')
  const [urgentFirst, setUrgentFirst] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [query, setQuery] = useState('')

  const categories = useMemo(() => {
    const set = new Set<string>()
    threads.forEach((thread) => {
      if (thread.category?.trim()) set.add(thread.category.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [threads])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const list = threads.filter((thread) => {
      if (thread.status !== statusFilter) return false
      if (category !== 'all' && (thread.category?.trim() ?? '') !== category) return false
      if (unreadOnly && thread.unreadCount === 0) return false
      if (!term) return true
      return [thread.topic, thread.organizationName ?? '', thread.category ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    })

    return list.sort((a, b) => {
      if (urgentFirst && a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1
      if (unreadOnly && a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
      return b.lastMessageAt.localeCompare(a.lastMessageAt)
    })
  }, [threads, statusFilter, category, unreadOnly, urgentFirst, query])

  const openUnread = threads.filter((thread) => thread.status === 'open').reduce((sum, thread) => sum + thread.unreadCount, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Requests</h2>
          {openUnread > 0 && (
            <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold text-coral">
              {openUnread} unread
            </span>
          )}
        </div>

        <div className="mt-3 inline-flex overflow-hidden rounded-md border border-line">
          {(['open', 'closed'] as RequestStatus[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              aria-pressed={statusFilter === value}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold capitalize transition',
                statusFilter === value ? 'bg-evergreen text-white' : 'bg-surface text-ink-soft hover:bg-paper-deep',
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3">
            <Search className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search requests…"
              aria-label="Search requests"
              className="h-9 w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/70"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
            className="h-9 rounded-md border border-line bg-surface px-2 text-xs font-semibold text-ink-soft outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setUrgentFirst((current) => !current)}
            aria-pressed={urgentFirst}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition',
              urgentFirst
                ? 'border-coral/40 bg-coral/10 text-coral'
                : 'border-line bg-surface text-ink-soft hover:bg-paper-deep',
            )}
          >
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Urgent first
          </button>
          <button
            type="button"
            onClick={() => setUnreadOnly((current) => !current)}
            aria-pressed={unreadOnly}
            className={cn(
              'rounded-full border px-2.5 py-1 transition',
              unreadOnly
                ? 'border-evergreen/40 bg-sage/15 text-evergreen'
                : 'border-line bg-surface text-ink-soft hover:bg-paper-deep',
            )}
          >
            Unread only
          </button>
        </div>
      </div>

      <div className="chat-scroll min-h-0 flex-1">
        {status === 'loading' && (
          <div className="flex items-center gap-2 px-4 py-6 text-xs text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading requests…
          </div>
        )}

        {status === 'error' && (
          <div className="px-4 py-6 text-xs text-ink-soft">
            <p className="font-semibold text-coral" role="alert">
              {error ?? 'Unable to load requests.'}
            </p>
            <p className="mt-2 leading-relaxed">
              If Employee Requests is new here, run the Employee Requests SQL in Supabase, then try again.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-md border border-line bg-surface px-3 py-1.5 font-semibold text-ink transition hover:bg-paper-deep"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
              <Inbox className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-ink">
              {query.trim() ? `Nothing matches “${query.trim()}”.` : `No ${statusFilter} requests`}
            </p>
            <p className="max-w-xs text-xs text-ink-soft">
              Requests raised by employees in the Employee Portal land here.
            </p>
          </div>
        )}

        {visible.length > 0 && (
          <ul className="flex flex-col">
            {visible.map((thread) => {
              const isActive = thread.id === activeThreadId
              const isUrgent = thread.priority === 'urgent'
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(thread.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-line/70 px-4 py-3.5 text-left transition',
                      isActive ? 'bg-sage/15' : 'hover:bg-paper-deep/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        isUrgent ? 'bg-coral/15 text-coral' : 'bg-sage/25 text-evergreen',
                      )}
                      aria-hidden="true"
                    >
                      {isUrgent ? <TriangleAlert className="size-4" /> : <Building2 className="size-4" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{thread.topic}</span>
                        <span className="shrink-0 text-[10px] text-ink-soft">
                          {formatConversationTime(thread.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="truncate text-[11px] text-ink-soft">
                          {thread.organizationName ?? 'Organization'}
                        </span>
                        {thread.category && (
                          <span className="shrink-0 rounded bg-paper-deep px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                            {thread.category}
                          </span>
                        )}
                        {isUrgent && (
                          <span className="shrink-0 rounded-full bg-coral/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-coral">
                            Urgent
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-ink-soft">{previewText(thread)}</span>
                        {thread.unreadCount > 0 && (
                          <span className="min-w-5 shrink-0 rounded-full bg-evergreen px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                            {thread.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
