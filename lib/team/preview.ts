'use client'

import type {
  NewTeamChannelInput,
  TeamBackend,
  TeamChannelSummary,
  TeamChannelType,
  TeamColleague,
  TeamMessage,
  TeamSnapshot,
  TeamSubscriptionHandlers,
} from './types'

// Preview backend: used only when Supabase is not yet connected (or the SQL has
// not been applied). It keeps the TeamBackend contract — a list of channels with
// unread counts, and messages with edit/soft-delete stamps — and simulates a
// colleague replying, so the interface is fully explorable offline.

const SELF_ID = 'preview-me'
const SELF_NAME = 'Jordan Davis'

const colleagues: TeamColleague[] = [
  { userId: 'preview-anna', displayName: 'Anna Whiteside', role: 'admin' },
  { userId: 'preview-marcus', displayName: 'Marcus Bell', role: 'staff' },
  { userId: 'preview-priya', displayName: 'Priya Nair', role: 'staff' },
]

type PreviewChannel = {
  id: string
  type: TeamChannelType
  name: string | null
  createdBy: string
  createdAt: string
  memberIds: string[]
  lastReadAt: string | null
}

const now = Date.now()
const minutesAgo = (n: number) => new Date(now - n * 60 * 1000).toISOString()
const hoursAgo = (n: number) => new Date(now - n * 60 * 60 * 1000).toISOString()

const channels: PreviewChannel[] = [
  {
    id: 'preview-channel-team',
    type: 'group',
    name: 'Front counter',
    createdBy: SELF_ID,
    createdAt: hoursAgo(30),
    memberIds: [SELF_ID, 'preview-anna', 'preview-marcus'],
    lastReadAt: hoursAgo(1),
  },
  {
    id: 'preview-channel-anna',
    type: 'direct',
    name: null,
    createdBy: SELF_ID,
    createdAt: hoursAgo(20),
    memberIds: [SELF_ID, 'preview-anna'],
    lastReadAt: minutesAgo(90),
  },
]

let seq = 0
const nextId = (prefix: string) => `${prefix}-${++seq}`

function message(
  channelId: string,
  senderId: string,
  body: string,
  createdAt: string,
  extras: { editedAt?: string | null; deletedAt?: string | null } = {},
): TeamMessage {
  return {
    id: nextId('tm'),
    channelId,
    senderId,
    senderName: senderId === SELF_ID ? SELF_NAME : colleagues.find((c) => c.userId === senderId)?.displayName ?? 'Team member',
    body,
    createdAt,
    editedAt: extras.editedAt ?? null,
    deletedAt: extras.deletedAt ?? null,
  }
}

const messages: TeamMessage[] = [
  message('preview-channel-team', 'preview-anna', 'Opening count is done — two boxes of insulin pens are short.', hoursAgo(3)),
  message('preview-channel-team', SELF_ID, 'Thanks. Use resident initials on the counter notes, not full names.', hoursAgo(2.5)),
  message('preview-channel-team', 'preview-marcus', 'Noted. I will re-count the fridge before the afternoon rush.', hoursAgo(0.6)),
  message('preview-channel-anna', 'preview-anna', 'Can you cover my 4pm handoff today?', minutesAgo(50)),
]

const listeners = new Set<TeamSubscriptionHandlers>()

function emitChannelChange() {
  listeners.forEach((listener) => listener.onChannelChange())
}

function emitMessage(item: TeamMessage) {
  listeners.forEach((listener) => listener.onMessage(item))
}

function memberColleagues(channel: PreviewChannel): TeamColleague[] {
  return channel.memberIds.map((userId) =>
    userId === SELF_ID
      ? { userId: SELF_ID, displayName: SELF_NAME, role: 'staff' }
      : colleagues.find((c) => c.userId === userId) ?? { userId, displayName: 'Team member', role: null },
  )
}

