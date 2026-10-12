'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  AuthorizedHome,
  ChatBackend,
  ChatMessage,
  ChatSnapshot,
  ChatSubscriptionHandlers,
  ConversationSummary,
  NewConversationInput,
  SendMessageInput,
  Urgency,
} from './types'

// The live backend reads and writes the SAME rows the Nursing Home Portal uses:
// public.chat_threads (one row per thread) and public.portal_messages (one row
// per message). Those tables pre-date this app, so `subject` is the thread
// title, `resident_ref` is the thread's resident identifier, and `sender_role`
// ("home" | "pharmacy") says which side wrote a message.
//
// Uses only plain table reads/writes — no RPCs — so it needs nothing beyond
// SELECT/INSERT/UPDATE privileges plus row level security.
//
// See supabase/migrations/*_share_chat_with_nursing_home_portal.sql for the
// grants, policies, realtime publication and the home_id backfill.

const SENDER_ROLE_PHARMACY = 'pharmacy'
const SENDER_ROLE_HOME = 'home'

type ThreadRow = {
  id: string
  home_id: string | null
  pharmacy_id: string | null
  resident_ref: string | null
  subject: string | null
  urgent: boolean | null
  created_by: string | null
  created_at: string
  last_message_at: string | null
  /** Added by 20261020000000_tenant_theme_and_chat_archive.sql. */
  archived_at?: string | null
}

type PortalMessageRow = {
  id: string
  user_id: string
  thread_id: string | null
  sender_role: string
  sender_name: string
  body: string
  urgent: boolean | null
  read_at: string | null
  created_at: string
}

type PostgrestLikeError = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string
}

// How far back we look when computing previews and unread counts.
const SUMMARY_MESSAGE_LIMIT = 5000
const THREAD_MESSAGE_LIMIT = 1000

const THREAD_COLUMNS = 'id, home_id, pharmacy_id, resident_ref, subject, urgent, created_by, created_at, last_message_at, archived_at'
/** Same columns before the archive migration — used as a fallback so an un-migrated project still opens. */
const THREAD_COLUMNS_LEGACY = 'id, home_id, pharmacy_id, resident_ref, subject, urgent, created_by, created_at, last_message_at'

function toUrgency(urgent: boolean | null): Urgency {
  return urgent ? 'urgent' : 'routine'
}

/** Turns a Supabase/PostgREST error into a real Error so the UI can show why it failed. */
function toChatError(error: unknown): Error {
  if (error instanceof Error) return error
  const detail = error as PostgrestLikeError | null
  const parts = [detail?.message, detail?.details, detail?.hint].filter(Boolean)
  if (parts.length) return new Error(parts.join(' · '))
  return new Error('Unable to reach the messaging service.')
}

function newId(): string {
  return crypto.randomUUID()
}

