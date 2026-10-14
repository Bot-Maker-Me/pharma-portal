'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { registerServiceWorker } from '@/lib/push/register'

/**
 * Registers `/sw.js` once, on app load, from the root layout — so a user who has
 * already granted permission is reachable by a push on any page, not only on the
 * chat screen.
 *
 * It also bridges the worker's "go here" message. Safari and older Firefox do not
 * implement `WindowClient.navigate`, so a tapped notification can only *focus* the
 * window that is already open; this is how that window then routes itself to the
 * conversation in-app, instead of the worker having to open a second tab.
 */
export function ServiceWorkerRegistrar() {
  const router = useRouter()

  useEffect(() => {
    void registerServiceWorker()
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: unknown; url?: unknown } | null
      if (!data || data.type !== 'pharma-portal:navigate') return
      // Only same-origin paths, so the worker cannot hand the app an off-site URL.
      if (typeof data.url !== 'string' || !data.url.startsWith('/')) return
      router.push(data.url)
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [router])

  return null
}