function summarize(channel: PreviewChannel): TeamChannelSummary {
  const owned = messages
    .filter((item) => item.channelId === channel.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const last = owned[0] ?? null
  const members = memberColleagues(channel)
  const other = members.find((member) => member.userId !== SELF_ID) ?? null
  const title =
    channel.type === 'group' ? channel.name?.trim() || 'Group chat' : other?.displayName ?? 'Direct message'
  const unreadCount = owned.filter(
    (item) =>
      item.senderId !== SELF_ID &&
      !item.deletedAt &&
      (channel.lastReadAt === null || item.createdAt > channel.lastReadAt),
  ).length

  return {
    channelId: channel.id,
    type: channel.type,
    name: channel.name,
    title,
    members,
    lastMessageBody: last && !last.deletedAt ? last.body : null,
    lastMessageSenderName: last?.senderName ?? null,
    lastMessageAt: last?.createdAt ?? channel.createdAt,
    unreadCount,
  }
}

const colleagueReply = (body: string): string => {
  if (/cover|shift|handoff/i.test(body)) return 'Yes, I can cover that — see you at handoff.'
  if (/count|insulin|fridge/i.test(body)) return 'Re-counted, the fridge matches the sheet now.'
  return 'Got it, thanks for the heads-up.'
}

export function createPreviewTeamBackend(): TeamBackend {
  return {
    mode: 'preview',

    async load(): Promise<TeamSnapshot> {
      return {
        userId: SELF_ID,
        displayName: SELF_NAME,
        colleagues,
        channels: channels.map(summarize).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
      }
    },

    async loadMessages(channelId: string): Promise<TeamMessage[]> {
      return messages
        .filter((item) => item.channelId === channelId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },

    async createChannel(input: NewTeamChannelInput): Promise<string> {
      const memberIds = Array.from(new Set([SELF_ID, ...input.memberIds.filter((id) => id !== SELF_ID)]))

      if (input.type === 'direct') {
        const target = memberIds.find((id) => id !== SELF_ID)
        const existing = channels.find(
          (channel) =>
            channel.type === 'direct' &&
            channel.memberIds.length === 2 &&
            channel.memberIds.includes(SELF_ID) &&
            Boolean(target && channel.memberIds.includes(target)),
        )
        if (existing) return existing.id
      }

      const channel: PreviewChannel = {
        id: nextId('preview-channel'),
        type: input.type,
        name: input.type === 'group' ? input.name?.trim() || null : null,
        createdBy: SELF_ID,
        createdAt: new Date().toISOString(),
        memberIds,
        lastReadAt: new Date().toISOString(),
      }
      channels.push(channel)
      emitChannelChange()
      return channel.id
    },

    async sendMessage({ channelId, body }): Promise<TeamMessage> {
      const item = message(channelId, SELF_ID, body, new Date().toISOString())
      messages.push(item)
      emitChannelChange()
      emitMessage(item)

      // Simulate a colleague reading the message and replying.
      window.setTimeout(() => {
        const channel = channels.find((c) => c.id === channelId)
        const responder = channel?.memberIds.find((id) => id !== SELF_ID)
        if (!responder) return
        const reply = message(channelId, responder, colleagueReply(body), new Date().toISOString())
        messages.push(reply)
        emitChannelChange()
        emitMessage(reply)
      }, 1600)

      return item
    },

    async editMessage({ messageId, body }): Promise<TeamMessage> {
      const item = messages.find((entry) => entry.id === messageId)
      if (!item) throw new Error('That message no longer exists.')
      item.body = body
      item.editedAt = new Date().toISOString()
      emitChannelChange()
      emitMessage(item)
      return item
    },

    async deleteMessage(messageId: string): Promise<void> {
      const item = messages.find((entry) => entry.id === messageId)
      if (!item) return
      item.deletedAt = new Date().toISOString()
      emitChannelChange()
    },

    async markRead(channelId: string): Promise<void> {
      const channel = channels.find((c) => c.id === channelId)
      if (!channel) return
      channel.lastReadAt = new Date().toISOString()
      emitChannelChange()
    },

    subscribe(handlers: TeamSubscriptionHandlers): () => void {
      listeners.add(handlers)
      return () => {
        listeners.delete(handlers)
      }
    },
  }
}
