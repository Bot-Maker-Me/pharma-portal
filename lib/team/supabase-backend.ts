'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  TeamBackend,
  TeamChannelSummary,
  TeamChannelType,
  TeamColleague,
  TeamMessage,
  TeamSnapshot,
  NewTeamChannelInput,
  TeamSubscriptionHandlers,
} from './types'

// Live Team Chat: plain table reads/writes against the tables shared with the
// Employee Portal (team_channels / team_channel_members / team_messages). No
// RPCs beyond `current_tenant_id()` (needed to stamp a new channel) and
// `pharmacy_colleagues()` (which lists the people in my pharmacy — profiles are
// otherwise readable only by their owner).
//
// Nothing here logs a message body, and no message is ever hard-deleted: editing
// stamps `edited_at`, removing stamps `deleted_at`.

const SUMMARY_MESSAGE_LIMIT = 3000
const THREAD_MESSAGE_LIMIT = 1000

const CHANNEL_COLUMNS = 'id, pharmacy_id, type, name, created_by, created_at'
const MEMBER_COLUMNS = 'channel_id, user_id, last_read_at, joined_at'
const MESSAGE_COLUMNS = 'id, channel_id, sender_id, body, created_at, edited_at, deleted_at'
const CHANNEL_LIST_COLUMNS = 'id, type'
const CHANNEL_MEMBER_IDS = 'channel_id, user_id'

type ChannelRow = {
  id: string
  pharmacy_id: string
  type: string
  name: string | null
  created_by: string | null
  created_at: string
}

type MemberRow = {
  channel_id: string
  user_id: string
  last_read_at: string | null
  joined_at: string
}

type MessageRow = {
  id: string
  channel_id: string
  sender_id: string
  body: string
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

type ColleagueRow = {
  user_id: string
  full_name: string | null
  role: string | null
}

type PostgrestLikeError = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string
}

function toTeamError(error: unknown): Error {
  if (error instanceof Error) return error
  const detail = error as PostgrestLikeError | null
  const parts = [detail?.message, detail?.details, detail?.hint].filter(Boolean)
  if (parts.length) return new Error(parts.join(' · '))
  return new Error('Unable to reach the messaging service.')
}

function newId(): string {
  return crypto.randomUUID()
}

function toType(value: string): TeamChannelType {
  return value === 'group' ? 'group' : 'direct'
}

