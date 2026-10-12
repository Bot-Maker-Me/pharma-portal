'use client'

import { useState, type KeyboardEvent } from 'react'
import { CircleAlert, Hash, SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { urgencyMeta, urgencyOrder } from '@/lib/chat/urgency'
import type { Urgency } from '@/lib/chat/types'

type MessageComposerProps = {
  homeName: string
  onSend: (input: { body: string; urgency: Urgency; residentId: string | null }) => Promise<boolean>
  sending: boolean
  error: string | null
  disabled?: boolean
}

export function MessageComposer({ homeName, onSend, sending, error, disabled }: MessageComposerProps) {
  const [body, setBody] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('routine')
  const [residentId, setResidentId] = useState('')
  const [showResident, setShowResident] = useState(false)

  const canSend = body.trim().length > 0 && !sending && !disabled

  async function submit() {
    if (!canSend) return
    const ok = await onSend({
      body: body.trim(),
      urgency,
      residentId: residentId.trim() ? residentId.trim() : null,
    })
    if (ok) {
      setBody('')
      setResidentId('')
      setShowResident(false)
      setUrgency('routine')
    }
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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Priority</span>
        <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="Message priority">
          {urgencyOrder.map((level) => {
            const meta = urgencyMeta[level]
            const selected = urgency === level
            return (
              <button
                key={level}
                type="button"
                onClick={() => setUrgency(level)}
                aria-pressed={selected}
                title={meta.description}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold transition',
                  selected
                    ? level === 'routine'
                      ? 'bg-evergreen text-white'
                      : 'bg-coral text-white'
                    : 'bg-surface text-ink-soft hover:bg-paper-deep',
                )}
              >
                {meta.short}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowResident((current) => !current)}
          aria-pressed={showResident}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition',
            showResident
              ? 'border-evergreen/30 bg-sage/20 text-evergreen'
              : 'border-line bg-surface text-ink-soft hover:bg-paper-deep',
          )}
        >
          <Hash className="size-3.5" aria-hidden="true" />
          Resident ID
        </button>
      </div>

      {showResident && (
        <div className="mt-2.5">
          <label className="text-[11px] font-semibold text-ink-soft" htmlFor="resident-id">
            Resident identifier (ID only — never a full name)
          </label>
          <input
            id="resident-id"
            value={residentId}
            onChange={(event) => setResidentId(event.target.value)}
            placeholder="e.g. R-2041"
            maxLength={40}
            className="mt-1 h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-evergreen"
          />
        </div>
      )}

      <div className="mt-2.5 flex items-end gap-2">
        <label className="sr-only" htmlFor="chat-message">
          Message to {homeName}
        </label>
        <textarea
          id="chat-message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={4000}
          disabled={disabled}
          placeholder={`Message ${homeName}…  (Enter to send, Shift + Enter for a new line)`}
          className="max-h-40 min-h-11 flex-1 resize-y rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-evergreen disabled:opacity-60"
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
