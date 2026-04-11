'use client'

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

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUser')
    router.push('/login')
  }

  // Don't show navbar on login page
  if (pathname === '/login') {
    return null
  }

  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden md:block bg-green-700 text-white p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 
              onClick={() => router.push('/')}
              className="text-2xl font-bold cursor-pointer"
            >
              ⛳ Golf Tracker
            </h1>
            {!loading && currentUser && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-green-600 rounded">
                  <span>👤</span>
                  <span className="font-semibold">{currentUser.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-green-600 hover:bg-green-800 rounded font-semibold text-sm transition"
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      {!loading && currentUser && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-green-700 text-white border-t border-green-600 z-50">
          <div className="flex justify-around">
            <button
              onClick={() => router.push('/')}
              className={`flex-1 flex flex-col items-center justify-center py-3 font-semibold text-xs transition ${
                isActive('/') && pathname !== '/course-search' && pathname !== '/manage-courses'
                  ? 'bg-green-600 text-white'
                  : 'hover:bg-green-600'
              }`}
            >
              <span className="text-lg mb-1">🏠</span>
              Home
            </button>
            <button
              onClick={() => router.push('/players')}
              className={`flex-1 flex flex-col items-center justify-center py-3 font-semibold text-xs transition ${
                pathname === '/players' ? 'bg-green-600 text-white' : 'hover:bg-green-600'
              }`}
            >
              <span className="text-lg mb-1">👥</span>
              Golfers
            </button>
            <button
              onClick={() => router.push('/manage-courses')}
              className={`flex-1 flex flex-col items-center justify-center py-3 font-semibold text-xs transition ${
                pathname === '/manage-courses' || pathname === '/course-search' || pathname === '/add-course'
                  ? 'bg-green-600 text-white'
                  : 'hover:bg-green-600'
              }`}
            >
              <span className="text-lg mb-1">⛳</span>
              Courses
            </button>
            <button
              onClick={() => router.push('/settings')}
              className={`flex-1 flex flex-col items-center justify-center py-3 font-semibold text-xs transition ${
                pathname === '/settings' ? 'bg-green-600 text-white' : 'hover:bg-green-600'
              }`}
            >
              <span className="text-lg mb-1">⚙️</span>
              Account
            </button>
          </div>
        </nav>
      )}
    </>
  )
}

