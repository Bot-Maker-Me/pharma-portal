import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * The unread badge Employee Requests shows in the workspace rail: employee
 * messages in this pharmacy's threads that the pharmacy has not opened yet.
 *
 * Fails closed — an un-migrated database, a missing grant or any query error
 * returns 0 rather than throwing, so the rail always renders.
 */
export async function countEmployeeRequestUnread(tenantId: string): Promise<number> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return 0
  const supabase = await createClient()

  const { data: threads, error: threadError } = await supabase
    .from('topic_threads')
    .select('id')
    .eq('pharmacy_id', tenantId)
  if (threadError || !threads?.length) return 0

  const threadIds = (threads as { id: string }[]).map((row) => row.id)
  const { count, error: messageError } = await supabase
    .from('topic_messages')
    .select('id', { count: 'exact', head: true })
    .in('thread_id', threadIds)
    .eq('sender_side', 'employee')
    .is('read_at', null)
  if (messageError) return 0
  return count ?? 0
}
