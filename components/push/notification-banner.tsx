'use client'

import { useEffect, useState } from 'react'
import { BellRing, Loader2, X } from 'lucide-react'
import { usePushNotifications } from '@/lib/push/client'

const DISMISS_KEY = 'pharma-portal:push-banner-dismissed'

/**
 * A slim, dismissible prompt above the chat thread. It is the one place a user is
 * likely to want notifications, so the ask happens here as well as in Account
 * settings — and it is only ever an ask: permission is requested from the click,
 * never on load.
 */
export function NotificationBanner() {
  const push = usePushNotifications()
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  // Read storage after mount so the first client render matches the server's.
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
    setReady(true)
  }, [])

  const installHint = push.support === 'ios-needs-install'
  const canEnable = push.support === 'ready' && push.permission !== 'denied'
  const visible = ready && !dismissed && !push.subscribed && (installHint || canEnable)

  if (!visible) return null

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Storage can be unavailable in private mode; dismissing still works for
      // this page view.
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-line bg-paper-deep px-4 py-2.5 text-[11px] text-ink-soft sm:px-6">
      <BellRing className="size-3.5 shrink-0 text-evergreen" aria-hidden="true" />

      <p className="min-w-0 flex-1 leading-relaxed">
        {installHint ? (
          <>
            <strong className="font-semibold text-ink">Add the portal to your Home Screen</strong> to get message
            notifications on iPhone. Tap Share, then Add to Home Screen, then open the portal from there.
          </>
        ) : (
          <>
            <strong className="font-semibold text-ink">Get notified about new messages</strong> even when this tab is
            closed. Alerts never include message text.
          </>
        )}
      </p>

      {canEnable && (
        <button
          type="button"
          onClick={() => void push.enable()}
          disabled={push.busy}
          className="inline-flex shrink-0 items-center gap-1.5 bg-evergreen px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-evergreen/90 disabled:opacity-60"
        >
          {push.busy && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
          {push.busy ? 'Enabling…' : 'Enable'}
        </button>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss the notifications prompt"
        className="shrink-0 text-ink-soft transition hover:text-ink"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
