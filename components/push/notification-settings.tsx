'use client'

import { BellOff, BellRing, Loader2, Share } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePushNotifications } from '@/lib/push/client'

const primaryButton =
  'inline-flex items-center gap-1.5 bg-evergreen px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-evergreen/90 disabled:opacity-60'
const secondaryButton =
  'inline-flex items-center gap-1.5 border border-line px-3.5 py-2 text-xs font-semibold text-ink-soft transition hover:bg-paper-deep disabled:opacity-60'

/**
 * The Account → Notifications control: one device at a time, with every outcome
 * spelled out rather than a single button that silently does nothing.
 */
export function NotificationSettings() {
  const push = usePushNotifications()

  const blocked = push.permission === 'denied'
  const canEnable = push.support === 'ready' && !blocked

  function renderStatus() {
    switch (push.support) {
      case 'checking':
        return <p>Checking this device…</p>

      case 'ios-needs-install':
        return (
          <>
            <p>
              iPhone and iPad only deliver notifications to apps that have been added to the Home Screen — a Safari tab
              cannot receive them, on any iOS version.
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1">
              <Share className="size-3 shrink-0" aria-hidden="true" />
              Tap <strong className="font-semibold text-ink">Share</strong>, then{' '}
              <strong className="font-semibold text-ink">Add to Home Screen</strong>, then open the portal from the
              Home Screen and come back to this screen.
            </p>
          </>
        )

      case 'unsupported':
        return (
          <p>
            This browser cannot show notifications. On a phone, open the portal in Chrome (Android) or Safari (iPhone)
            and add it to your Home Screen.
          </p>
        )

      case 'unconfigured':
        return (
          <p>
            Notifications are not configured on this deployment yet. An administrator needs to set the{' '}
            <code className="font-mono text-[11px]">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> environment variable.
          </p>
        )

      default:
        if (blocked) {
          return (
            <p>
              Notifications are blocked for this site. Allow them in your browser settings (the padlock or icon next to
              the address bar), then reload this page.
            </p>
          )
        }
        if (push.subscribed) {
          return (
            <>
              <p>
                Notifications are <strong className="font-semibold text-ink">on for this device</strong>. You will get a
                short alert when a new message arrives, even if the portal is closed.
              </p>
              <p className="mt-1.5">
                Notifications never include message text, a resident name, or a medicine — only the title and the
                pharmacy it came from.
              </p>
              {push.savedToServer === false && (
                <p className="mt-1.5 text-coral">
                  This device is subscribed, but the server could not store it. Sign in and press Enable again so
                  notifications can be sent to it.
                </p>
              )}
            </>
          )
        }
        return (
          <p>
            Get a short alert on this device when a new message arrives, even when the portal is closed. Each device is
            enabled separately, and you can turn it off again at any time.
          </p>
        )
    }
  }

  return (
    <section className="mt-6 border border-line bg-surface p-4">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
            push.subscribed ? 'bg-sage/25 text-evergreen' : 'bg-paper-deep text-ink-soft',
          )}
          aria-hidden="true"
        >
          {push.subscribed ? <BellRing className="size-3.5" /> : <BellOff className="size-3.5" />}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">Notifications</h2>
          <div className="mt-1 text-xs leading-relaxed text-ink-soft">{renderStatus()}</div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {push.subscribed ? (
              <button type="button" className={secondaryButton} disabled={push.busy} onClick={() => void push.disable()}>
                {push.busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                {push.busy ? 'Turning off…' : 'Disable notifications'}
              </button>
            ) : (
              canEnable && (
                <button type="button" className={primaryButton} disabled={push.busy} onClick={() => void push.enable()}>
                  {push.busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                  {push.busy ? 'Enabling…' : 'Enable notifications'}
                </button>
              )
            )}
          </div>

          {push.error && (
            <p className="mt-2 text-xs leading-relaxed text-coral" role="alert">
              {push.error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
