'use client'

import type {
  RequestMessage,
  RequestPriority,
  RequestSenderSide,
  RequestStatus,
  RequestThread,
  RequestsBackend,
  RequestsSnapshot,
  RequestsSubscriptionHandlers,
} from './types'

// Preview backend: used only when Supabase is not yet connected (or the SQL has
// not been applied). It keeps the same RequestsBackend contract — threads with
// urgency, status, categories and unread counts, plus a live-looking thread — so
// the inbox is fully explorable offline.

const SELF_ID = 'preview-me'
const SELF_NAME = 'Jordan Davis'

type PreviewThread = {
  id: string
  organizationId: string | null
  organizationName: string
  topic: string
  category: string
  priority: RequestPriority
  status: RequestStatus
  createdAt: string
  closedAt: string | null
  createdBy: string
}

const now = Date.now()
const minutesAgo = (n: number) => new Date(now - n * 60 * 1000).toISOString()
const hoursAgo = (n: number) => new Date(now - n * 60 * 60 * 1000).toISOString()
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()

const threads: PreviewThread[] = [
  {
    id: 'preview-thread-supply',
    organizationId: 'org-riverbend',
    organizationName: 'Riverbend Care Centre',
    topic: 'Oxygen concentrator tubing — urgent supply',
    category: 'Supply',
    priority: 'urgent',
    status: 'open',
    createdAt: hoursAgo(6),
    closedAt: null,
    createdBy: 'preview-employee-1',
  },
  {
    id: 'preview-thread-payroll',
    organizationId: 'org-riverbend',
    organizationName: 'Riverbend Care Centre',
    topic: 'Payroll deduction for parking passes',
    category: 'Payroll',
    priority: 'normal',
    status: 'open',
    createdAt: daysAgo(2),
    closedAt: null,
    createdBy: 'preview-employee-2',
  },
  {
    id: 'preview-thread-uniform',
    organizationId: 'org-harbour',
    organizationName: 'Harbourview Nursing Home',
    topic: 'Uniform order for the new hires',
    category: 'Facilities',
    priority: 'normal',
    status: 'closed',
    createdAt: daysAgo(9),
    closedAt: daysAgo(3),
    createdBy: 'preview-employee-3',
  },
]

let seq = 0
const nextId = (prefix: string) => `${prefix}-${++seq}`

function message(
  threadId: string,
  side: RequestSenderSide,
  body: string,
  createdAt: string,
  readAt: string | null,
): RequestMessage {
  return {
    id: nextId('rm'),
    threadId,
    senderId: side === 'pharmacy' ? SELF_ID : 'preview-employee',
    senderName: side === 'pharmacy' ? SELF_NAME : 'Employee',
    senderSide: side,
    body,
    createdAt,
    readAt,
  }
}

const messages: RequestMessage[] = [
  message(
    'preview-thread-supply',
    'employee',
    'We are down to our last set of oxygen tubing for the second floor. Can you send more today?',
    hoursAgo(6),
    null,
  ),
  message(
    'preview-thread-payroll',
    'employee',
    'How do I set up a payroll deduction for the monthly parking pass?',
    daysAgo(2),
    null,
  ),
  message(
    'preview-thread-uniform',
    'employee',
    'Please order two sets of scrubs in medium and large.',
    daysAgo(9),
    daysAgo(8),
  ),
  message(
    'preview-thread-uniform',
    'pharmacy',
    'Ordered — they should arrive within five business days.',
    daysAgo(8),
    daysAgo(8),
  ),
]

const listeners = new Set<RequestsSubscriptionHandlers>()

function emitThreadChange() {
  listeners.forEach((listener) => listener.onThreadChange())
}

function emitMessage(item: RequestMessage) {
  listeners.forEach((listener) => listener.onMessage(item))
}

function summarize(thread: PreviewThread): RequestThread {
  const owned = messages
    .filter((item) => item.threadId === thread.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const last = owned[0] ?? null
  const unreadCount = owned.filter((item) => item.senderSide === 'employee' && !item.readAt).length

  return {
    id: thread.id,
    organizationId: thread.organizationId,
    organizationName: thread.organizationName,
    pharmacyId: 'preview-pharmacy',
    createdBy: thread.createdBy,
    topic: thread.topic,
    category: thread.category,
    priority: thread.priority,
    status: thread.status,
    createdAt: thread.createdAt,
    closedAt: thread.closedAt,
    lastMessageBody: last?.body ?? null,
    lastMessageSide: last?.senderSide ?? null,
    lastMessageAt: last?.createdAt ?? thread.createdAt,
    unreadCount,
  }
}

export function createPreviewRequestsBackend(): RequestsBackend {
  return {
    mode: 'preview',

    async load(): Promise<RequestsSnapshot> {
      return {
        userId: SELF_ID,
        displayName: SELF_NAME,
        threads: threads.map(summarize).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
      }
    },

    async loadMessages(threadId: string): Promise<RequestMessage[]> {
      return messages
        .filter((item) => item.threadId === threadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },

    async sendMessage({ threadId, body }): Promise<RequestMessage> {
      const item = message(threadId, 'pharmacy', body, new Date().toISOString(), new Date().toISOString())
      messages.push(item)
      emitThreadChange()
      emitMessage(item)
      return item
    },

    async setStatus(threadId: string, status: RequestStatus): Promise<void> {
      const thread = threads.find((item) => item.id === threadId)
      if (!thread) return
      thread.status = status
      thread.closedAt = status === 'closed' ? new Date().toISOString() : null
      emitThreadChange()
    },

    async markRead(threadId: string): Promise<void> {
      const stamp = new Date().toISOString()
      let changed = false
      messages.forEach((item) => {
        if (item.threadId !== threadId || item.senderSide !== 'employee' || item.readAt) return
        item.readAt = stamp
        changed = true
      })
      if (changed) emitThreadChange()
    },

    subscribe(handlers: RequestsSubscriptionHandlers): () => void {
      listeners.add(handlers)
      return () => {
        listeners.delete(handlers)
      }
    },
  }
}
