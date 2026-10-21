'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRequests } from '@/lib/requests/use-requests'
import { AdminPreviewNotice } from '@/components/features/feature-gate'
import { RequestsList } from './requests-list'
import { RequestsThread } from './requests-thread'

type EmployeeRequestsProps = {
  /** Rendered inside the workspace rail (mobile hides the rail for this pane). */
  embedded?: boolean
  /** Rendered by the feature route for a platform admin previewing an off feature. */
  adminPreview?: boolean
  /** Embedded on a phone: leave the inbox and return to the rail. */
  onExit?: () => void
  /** Reports the unread total so the sidebar badge stays in step. */
  onUnreadChange?: (count: number) => void
}

/**
 * Employee Requests — the pharmacy's inbox for conversations started by employees
 * in the Employee Portal. Replying here sets the message's `sender_side` to
 * `pharmacy`; opening a thread marks the employee's messages read.
 */
export function EmployeeRequests({
  embedded = false,
  adminPreview = false,
  onExit,
  onUnreadChange,
}: EmployeeRequestsProps) {
  const requests = useRequests()
  const [pane, setPane] = useState<'list' | 'thread'>('list')

  useEffect(() => {
    onUnreadChange?.(requests.totalUnread)
  }, [requests.totalUnread, onUnreadChange])

  function handleSelect(threadId: string) {
    requests.selectThread(threadId)
    setPane('thread')
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
          <p className="truncate text-sm font-bold tracking-tight text-ink">Employee Requests</p>
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
            <p className="truncate text-sm font-bold tracking-tight text-ink">Employee Requests</p>
            <p className="truncate text-[11px] text-ink-soft">Requests raised in the Employee Portal</p>
          </div>
        </header>
      )}

      {adminPreview && (
        <div className="border-b border-line p-3">
          <AdminPreviewNotice label="Employee Requests" />
        </div>
      )}

      <div className="msg-body">
        <aside className={cn('msg-list-pane', pane === 'thread' && 'msg-pane-off')}>
          <RequestsList
            threads={requests.threads}
            activeThreadId={requests.activeThreadId}
            onSelect={handleSelect}
            status={requests.status}
            error={requests.error}
            onRetry={requests.retry}
          />
        </aside>

        <section className={cn('msg-thread-pane', pane === 'list' && 'msg-pane-off')}>
          <RequestsThread
            thread={requests.activeThread}
            messages={requests.messages}
            status={requests.threadStatus}
            error={requests.threadError}
            sending={requests.sending}
            sendError={requests.sendError}
            onRetry={requests.retry}
            onSend={requests.sendMessage}
            onSetStatus={requests.setStatus}
            onBack={() => setPane('list')}
            mode={requests.mode}
          />
        </section>
      </div>
    </div>
  )
}
