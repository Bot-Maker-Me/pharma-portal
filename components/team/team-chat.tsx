'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTeamChat } from '@/lib/team/use-team-chat'
import type { NewTeamChannelInput } from '@/lib/team/types'
import { AdminPreviewNotice } from '@/components/features/feature-gate'
import { TeamChatList } from './team-chat-list'
import { TeamChatThread } from './team-chat-thread'
import { NewChatDialog } from './new-chat-dialog'

/** Shown above every team conversation — a reminder of the house rules. */
const STAFF_NOTE = 'For staff communication only. Use resident IDs or initials, never full names.'

type TeamChatProps = {
  /** Rendered inside the workspace rail (mobile hides the rail for this pane). */
  embedded?: boolean
  /** Rendered by the feature route for a platform admin previewing an off feature. */
  adminPreview?: boolean
  /** Embedded on a phone: leave the chat and return to the rail. */
  onExit?: () => void
  /** Reports the unread total so the sidebar badge stays in step. */
  onUnreadChange?: (count: number) => void
}

/**
 * Team Chat — staff-to-staff messaging inside one pharmacy.
 *
 * The left pane is my chats (with unread badges and search), the right pane is the
 * open conversation. On phones only one pane shows at a time.
 */
export function TeamChat({ embedded = false, adminPreview = false, onExit, onUnreadChange }: TeamChatProps) {
  const chat = useTeamChat()
  const [pane, setPane] = useState<'list' | 'thread'>('list')
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    onUnreadChange?.(chat.totalUnread)
  }, [chat.totalUnread, onUnreadChange])

  function handleSelect(channelId: string) {
    chat.selectChannel(channelId)
    setPane('thread')
  }

  async function handleCreate(input: NewTeamChannelInput) {
    const channelId = await chat.createChannel(input)
    if (channelId) {
      setDialogOpen(false)
      setPane('thread')
    }
  }

  return (
    <div className={cn('msg-shell', embedded ? 'msg-shell--embedded' : 'msg-shell--standalone', 'bg-paper')}>
      {embedded ? (
        <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5 lg:hidden">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Workspace
            </button>
          )}
          <p className="truncate text-sm font-bold tracking-tight text-ink">Team Chat</p>
        </header>
      ) : (
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Workspace</span>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-ink">Team Chat</p>
            <p className="truncate text-[11px] text-ink-soft">Staff messaging inside your pharmacy</p>
          </div>
        </header>
      )}

      {adminPreview && (
        <div className="border-b border-line p-3">
          <AdminPreviewNotice label="Team Chat" />
        </div>
      )}

      <div className="flex items-start gap-2 border-b border-line bg-sage/10 px-4 py-2.5 text-[11px] text-ink-soft sm:px-6">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-evergreen" aria-hidden="true" />
        <p>{STAFF_NOTE}</p>
      </div>

      <div className="msg-body">
        <aside className={cn('msg-list-pane', pane === 'thread' && 'msg-pane-off')}>
          <TeamChatList
            channels={chat.channels}
            activeChannelId={chat.activeChannelId}
            onSelect={handleSelect}
            onNewChat={() => setDialogOpen(true)}
            status={chat.status}
            error={chat.error}
            onRetry={chat.retry}
            creating={chat.creating}
          />
        </aside>

        <section className={cn('msg-thread-pane', pane === 'list' && 'msg-pane-off')}>
          <TeamChatThread
            channel={chat.activeChannel}
            userId={chat.userId}
            messages={chat.messages}
            status={chat.threadStatus}
            error={chat.threadError}
            sending={chat.sending}
            sendError={chat.sendError}
            onRetry={chat.retry}
            onSend={chat.sendMessage}
            onEdit={chat.editMessage}
            onDelete={chat.deleteMessage}
            onBack={() => setPane('list')}
            mode={chat.mode}
          />
        </section>
      </div>

      <NewChatDialog
        open={dialogOpen}
        colleagues={chat.colleagues}
        busy={chat.creating}
        error={chat.sendError}
        onClose={() => setDialogOpen(false)}
        onCreate={(input) => void handleCreate(input)}
      />
    </div>
  )
}
