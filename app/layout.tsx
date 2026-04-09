import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Golf Score Tracker',
  description: 'Track your golf scores and calculate your handicap',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <nav className="bg-green-700 text-white p-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold">⛳ Golf Score Tracker</h1>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto p-4">
          {children}
        </main>
      </body>
    </html>
  )
}
