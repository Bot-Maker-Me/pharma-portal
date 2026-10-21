'use client'

import { createClient } from '@/lib/supabase/client'
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

// Live Employee Requests: plain table reads/writes against the tables shared with
// the Employee Portal (topic_threads / topic_messages). Row level security decides
// what the pharmacy may see (its own threads, and only while the feature is on),
// so there is no tenant filter here to get wrong.
//
// Nothing here logs a message body, and opening a thread only stamps `read_at`.

const SUMMARY_MESSAGE_LIMIT = 3000
const THREAD_MESSAGE_LIMIT = 1000

const THREAD_COLUMNS =
  'id, organization_id, organization_name, pharmacy_id, created_by, topic, category, priority, status, created_at, closed_at'
const MESSAGE_COLUMNS = 'id, thread_id, sender_id, sender_side, body, created_at, read_at'

type ThreadRow = {
  id: string
  organization_id: string | null
  organization_name: string | null
  pharmacy_id: string | null
  created_by: string | null
  topic: string
  category: string | null
  priority: string
  status: string
  created_at: string
  closed_at: string | null
}

type MessageRow = {
  id: string
  thread_id: string
  sender_id: string
  sender_side: string
  body: string
  created_at: string
  read_at: string | null
}

type ColleagueRow = { user_id: string; full_name: string | null; role: string | null }

type PostgrestLikeError = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string
}

function toRequestsError(error: unknown): Error {
  if (error instanceof Error) return error
  const detail = error as PostgrestLikeError | null
  const parts = [detail?.message, detail?.details, detail?.hint].filter(Boolean)
  if (parts.length) return new Error(parts.join(' · '))
  return new Error('Unable to reach the requests service.')
}

function newId(): string {
  return crypto.randomUUID()
}

function toSide(value: string): RequestSenderSide {
  return value === 'pharmacy' ? 'pharmacy' : 'employee'
}

function toPriority(value: string): RequestPriority {
  return value === 'urgent' ? 'urgent' : 'normal'
}

function toStatus(value: string): RequestStatus {
  return value === 'closed' ? 'closed' : 'open'
}

export function createSupabaseRequestsBackend(): RequestsBackend {
  const client = createClient()
  if (!client) throw new Error('Supabase is not configured')
  // Bound to a narrowed const so the nested helpers below see a non-null client.
  const supabase = client

  // Pharmacy colleagues, so a reply can be labelled with the name of whoever sent
  // it. Employee senders are labelled by side — their profile is not readable here.
  const nameById = new Map<string, string>()

  function senderName(row: MessageRow, selfId: string): string {
    if (toSide(row.sender_side) === 'employee') return 'Employee'
    if (row.sender_id === selfId) return 'You'
    return nameById.get(row.sender_id) ?? 'Pharmacy'
  }

  function mapMessage(row: MessageRow, selfId: string): RequestMessage {
    return {
      id: row.id,
      threadId: row.thread_id,
      senderId: row.sender_id,
      senderName: senderName(row, selfId),
      senderSide: toSide(row.sender_side),
      body: row.body,
      createdAt: row.created_at,
      readAt: row.read_at,
    }
  }

  async function requireUser(): Promise<string> {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    if (!userId) throw new Error('Your session has expired. Please sign in again.')
    return userId
  }

  async function refreshColleagueNames(): Promise<void> {
    const { data, error } = await supabase.rpc('pharmacy_colleagues')
    if (error) return
    nameById.clear()
    ;((data ?? []) as ColleagueRow[]).forEach((row) => {
      const name = (row.full_name ?? '').trim()
      if (name) nameById.set(String(row.user_id), name)
    })
  }

  function summarize(row: ThreadRow, messageRows: MessageRow[]): RequestThread {
    const last = messageRows[0] ?? null
    const unreadCount = messageRows.filter(
      (message) => toSide(message.sender_side) === 'employee' && !message.read_at,
    ).length

    return {
      id: row.id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      pharmacyId: row.pharmacy_id,
      createdBy: row.created_by,
      topic: row.topic,
      category: row.category,
      priority: toPriority(row.priority),
      status: toStatus(row.status),
      createdAt: row.created_at,
      closedAt: row.closed_at,
      lastMessageBody: last?.body ?? null,
      lastMessageSide: last ? toSide(last.sender_side) : null,
      lastMessageAt: last?.created_at ?? row.created_at,
      unreadCount,
    }
  }

  return {
    mode: 'live',

    async load(): Promise<RequestsSnapshot> {
      const selfId = await requireUser()
      await refreshColleagueNames()

      const { data: threadData, error: threadError } = await supabase
        .from('topic_threads')
        .select(THREAD_COLUMNS)
        .order('created_at', { ascending: false })
      if (threadError) throw toRequestsError(threadError)

      const rows = (threadData ?? []) as ThreadRow[]
      if (rows.length === 0) return { userId: selfId, displayName: nameById.get(selfId) ?? 'You', threads: [] }

      const threadIds = rows.map((row) => row.id)
      const { data: messageData, error: messageError } = await supabase
        .from('topic_messages')
        .select(MESSAGE_COLUMNS)
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })
        .limit(SUMMARY_MESSAGE_LIMIT)
      if (messageError) throw toRequestsError(messageError)

      const messagesByThread = new Map<string, MessageRow[]>()
      ;((messageData ?? []) as MessageRow[]).forEach((row) => {
        const bucket = messagesByThread.get(row.thread_id)
        if (bucket) bucket.push(row)
        else messagesByThread.set(row.thread_id, [row])
      })

      const threads: RequestThread[] = rows
        .map((row) => summarize(row, messagesByThread.get(row.id) ?? []))
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

      return { userId: selfId, displayName: nameById.get(selfId) ?? 'You', threads }
    },

    async loadMessages(threadId: string): Promise<RequestMessage[]> {
      const selfId = await requireUser()
      const { data, error } = await supabase
        .from('topic_messages')
        .select(MESSAGE_COLUMNS)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(THREAD_MESSAGE_LIMIT)
      if (error) throw toRequestsError(error)
      return ((data ?? []) as MessageRow[]).map((row) => mapMessage(row, selfId))
    },

    async sendMessage({ threadId, body }): Promise<RequestMessage> {
      const selfId = await requireUser()
      const { data, error } = await supabase
        .from('topic_messages')
        .insert({
          id: newId(),
          thread_id: threadId,
          sender_id: selfId,
          sender_side: 'pharmacy',
          body,
          created_at: new Date().toISOString(),
        })
        .select(MESSAGE_COLUMNS)
        .single()
      if (error) throw toRequestsError(error)
      return mapMessage(data as MessageRow, selfId)
    },

    async setStatus(threadId: string, status: RequestStatus): Promise<void> {
      const { error } = await supabase
        .from('topic_threads')
        .update({ status, closed_at: status === 'closed' ? new Date().toISOString() : null })
        .eq('id', threadId)
      if (error) throw toRequestsError(error)
    },

    async markRead(threadId: string): Promise<void> {
      // Only the employee's messages are ours to mark read.
      await supabase
        .from('topic_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .eq('sender_side', 'employee')
        .is('read_at', null)
    },

    subscribe(handlers: RequestsSubscriptionHandlers): () => void {
      const channel = supabase
        .channel('employee-requests')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'topic_messages' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              handlers.onMessage(mapMessage(payload.new as MessageRow, ''))
            }
            handlers.onThreadChange()
          },
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'topic_threads' }, () =>
          handlers.onThreadChange(),
        )
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    },
  }
}
