'use client'

/**
 * Registers `/sw.js`, the worker that turns a push message into a system
 * notification while the portal is closed.
 *
 * Registration is deliberately quiet about failure: notifications are an extra,
 * and a browser that refuses the worker (private mode, a locked-down profile) must
 * still get a working portal.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  try {
    // Always call `register()` — do NOT return an existing registration without
    // it. `register()` re-runs the worker's update algorithm, and that is the only
    // thing that pulls a branding change into a device that already had the
    // previous worker: without it the old worker keeps its old notification icon,
    // because Chrome throttles its own update check to about once every 24 hours.
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

    // Belt and braces: an explicit `update()` bypasses that 24-hour throttle so a
    // just-deployed worker (with the current icon) is fetched on the very next
    // load. The new worker calls skipWaiting()/clients.claim(), so it takes over
    // immediately rather than waiting for every tab to close.
    void registration.update().catch(() => {})

    return registration
  } catch (error) {
    console.warn('[push] service worker registration failed:', error)
    return null
  }
}
