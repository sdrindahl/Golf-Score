import type { Metadata, Viewport } from 'next'
import './globals.css'
import CourseInitializer from '@/components/CourseInitializer'
import Link from 'next/link'

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
        <CourseInitializer />
        <nav className="bg-green-700 text-white p-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/">
              <h1 className="text-2xl font-bold cursor-pointer">⛳ Golf Score Tracker</h1>
            </Link>
            <Link href="/">
              <button className="bg-green-600 hover:bg-green-800 px-4 py-2 rounded font-semibold">
                Home
              </button>
            </Link>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto p-4">
          {children}
        </main>
      </body>
    </html>
  )
}
