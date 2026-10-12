'use client'

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

// Preview backend: used only when Supabase is not yet connected. It keeps the
// same ChatBackend contract as the live backend so the UI is identical, and it
// simulates the home side replying so realtime + read receipts are demonstrable.
// Once NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are set, this is never used.

const PHARMACY_USER_ID = 'preview-pharmacy-user'
const HOME_USER_ID = 'preview-home-user'
const PHARMACY_NAME = 'Jordan Davis'

const now = Date.now()
const minutesAgo = (n: number) => new Date(now - n * 60 * 1000).toISOString()
const hoursAgo = (n: number) => new Date(now - n * 60 * 60 * 1000).toISOString()

type PreviewConversation = {
  id: string
  homeId: string
  homeName: string
  title: string | null
  lastMessageBody: string | null
  lastMessageSenderName: string | null
  lastMessageAt: string
}

type PreviewRead = { conversationId: string; userId: string; lastReadAt: string }

const homes: AuthorizedHome[] = [
  { id: 'home-riverbend', name: 'Riverbend Care Centre' },
  { id: 'home-harbour', name: 'Harbourview Nursing Home' },
  { id: 'home-maple', name: 'Maple Street Lodge' },
]

const conversations: PreviewConversation[] = [
  {
    id: 'conv-riverbend',
    homeId: 'home-riverbend',
    homeName: 'Riverbend Care Centre',
    title: 'Medicine supply',
    lastMessageBody: "Perfect — I'll flag it for the afternoon delivery run.",
    lastMessageSenderName: 'Jordan Davis',
    lastMessageAt: minutesAgo(24),
  },
  {
    id: 'conv-riverbend-2',
    homeId: 'home-riverbend',
    homeName: 'Riverbend Care Centre',
    title: 'Blister packs',
    lastMessageBody: 'Could you confirm the Tuesday cycle cut-off?',
    lastMessageSenderName: 'Riverbend Care Centre',
    lastMessageAt: hoursAgo(4),
  },
  {
    id: 'conv-harbour',
    homeId: 'home-harbour',
    homeName: 'Harbourview Nursing Home',
    title: 'Blister pack — R-5502',
    lastMessageBody: 'Blister pack for R-5502 is ready for the Tuesday cycle.',
    lastMessageSenderName: 'Harbourview Nursing Home',
    lastMessageAt: hoursAgo(26),
  },
]

let messageSeq = 0
const nextId = (prefix: string) => `${prefix}-${++messageSeq}`

const messages: ChatMessage[] = [
  {
    id: nextId('m'),
    conversationId: 'conv-riverbend',
    senderId: HOME_USER_ID,
    senderName: 'Riverbend Care Centre',
    body: 'Morning — resident R-2041 has a new order for Apixaban 2.5mg BID. Can you confirm the preferred generic?',
    urgency: 'routine',
    residentId: 'R-2041',
    createdAt: hoursAgo(3),
  },
  {
    id: nextId('m'),
    conversationId: 'conv-riverbend',
    senderId: PHARMACY_USER_ID,
    senderName: PHARMACY_NAME,
    body: 'Confirmed. Preferred generic is Apixaban, DIN 02478123. The alternate is stocked if there is a supply gap.',
    urgency: 'routine',
    residentId: 'R-2041',
    createdAt: hoursAgo(2),
  },
  {
    id: nextId('m'),
    conversationId: 'conv-riverbend',
    senderId: HOME_USER_ID,
    senderName: 'Riverbend Care Centre',
    body: 'Thanks. R-3118 is also out of Rosuvastatin — is there an alternate we can dispense today?',
    urgency: 'urgent',
    residentId: 'R-3118',
    createdAt: minutesAgo(38),
  },
  {
    id: nextId('m'),
    conversationId: 'conv-riverbend',
    senderId: PHARMACY_USER_ID,
    senderName: PHARMACY_NAME,
    body: "Yes — Rosuvastatin 10mg alternate is on the shelf. I'll flag it for the afternoon delivery run.",
    urgency: 'routine',
    residentId: 'R-3118',
    createdAt: minutesAgo(24),
  },
  {
    id: nextId('m'),
    conversationId: 'conv-riverbend-2',
    senderId: HOME_USER_ID,
    senderName: 'Riverbend Care Centre',
    body: 'Could you confirm the Tuesday cycle cut-off?',
    urgency: 'routine',
    residentId: null,
    createdAt: hoursAgo(4),
  },
  {
    id: nextId('m'),
    conversationId: 'conv-harbour',
    senderId: HOME_USER_ID,
    senderName: 'Harbourview Nursing Home',
    body: 'Blister pack for R-5502 is ready for the Tuesday cycle.',
    urgency: 'routine',
    residentId: 'R-5502',
    createdAt: hoursAgo(26),
  },
]

const reads: PreviewRead[] = [
  { conversationId: 'conv-riverbend', userId: PHARMACY_USER_ID, lastReadAt: minutesAgo(20) },
  { conversationId: 'conv-riverbend', userId: HOME_USER_ID, lastReadAt: minutesAgo(22) },
  { conversationId: 'conv-harbour', userId: PHARMACY_USER_ID, lastReadAt: hoursAgo(25) },
]

