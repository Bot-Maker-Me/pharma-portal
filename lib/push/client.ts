'use client'

import { useCallback, useEffect, useState } from 'react'
import { registerServiceWorker } from './register'
import { deleteSubscriptionRow, isEndpointStored, resolveTenantId, saveSubscription } from './subscriptions'
import { hasVapidPublicKey, urlBase64ToUint8Array, vapidKeyStatus, vapidPublicKey } from './vapid'

/**
 * Why the toggle is in the state it is in. `unsupported` and `ios-needs-install`
 * are deliberately separate: on an iPhone in a Safari tab the API genuinely does
 * not exist, but the fix is "add it to your Home Screen", not "your browser is
 * too old" — so the UI has to be able to tell them apart.
 *
 * `unconfigured` (no key at all) and `invalid-key` (a key that cannot be a VAPID
 * key) are separate too, so the message can say which of the two it is.
 */
export type PushSupport = 'checking' | 'unsupported' | 'ios-needs-install' | 'unconfigured' | 'invalid-key' | 'ready'

export type PushController = {
  support: PushSupport
  permission: NotificationPermission | null
  /** This browser holds a live push subscription for this device. */
  subscribed: boolean
  /** Whether the server has that subscription on file. `null` until it is asked. */
  savedToServer: boolean | null
  /** A valid `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is present at build time. */
  keyConfigured: boolean
  /** `/sw.js` is registered for this page. */
  serviceWorkerRegistered: boolean
  busy: boolean
  error: string | null
  enable: () => Promise<void>
  disable: () => Promise<void>
}

/** iPadOS 13+ reports itself as a Mac, so the touch-point count is the tell. */
function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** An app opened from the Home Screen / an installed app window, not a browser tab. */
function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function usePushNotifications(): PushController {
  const [support, setSupport] = useState<PushSupport>('checking')
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [savedToServer, setSavedToServer] = useState<boolean | null>(null)
  const [serviceWorkerRegistered, setServiceWorkerRegistered] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Work out what this device can do, and whether it is already subscribed.
  useEffect(() => {
    let cancelled = false

    async function inspect() {
      if (typeof window === 'undefined') return

      setPermission('Notification' in window ? Notification.permission : null)

      if (isIosDevice() && !isInstalled()) {
        if (!cancelled) setSupport('ios-needs-install')
        return
      }
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (!cancelled) setSupport('unsupported')
        return
      }

      const keyStatus = vapidKeyStatus()
      if (keyStatus !== 'configured') {
        if (!cancelled) setSupport(keyStatus === 'missing' ? 'unconfigured' : 'invalid-key')
        return
      }
      if (!cancelled) setSupport('ready')

      const registration =
        (await navigator.serviceWorker.getRegistration('/')) ?? (await registerServiceWorker())
      if (!cancelled) setServiceWorkerRegistered(Boolean(registration))
      const subscription = await registration?.pushManager.getSubscription().catch(() => null)
      if (cancelled || !subscription) return

      setSubscribed(true)
      const stored = await isEndpointStored(subscription.endpoint).catch(() => false)
      if (!cancelled) setSavedToServer(stored)
    }

    void inspect()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('This browser cannot show notifications.')
        return
      }

      const keyStatus = vapidKeyStatus()
      if (keyStatus !== 'configured') {
        setError(
          keyStatus === 'missing'
            ? 'This deployment has no NEXT_PUBLIC_VAPID_PUBLIC_KEY set, so a subscription cannot be created.'
            : 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is set but is not a valid VAPID public key. It should be an ~87-character URL-safe base64 string that starts with "B".',
        )
        return
      }

      // Safari only honours the prompt while the user activation from the click is
      // still live, so this is the first await — nothing may run before it.
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        setError(
          nextPermission === 'denied'
            ? 'Notifications are blocked for this site. Allow them in your browser settings, then try again.'
            : 'Permission was dismissed. Press Enable again and choose Allow.',
        )
        return
      }

      const registration =
        (await navigator.serviceWorker.getRegistration('/')) ?? (await registerServiceWorker())
      if (!registration) {
        setError('The notification worker is not available. Reload the page and try again.')
        return
      }
      setServiceWorkerRegistered(true)
      await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription().catch(() => null)
      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          })
        } catch (subscribeError) {
          console.error('[push] pushManager.subscribe failed:', subscribeError)
          throw subscribeError
        }
      }

      // Subscribed from here on, whether or not the server can be told — that
      // difference is exactly what `savedToServer` reports.
      setSubscribed(true)

      try {
        await saveSubscription({ subscription, tenantId: await resolveTenantId() })
        setSavedToServer(true)
      } catch (saveFailure: unknown) {
        setSavedToServer(false)
        throw saveFailure
      }
    } catch (failure: unknown) {
      console.error('[push] enabling notifications failed:', failure)
      setError(failure instanceof Error ? failure.message : 'Notifications could not be enabled.')
    } finally {
      setBusy(false)
    }
  }, [busy])

  const disable = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription().catch(() => null)
      if (subscription) {
        // Tell the server first: once the browser forgets the endpoint, the row
        // can never be found again.
        await deleteSubscriptionRow(subscription.endpoint).catch(() => undefined)
        await subscription.unsubscribe()
      }
      setSubscribed(false)
      setSavedToServer(null)
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Notifications could not be turned off.')
    } finally {
      setBusy(false)
    }
  }, [busy])

  return {
    support,
    permission,
    subscribed,
    savedToServer,
    keyConfigured: hasVapidPublicKey(),
    serviceWorkerRegistered,
    busy,
    error,
    enable,
    disable,
  }
}