function mapMessage(row: PortalMessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.thread_id ?? '',
    senderName: row.sender_name,
    body: row.body,
    urgency: toUrgency(row.urgent),
    // sender_role is the authoritative "which side" flag — never the user id.
    fromPharmacy: row.sender_role !== SENDER_ROLE_HOME,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

function mapThread(row: ThreadRow, homeName: string, messages: PortalMessageRow[]): ConversationSummary {
  const thread = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const last = thread[thread.length - 1] ?? null
  const unread = thread.filter((message) => message.sender_role === SENDER_ROLE_HOME && !message.read_at)

  return {
    conversationId: row.id,
    homeId: row.home_id ?? '',
    homeName,
    title: row.subject?.trim() || null,
    residentRef: row.resident_ref?.trim() || null,
    lastMessageBody: last?.body ?? null,
    lastMessageSenderName: last?.sender_name ?? null,
    lastMessageAt: last?.created_at ?? row.last_message_at ?? row.created_at,
    unreadCount: unread.length,
    hasUrgent: unread.some((message) => message.urgent === true),
    archivedAt: row.archived_at ?? null,
  }
}

export function createSupabaseChatBackend(): ChatBackend {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase is not configured')

  return {
    mode: 'live',

    async load(): Promise<ChatSnapshot> {
      const [homesResult, messagesResult, threadsResult] = await Promise.all([
        supabase.from('homes').select('id, name').order('name', { ascending: true }),
        supabase
          .from('portal_messages')
          .select('id, user_id, thread_id, sender_role, sender_name, body, urgent, read_at, created_at')
          .order('created_at', { ascending: false })
          .limit(SUMMARY_MESSAGE_LIMIT),
        supabase
          .from('chat_threads')
          .select(THREAD_COLUMNS)
          .order('last_message_at', { ascending: false }),
      ])
      if (homesResult.error) throw toChatError(homesResult.error)
      if (messagesResult.error) throw toChatError(messagesResult.error)

      // Retry without the archive column when it is not in this database yet.
      let threadRows = (threadsResult.data ?? []) as ThreadRow[]
      let threadError = threadsResult.error
      if (threadError) {
        const legacy = await supabase
          .from('chat_threads')
          .select(THREAD_COLUMNS_LEGACY)
          .order('last_message_at', { ascending: false })
        threadRows = (legacy.data ?? []) as ThreadRow[]
        threadError = legacy.error
      }
      if (threadError) throw toChatError(threadError)

      const homes: AuthorizedHome[] = (homesResult.data ?? []).map((home) => ({ id: home.id, name: home.name }))
      const homeNames = new Map(homes.map((home) => [home.id, home.name]))

      const messages = (messagesResult.data ?? []) as PortalMessageRow[]
      const messagesByThread = new Map<string, PortalMessageRow[]>()
      messages.forEach((message) => {
        if (!message.thread_id) return
        const bucket = messagesByThread.get(message.thread_id)
        if (bucket) bucket.push(message)
        else messagesByThread.set(message.thread_id, [message])
      })

      const summaries: ConversationSummary[] = threadRows
        .map((thread) => {
          const homeName = thread.home_id ? homeNames.get(thread.home_id) ?? 'Nursing home' : 'Nursing home'
          return mapThread(thread, homeName, messagesByThread.get(thread.id) ?? [])
        })
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

      return { homes, conversations: summaries }
    },

    async loadMessages(conversationId: string): Promise<ChatMessage[]> {
      const { data, error } = await supabase
        .from('portal_messages')
        .select('id, user_id, thread_id, sender_role, sender_name, body, urgent, read_at, created_at')
        .eq('thread_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(THREAD_MESSAGE_LIMIT)
      if (error) throw toChatError(error)
      return ((data ?? []) as PortalMessageRow[]).map(mapMessage)
    },

    async ensureConversation(homeId: string, input: NewConversationInput): Promise<string> {
      // Reuse the home's most recent thread. Creating a second thread for a home
      // that already has one is what makes the two portals talk past each other,
      // so this only inserts when there is nothing to reuse.
      const { data: existing, error: existingError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('home_id', homeId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (existingError) throw toChatError(existingError)
      if (existing?.id) return existing.id

      const { data: userData } = await supabase.auth.getUser()
      const createdBy = userData.user?.id
      if (!createdBy) throw new Error('Your session has expired. Please sign in again.')

      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('chat_threads')
        .insert({
          id: newId(),
          home_id: homeId,
          resident_ref: input.residentId?.trim() ?? '',
          subject: input.subject,
          urgent: input.urgent,
          created_by: createdBy,
          created_at: now,
          last_message_at: now,
        })
        .select('id')
        .single()
      if (error) throw toChatError(error)
      return data.id
    },

    async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('Your session has expired. Please sign in again.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()
      const senderName =
        profile?.full_name?.trim() || userData.user?.email?.split('@')[0] || 'Pharmacy team'

      const now = new Date().toISOString()
      const urgent = input.urgency !== 'routine'
      const { data, error } = await supabase
        .from('portal_messages')
        .insert({
          id: newId(),
          thread_id: input.conversationId,
          user_id: userId,
          sender_role: SENDER_ROLE_PHARMACY,
          sender_name: senderName,
          body: input.body,
          urgent,
          created_at: now,
        })
        .select('id, user_id, thread_id, sender_role, sender_name, body, urgent, read_at, created_at')
        .single()
      if (error) throw toChatError(error)

      // Keep the thread's ordering/preview in step for the Nursing Home portal.
      await supabase.from('chat_threads').update({ last_message_at: now }).eq('id', input.conversationId)

      return mapMessage(data as PortalMessageRow)
    },

    async markRead(conversationId: string): Promise<void> {
      // Read state lives on the message: stamp the home's messages as read.
      await supabase
        .from('portal_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('thread_id', conversationId)
        .eq('sender_role', SENDER_ROLE_HOME)
        .is('read_at', null)
    },

    async setArchived(conversationId: string, archived: boolean): Promise<void> {
      // Archiving only sets a timestamp on the thread — no message is ever
      // deleted, and the nursing home side keeps seeing the conversation.
      const { error } = await supabase
        .from('chat_threads')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', conversationId)
      if (!error) return

      const failure = toChatError(error)
      if (/archived_at/i.test(failure.message)) {
        throw new Error(
          'Archiving is not switched on in this database yet — run 20261020000000_tenant_theme_and_chat_archive.sql in Supabase.',
        )
      }
      throw failure
    },

    subscribe(handlers: ChatSubscriptionHandlers): () => void {
      const channel = supabase
        .channel('chat-with-home')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_messages' }, (payload) => {
          handlers.onMessage(mapMessage(payload.new as PortalMessageRow))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => {
          handlers.onConversationChange()
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'portal_messages' }, () => {
          handlers.onConversationChange()
        })
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    },
  }
}