export function createSupabaseTeamBackend(): TeamBackend {
  const client = createClient()
  if (!client) throw new Error('Supabase is not configured')
  // Bound to a narrowed const so the nested helpers below see a non-null client.
  const supabase = client

  // Names resolved from `pharmacy_colleagues()`, cached for the lifetime of this
  // backend so realtime inserts and thread loads can label senders without a
  // second round trip.
  const colleagueById = new Map<string, TeamColleague>()

  function nameOf(userId: string, fallback = 'Team member'): string {
    return colleagueById.get(userId)?.displayName ?? fallback
  }

  function mapMessage(row: MessageRow, selfId: string): TeamMessage {
    return {
      id: row.id,
      channelId: row.channel_id,
      senderId: row.sender_id,
      senderName: row.sender_id === selfId ? 'You' : nameOf(row.sender_id),
      body: row.body,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      deletedAt: row.deleted_at,
    }
  }

  async function fetchColleagues(): Promise<TeamColleague[]> {
    const { data, error } = await supabase.rpc('pharmacy_colleagues')
    if (error) throw toTeamError(error)
    return ((data ?? []) as ColleagueRow[]).map((row) => ({
      userId: String(row.user_id),
      displayName: (row.full_name ?? '').trim() || 'Team member',
      role: row.role ?? null,
    }))
  }

  async function requireUser(): Promise<string> {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    if (!userId) throw new Error('Your session has expired. Please sign in again.')
    return userId
  }

  function summarize(
    row: ChannelRow,
    memberRows: MemberRow[],
    messageRows: MessageRow[],
    lastReadAt: string | null,
    selfId: string,
  ): TeamChannelSummary {
    const type = toType(row.type)
    const members: TeamColleague[] = memberRows.map((member) => ({
      userId: member.user_id,
      displayName: colleagueById.get(member.user_id)?.displayName ?? 'Team member',
      role: colleagueById.get(member.user_id)?.role ?? null,
    }))
    // messageRows arrive newest-first.
    const last = messageRows[0] ?? null
    const other = members.find((member) => member.userId !== selfId) ?? null
    const title = type === 'group' ? row.name?.trim() || 'Group chat' : other?.displayName ?? 'Direct message'

    const unreadCount = messageRows.filter(
      (message) =>
        message.sender_id !== selfId &&
        !message.deleted_at &&
        (lastReadAt === null || message.created_at > lastReadAt),
    ).length

    return {
      channelId: row.id,
      type,
      name: row.name,
      title,
      members,
      lastMessageBody: last && !last.deleted_at ? last.body : null,
      lastMessageSenderName: last ? (last.sender_id === selfId ? 'You' : nameOf(last.sender_id)) : null,
      lastMessageAt: last?.created_at ?? row.created_at,
      unreadCount,
    }
  }

  async function findDirectChannel(selfId: string, colleagueId: string): Promise<string | null> {
    const { data: mine, error } = await supabase
      .from('team_channel_members')
      .select('channel_id')
      .eq('user_id', selfId)
    if (error) return null
    const ids = ((mine ?? []) as { channel_id: string }[]).map((row) => row.channel_id)
    if (ids.length === 0) return null

    const [channelsResult, membersResult] = await Promise.all([
      supabase.from('team_channels').select(CHANNEL_LIST_COLUMNS).in('id', ids),
      supabase.from('team_channel_members').select(CHANNEL_MEMBER_IDS).in('channel_id', ids),
    ])
    if (channelsResult.error || membersResult.error) return null

    const directIds = new Set(
      ((channelsResult.data ?? []) as { id: string; type: string }[])
        .filter((row) => toType(row.type) === 'direct')
        .map((row) => row.id),
    )
    if (directIds.size === 0) return null

    const byChannel = new Map<string, Set<string>>()
    ;((membersResult.data ?? []) as { channel_id: string; user_id: string }[]).forEach((row) => {
      if (!directIds.has(row.channel_id)) return
      const set = byChannel.get(row.channel_id) ?? new Set<string>()
      set.add(row.user_id)
      byChannel.set(row.channel_id, set)
    })

    for (const [channelId, members] of byChannel) {
      if (members.size === 2 && members.has(selfId) && members.has(colleagueId)) return channelId
    }
    return null
  }

  return {
    mode: 'live',

    async load(): Promise<TeamSnapshot> {
      const selfId = await requireUser()

      const colleagues = await fetchColleagues()
      colleagueById.clear()
      colleagues.forEach((colleague) => colleagueById.set(colleague.userId, colleague))
      const displayName = colleagueById.get(selfId)?.displayName ?? 'Team member'
      const others = colleagues.filter((colleague) => colleague.userId !== selfId)

      const { data: myMemberships, error: membershipError } = await supabase
        .from('team_channel_members')
        .select('channel_id, last_read_at')
        .eq('user_id', selfId)
      if (membershipError) throw toTeamError(membershipError)

      const lastRead = new Map<string, string | null>()
      const channelIds = ((myMemberships ?? []) as { channel_id: string; last_read_at: string | null }[]).map(
        (row) => {
          lastRead.set(row.channel_id, row.last_read_at)
          return row.channel_id
        },
      )
      if (channelIds.length === 0) return { userId: selfId, displayName, colleagues: others, channels: [] }

      const [channelsResult, membersResult, messagesResult] = await Promise.all([
        supabase.from('team_channels').select(CHANNEL_COLUMNS).in('id', channelIds),
        supabase.from('team_channel_members').select(MEMBER_COLUMNS).in('channel_id', channelIds),
        supabase
          .from('team_messages')
          .select(MESSAGE_COLUMNS)
          .in('channel_id', channelIds)
          .order('created_at', { ascending: false })
          .limit(SUMMARY_MESSAGE_LIMIT),
      ])
      if (channelsResult.error) throw toTeamError(channelsResult.error)
      if (membersResult.error) throw toTeamError(membersResult.error)
      if (messagesResult.error) throw toTeamError(messagesResult.error)

      const membersByChannel = new Map<string, MemberRow[]>()
      ;((membersResult.data ?? []) as MemberRow[]).forEach((row) => {
        const bucket = membersByChannel.get(row.channel_id)
        if (bucket) bucket.push(row)
        else membersByChannel.set(row.channel_id, [row])
      })

      const messagesByChannel = new Map<string, MessageRow[]>()
      ;((messagesResult.data ?? []) as MessageRow[]).forEach((row) => {
        const bucket = messagesByChannel.get(row.channel_id)
        if (bucket) bucket.push(row)
        else messagesByChannel.set(row.channel_id, [row])
      })

      const channels: TeamChannelSummary[] = ((channelsResult.data ?? []) as ChannelRow[])
        .map((row) =>
          summarize(
            row,
            membersByChannel.get(row.id) ?? [],
            messagesByChannel.get(row.id) ?? [],
            lastRead.get(row.id) ?? null,
            selfId,
          ),
        )
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

      return { userId: selfId, displayName, colleagues: others, channels }
    },

    async loadMessages(channelId: string): Promise<TeamMessage[]> {
      const selfId = await requireUser()
      const { data, error } = await supabase
        .from('team_messages')
        .select(MESSAGE_COLUMNS)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(THREAD_MESSAGE_LIMIT)
      if (error) throw toTeamError(error)
      return ((data ?? []) as MessageRow[]).map((row) => mapMessage(row, selfId))
    },

    async createChannel(input: NewTeamChannelInput): Promise<string> {
      const selfId = await requireUser()

      // A direct chat is a single conversation: reuse the existing one rather than
      // starting a second thread with the same colleague.
      if (input.type === 'direct') {
        const target = input.memberIds.find((id) => id !== selfId)
        if (!target) throw new Error('Pick a colleague to chat with.')
        const existing = await findDirectChannel(selfId, target)
        if (existing) return existing
      }

      const { data: tenantId, error: tenantError } = await supabase.rpc('current_tenant_id')
      if (tenantError) throw toTeamError(tenantError)
      if (!tenantId) throw new Error('You are not attached to a pharmacy workspace.')

      const now = new Date().toISOString()
      const channelId = newId()
      const { error: channelError } = await supabase.from('team_channels').insert({
        id: channelId,
        pharmacy_id: tenantId,
        type: input.type,
        name: input.type === 'group' ? input.name?.trim() || null : null,
        created_by: selfId,
        created_at: now,
      })
      if (channelError) throw toTeamError(channelError)

      const members = Array.from(new Set([selfId, ...input.memberIds.filter((id) => id !== selfId)]))
      const { error: membersError } = await supabase.from('team_channel_members').insert(
        members.map((userId) => ({
          channel_id: channelId,
          user_id: userId,
          last_read_at: now,
          joined_at: now,
        })),
      )
      if (membersError) throw toTeamError(membersError)

      return channelId
    },

    async sendMessage({ channelId, body }): Promise<TeamMessage> {
      const selfId = await requireUser()
      const { data, error } = await supabase
        .from('team_messages')
        .insert({
          id: newId(),
          channel_id: channelId,
          sender_id: selfId,
          body,
          created_at: new Date().toISOString(),
        })
        .select(MESSAGE_COLUMNS)
        .single()
      if (error) throw toTeamError(error)
      return mapMessage(data as MessageRow, selfId)
    },

    async editMessage({ messageId, body }): Promise<TeamMessage> {
      const selfId = await requireUser()
      const { data, error } = await supabase
        .from('team_messages')
        .update({ body, edited_at: new Date().toISOString() })
        .eq('id', messageId)
        .select(MESSAGE_COLUMNS)
        .single()
      if (error) throw toTeamError(error)
      return mapMessage(data as MessageRow, selfId)
    },

    async deleteMessage(messageId: string): Promise<void> {
      const { error } = await supabase
        .from('team_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)
      if (error) throw toTeamError(error)
    },

    async markRead(channelId: string): Promise<void> {
      const selfId = await requireUser()
      await supabase
        .from('team_channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', selfId)
    },

    subscribe(handlers: TeamSubscriptionHandlers): () => void {
      const channel = supabase
        .channel('team-chat')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'team_messages' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              handlers.onMessage(mapMessage(payload.new as MessageRow, ''))
            }
            handlers.onChannelChange()
          },
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_channels' }, () =>
          handlers.onChannelChange(),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'team_channel_members' },
          () => handlers.onChannelChange(),
        )
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    },
  }
}
