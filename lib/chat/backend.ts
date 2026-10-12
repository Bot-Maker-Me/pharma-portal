'use client'

import { createClient } from '@/lib/supabase/client'
import { createPreviewChatBackend } from './preview-backend'
import { createSupabaseChatBackend } from './supabase-backend'
import type { ChatBackend } from './types'

/**
 * Chooses the chat backend at runtime. When Supabase credentials are present we
 * talk to the shared project (same tables as the Nursing Home Portal); otherwise
 * we fall back to the preview backend so the interface is still explorable.
 */
export function createChatBackend(): ChatBackend {
  return createClient() ? createSupabaseChatBackend() : createPreviewChatBackend()
}
