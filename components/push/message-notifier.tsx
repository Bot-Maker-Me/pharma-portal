'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registerServiceWorker } from '@/lib/push/register'

/**
 * Anything waiting on a notification must be generic — this is a healthcare
 * product, and a lock screen is not a place for a resident name or a medicine.
 * The same shapes the service worker accepts for a server push.
 */
const NOTIFICATION_TITLE = 'New message'
const NOTIFICATION_BODY = 'You have a new message from the nursing home'
const NOTIFICATION_TAG = 'pharma-portal-message'

/**
 * The pharmacy half of message alerts.
 *
 * The server-side push (`send-push` + the `portal_messages` trigger) lives in the
 * shared Nursing Home project — this app cannot see or edit it. What it *can* do
 * is watch the same rows every signed-in pharmacy already has realtime access to
 * and raise a desktop/mobile notification itself: when a message arrives from the
 * home side while the portal is not the tab in front of the user, show a system
 * notification (through the service worker, so it matches the server push exactly).
 *
 * It is mounted once, from the root layout, so it works on every page — not only
 * on the chat screen — and it needs only notification permission, not a stored
 * push subscription, so it also covers a device that never registered for the
 * server push. Notifications from the two paths collapse under one `tag`.
 */
export function MessageNotifier() {
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    let registration: ServiceWorkerRegistration | null = null
    void registerServiceWorker().then((value) => {
      registration = value
    })

    const channel = supabase
      .channel('pharma-portal:incoming-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'portal_messages' },
        (payload) => {
          const row = payload.new as { sender_role?: string | null } | null
          // Only the nursing home's messages are "new" to the pharmacy; the
          // pharmacy's own sends (including from another device) are ignored.
          if (!row || row.sender_role === 'pharmacy') return
          if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
          // When the portal is the tab in front of the user, the thread and unread
          // badge are the signal already — a pop-up on top of them is noise.
          if (document.visibilityState === 'visible') return

          const options: NotificationOptions = {
            body: NOTIFICATION_BODY,
            // Same PNG the service worker uses (generated from app/apple-icon.tsx),
            // so the notification carries the Pharma Portal mark, never a fallback.
            icon: '/apple-icon',
            badge: '/apple-icon',
            tag: NOTIFICATION_TAG,
            data: { url: '/chat' },
          }

          try {
            if (registration) void registration.showNotification(NOTIFICATION_TITLE, options)
            else new Notification(NOTIFICATION_TITLE, options)
          } catch (error) {
            console.error('[push] failed to show an incoming-message notification:', error)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return null
}
