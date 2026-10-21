'use client'

import { useMemo, useState } from 'react'
import { Loader2, MessagesSquare, Search, SquarePen, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatConversationTime } from '@/lib/chat/format'
import type { TeamChannelSummary } from '@/lib/team/types'
import type { LoadStatus } from '@/lib/team/use-team-chat'

type TeamChatListProps = {
  channels: TeamChannelSummary[]
  activeChannelId: string | null
  onSelect: (channelId: string) => void
  onNewChat: () => void
  status: LoadStatus
  error: string | null
  onRetry: () => void
  creating: boolean
}

function previewText(channel: TeamChannelSummary): string {
  if (!channel.lastMessageBody) return 'No messages yet — say hello'
  const sender = channel.lastMessageSenderName
  return sender ? `${sender}: ${channel.lastMessageBody}` : channel.lastMessageBody
}

export function TeamChatList({
  channels,
  activeChannelId,
  onSelect,
  onNewChat,
  status,
  error,
  onRetry,
  creating,
}: TeamChatListProps) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const sorted = [...channels].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
    if (!term) return sorted
    return sorted.filter((channel) =>
      [channel.title, ...channel.members.map((member) => member.displayName)]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [channels, query])

  const totalUnread = channels.reduce((sum, channel) => sum + channel.unreadCount, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">My chats</h2>
          {totalUnread > 0 && (
            <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold text-coral">
              {totalUnread} unread
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onNewChat}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-evergreen px-3 py-2 text-sm font-semibold text-white transition hover:bg-evergreen/90"
        >
          <SquarePen className="size-4" aria-hidden="true" />
          New chat
        </button>

        <label className="mt-3 flex items-center gap-2 rounded-md border border-line bg-surface px-3">
          <Search className="size-4 shrink-0 text-ink-soft" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="h-9 w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/70"
          />
        </label>
      </div>

      <div className="chat-scroll min-h-0 flex-1">
        {status === 'loading' && (
          <div className="flex items-center gap-2 px-4 py-6 text-xs text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading your chats…
          </div>
        )}

        {status === 'error' && (
          <div className="px-4 py-6 text-xs text-ink-soft">
            <p className="font-semibold text-coral" role="alert">
              {error ?? 'Unable to load your chats.'}
            </p>
            <p className="mt-2 leading-relaxed">
              If Team Chat is new here, run the Team Chat SQL in Supabase, then try again.
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
              <MessagesSquare className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-ink">
              {query.trim() ? `Nothing matches “${query.trim()}”.` : 'No chats yet'}
            </p>
            {!query.trim() && (
              <p className="max-w-xs text-xs text-ink-soft">
                Start a chat with a colleague in your pharmacy — one-to-one, or a group with a name.
              </p>
            )}
            {creating && (
              <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Creating…
              </span>
            )}
          </div>
        )}

        {visible.length > 0 && (
          <ul className="flex flex-col">
            {visible.map((channel) => {
              const isActive = channel.channelId === activeChannelId
              const hasUnread = channel.unreadCount > 0
              return (
                <li key={channel.channelId}>
                  <button
                    type="button"
                    onClick={() => onSelect(channel.channelId)}
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
                      {channel.type === 'group' ? (
                        <Users className="size-4" />
                      ) : (
                        channel.title.slice(0, 2).toUpperCase()
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{channel.title}</span>
                        <span className="shrink-0 text-[10px] text-ink-soft">
                          {formatConversationTime(channel.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs text-ink-soft">{previewText(channel)}</span>
                        {hasUnread && (
                          <span className="min-w-5 shrink-0 rounded-full bg-evergreen px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                            {channel.unreadCount}
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
