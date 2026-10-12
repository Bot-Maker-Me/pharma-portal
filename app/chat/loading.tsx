import { Loader2 } from 'lucide-react'

export default function ChatLoading() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-paper text-ink-soft">
      <Loader2 className="size-6 animate-spin text-evergreen" aria-hidden="true" />
      <p className="text-sm">Opening Chat with Home…</p>
    </div>
  )
}
