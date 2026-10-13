'use client'

import { AlertTriangle } from 'lucide-react'

export default function ChatError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-coral/10 text-coral">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">Chat with Pharmacy hit a problem</p>
        <p className="mt-1 max-w-sm text-xs text-ink-soft">{error.message || 'Please try again in a moment.'}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-evergreen px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-evergreen/90"
      >
        Try again
      </button>
    </div>
  )
}
