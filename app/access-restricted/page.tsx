import type { Metadata } from 'next'

/**
 * Where a blocked request lands. Static on purpose: no database reads, no user
 * lookup, and no hint about which addresses are allowed, which rule matched, or
 * whether this address was ever seen. The message is deliberately the whole page.
 */
export const metadata: Metadata = {
  title: 'Access restricted · Pharma Portal',
  robots: { index: false, follow: false },
}

export default function AccessRestrictedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <p className="ws-subtitle max-w-md">
        Access is restricted to your organisation's network. Contact your administrator.
      </p>
    </main>
  )
}
