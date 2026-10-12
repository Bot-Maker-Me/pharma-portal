import { AlertTriangle, Loader2, MessagesSquare, ShieldCheck } from 'lucide-react'

export function ChatLoadingState({ label = 'Loading conversations…' }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-soft" role="status">
      <Loader2 className="size-5 animate-spin text-evergreen" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function ChatErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
      <span className="flex size-10 items-center justify-center rounded-full bg-coral/10 text-coral">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">We couldn&apos;t load your messages</p>
        <p className="mt-1 max-w-xs text-xs text-ink-soft">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-evergreen transition hover:bg-paper-deep"
      >
        Try again
      </button>
    </div>
  )
}

export function ChatEmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-sage/20 text-evergreen">
        <MessagesSquare className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">No nursing homes assigned yet</p>
        <p className="mt-1 max-w-xs text-xs text-ink-soft">
          Once a nursing home is assigned to your pharmacy, its conversation will appear here.
        </p>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-evergreen transition hover:bg-paper-deep"
        >
          Refresh
        </button>
      )}
    </div>
  )
}

export function ThreadPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-sage/20 text-evergreen">
        <MessagesSquare className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">Select a nursing home</p>
        <p className="mt-1 max-w-xs text-xs text-ink-soft">
          Choose a home on the left to open your secure conversation thread.
        </p>
      </div>
    </div>
  )
}

export function ThreadStartState({ homeName }: { homeName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-sage/20 text-evergreen">
        <ShieldCheck className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">Start the conversation with {homeName}</p>
        <p className="mt-1 max-w-sm text-xs text-ink-soft">
          Share clinical updates, confirm substitutions and flag anything time-sensitive. Reference residents by
          ID only.
        </p>
      </div>
    </div>
  )
}
