'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, Hash, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDayLabel, formatFullTimestamp, formatMessageTime, isSameDay } from '@/lib/chat/format'
import { urgencyMeta } from '@/lib/chat/urgency'
import type { ChatMessage, ConversationRead, SendMessageInput } from '@/lib/chat/types'
import { ChatErrorState, ChatLoadingState, ThreadStartState } from './chat-states'
import { MessageComposer } from './message-composer'
import type { ThreadStatus } from '@/lib/chat/use-chat'

type MessageThreadProps = {
  homeName: string
  messages: ChatMessage[]
  reads: ConversationRead[]
  selfUserId: string | null
  status: ThreadStatus
  error: string | null
  onRetry: () => void
  sending: boolean
  sendError: string | null
  onSend: (input: Omit<SendMessageInput, 'conversationId'>) => Promise<boolean>
  onBack: () => void
  mode: 'live' | 'preview'
}

export function MessageThread({
  homeName,
  messages,
  reads,
  selfUserId,
  status,
  error,
  onRetry,
  sending,
  sendError,
  onSend,
  onBack,
  mode,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages.length, status])

  // The latest time the other side opened this thread — used for read receipts.
  const othersReadAt = useMemo(() => {
    return reads
      .filter((read) => read.userId !== selfUserId)
      .reduce<string | null>((latest, read) => (!latest || read.lastReadAt > latest ? read.lastReadAt : latest), null)
  }, [reads, selfUserId])

  const groups = useMemo(() => {
    const result: { day: string; messages: ChatMessage[] }[] = []
    messages.forEach((message) => {
      const last = result[result.length - 1]
      if (last && isSameDay(last.messages[last.messages.length - 1].createdAt, message.createdAt)) {
        last.messages.push(message)
      } else {
        result.push({ day: formatDayLabel(message.createdAt), messages: [message] })
      }
    })
    return result
  }, [messages])

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep md:hidden"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Homes
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="chat-title truncate">{homeName}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
            <ShieldCheck className="size-3.5 text-sage" aria-hidden="true" />
            Secure channel · shared with the Nursing Home portal
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
            mode === 'live' ? 'bg-sage/20 text-evergreen' : 'bg-coral/15 text-coral',
          )}
        >
          {mode === 'live' ? 'Live' : 'Preview data'}
        </span>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto chat-scroll px-4 py-4" role="log" aria-live="polite">
        {status === 'loading' && <ChatLoadingState label="Loading conversation…" />}
        {status === 'error' && <ChatErrorState message={error ?? 'Unable to load this conversation.'} onRetry={onRetry} />}
        {status === 'ready' && messages.length === 0 && <ThreadStartState homeName={homeName} />}

        {status === 'ready' &&
          groups.map((group) => (
            <div key={`${group.day}-${group.messages[0].id}`} className="mb-4">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{group.day}</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="flex flex-col gap-3">
                {group.messages.map((message) => {
                  const isMine = message.senderId === selfUserId
                  const meta = urgencyMeta[message.urgency]
                  const isRead = Boolean(othersReadAt && othersReadAt >= message.createdAt)
                  const flagged = message.urgency !== 'routine'
                  return (
                    <div key={message.id} className={cn('chat-message flex', isMine ? 'justify-end' : 'justify-start')}>
                      <div className="max-w-[min(34rem,85%)]">
                        {!isMine && (
                          <p className="mb-1 pl-1 text-[11px] font-semibold text-ink-soft">{message.senderName}</p>
                        )}
                        <div
                          className={cn(
                            'rounded-2xl border px-3.5 py-2.5 shadow-sm',
                            isMine
                              ? 'border-evergreen/30 bg-evergreen text-white'
                              : 'border-line bg-surface text-ink',
                          )}
                        >
                          {flagged && (
                            <span
                              className={cn(
                                'mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                message.urgency === 'emergency'
                                  ? 'bg-coral text-white'
                                  : 'bg-coral/20 text-coral',
                              )}
                            >
                              <TriangleAlert className="size-3" aria-hidden="true" />
                              {meta.label}
                            </span>
                          )}
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                          {message.residentId && (
                            <span
                              className={cn(
                                'mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                                isMine ? 'bg-white/15 text-white' : 'bg-sage/20 text-evergreen',
                              )}
                            >
                              <Hash className="size-3" aria-hidden="true" />
                              Resident {message.residentId}
                            </span>
                          )}
                          <div
                            className={cn(
                              'mt-1.5 flex items-center gap-2 text-[10px]',
                              isMine ? 'text-white/70' : 'text-ink-soft',
                            )}
                          >
                            <time dateTime={message.createdAt} title={formatFullTimestamp(message.createdAt)}>
                              {formatMessageTime(message.createdAt)}
                            </time>
                            {isMine && (
                              <span className={cn('font-semibold', isRead ? 'text-white' : 'text-white/60')}>
                                {isRead ? 'Read' : 'Sent'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>

      <MessageComposer
        homeName={homeName}
        onSend={onSend}
        sending={sending}
        error={sendError}
        disabled={status !== 'ready'}
      />
    </div>
  )
}