const listeners = new Set<ChatSubscriptionHandlers>()

function emitMessage(message: ChatMessage) {
  listeners.forEach((listener) => listener.onMessage(message))
}

function emitConversationChange() {
  listeners.forEach((listener) => listener.onConversationChange())
}

function emitRead(read: PreviewRead) {
  listeners.forEach((listener) =>
    listener.onReadChange({
      conversationId: read.conversationId,
      userId: read.userId,
      lastReadAt: read.lastReadAt,
    }),
  )
}

function pushMessage(message: ChatMessage) {
  messages.push(message)
  const conversation = conversations.find((item) => item.id === message.conversationId)
  if (conversation) {
    conversation.lastMessageBody = message.body
    conversation.lastMessageSenderName = message.senderName
    conversation.lastMessageAt = message.createdAt
  }
  emitMessage(message)
  emitConversationChange()
}

function setRead(conversationId: string, userId: string, at: string) {
  const existing = reads.find((read) => read.conversationId === conversationId && read.userId === userId)
  if (existing) existing.lastReadAt = at
  else reads.push({ conversationId, userId, lastReadAt: at })
  emitRead({ conversationId, userId, lastReadAt: at })
}

function summarize(): ConversationSummary[] {
  return conversations
    .map((conversation) => {
      const myRead = reads.find(
        (read) => read.conversationId === conversation.id && read.userId === PHARMACY_USER_ID,
      )?.lastReadAt
      const thread = messages.filter((message) => message.conversationId === conversation.id)
      const unread = thread.filter(
        (message) => message.senderId !== PHARMACY_USER_ID && (!myRead || message.createdAt > myRead),
      )
      return {
        conversationId: conversation.id,
        homeId: conversation.homeId,
        homeName: conversation.homeName,
        title: conversation.title,
        lastMessageBody: conversation.lastMessageBody,
        lastMessageSenderName: conversation.lastMessageSenderName,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: unread.length,
        hasUrgent: unread.some((message) => message.urgency === 'urgent' || message.urgency === 'emergency'),
      }
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

function homeReply(body: string, urgency: Urgency, residentId: string | null): string {
  if (urgency === 'emergency') return 'Acknowledged — escalating to the on-call pharmacist now.'
  if (urgency === 'urgent') return `Understood, that is time-sensitive. We will hold on R-${residentId ?? '—'} until you confirm.`
  if (body.toLowerCase().includes('din')) return 'Great, noted against the resident record. Thank you.'
  return 'Thanks for the update — logged for the care team.'
}

export function createPreviewChatBackend(): ChatBackend {
  return {
    mode: 'preview',

    async load(): Promise<ChatSnapshot> {
      return { selfUserId: PHARMACY_USER_ID, homes, conversations: summarize() }
    },

    async loadMessages(conversationId: string): Promise<ChatMessage[]> {
      return messages
        .filter((message) => message.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },

    async loadReads(conversationId: string): Promise<ConversationRead[]> {
      return reads
        .filter((read) => read.conversationId === conversationId)
        .map((read) => ({
          conversationId: read.conversationId,
          userId: read.userId,
          lastReadAt: read.lastReadAt,
        }))
    },

    async ensureConversation(homeId: string): Promise<string> {
      const existing = conversations
        .filter((conversation) => conversation.homeId === homeId)
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))[0]
      if (existing) return existing.id
      const home = homes.find((item) => item.id === homeId)
      const conversation: PreviewConversation = {
        id: nextId('conv'),
        homeId,
        homeName: home?.name ?? 'Nursing home',
        title: null,
        lastMessageBody: null,
        lastMessageSenderName: null,
        lastMessageAt: new Date().toISOString(),
      }
      conversations.push(conversation)
      emitConversationChange()
      return conversation.id
    },

    async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
      const message: ChatMessage = {
        id: nextId('m'),
        conversationId: input.conversationId,
        senderId: PHARMACY_USER_ID,
        senderName: PHARMACY_NAME,
        body: input.body,
        urgency: input.urgency,
        residentId: input.residentId,
        createdAt: new Date().toISOString(),
      }
      pushMessage(message)

      // The home side reads the message, then replies — mirroring live realtime.
      window.setTimeout(() => setRead(input.conversationId, HOME_USER_ID, new Date().toISOString()), 900)
      window.setTimeout(() => {
        pushMessage({
          id: nextId('m'),
          conversationId: input.conversationId,
          senderId: HOME_USER_ID,
          senderName: conversations.find((item) => item.id === input.conversationId)?.homeName ?? 'Nursing home',
          body: homeReply(input.body, input.urgency, input.residentId),
          urgency: 'routine',
          residentId: input.residentId,
          createdAt: new Date().toISOString(),
        })
      }, 1800)

      return message
    },

    async markRead(conversationId: string): Promise<void> {
      setRead(conversationId, PHARMACY_USER_ID, new Date().toISOString())
    },

    subscribe(handlers: ChatSubscriptionHandlers): () => void {
      listeners.add(handlers)
      return () => {
        listeners.delete(handlers)
      }
    },
  }
}
