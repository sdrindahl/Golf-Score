import type { Metadata, Viewport } from 'next'
import './globals.css'
import CourseInitializer from '@/components/CourseInitializer'
import VersionChecker from '@/components/VersionChecker'
import NavBar from '@/components/NavBar'
import { ThemeProvider } from '@/lib/themeContext'

export const metadata: Metadata = {
  title: 'Golf Score Tracker',
  description: 'Track your golf scores and calculate your handicap',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: '/icon-192.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Golf Score Tracker',
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
        <meta name="apple-mobile-web-app-title" content="Golf Tracker" />
      </head>
      <body>
        <ThemeProvider>
          <CourseInitializer />
          <VersionChecker />
          <NavBar />
          <main className="max-w-6xl mx-auto p-3 md:p-4 lg:p-6 pb-24 md:pb-6">
            {children}
          </main>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(err => {
                  console.log('Service Worker registration failed:', err)
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
