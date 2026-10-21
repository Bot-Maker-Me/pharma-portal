// Team Chat domain types — staff-to-staff messaging inside one pharmacy.
//
// These map onto three shared tables also used by the Employee Portal's staff
// messaging:
//
//   team_channels        id, pharmacy_id, type ('direct' | 'group'), name,
//                        created_by, created_at
//   team_channel_members channel_id, user_id, last_read_at, joined_at
//   team_messages        id, channel_id, sender_id, body, created_at,
//                        edited_at, deleted_at
//
// Nothing here logs a message body; bodies travel to the database and back only.

/** One person the signed-in staff member may start a chat with (same pharmacy). */
export type TeamColleague = {
  userId: string
  displayName: string
  /** Their membership role in the pharmacy ('owner' | 'admin' | 'staff'). */
  role: string | null
}

export type TeamChannelType = 'direct' | 'group'

export type TeamChannelSummary = {
  channelId: string
  type: TeamChannelType
  /** Group chats carry a name; direct chats resolve theirs from the members. */
  name: string | null
  /** The label the list shows: a group name, or the other person's name. */
  title: string
  members: TeamColleague[]
  lastMessageBody: string | null
  lastMessageSenderName: string | null
  lastMessageAt: string
  /** Messages from others newer than this member's `last_read_at`. */
  unreadCount: number
}

export type TeamMessage = {
  id: string
  channelId: string
  senderId: string
  senderName: string
  body: string
  createdAt: string
  editedAt: string | null
  /** Set when the sender removed the message — the row is never deleted. */
  deletedAt: string | null
}

export type TeamSnapshot = {
  userId: string
  displayName: string
  /** Everyone in my pharmacy except me — the only people I can chat with. */
  colleagues: TeamColleague[]
  channels: TeamChannelSummary[]
}

export type NewTeamChannelInput = {
  type: TeamChannelType
  /** Required for a group chat; ignored for a direct chat. */
  name: string | null
  /** Colleagues to include (never the creator — the backend adds them). */
  memberIds: string[]
}

export type TeamSubscriptionHandlers = {
  onMessage: (message: TeamMessage) => void
  onChannelChange: () => void
}

/**
 * The contract both backends implement. The live backend talks to the shared
 * Supabase tables; the preview backend runs on sample data so the interface is
 * explorable before Supabase (or the SQL) is in place.
 */
export interface TeamBackend {
  mode: 'live' | 'preview'
  load(): Promise<TeamSnapshot>
  loadMessages(channelId: string): Promise<TeamMessage[]>
  createChannel(input: NewTeamChannelInput): Promise<string>
  sendMessage(input: { channelId: string; body: string }): Promise<TeamMessage>
  editMessage(input: { messageId: string; body: string }): Promise<TeamMessage>
  deleteMessage(messageId: string): Promise<void>
  markRead(channelId: string): Promise<void>
  subscribe(handlers: TeamSubscriptionHandlers): () => void
}
