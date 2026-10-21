// Employee Requests domain types — the pharmacy side of the inbox whose threads
// are started by employees in the Employee Portal.
//
// They map onto two shared tables:
//
//   topic_threads  id, organization_id, organization_name, pharmacy_id, created_by,
//                  topic, category, priority ('normal' | 'urgent'),
//                  status ('open' | 'closed'), created_at, closed_at
//   topic_messages id, thread_id, sender_id, sender_side ('employee' | 'pharmacy'),
//                  body, created_at, read_at
//
// Bodies are never logged anywhere — they only travel to the database and back.

export type RequestPriority = 'normal' | 'urgent'
export type RequestStatus = 'open' | 'closed'
export type RequestSenderSide = 'employee' | 'pharmacy'

export type RequestThread = {
  id: string
  organizationId: string | null
  organizationName: string | null
  pharmacyId: string | null
  createdBy: string | null
  topic: string
  category: string | null
  priority: RequestPriority
  status: RequestStatus
  createdAt: string
  closedAt: string | null
  lastMessageBody: string | null
  lastMessageSide: RequestSenderSide | null
  lastMessageAt: string
  /** Employee messages the pharmacy has not opened yet. */
  unreadCount: number
}

export type RequestMessage = {
  id: string
  threadId: string
  senderId: string
  senderName: string
  senderSide: RequestSenderSide
  body: string
  createdAt: string
  readAt: string | null
}

export type RequestsSnapshot = {
  userId: string
  displayName: string
  threads: RequestThread[]
}

export type RequestsSubscriptionHandlers = {
  onMessage: (message: RequestMessage) => void
  onThreadChange: () => void
}

/**
 * The contract both backends implement. The live backend talks to the shared
 * Supabase tables; the preview backend runs on sample data so the inbox is
 * explorable before Supabase (or the SQL) is in place.
 */
export interface RequestsBackend {
  mode: 'live' | 'preview'
  load(): Promise<RequestsSnapshot>
  loadMessages(threadId: string): Promise<RequestMessage[]>
  sendMessage(input: { threadId: string; body: string }): Promise<RequestMessage>
  setStatus(threadId: string, status: RequestStatus): Promise<void>
  markRead(threadId: string): Promise<void>
  subscribe(handlers: RequestsSubscriptionHandlers): () => void
}
