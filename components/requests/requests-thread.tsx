'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Building2, ChevronLeft, CircleAlert, Inbox, Loader2, Lock, LockOpen, SendHorizontal, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatDayLabel,
  formatFullTimestamp,
  formatMessageTime,
  initialsFromName,
  isSameDay,
} from '@/lib/chat/format'
import type { RequestMessage, RequestStatus, RequestThread } from '@/lib/requests/types'
import type { ThreadStatus } from '@/lib/requests/use-requests'

const MAX_MESSAGE_LENGTH = 4000

type RequestsThreadProps = {
  thread: RequestThread | null
  messages: RequestMessage[]
  status: ThreadStatus
  error: string | null
  sending: boolean
  sendError: string | null
  onRetry: () => void
  onSend: (body: string) => Promise<boolean>
  onSetStatus: (status: RequestStatus) => Promise<boolean>
  onBack: () => void
  mode: 'live' | 'preview'
}

export function RequestsThread({
  thread,
  messages,
  status,
  error,
  sending,
  sendError,
  onRetry,
  onSend,
  onSetStatus,
  onBack,
  mode,
}: RequestsThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages.length, status, thread?.id])

  const groups = useMemo(() => {
    const result: { day: string; messages: RequestMessage[] }[] = []
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

  if (!thread) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
          <Inbox className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Pick a request to read it</p>
          <p className="mt-1 max-w-xs text-xs text-ink-soft">
            Requests raised by employees in the Employee Portal appear on the left.
          </p>
        </div>
      </div>
    )
  }

  const isClosed = thread.status === 'closed'

  async function changeStatus(next: RequestStatus) {
    setStatusBusy(true)
    await onSetStatus(next)
    setStatusBusy(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep md:hidden"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Requests
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="msg-title truncate">{thread.topic}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" aria-hidden="true" />
                {thread.organizationName ?? 'Organization'}
              </span>
              {thread.category && <span className="rounded bg-paper-deep px-1.5 py-0.5 font-semibold">{thread.category}</span>}
              {thread.priority === 'urgent' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-coral/15 px-2 py-0.5 font-bold uppercase tracking-wide text-coral">
                  <TriangleAlert className="size-3" aria-hidden="true" />
                  Urgent
                </span>
              )}
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
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
              isClosed ? 'bg-paper-deep text-ink-soft' : 'bg-sage/20 text-evergreen',
            )}
          >
            {isClosed ? <Lock className="size-3" aria-hidden="true" /> : <LockOpen className="size-3" aria-hidden="true" />}
            {isClosed ? 'Closed' : 'Open'}
          </span>

          <button
            type="button"
            onClick={() => void changeStatus(isClosed ? 'open' : 'closed')}
            disabled={statusBusy}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50',
              isClosed
                ? 'border-evergreen/30 bg-sage/15 text-evergreen hover:bg-sage/25'
                : 'border-line bg-surface text-ink-soft hover:bg-paper-deep',
            )}
          >
            {statusBusy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {isClosed ? 'Reopen' : 'Close thread'}
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="chat-scroll px-4 py-4" role="log" aria-live="polite">
        {status === 'loading' && (
          <div className="flex items-center gap-2 py-6 text-xs text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading conversation…
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 text-xs">
            <p className="font-semibold text-coral" role="alert">
              {error ?? 'Unable to load this request.'}
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

        {status === 'ready' && messages.length === 0 && (
          <p className="py-8 text-center text-xs text-ink-soft">No messages in this request yet.</p>
        )}

        {status === 'ready' &&
          groups.map((group) => (
            <div key={`${group.day}-${group.messages[0].id}`} className="mb-4">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  {group.day}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="flex flex-col gap-3">
                {group.messages.map((message) => {
                  const isMine = message.senderSide === 'pharmacy'
                  return (
                    <div
                      key={message.id}
                      className={cn('chat-message flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}
                    >
                      {!isMine && (
                        <span
                          className="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-sage/25 text-[10px] font-bold text-evergreen"
                          aria-hidden="true"
                        >
                          {initialsFromName(message.senderName)}
                        </span>
                      )}
                      <div className="max-w-[min(34rem,80%)]">
                        {!isMine && (
                          <p className="mb-1 pl-1 text-[11px] font-semibold text-ink-soft">{message.senderName}</p>
                        )}
                        <div
                          className={cn(
                            'rounded-2xl border px-3.5 py-2.5 shadow-sm',
                            isMine ? 'border-evergreen/30 bg-evergreen text-white' : 'border-line bg-surface text-ink',
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                          <div
                            className={cn(
                              'mt-1.5 flex items-center gap-2 text-[10px]',
                              isMine ? 'text-white/70' : 'text-ink-soft',
                            )}
                          >
                            <time dateTime={message.createdAt} title={formatFullTimestamp(message.createdAt)}>
                              {formatMessageTime(message.createdAt)}
                            </time>
                            {isMine && <span className="font-semibold">{message.readAt ? 'Read' : 'Sent'}</span>}
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

      {isClosed ? (
        <div className="flex items-center gap-2 border-t border-line bg-surface px-4 py-3 text-xs text-ink-soft">
          <Lock className="size-3.5" aria-hidden="true" />
          This thread is closed. Reopen it to reply.
        </div>
      ) : (
        <RequestsComposer
          topic={thread.topic}
          onSend={onSend}
          sending={sending}
          error={sendError}
          disabled={status !== 'ready'}
        />
      )}
    </div>
  )
}

function RequestsComposer({
  topic,
  onSend,
  sending,
  error,
  disabled,
}: {
  topic: string
  onSend: (body: string) => Promise<boolean>
  sending: boolean
  error: string | null
  disabled?: boolean
}) {
  const [body, setBody] = useState('')
  const canSend = body.trim().length > 0 && !sending && !disabled

  async function submit() {
    if (!canSend) return
    const ok = await onSend(body.trim())
    if (ok) setBody('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <form
      className="border-t border-line bg-surface px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="request-reply">
          Reply about {topic}
        </label>
        <textarea
          id="request-reply"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder="Write a reply…  (Enter to send, Shift + Enter for a new line)"
          className="msg-field max-h-40 min-h-11 flex-1 resize-y rounded-md px-3 py-2.5 outline-none focus:border-evergreen"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-evergreen px-4 text-sm font-semibold text-white transition hover:bg-evergreen/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizontal className="size-4" aria-hidden="true" />
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-coral" role="alert">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </form>
  )
}
