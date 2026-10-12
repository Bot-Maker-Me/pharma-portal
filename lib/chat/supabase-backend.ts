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

type SummaryRow = {
  conversation_id: string
  home_id: string
  home_name: string
  last_message_body: string | null
  last_message_sender_name: string | null
  last_message_at: string | null
  unread_count: number | string | null
  has_urgent: boolean | null
}

type ReadRow = {
  conversation_id: string
  user_id: string
  last_read_at: string
}

function normalizeUrgency(value: string): Urgency {
  return value === 'urgent' || value === 'emergency' ? value : 'routine'
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

function mapSummary(row: SummaryRow): ConversationSummary {
  return {
    conversationId: row.conversation_id,
    homeId: row.home_id,
    homeName: row.home_name,
    lastMessageBody: row.last_message_body,
    lastMessageSenderName: row.last_message_sender_name,
    lastMessageAt: row.last_message_at ?? new Date().toISOString(),
    unreadCount: Number(row.unread_count ?? 0),
    hasUrgent: Boolean(row.has_urgent),
  }
}

export function createSupabaseChatBackend(): ChatBackend {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase is not configured')

  return {
    mode: 'live',

    async load(): Promise<ChatSnapshot> {
      const [userResult, homesResult, summariesResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('homes').select('id, name').order('name', { ascending: true }),
        supabase.rpc('chat_conversation_summaries'),
      ])

      if (homesResult.error) throw homesResult.error
      if (summariesResult.error) throw summariesResult.error

      const homes: AuthorizedHome[] = (homesResult.data ?? []).map((home) => ({
        id: home.id,
        name: home.name,
      }))
      const conversations = ((summariesResult.data ?? []) as SummaryRow[]).map(mapSummary)
      return { selfUserId: userResult.data.user?.id ?? null, homes, conversations }
    },

    async loadMessages(conversationId: string): Promise<ChatMessage[]> {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return ((data ?? []) as MessageRow[]).map(mapMessage)
    },

    async loadReads(conversationId: string): Promise<ConversationRead[]> {
      const { data, error } = await supabase
        .from('conversation_reads')
        .select('conversation_id, user_id, last_read_at')
        .eq('conversation_id', conversationId)
      if (error) throw error
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
      if (existingError) throw existingError
      if (existing?.id) return existing.id

      const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({ home_id: homeId })
        .select('id')
        .single()
      if (createError) throw createError
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
      const senderName = profile?.full_name ?? userData.user?.email?.split('@')[0] ?? 'Pharmacy team'

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
      if (error) throw error
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
