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
    const existing = await navigator.serviceWorker.getRegistration('/')
    if (existing) return existing
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (error) {
    console.warn('[push] service worker registration failed:', error)
    return null
  }
}
