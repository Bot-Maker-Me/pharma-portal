/* Pharma Portal service worker — the notification runner.
 *
 * Its whole job is turning a push message into a system notification and opening
 * the right screen when that notification is tapped. It holds no tenant, auth or
 * conversation logic of its own.
 *
 * This file is served from /public, so it is plain JavaScript with no build step
 * and no imports.
 */

const DEFAULT_TITLE = 'New message'
const DEFAULT_BODY = 'You have a new message from the pharmacy'
const DEFAULT_URL = '/chat'
const ICON = '/icons/icon.svg'
const BADGE = '/icon-light-32x32.png'

/* ---------------------------------------------------------------------------
 * PRIVACY GUARD
 *
 * This is a healthcare product, so a notification must never put a message body,
 * a resident name, or a medicine onto a lock screen — and it must not be possible
 * to make it do so by sending a cleverer payload. Whatever text arrives is
 * therefore discarded unless it matches one of these generic shapes:
 *
 *   title: "New message"
 *   body:  "You have a new message from the pharmacy"
 *   body:  "You have a new message from <pharmacy name>"
 *
 * The guard lives here as well as on the server, so a future mistake in the
 * sender cannot leak anything to a device that is already subscribed.
 * ------------------------------------------------------------------------- */

const TITLE_PATTERN = /^New message$/
const BODY_PATTERN = /^You have a new message(?: from [^.!?\n]{1,60})?$/

function safeText(value, pattern, fallback) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return pattern.test(trimmed) ? trimmed : fallback
}

/**
 * Only same-origin paths are honoured. An absolute URL from the payload would
 * turn a notification tap into an open redirect.
 */
function safeUrl(value) {
  if (typeof value !== 'string') return DEFAULT_URL
  return /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/.test(value) ? value : DEFAULT_URL
}

function originOf(value) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

self.addEventListener('install', () => {
  // Take over as soon as possible: a user who has just granted permission should
  // not have to reload before the worker can receive a push.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    // A push with no payload (or one that is not JSON) still has to show
    // something, so fall through to the generic copy.
    payload = {}
  }

  const title = safeText(payload.title, TITLE_PATTERN, DEFAULT_TITLE)
  const body = safeText(payload.body, BODY_PATTERN, DEFAULT_BODY)
  const url = safeUrl(payload.url)
  // A stable tag collapses repeat notifications for the same thread instead of
  // stacking one per message.
  const tag = typeof payload.tag === 'string' && payload.tag ? payload.tag.slice(0, 64) : 'pharma-portal-message'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: ICON,
      badge: BADGE,
      tag,
      renotify: true,
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetPath = safeUrl(event.notification.data && event.notification.data.url)
  const targetUrl = new URL(targetPath, self.location.origin).href

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      // 1. A portal window already showing the target screen — just bring it forward.
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus()
      }

      // 2. Another portal window is open — send it to the target, then focus it.
      const sameOrigin = windowClients.find((client) => originOf(client.url) === self.location.origin)
      if (sameOrigin && 'navigate' in sameOrigin) {
        await sameOrigin.navigate(targetUrl).catch(() => undefined)
        return 'focus' in sameOrigin ? sameOrigin.focus() : undefined
      }

      // 3. Nothing open — open a new window.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      return undefined
    })(),
  )
})
