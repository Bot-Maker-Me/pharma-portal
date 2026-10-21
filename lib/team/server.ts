import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * The unread badge Team Chat shows in the workspace rail: every message written by
 * a colleague, in a channel I belong to, after the last time I opened it.
 *
 * Fails closed — an un-migrated database, a missing grant or any query error
 * returns 0 rather than throwing, so the rail always renders.
 */
export async function countTeamChatUnread(userId: string): Promise<number> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return 0
  const supabase = await createClient()

  const { data: memberships, error: membershipError } = await supabase
    .from('team_channel_members')
    .select('channel_id, last_read_at')
    .eq('user_id', userId)
  if (membershipError || !memberships?.length) return 0

  const lastRead = new Map<string, string | null>()
  const channelIds = (memberships as { channel_id: string; last_read_at: string | null }[]).map((row) => {
    lastRead.set(row.channel_id, row.last_read_at)
    return row.channel_id
  })

  const { data: messages, error: messageError } = await supabase
    .from('team_messages')
    .select('channel_id, created_at')
    .in('channel_id', channelIds)
    .neq('sender_id', userId)
    .is('deleted_at', null)
  if (messageError) return 0

  return ((messages ?? []) as { channel_id: string; created_at: string }[]).filter((message) => {
    const read = lastRead.get(message.channel_id)
    return read === null || read === undefined || message.created_at > read
  }).length
}
