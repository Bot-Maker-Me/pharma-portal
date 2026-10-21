'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, CircleAlert, Loader2, Pencil, SendHorizontal, Trash2, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatDayLabel,
  formatFullTimestamp,
  formatMessageTime,
  initialsFromName,
  isSameDay,
} from '@/lib/chat/format'
import type { TeamChannelSummary, TeamMessage } from '@/lib/team/types'
import type { ThreadStatus } from '@/lib/team/use-team-chat'

const MAX_MESSAGE_LENGTH = 4000

type TeamChatThreadProps = {
  channel: TeamChannelSummary | null
  userId: string
  messages: TeamMessage[]
  status: ThreadStatus
  error: string | null
  sending: boolean
  sendError: string | null
  onRetry: () => void
  onSend: (body: string) => Promise<boolean>
  onEdit: (messageId: string, body: string) => Promise<boolean>
  onDelete: (messageId: string) => Promise<boolean>
  onBack: () => void
  mode: 'live' | 'preview'
}

export function TeamChatThread({
  channel,
  userId,
  messages,
  status,
  error,
  sending,
  sendError,
  onRetry,
  onSend,
  onEdit,
  onDelete,
  onBack,
  mode,
}: TeamChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages.length, status, channel?.channelId])

  const groups = useMemo(() => {
    const result: { day: string; messages: TeamMessage[] }[] = []
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

  if (!channel) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
          <Users className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Pick a chat, or start a new one</p>
          <p className="mt-1 max-w-xs text-xs text-ink-soft">
            Team Chat is for messages between the staff at your pharmacy.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep md:hidden"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Chats
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="msg-title truncate">{channel.title}</h1>
            {channel.type === 'group' && (
              <span className="shrink-0 rounded bg-paper-deep px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                Group
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-ink-soft">
            {channel.members.map((member) => member.displayName).join(', ')}
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

      <div ref={scrollRef} className="chat-scroll px-4 py-4" role="log" aria-live="polite">
        {status === 'loading' && (
          <div className="flex items-center gap-2 py-6 text-xs text-ink-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading messages…
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 text-xs">
            <p className="font-semibold text-coral" role="alert">
              {error ?? 'Unable to load this chat.'}
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
          <p className="py-8 text-center text-xs text-ink-soft">
            No messages yet — send the first one to {channel.title}.
          </p>
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
                {group.messages.map((message) => (
                  <TeamMessageRow
                    key={message.id}
                    message={message}
                    isMine={message.senderId === userId}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      <TeamComposer
        channelTitle={channel.title}
        onSend={onSend}
        sending={sending}
        error={sendError}
        disabled={status !== 'ready'}
      />
    </div>
  )
}

function TeamMessageRow({
  message,
  isMine,
  onEdit,
  onDelete,
}: {
  message: TeamMessage
  isMine: boolean
  onEdit: (messageId: string, body: string) => Promise<boolean>
  onDelete: (messageId: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const [busy, setBusy] = useState(false)

  const removed = Boolean(message.deletedAt)

  async function save() {
    const body = draft.trim()
    if (!body || body === message.body) {
      setEditing(false)
      return
    }
    setBusy(true)
    const ok = await onEdit(message.id, body)
    setBusy(false)
    if (ok) setEditing(false)
  }

  return (
    <div className={cn('chat-message flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine && (
        <span
          className="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-sage/25 text-[10px] font-bold text-evergreen"
          aria-hidden="true"
        >
          {initialsFromName(message.senderName)}
        </span>
      )}
      <div className="max-w-[min(34rem,80%)]">
        {!isMine && <p className="mb-1 pl-1 text-[11px] font-semibold text-ink-soft">{message.senderName}</p>}

        {editing ? (
          <div className="rounded-2xl border border-evergreen/30 bg-surface p-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              className="msg-field w-full resize-y rounded-md px-2.5 py-2 outline-none focus:border-evergreen"
            />
            <div className="mt-1.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(message.body)
                  setEditing(false)
                }}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink-soft transition hover:bg-paper-deep disabled:opacity-50"
              >
                <X className="size-3" aria-hidden="true" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || draft.trim().length === 0}
                className="rounded-md bg-evergreen px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-evergreen/90 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'rounded-2xl border px-3.5 py-2.5 shadow-sm',
              isMine ? 'border-evergreen/30 bg-evergreen text-white' : 'border-line bg-surface text-ink',
            )}
          >
            {removed ? (
              <p className={cn('text-sm italic', isMine ? 'text-white/80' : 'text-ink-soft')}>Message removed</p>
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
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
              {message.editedAt && !removed && <span>· edited</span>}
              {isMine && !removed && (
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(message.body)
                      setEditing(true)
                    }}
                    aria-label="Edit message"
                    className="rounded p-0.5 transition hover:bg-white/20"
                  >
                    <Pencil className="size-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(message.id)}
                    aria-label="Delete message"
                    className="rounded p-0.5 transition hover:bg-white/20"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamComposer({
  channelTitle,
  onSend,
  sending,
  error,
  disabled,
}: {
  channelTitle: string
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
        <label className="sr-only" htmlFor="team-message">
          Message {channelTitle}
        </label>
        <textarea
          id="team-message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder={`Message ${channelTitle}…  (Enter to send, Shift + Enter for a new line)`}
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
