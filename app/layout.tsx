import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import ClientLayout from './ClientLayout'

export const metadata: Metadata = {
  title: 'ApexTracer - Golf Scorecard',
  description: 'Your personal golf caddie - track scores, calculate handicaps, and compete with friends',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/apex_tracer.png', sizes: '192x192', type: 'image/png' },
      { url: '/apex_tracer.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apex_tracer.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ApexTracer',
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
        <meta name="apple-mobile-web-app-title" content="ApexTracer" />
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
