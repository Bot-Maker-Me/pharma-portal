// Shared chat domain types.
//
// These mirror the columns the Nursing Home portal already stores its messaging
// in — public.chat_threads and public.portal_messages — so both portals read and
// write one shared mailbox:
//
//   chat_threads    id, home_id, pharmacy_id, resident_ref, subject, urgent,
//                   created_by, created_at, last_message_at
//   portal_messages id, user_id, thread_id, sender_role, sender_name, body,
//                   urgent, read_at, created_at

export type Urgency = 'routine' | 'urgent' | 'emergency'

export type ChatIdentity = {
  /** True when NEXT_PUBLIC_SUPABASE_URL + ANON_KEY are present. */
  configured: boolean
  signedIn: boolean
  userId: string | null
  displayName: string
  organization: string | null
}

export type AuthorizedHome = {
  id: string
  name: string
}

export type ConversationSummary = {
  conversationId: string
  homeId: string
  homeName: string
  /** The thread's subject line, set by whichever portal started it. */
  title: string | null
  /** Resident identifier for the whole thread (chat_threads.resident_ref). */
  residentRef: string | null
  lastMessageBody: string | null
  lastMessageSenderName: string | null
  lastMessageAt: string
  unreadCount: number
  hasUrgent: boolean
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderName: string
  body: string
  urgency: Urgency
  /**
   * True when the pharmacy sent it (portal_messages.sender_role !== 'home').
   * This — not the user id — decides which side of the thread a message sits on:
   * the same account can be signed into both portals while testing.
   */
  fromPharmacy: boolean
  /** When the other side opened the message (portal_messages.read_at). */
  readAt: string | null
  createdAt: string
}

export type SendMessageInput = {
  conversationId: string
  body: string
  urgency: Urgency
  residentId: string | null
}

/** Everything needed to create a thread — chat_threads requires a subject. */
export type NewConversationInput = {
  subject: string
  residentId: string | null
  urgent: boolean
}

export type ChatSnapshot = {
  homes: AuthorizedHome[]
  conversations: ConversationSummary[]
}

export type ChatSubscriptionHandlers = {
  onMessage: (message: ChatMessage) => void
  onConversationChange: () => void
}

/**
 * The contract every chat backend implements. The live backend talks to the
 * tables shared with the Nursing Home Portal; the preview backend runs on sample
 * data so the interface is still explorable before Supabase is connected.
 */
export interface ChatBackend {
  mode: 'live' | 'preview'
  load(): Promise<ChatSnapshot>
  loadMessages(conversationId: string): Promise<ChatMessage[]>
  ensureConversation(homeId: string, input: NewConversationInput): Promise<string>
  sendMessage(input: SendMessageInput): Promise<ChatMessage>
  markRead(conversationId: string): Promise<void>
  subscribe(handlers: ChatSubscriptionHandlers): () => void
}
