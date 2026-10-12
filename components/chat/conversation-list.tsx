'use client'

import { useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquarePlus,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatConversationTime, initialsFromName } from '@/lib/chat/format'
import type { AuthorizedHome, ConversationSummary } from '@/lib/chat/types'
import { ChatEmptyState, ChatErrorState, ChatLoadingState } from './chat-states'
import type { LoadStatus } from '@/lib/chat/use-chat'

type ConversationListProps = {
  homes: AuthorizedHome[]
  conversations: ConversationSummary[]
  activeConversationId: string | null
  activeHomeId: string | null
  onSelectConversation: (conversationId: string) => void
  onStartConversation: (homeId: string) => void
  onSetArchived: (conversationId: string, archived: boolean) => void
  archivingId: string | null
  archiveError: string | null
  status: LoadStatus
  error: string | null
  onRetry: () => void
}

function previewText(summary: ConversationSummary): string {
  if (!summary.lastMessageBody) return 'No messages yet — start the conversation'
  const sender = summary.lastMessageSenderName?.split(' ')[0]
  return sender ? `${sender}: ${summary.lastMessageBody}` : summary.lastMessageBody
}

function ThreadRow({
  summary,
  isActive,
  archived,
  busy,
  onSelect,
  onSetArchived,
}: {
  summary: ConversationSummary
  isActive: boolean
  archived: boolean
  busy: boolean
  onSelect: () => void
  onSetArchived: (archived: boolean) => void
}) {
  const hasUnread = summary.unreadCount > 0
  const action = archived ? 'Restore' : 'Archive'
  const actionLabel = `${action} conversation with ${summary.homeName}`

  return (
    <li className="flex items-stretch border-b border-line/70">
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? 'true' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 text-left transition',
          isActive ? 'bg-sage/15' : 'hover:bg-paper-deep/60',
        )}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            isActive ? 'bg-evergreen text-white' : 'bg-sage/25 text-evergreen',
            archived && !isActive && 'opacity-70',
          )}
          aria-hidden="true"
        >
          {initialsFromName(summary.homeName)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className={cn('truncate text-sm font-semibold', archived ? 'text-ink-soft' : 'text-ink')}>
              {summary.homeName}
            </span>
            <span className="shrink-0 text-[10px] text-ink-soft">
              {formatConversationTime(summary.archivedAt ?? summary.lastMessageAt)}
            </span>
          </span>
          <span className="mt-1 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              {summary.title && (
                <span className="shrink-0 rounded bg-paper-deep px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  {summary.title}
                </span>
              )}
              <span className={cn('truncate text-xs', hasUnread && !archived ? 'text-ink' : 'text-ink-soft')}>
                {previewText(summary)}
              </span>
            </span>
            {hasUnread && (
              <span className="flex shrink-0 items-center gap-1">
                {summary.hasUrgent && (
                  <TriangleAlert className="size-3.5 text-coral" aria-label="Unread urgent message" />
                )}
                <span className="min-w-5 rounded-full bg-evergreen px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                  {summary.unreadCount}
                </span>
              </span>
            )}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSetArchived(!archived)}
        disabled={busy}
        title={actionLabel}
        aria-label={actionLabel}
        className="flex w-10 shrink-0 items-center justify-center text-ink-soft transition hover:bg-paper-deep hover:text-evergreen disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : archived ? (
          <ArchiveRestore className="size-4" aria-hidden="true" />
        ) : (
          <Archive className="size-4" aria-hidden="true" />
        )}
      </button>
    </li>
  )
}

export function ConversationList({
  homes,
  conversations,
  activeConversationId,
  activeHomeId,
  onSelectConversation,
  onStartConversation,
  onSetArchived,
  archivingId,
  archiveError,
  status,
  error,
  onRetry,
}: ConversationListProps) {
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const { threads, archived, unstarted } = useMemo(() => {
    const term = query.trim().toLowerCase()
    const matches = (value: string) => value.toLowerCase().includes(term)

    // Every thread the home portal created or replied in, newest activity first.
    const visible = conversations.filter(
      (conversation) => !term || matches(conversation.homeName) || matches(conversation.title ?? ''),
    )
    const threads = visible
      .filter((conversation) => !conversation.archivedAt)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    const archived = visible
      .filter((conversation) => conversation.archivedAt)
      .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))

    // Homes we serve that have no thread at all yet — the pharmacy can start one.
    const withThread = new Set(conversations.map((conversation) => conversation.homeId))
    const unstarted = homes
      .filter((home) => !withThread.has(home.id))
      .filter((home) => !term || matches(home.name))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { threads, archived, unstarted }
  }, [homes, conversations, query])

  if (status === 'loading') return <ChatLoadingState />
  if (status === 'error') return <ChatErrorState message={error ?? 'Unable to load conversations.'} onRetry={onRetry} />
  if (homes.length === 0 && conversations.length === 0) return <ChatEmptyState onRefresh={onRetry} />

  const totalUnread = conversations.reduce((sum, summary) => sum + summary.unreadCount, 0)
  const isEmpty = threads.length === 0 && unstarted.length === 0 && archived.length === 0
  const archivedOpen = showArchived || query.trim().length > 0

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
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="h-9 w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/70"
          />
        </label>
        {archiveError && (
          <p className="mt-2 text-[11px] font-semibold leading-relaxed text-coral" role="alert">
            {archiveError}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto chat-scroll">
        {isEmpty ? (
          <p className="px-4 py-8 text-center text-xs text-ink-soft">
            {query.trim()
              ? `Nothing matches “${query.trim()}”.`
              : 'No nursing homes assigned yet.'}
          </p>
        ) : (
          <ul className="flex flex-col">
            {threads.map((summary) => (
              <ThreadRow
                key={summary.conversationId}
                summary={summary}
                isActive={summary.conversationId === activeConversationId}
                archived={false}
                busy={archivingId === summary.conversationId}
                onSelect={() => onSelectConversation(summary.conversationId)}
                onSetArchived={(next) => onSetArchived(summary.conversationId, next)}
              />
            ))}

            {unstarted.map((home) => {
              const isActive = activeConversationId === null && home.id === activeHomeId
              return (
                <li key={home.id}>
                  <button
                    type="button"
                    onClick={() => onStartConversation(home.id)}
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
                      <span className="truncate text-sm font-semibold text-ink">{home.name}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                        <MessageSquarePlus className="size-3.5 shrink-0" aria-hidden="true" />
                        No messages yet — start the conversation
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}

            {archived.length > 0 && (
              <>
                <li>
                  <button
                    type="button"
                    onClick={() => setShowArchived((current) => !current)}
                    aria-expanded={archivedOpen}
                    className="flex w-full items-center gap-2 border-b border-line/70 bg-paper-deep/50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-soft transition hover:bg-paper-deep"
                  >
                    {archivedOpen ? (
                      <ChevronDown className="size-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    )}
                    Archived
                    <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold normal-case">
                      {archived.length}
                    </span>
                  </button>
                </li>

                {archivedOpen &&
                  archived.map((summary) => (
                    <ThreadRow
                      key={summary.conversationId}
                      summary={summary}
                      isActive={summary.conversationId === activeConversationId}
                      archived
                      busy={archivingId === summary.conversationId}
                      onSelect={() => onSelectConversation(summary.conversationId)}
                      onSetArchived={(next) => onSetArchived(summary.conversationId, next)}
                    />
                  ))}
              </>
            )}
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
