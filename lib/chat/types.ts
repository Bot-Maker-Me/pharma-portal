// Shared chat domain types. These mirror the columns in the shared Supabase
// schema (see supabase/migrations/20261001000000_chat_with_home.sql) so the
// Nursing Home Portal and the Pharma Portal speak the exact same language.

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
  lastMessageBody: string | null
  lastMessageSenderName: string | null
  lastMessageAt: string
  unreadCount: number
  hasUrgent: boolean
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  body: string
  urgency: Urgency
  residentId: string | null
  createdAt: string
}

export type ConversationRead = {
  conversationId: string
  userId: string
  lastReadAt: string
}

export type SendMessageInput = {
  conversationId: string
  body: string
  urgency: Urgency
  residentId: string | null
}

export type ChatSnapshot = {
  /** The signed-in user's id, used to tell "my" messages from the home's. */
  selfUserId: string | null
  homes: AuthorizedHome[]
  conversations: ConversationSummary[]
}

export type ChatSubscriptionHandlers = {
  onMessage: (message: ChatMessage) => void
  onConversationChange: () => void
  onReadChange: (read: ConversationRead) => void
}

/**
 * The contract every chat backend implements. The live backend talks to Supabase
 * (shared with the Nursing Home Portal); the preview backend runs on sample data
 * so the interface is still explorable before Supabase is connected.
 */
export interface ChatBackend {
  mode: 'live' | 'preview'
  load(): Promise<ChatSnapshot>
  loadMessages(conversationId: string): Promise<ChatMessage[]>
  loadReads(conversationId: string): Promise<ConversationRead[]>
  ensureConversation(homeId: string): Promise<string>
  sendMessage(input: SendMessageInput): Promise<ChatMessage>
  markRead(conversationId: string): Promise<void>
  subscribe(handlers: ChatSubscriptionHandlers): () => void
}
