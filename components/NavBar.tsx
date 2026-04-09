'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { User } from '@/types'
import { useAuth } from '@/lib/useAuth'

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const auth = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current user
    const user = auth.getCurrentUser()
    setCurrentUser(user)
    setLoading(false)

    // If not logged in and not on login page, redirect to login
    if (!user && pathname !== '/login' && !pathname.startsWith('/player') && pathname !== '/settings') {
      router.push('/login')
    }
  }, [pathname, router])

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      auth.logoutUser()
      router.push('/login')
    }
  }

  // Don't show navbar on login page
  if (pathname === '/login') {
    return null
  }

  return (
    <nav className="bg-green-700 text-white p-3 md:p-4 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2 md:mb-0">
          <Link href="/">
            <h1 className="text-lg md:text-2xl font-bold cursor-pointer">⛳ Golf Tracker</h1>
          </Link>

          <div className="flex items-center gap-2 md:gap-4">
            {!loading && currentUser && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-600 rounded text-xs md:text-sm">
                <span>👤</span>
                <span className="font-semibold hidden sm:inline">{currentUser.name}</span>
              </div>
            )}
          </div>
        </div>

        {!loading && currentUser && (
          <div className="flex gap-2 flex-wrap md:flex-nowrap md:justify-end md:border-t md:border-green-500 md:pt-2 md:mt-2">
            <Link href="/" className="flex-1 md:flex-none">
              <button className="bg-green-600 hover:bg-green-800 px-3 py-2 rounded font-semibold text-xs md:text-sm w-full md:w-auto">
                Home
              </button>
            </Link>
            <Link href={`/player?id=${currentUser.id}`} className="flex-1 md:flex-none">
              <button className="bg-green-600 hover:bg-green-800 px-3 py-2 rounded font-semibold text-xs md:text-sm w-full md:w-auto">
                Profile
              </button>
            </Link>
            <Link href="/settings" className="flex-1 md:flex-none">
              <button className="bg-green-600 hover:bg-green-800 px-3 py-2 rounded font-semibold text-xs md:text-sm w-full md:w-auto">
                ⚙️
              </button>
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-800 px-3 py-2 rounded font-semibold text-xs md:text-sm flex-1 md:flex-none"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
