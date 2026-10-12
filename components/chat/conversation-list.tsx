'use client'

import { useMemo, useState } from 'react'
import { Building2, Search, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatConversationTime, initialsFromName } from '@/lib/chat/format'
import type { AuthorizedHome, ConversationSummary } from '@/lib/chat/types'
import { ChatEmptyState, ChatErrorState, ChatLoadingState } from './chat-states'
import type { LoadStatus } from '@/lib/chat/use-chat'

type ConversationListProps = {
  homes: AuthorizedHome[]
  conversations: ConversationSummary[]
  activeHomeId: string | null
  onSelect: (homeId: string) => void
  status: LoadStatus
  error: string | null
  onRetry: () => void
}

type ListItem = {
  home: AuthorizedHome
  summary: ConversationSummary | null
}

export function ConversationList({
  homes,
  conversations,
  activeHomeId,
  onSelect,
  status,
  error,
  onRetry,
}: ConversationListProps) {
  const [query, setQuery] = useState('')

  const items = useMemo<ListItem[]>(() => {
    const summariesByHome = new Map(conversations.map((summary) => [summary.homeId, summary]))
    const merged = homes.map((home) => ({ home, summary: summariesByHome.get(home.id) ?? null }))
    const term = query.trim().toLowerCase()
    const filtered = term
      ? merged.filter((item) => item.home.name.toLowerCase().includes(term))
      : merged

    return filtered.sort((a, b) => {
      // Active conversations first (most recent), then unstarted homes by name.
      if (a.summary && b.summary) return b.summary.lastMessageAt.localeCompare(a.summary.lastMessageAt)
      if (a.summary) return -1
      if (b.summary) return 1
      return a.home.name.localeCompare(b.home.name)
    })
  }, [homes, conversations, query])

  if (status === 'loading') return <ChatLoadingState />
  if (status === 'error') return <ChatErrorState message={error ?? 'Unable to load conversations.'} onRetry={onRetry} />
  if (homes.length === 0) return <ChatEmptyState onRefresh={onRetry} />

  const totalUnread = conversations.reduce((sum, summary) => sum + summary.unreadCount, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Conversations</h2>
          {totalUnread > 0 && (
            <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold text-coral">
              {totalUnread} unread
            </span>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-md border border-line bg-surface px-3">
          <Search className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nursing homes…"
            aria-label="Search nursing homes"
            className="h-9 w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/70"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto chat-scroll">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-ink-soft">No nursing homes match “{query}”.</p>
        ) : (
          <ul className="flex flex-col">
            {items.map(({ home, summary }) => {
              const isActive = home.id === activeHomeId
              const hasUnread = (summary?.unreadCount ?? 0) > 0
              return (
                <li key={home.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(home.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-line/70 px-4 py-3.5 text-left transition',
                      isActive ? 'bg-sage/15' : 'hover:bg-paper-deep/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        isActive ? 'bg-evergreen text-white' : 'bg-sage/25 text-evergreen',
                      )}
                      aria-hidden="true"
                    >
                      {initialsFromName(home.name)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{home.name}</span>
                        {summary && (
                          <span className="shrink-0 text-[10px] text-ink-soft">
                            {formatConversationTime(summary.lastMessageAt)}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className={cn('truncate text-xs', hasUnread ? 'text-ink' : 'text-ink-soft')}>
                          {summary?.lastMessageBody
                            ? `${summary.lastMessageSenderName ? `${summary.lastMessageSenderName.split(' ')[0]}: ` : ''}${summary.lastMessageBody}`
                            : 'No messages yet — start the conversation'}
                        </span>
                        {hasUnread && (
                          <span className="flex shrink-0 items-center gap-1">
                            {summary?.hasUrgent && <TriangleAlert className="size-3.5 text-coral" aria-label="Unread urgent message" />}
                            <span className="min-w-5 rounded-full bg-evergreen px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                              {summary.unreadCount}
                            </span>
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

      <p className="flex items-center gap-2 border-t border-line px-4 py-3 text-[11px] text-ink-soft">
        <Building2 className="size-3.5" aria-hidden="true" />
        {homes.length} nursing {homes.length === 1 ? 'home' : 'homes'} assigned to your pharmacy
      </p>
    </div>
  )
}
