import { Analytics } from '@vercel/analytics/next'
import { IBM_Plex_Mono, Manrope, Playfair_Display } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegistrar } from '@/components/push/service-worker-registrar'
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

export const metadata: Metadata = {
  title: 'Pharma Portal — pharmacy workspace & Chat with Home',
  description:
    'A focused workspace for pharmacy formularies, plus secure real-time messaging between your pharmacy and the nursing homes you serve.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
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
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
