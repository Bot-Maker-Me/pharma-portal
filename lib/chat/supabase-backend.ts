'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  AuthorizedHome,
  ChatBackend,
  ChatMessage,
  ChatSnapshot,
  ChatSubscriptionHandlers,
  ConversationRead,
  ConversationSummary,
  SendMessageInput,
  Urgency,
} from './types'

// The live backend reads and writes the shared Supabase tables that the Nursing
// Home Portal also uses, so both portals see the same conversations in real time.
//
// Deliberately uses only plain table reads (no database functions/RPCs) so it
// depends on nothing beyond SELECT/INSERT privileges + RLS.

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  sender_name: string
  body: string
  urgency: string
  resident_id: string | null
  created_at: string
}

type ConversationRow = {
  id: string
  home_id: string
  created_at: string
}

type SummaryMessageRow = {
  conversation_id: string
  sender_id: string
  sender_name: string
  body: string
  urgency: string
  created_at: string
}

type ReadRow = {
  conversation_id: string
  user_id: string
  last_read_at: string
}

type PostgrestLikeError = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string
}

// How far back we look when computing previews and unread counts.
const SUMMARY_WINDOW_DAYS = 30
const SUMMARY_MESSAGE_LIMIT = 5000

function normalizeUrgency(value: string): Urgency {
  return value === 'urgent' || value === 'emergency' ? value : 'routine'
}

/** Turns a Supabase/PostgREST error into a real Error so the UI can show why it failed. */
function toChatError(error: unknown): Error {
  if (error instanceof Error) return error
  const detail = error as PostgrestLikeError | null
  const parts = [detail?.message, detail?.details, detail?.hint].filter(Boolean)
  if (parts.length) return new Error(parts.join(' · '))
  return new Error('Unable to reach the messaging service.')
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    body: row.body,
    urgency: normalizeUrgency(row.urgency),
    residentId: row.resident_id,
    createdAt: row.created_at,
  }
}

export function createSupabaseChatBackend(): ChatBackend {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase is not configured')

  return {
    mode: 'live',

    async load(): Promise<ChatSnapshot> {
      const { data: userData } = await supabase.auth.getUser()
      const selfUserId = userData.user?.id ?? null

      const [homesResult, conversationsResult] = await Promise.all([
        supabase.from('homes').select('id, name').order('name', { ascending: true }),
        supabase.from('conversations').select('id, home_id, created_at'),
      ])
      if (homesResult.error) throw toChatError(homesResult.error)
      if (conversationsResult.error) throw toChatError(conversationsResult.error)

      const homes: AuthorizedHome[] = (homesResult.data ?? []).map((home) => ({
        id: home.id,
        name: home.name,
      }))
      const conversations = (conversationsResult.data ?? []) as ConversationRow[]
      if (!selfUserId || conversations.length === 0) {
        return { selfUserId, homes, conversations: [] }
      }

      const since = new Date(Date.now() - SUMMARY_WINDOW_DAYS * 86_400_000).toISOString()
      const [readsResult, messagesResult] = await Promise.all([
        supabase.from('conversation_reads').select('conversation_id, last_read_at').eq('user_id', selfUserId),
        supabase
          .from('messages')
          .select('conversation_id, sender_id, sender_name, body, urgency, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(SUMMARY_MESSAGE_LIMIT),
      ])
      if (readsResult.error) throw toChatError(readsResult.error)
      if (messagesResult.error) throw toChatError(messagesResult.error)

      const lastReadByConversation = new Map<string, string>()
      ;(readsResult.data ?? []).forEach((row) =>
        lastReadByConversation.set(row.conversation_id, row.last_read_at),
      )

      const recent = (messagesResult.data ?? []) as SummaryMessageRow[]
      const homeNames = new Map(homes.map((home) => [home.id, home.name]))

      const summaries: ConversationSummary[] = conversations
        .map((conversation) => {
          const thread = recent
            .filter((message) => message.conversation_id === conversation.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
          const last = thread[thread.length - 1] ?? null
          const lastReadAt = lastReadByConversation.get(conversation.id)
          const unread = thread.filter(
            (message) => message.sender_id !== selfUserId && (!lastReadAt || message.created_at > lastReadAt),
          )

          return {
            conversationId: conversation.id,
            homeId: conversation.home_id,
            homeName: homeNames.get(conversation.home_id) ?? 'Nursing home',
            lastMessageBody: last?.body ?? null,
            lastMessageSenderName: last?.sender_name ?? null,
            lastMessageAt: last?.created_at ?? conversation.created_at,
            unreadCount: unread.length,
            hasUrgent: unread.some((message) => normalizeUrgency(message.urgency) !== 'routine'),
          }
        })
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

      return { selfUserId, homes, conversations: summaries }
    },

    async loadMessages(conversationId: string): Promise<ChatMessage[]> {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw toChatError(error)
      return ((data ?? []) as MessageRow[]).map(mapMessage)
    },

    async loadReads(conversationId: string): Promise<ConversationRead[]> {
      const { data, error } = await supabase
        .from('conversation_reads')
        .select('conversation_id, user_id, last_read_at')
        .eq('conversation_id', conversationId)
      if (error) throw toChatError(error)
      return ((data ?? []) as ReadRow[]).map((row) => ({
        conversationId: row.conversation_id,
        userId: row.user_id,
        lastReadAt: row.last_read_at,
      }))
    },

    async ensureConversation(homeId: string): Promise<string> {
      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .eq('home_id', homeId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (existingError) throw toChatError(existingError)
      if (existing?.id) return existing.id

      const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({ home_id: homeId })
        .select('id')
        .single()
      if (createError) throw toChatError(createError)
      return created.id
    },

    async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
      const { data: userData } = await supabase.auth.getUser()
      const senderId = userData.user?.id
      if (!senderId) throw new Error('Your session has expired. Please sign in again.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', senderId)
        .maybeSingle()
      const senderName =
        profile?.full_name?.trim() || userData.user?.email?.split('@')[0] || 'Pharmacy team'

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          sender_id: senderId,
          sender_name: senderName,
          body: input.body,
          urgency: input.urgency,
          resident_id: input.residentId,
        })
        .select('*')
        .single()
      if (error) throw toChatError(error)
      return mapMessage(data as MessageRow)
    },

    async markRead(conversationId: string): Promise<void> {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      await supabase
        .from('conversation_reads')
        .upsert(
          { conversation_id: conversationId, user_id: userId, last_read_at: new Date().toISOString() },
          { onConflict: 'conversation_id,user_id' },
        )
    },

    subscribe(handlers: ChatSubscriptionHandlers): () => void {
      const channel = supabase
        .channel('chat-with-home')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          handlers.onMessage(mapMessage(payload.new as MessageRow))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
          handlers.onConversationChange()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_reads' }, (payload) => {
          const row = payload.new as ReadRow | undefined
          if (row?.user_id) {
            handlers.onReadChange({
              conversationId: row.conversation_id,
              userId: row.user_id,
              lastReadAt: row.last_read_at,
            })
          }
        })
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    },
  }
}
