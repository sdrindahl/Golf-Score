'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { getRoundsInProgress } from '@/lib/roundsInProgress'

export default function NavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const auth = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // State for current round in progress
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const [isLastHole, setIsLastHole] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [currentHole, setCurrentHole] = useState<number>(1)

  // Fetch active rounds from Supabase on mount and when pathname changes
  // This ensures button disappears when user returns after round is deleted
  useEffect(() => {
    const fetchActiveRound = async () => {
      try {
        const user = auth.getCurrentUser();
        if (!user) {
          setCurrentRoundId(null);
          return;
        }

        // Pass user ID to filter rounds by current user only (FIX: prevent cross-user access bug)
        const rounds = await getRoundsInProgress(user.id);
        if (rounds && rounds.length > 0) {
          setCurrentRoundId(rounds[0].id);
        } else {
          setCurrentRoundId(null);
        }
      } catch (err) {
        console.error('[NavBar] Error fetching rounds:', err);
        setCurrentRoundId(null);
      }
    };

    fetchActiveRound();
  }, [pathname, auth]);

  useEffect(() => {
    // Get current user
    const user = auth.getCurrentUser()
    console.log('[NavBar] Current user:', user)
    setCurrentUser(user || null)
    setLoading(false)

    // If not logged in and not on login page, redirect to login
    if (
      !user &&
      pathname !== '/login' &&
      pathname && pathname.startsWith('/player') === false &&
      pathname !== '/settings'
    ) {
      router.push('/login')
    }
  }, [])

  // Listen for hole index changes from track-round page
  useEffect(() => {
    const handleHoleIndexChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      setIsLastHole(customEvent.detail.isLastHole);
    };

    const handleMapStateChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      setIsMapOpen(customEvent.detail.isOpen);
      if (customEvent.detail.currentHole) {
        setCurrentHole(customEvent.detail.currentHole);
      }
    };
    
    window.addEventListener('holeIndexChanged', handleHoleIndexChange);
    window.addEventListener('mapStateChanged', handleMapStateChange);
    return () => {
      window.removeEventListener('holeIndexChanged', handleHoleIndexChange);
      window.removeEventListener('mapStateChanged', handleMapStateChange);
    };
  }, [])

  const isActive = (path: string) => {
    if (!pathname) return false
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
    console.log('[NavBar] On login page, returning null')
    return null;
  }

  console.log('[NavBar] Rendering navbar. pathname:', pathname, 'currentUser:', currentUser)

  // Don't show Return to Round button on track-round page
  const isTrackRoundPage = pathname && pathname.startsWith('/track-round');

  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden md:block text-white p-4 sticky top-0 z-50 shadow-lg border-b border-black/10" style={{ background: 'var(--green-bg)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div 
              onClick={() => router.push('/')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <img src="/apex_tracer.png" alt="ApexTracer Golf" className="h-12 w-12" />
              <h1 className="text-2xl font-bold">ApexTracer Golf</h1>
            </div>
            {currentUser && (
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

      {/* Mobile Bottom Navigation - hidden on Track Round page */}
      {/* Mobile Bottom Navigation - hidden on Track Round page */}
      {!isTrackRoundPage && (
        <nav className="md:hidden mobile-navbar text-white z-50 shadow-2xl border-t border-black/10" style={{ background: 'var(--green-bg)', WebkitTransform: 'translate3d(0, 0, 0)' }}>
          {/* ...mobile navbar content here (restored if needed)... */}
        </nav>
      )}
    </>
  )
}

