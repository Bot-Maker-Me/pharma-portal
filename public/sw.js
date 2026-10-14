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
/** The screen a notification opens, and the path a focused window is routed to. */
const CHAT_PATH = '/chat'
const ICON = '/icons/icon.svg'
const BADGE = '/icon-light-32x32.png'
/** Message the app listens for when the window cannot be navigated directly. */
const NAVIGATE_MESSAGE = 'pharma-portal:navigate'

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
  if (typeof value !== 'string') return CHAT_PATH
  return /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/.test(value) ? value : CHAT_PATH
}

function originOf(value) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/** Compares windows by screen rather than by exact string, so `?query` and
 *  trailing slashes do not count as "a different place". */
function pathnameOf(value) {
  try {
    return new URL(value).pathname.replace(/\/+$/, '') || '/'
  } catch {
    return ''
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

/* ---------------------------------------------------------------------------
 * Notification tap.
 *
 * The rule this handler exists to enforce: **never open a second window while the
 * portal is already open somewhere.** A new tab beside a running portal is what a
 * "the chat opened in an external tab" report looks like, and it used to happen
 * on Safari and older Firefox — neither implements `WindowClient.navigate`, so
 * the old "can I navigate it? no → open a window" check spawned a new window
 * instead of reusing the one already on screen.
 *
 * `openWindow` is therefore reachable only when there is provably no portal
 * window at all.
 * ------------------------------------------------------------------------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetPath = safeUrl(event.notification.data && event.notification.data.url)
  const targetUrl = new URL(targetPath, self.location.origin).href
  const targetPathname = pathnameOf(targetUrl)
  const chatPathname = pathnameOf(CHAT_PATH)

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const portal = windowClients.filter((client) => originOf(client.url) === self.location.origin)

      // 1. A portal window is already showing that screen — just bring it forward.
      //    Re-navigating it here would throw away the reader's scroll position.
      const onTarget = portal.find((client) => pathnameOf(client.url) === targetPathname)
      if (onTarget) {
        if ('focus' in onTarget) await onTarget.focus()
        return
      }

      // 2. Reuse an open portal window: prefer one already in chat, otherwise
      //    any of them.
      const reusable = portal.find((client) => pathnameOf(client.url) === chatPathname) ?? portal[0] ?? null

      if (reusable) {
        if ('navigate' in reusable) {
          const navigated = await reusable.navigate(targetUrl).catch(() => null)
          if (navigated) {
            if ('focus' in navigated) await navigated.focus()
            return
          }
        }

        // `navigate` missing or refused: focus the window we have, then ask the
        // app to route itself. Both are better than a second window.
        if ('focus' in reusable) await reusable.focus()
        try {
          reusable.postMessage({ type: NAVIGATE_MESSAGE, url: targetPath })
        } catch {
          // An uncontrolled client cannot receive messages. It is already
          // focused, which is the part that matters.
        }
        return
      }

      // 3. Nothing open at all — the only path that opens anything.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
