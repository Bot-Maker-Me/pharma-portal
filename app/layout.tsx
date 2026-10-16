import { Analytics } from '@vercel/analytics/next'
import { IBM_Plex_Mono, Manrope, Playfair_Display } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegistrar } from '@/components/push/service-worker-registrar'
import { MessageNotifier } from '@/components/push/message-notifier'
import './globals.css'

// Self-hosted through next/font, not a <link> to fonts.googleapis.com. A
// cross-origin stylesheet in the document makes Next's dev tooling throw
// "Failed to read the 'cssRules' property from 'CSSStyleSheet'" whenever it
// walks document.styleSheets, and it also costs a render-blocking round trip.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

// The display face: a high-contrast transitional serif, which is what the
// register headline is set in.
const serif = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

// Absolute base for the generated social image, so a shared link carries a full
// `og:image` URL rather than a relative one a crawler will drop.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')

const title = 'Pharma Portal — pharmacy workspace & Chat with Home'
const description =
  'A focused workspace for pharmacy formularies, plus secure real-time messaging between your pharmacy and the nursing homes you serve.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  // Every icon source is now the Pharma Portal mark. The vector lives at
  // /icon.svg (used by the manifest, the service worker and the notifier), while
  // the tab icon and the iOS home-screen/notification icon are the PNGs generated
  // from app/icon.tsx and app/apple-icon.tsx — file conventions, so Next links
  // them automatically. The old Next/v0-generated PNGs (icon-light-32x32,
  // icon-dark-32x32, apple-icon) were removed.
  //
  // The link-preview card. `og:image` is the generated app/opengraph-image.tsx;
  // declaring the card type here also makes X/Twitter use it.
  openGraph: {
    type: 'website',
    siteName: 'Pharma Portal',
    locale: 'en_US',
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  // Makes the portal installable. On iPhone this is what turns "Add to Home
  // Screen" into an app that can receive notifications at all — Safari only
  // delivers Web Push to an installed app, never to a browser tab.
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Pharma Portal',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  // The product is a light, paper-toned theme with no dark variant. Declaring
  // light keeps the browser from painting native controls (inputs, selects,
  // scrollbars) in dark mode, which is what made sign-in fields look blank.
  colorScheme: 'light',
  themeColor: '#0b1220',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${serif.variable} ${plexMono.variable}`}>
      <body className="antialiased">
        {children}
        <ServiceWorkerRegistrar />
        <MessageNotifier />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
