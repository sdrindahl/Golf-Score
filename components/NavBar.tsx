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
    if (!user && pathname !== '/login' && !pathname.startsWith('/player/') && pathname !== '/settings') {
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
    <nav className="bg-green-700 text-white p-4 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/">
          <h1 className="text-2xl font-bold cursor-pointer">⛳ Golf Score Tracker</h1>
        </Link>
        
        <div className="flex items-center gap-4">
          {!loading && currentUser && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm">👤</span>
                <span className="font-semibold">{currentUser.name}</span>
              </div>
              <div className="border-l border-green-500 pl-4 flex gap-3">
                <Link href="/">
                  <button className="bg-green-600 hover:bg-green-800 px-4 py-2 rounded font-semibold text-sm">
                    Home
                  </button>
                </Link>
                <Link href={`/player/${currentUser.id}`}>
                  <button className="bg-green-600 hover:bg-green-800 px-4 py-2 rounded font-semibold text-sm">
                    My Profile
                  </button>
                </Link>
                <Link href="/settings">
                  <button className="bg-green-600 hover:bg-green-800 px-4 py-2 rounded font-semibold text-sm">
                    ⚙️ Settings
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-800 px-4 py-2 rounded font-semibold text-sm"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
