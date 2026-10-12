'use client'

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

// Preview backend: used only when Supabase is not yet connected. It keeps the
// same ChatBackend contract — a list of threads and their messages, with read
// receipts on each message — so the UI is identical, and it simulates the home
// side replying. Once NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are set, this is never
// used.

const PHARMACY_NAME = 'Jordan Davis'

const now = Date.now()
const minutesAgo = (n: number) => new Date(now - n * 60 * 1000).toISOString()
const hoursAgo = (n: number) => new Date(now - n * 60 * 60 * 1000).toISOString()
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString()

type PreviewThread = {
  id: string
  homeId: string
  homeName: string
  title: string
  residentRef: string | null
  archivedAt: string | null
}

const homes: AuthorizedHome[] = [
  { id: 'home-riverbend', name: 'Riverbend Care Centre' },
  { id: 'home-harbour', name: 'Harbourview Nursing Home' },
  { id: 'home-maple', name: 'Maple Street Lodge' },
]

const threads: PreviewThread[] = [
  {
    id: 'conv-riverbend',
    homeId: 'home-riverbend',
    homeName: 'Riverbend Care Centre',
    title: 'Medicine supply',
    residentRef: 'R-3118',
    archivedAt: null,
  },
  {
    id: 'conv-riverbend-2',
    homeId: 'home-riverbend',
    homeName: 'Riverbend Care Centre',
    title: 'Blister packs',
    residentRef: null,
    archivedAt: null,
  },
  {
    id: 'conv-harbour',
    homeId: 'home-harbour',
    homeName: 'Harbourview Nursing Home',
    title: 'Blister pack — R-5502',
    residentRef: 'R-5502',
    // Already filed away, so the Archived section is explorable in preview mode.
    archivedAt: daysAgo(12),
  },
]

let messageSeq = 0
const nextId = (prefix: string) => `${prefix}-${++messageSeq}`

function message(
  conversationId: string,
  fromPharmacy: boolean,
  body: string,
  urgency: Urgency,
  createdAt: string,
  readAt: string | null = null,
): ChatMessage {
  return {
    id: nextId('m'),
    conversationId,
    senderName: fromPharmacy ? PHARMACY_NAME : threads.find((t) => t.id === conversationId)?.homeName ?? 'Nursing home',
    body,
    urgency,
    fromPharmacy,
    readAt,
    createdAt,
  }
}

const messages: ChatMessage[] = [
  message(
    'conv-riverbend',
    false,
    'Morning — resident R-2041 has a new order for Apixaban 2.5mg BID. Can you confirm the preferred generic?',
    'routine',
    hoursAgo(3),
    hoursAgo(2.5),
  ),
  message(
    'conv-riverbend',
    true,
    'Confirmed. Preferred generic is Apixaban, DIN 02478123. The alternate is stocked if there is a supply gap.',
    'routine',
    hoursAgo(2),
    hoursAgo(1.5),
  ),
  message(
    'conv-riverbend',
    false,
    'Thanks. R-3118 is also out of Rosuvastatin — is there an alternate we can dispense today?',
    'urgent',
    minutesAgo(38),
    null,
  ),
  message(
    'conv-riverbend-2',
    false,
    'Could you confirm the Tuesday cycle cut-off?',
    'routine',
    hoursAgo(4),
    null,
  ),
  message(
    'conv-harbour',
    false,
    'Blister pack for R-5502 is ready for the Tuesday cycle.',
    'routine',
    hoursAgo(26),
    hoursAgo(25),
  ),
]

const listeners = new Set<ChatSubscriptionHandlers>()

function emitMessage(item: ChatMessage) {
  listeners.forEach((listener) => listener.onMessage(item))
}

function emitConversationChange() {
  listeners.forEach((listener) => listener.onConversationChange())
}

function pushMessage(item: ChatMessage) {
  messages.push(item)
  if (threads.some((thread) => thread.id === item.conversationId)) emitConversationChange()
  emitMessage(item)
}

function markThreadRead(conversationId: string, readerIsPharmacy: boolean) {
  const at = new Date().toISOString()
  let changed = false
  messages.forEach((item) => {
    if (item.conversationId !== conversationId || item.readAt) return
    // Only the messages written by the *other* side get a read receipt.
    if (item.fromPharmacy === readerIsPharmacy) return
    item.readAt = at
    changed = true
  })
  if (changed) emitConversationChange()
}

function summarize(): ConversationSummary[] {
  return threads
    .map((thread) => {
      const threadMessages = messages
        .filter((item) => item.conversationId === thread.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const last = threadMessages[threadMessages.length - 1] ?? null
      const unread = threadMessages.filter((item) => !item.fromPharmacy && !item.readAt)
      return {
        conversationId: thread.id,
        homeId: thread.homeId,
        homeName: thread.homeName,
        title: thread.title,
        residentRef: thread.residentRef,
        lastMessageBody: last?.body ?? null,
        lastMessageSenderName: last?.senderName ?? null,
        lastMessageAt: last?.createdAt ?? new Date().toISOString(),
        unreadCount: unread.length,
        hasUrgent: unread.some((item) => item.urgency !== 'routine'),
        archivedAt: thread.archivedAt,
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
      return { homes, conversations: summarize() }
    },

    async loadMessages(conversationId: string): Promise<ChatMessage[]> {
      return messages
        .filter((item) => item.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },

    async ensureConversation(homeId: string, input: NewConversationInput): Promise<string> {
      const existing = threads.filter((thread) => thread.homeId === homeId).pop()
      if (existing) return existing.id
      const home = homes.find((item) => item.id === homeId)
      const thread: PreviewThread = {
        id: nextId('conv'),
        homeId,
        homeName: home?.name ?? 'Nursing home',
        title: input.subject,
        residentRef: input.residentId,
        archivedAt: null,
      }
      threads.push(thread)
      emitConversationChange()
      return thread.id
    },

    async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
      const item = message(
        input.conversationId,
        true,
        input.body,
        input.urgency,
        new Date().toISOString(),
      )
      pushMessage(item)

      // The home side reads the message, then replies — mirroring live realtime.
      window.setTimeout(() => markThreadRead(input.conversationId, false), 900)
      window.setTimeout(() => {
        pushMessage(
          message(
            input.conversationId,
            false,
            homeReply(input.body, input.urgency, input.residentId),
            'routine',
            new Date().toISOString(),
          ),
        )
      }, 1800)

      return item
    },

    async markRead(conversationId: string): Promise<void> {
      markThreadRead(conversationId, true)
    },

    async setArchived(conversationId: string, archived: boolean): Promise<void> {
      const thread = threads.find((item) => item.id === conversationId)
      if (!thread) return
      thread.archivedAt = archived ? new Date().toISOString() : null
      emitConversationChange()
    },

    subscribe(handlers: ChatSubscriptionHandlers): () => void {
      listeners.add(handlers)
      return () => {
        listeners.delete(handlers)
      }
    },
  }
}
