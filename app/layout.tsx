import type { Metadata, Viewport } from 'next'
import './globals.css'
import CourseInitializer from '@/components/CourseInitializer'
import NavBar from '@/components/NavBar'

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
        <NavBar />
        <main className="max-w-6xl mx-auto p-4">
          {children}
        </main>
      </body>
    </html>
  )
}
