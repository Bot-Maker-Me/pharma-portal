import { Eye, Lock } from 'lucide-react'

/**
 * Shown instead of a feature's content when the feature is off for the visitor's
 * pharmacy. Deliberately friendly and free of detail: it says the module is not
 * switched on yet and who to ask — nothing about the pharmacy's plan or the
 * feature's configuration.
 */
export function FeatureUnavailable({ label }: { label?: string }) {
  return (
    <main className="ws-shell flex min-h-dvh items-center justify-center bg-paper px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-sage/20 text-evergreen">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="ws-title">This feature is not available yet</h1>
          <p className="ws-subtitle">
            {label ? <><strong className="font-semibold text-ink">{label}</strong> has not been enabled for your pharmacy.</> : 'It has not been enabled for your pharmacy.'}{' '}
            Ask your administrator to turn it on.
          </p>
        </div>
      </div>
    </main>
  )
}

/**
 * The small "Admin preview" marker a platform admin sees when they open a feature
 * that is off for their own pharmacy. Only ever rendered for platform admins.
 */
export function AdminPreviewNotice({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border border-line bg-sage/10 px-3 py-2 text-xs text-ink-soft">
      <Eye className="size-3.5 shrink-0 text-evergreen" aria-hidden="true" />
      <p>
        <strong className="font-semibold text-ink">Admin preview.</strong> {label} is off for this pharmacy. Only
        platform admins can see this.
      </p>
    </div>
  )
}
