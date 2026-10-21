'use client'

import { createClient } from '@/lib/supabase/client'
import { createPreviewRequestsBackend } from './preview'
import { createSupabaseRequestsBackend } from './supabase-backend'
import type { RequestsBackend } from './types'

/**
 * Chooses the Employee Requests backend at runtime. With Supabase credentials
 * present we talk to the shared project; otherwise the preview backend keeps the
 * inbox explorable on sample data.
 */
export function createRequestsBackend(): RequestsBackend {
  return createClient() ? createSupabaseRequestsBackend() : createPreviewRequestsBackend()
}
