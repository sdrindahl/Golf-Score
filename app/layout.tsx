import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import ClientLayout from './ClientLayout'

export const metadata: Metadata = {
  title: 'Just Tap It - Golf Scorecard',
  description: 'Just Tap It - Your personal golf caddie: track scores, calculate handicaps, and compete with friends',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/JustTapIT_Logo.png', sizes: '192x192', type: 'image/png' },
      { url: '/JustTapIT_Logo.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/JustTapIT_Logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Just Tap It',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#22c55e',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="green" />
        <meta name="apple-mobile-web-app-title" content="Just Tap It" />
        <link rel="apple-touch-icon" href="/JustTapIT_Logo.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/JustTapIT_Logo.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/JustTapIT_Logo.png" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(err => {
                console.log('Service Worker registration failed:', err)
              })
            }
          `}
        </Script>
      </body>
    </html>
  )
}
