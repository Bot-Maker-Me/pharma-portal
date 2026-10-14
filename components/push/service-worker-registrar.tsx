'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/push/register'

/**
 * Registers `/sw.js` once, on app load, from the root layout — so a user who has
 * already granted permission is reachable by a push on any page, not only on the
 * chat screen.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker()
  }, [])

  return null
}
