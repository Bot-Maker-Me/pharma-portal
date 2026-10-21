'use client'

import { createClient } from '@/lib/supabase/client'
import { createPreviewTeamBackend } from './preview'
import { createSupabaseTeamBackend } from './supabase-backend'
import type { TeamBackend } from './types'

/**
 * Chooses the Team Chat backend at runtime. With Supabase credentials present we
 * talk to the shared project; otherwise the preview backend keeps the interface
 * explorable on sample data.
 */
export function createTeamBackend(): TeamBackend {
  return createClient() ? createSupabaseTeamBackend() : createPreviewTeamBackend()
}
