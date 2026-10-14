'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatData } from '@/lib/chat/use-chat'
import { initialsFromName } from '@/lib/chat/format'
import { tenantThemeClass } from '@/lib/tenant/theme'
import type { ChatIdentity } from '@/lib/chat/types'
import { NotificationBanner } from '@/components/push/notification-banner'
import { ConversationList } from './conversation-list'
import { MessageThread } from './message-thread'
import { ThreadPlaceholder } from './chat-states'

export function ChatExperience({ identity }: { identity: ChatIdentity }) {
  const chat = useChatData()
  const [pane, setPane] = useState<'list' | 'thread'>('list')

  const activeHome = chat.homes.find((home) => home.id === chat.activeHomeId) ?? null
  // Threads created by the Nursing Home portal may not be linked to a home row
  // yet, so fall back to the label the conversation itself carries.
  const activeHomeName = chat.activeSummary?.homeName ?? activeHome?.name ?? null

  function handleSelectConversation(conversationId: string) {
    chat.selectConversation(conversationId)
    setPane('thread')
  }

  function handleStartConversation(homeId: string) {
    chat.startConversation(homeId)
    setPane('thread')
  }

  return (
    <div className={cn('chat-shell bg-paper', tenantThemeClass(identity.theme))}>
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Workspace</span>
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center bg-evergreen text-sm font-bold text-white">+</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-ink">Chat with Home</p>
            <p className="truncate text-[11px] text-ink-soft">Pharmacy ↔ nursing home messaging</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold text-ink">{identity.displayName}</p>
            <p className="text-[11px] text-ink-soft">{identity.organization ?? 'Pharmacy team'}</p>
          </div>
          <span
            className="flex size-8 items-center justify-center rounded-full bg-sage/25 text-[11px] font-bold text-evergreen"
            aria-hidden="true"
          >
            {initialsFromName(identity.displayName)}
          </span>
        </div>
      </header>

      <NotificationBanner />

      {chat.mode === 'preview' && (
        <div className="flex items-start gap-2 border-b border-line bg-sage/10 px-4 py-2.5 text-[11px] text-ink-soft sm:px-6">
          <Info className="mt-0.5 size-3.5 shrink-0 text-evergreen" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-ink">Preview mode.</strong> Sample data for{' '}
            {identity.organization ?? 'this pharmacy'} is shown until Supabase is connected. Add{' '}
            <code className="rounded bg-paper-deep px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-paper-deep px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to sync live with the
            Nursing Home portal.
          </p>
        </div>
      )}

      <div className="chat-body">
        <aside className={cn('chat-list-pane', pane === 'thread' && 'chat-pane-off')}>
          <ConversationList
            homes={chat.homes}
            conversations={chat.conversations}
            activeConversationId={chat.activeConversationId}
            activeHomeId={chat.activeHomeId}
            onSelectConversation={handleSelectConversation}
            onStartConversation={handleStartConversation}
            onSetArchived={(conversationId, archived) => void chat.archiveConversation(conversationId, archived)}
            archivingId={chat.archivingId}
            archiveError={chat.archiveError}
            status={chat.status}
            error={chat.error}
            onRetry={chat.retry}
          />
        </aside>

        <section className={cn('chat-thread-pane', pane === 'list' && 'chat-pane-off')}>
          {activeHomeName ? (
            <MessageThread
              homeName={activeHomeName}
              conversationTitle={chat.activeSummary?.title ?? null}
              residentRef={chat.activeSummary?.residentRef ?? null}
              archivedAt={chat.activeSummary?.archivedAt ?? null}
              messages={chat.messages}
              status={chat.threadStatus}
              error={chat.threadError}
              onRetry={chat.retry}
              sending={chat.sending}
              sendError={chat.sendError}
              onSend={chat.sendMessage}
              onBack={() => setPane('list')}
              mode={chat.mode}
            />
          ) : (
            <ThreadPlaceholder />
          )}
        </section>
      </div>
    </div>
  )
}
