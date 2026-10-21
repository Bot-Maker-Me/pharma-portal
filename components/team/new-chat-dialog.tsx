'use client'

import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, Loader2, User as UserIcon, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initialsFromName } from '@/lib/chat/format'
import type { NewTeamChannelInput, TeamChannelType, TeamColleague } from '@/lib/team/types'

type NewChatDialogProps = {
  open: boolean
  colleagues: TeamColleague[]
  busy: boolean
  error: string | null
  onClose: () => void
  onCreate: (input: NewTeamChannelInput) => void
}

/**
 * Starts a new chat. A direct chat takes exactly one colleague; a group takes two
 * or more and a name. Only people from the signed-in user's own pharmacy are ever
 * listed — the backend re-checks this too, so the picker is convenience, not
 * security.
 */
export function NewChatDialog({ open, colleagues, busy, error, onClose, onCreate }: NewChatDialogProps) {
  const [type, setType] = useState<TeamChannelType>('direct')
  const [selected, setSelected] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [query, setQuery] = useState('')

  // Reset whenever the dialog is opened so it never reopens mid-selection.
  useEffect(() => {
    if (!open) return
    setType('direct')
    setSelected([])
    setGroupName('')
    setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, busy, onClose])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const sorted = [...colleagues].sort((a, b) => a.displayName.localeCompare(b.displayName))
    if (!term) return sorted
    return sorted.filter((colleague) => colleague.displayName.toLowerCase().includes(term))
  }, [colleagues, query])

  if (!open) return null

  function toggle(userId: string) {
    if (type === 'direct') {
      setSelected([userId])
      return
    }
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    )
  }

  const canCreate = type === 'direct' ? selected.length === 1 : selected.length >= 2 && groupName.trim().length > 0

  function submit() {
    if (!canCreate || busy) return
    onCreate({ type, name: type === 'group' ? groupName.trim() : null, memberIds: selected })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New chat"
        className="flex max-h-[85dvh] w-full max-w-md flex-col border border-line bg-surface shadow-xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">New chat</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-md text-ink-soft transition hover:bg-paper-deep disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="inline-flex overflow-hidden rounded-md border border-line">
            <button
              type="button"
              onClick={() => {
                setType('direct')
                setSelected((current) => current.slice(0, 1))
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition',
                type === 'direct' ? 'bg-evergreen text-white' : 'bg-surface text-ink-soft hover:bg-paper-deep',
              )}
            >
              <UserIcon className="size-3.5" aria-hidden="true" />
              One person
            </button>
            <button
              type="button"
              onClick={() => setType('group')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition',
                type === 'group' ? 'bg-evergreen text-white' : 'bg-surface text-ink-soft hover:bg-paper-deep',
              )}
            >
              <Users className="size-3.5" aria-hidden="true" />
              Group
            </button>
          </div>

          {type === 'group' && (
            <label className="mt-3 flex flex-col gap-1.5 text-xs font-semibold text-ink-soft">
              Group name
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={80}
                placeholder="e.g. Front counter"
                className="msg-field h-9 rounded-md px-3 outline-none focus:border-evergreen"
              />
            </label>
          )}

          <label className="mt-3 flex items-center gap-2 rounded-md border border-line bg-paper px-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search colleagues…"
              aria-label="Search colleagues"
              className="h-9 w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/70"
            />
          </label>

          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            {type === 'direct' ? 'Choose a colleague' : `Choose colleagues (${selected.length} selected)`}
          </p>

          {visible.length === 0 ? (
            <p className="mt-3 text-xs text-ink-soft">No colleagues in this pharmacy to show.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {visible.map((colleague) => {
                const isOn = selected.includes(colleague.userId)
                return (
                  <li key={colleague.userId}>
                    <button
                      type="button"
                      onClick={() => toggle(colleague.userId)}
                      aria-pressed={isOn}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition',
                        isOn
                          ? 'border-evergreen/40 bg-sage/15'
                          : 'border-line bg-surface hover:bg-paper-deep/60',
                      )}
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage/25 text-[11px] font-bold text-evergreen"
                        aria-hidden="true"
                      >
                        {initialsFromName(colleague.displayName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {colleague.displayName}
                        </span>
                        {colleague.role && (
                          <span className="block text-[11px] capitalize text-ink-soft">{colleague.role}</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center border',
                          type === 'direct' ? 'rounded-full' : 'rounded',
                          isOn ? 'border-evergreen bg-evergreen text-white' : 'border-line bg-surface',
                        )}
                        aria-hidden="true"
                      >
                        {isOn && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-line px-4 py-3">
          {error && (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-coral" role="alert">
              <CircleAlert className="size-3.5" aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-paper-deep disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canCreate || busy}
              className="inline-flex items-center gap-2 rounded-md bg-evergreen px-4 py-2 text-sm font-semibold text-white transition hover:bg-evergreen/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Start chat
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
