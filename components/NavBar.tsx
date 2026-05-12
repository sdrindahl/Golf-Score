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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden mobile-navbar text-white z-50 shadow-2xl border-t border-black/10" style={{ background: 'var(--green-bg)', WebkitTransform: 'translate3d(0, 0, 0)' }}>
        {isTrackRoundPage ? (
          // Track Round Mode - Enhanced Navigation
          <div className="flex justify-around gap-2 px-2 py-3">
            <button
              onClick={() => {
                // Dispatch event to previous hole
                window.dispatchEvent(new CustomEvent('navigatePreviousHole'));
              }}
              className="flex-1 flex flex-col items-center justify-center py-3 px-1 font-semibold text-xs transition rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 active:scale-95 shadow-md hover:shadow-lg border border-blue-400"
            >
              <span className="text-4xl mb-1">⬅️</span>
              <span className="leading-tight">Previous</span>
            </button>
            <button
              onClick={() => {
                // Dispatch event to toggle map
                window.dispatchEvent(new CustomEvent('toggleHoleMap'));
              }}
              className={`flex-1 flex flex-col items-center justify-center py-3 px-1 font-semibold text-xs transition rounded-xl active:scale-95 shadow-md hover:shadow-lg border-2 ${
                isMapOpen
                  ? 'bg-gradient-to-br from-cyan-400 to-blue-500 border-white ring-2 ring-white/50'
                  : 'bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 border-cyan-400'
              }`}
            >
              <span className="text-4xl mb-1">🗺️</span>
              <span className="leading-tight">{isMapOpen ? 'Return to\nScoring' : 'Map'}</span>
            </button>
            <button
              onClick={() => router.push('/rounds-in-progress')}
              className="flex-1 flex flex-col items-center justify-center py-3 px-1 font-semibold text-xs transition rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 hover:from-indigo-600 hover:to-purple-800 active:scale-95 shadow-md hover:shadow-lg border border-indigo-400"
            >
              <span className="text-4xl mb-1">📊</span>
              <span className="leading-tight">Leaderboard</span>
            </button>
            <button
              onClick={() => {
                // Dispatch event to next hole
                window.dispatchEvent(new CustomEvent('navigateNextHole'));
              }}
              className="flex-1 flex flex-col items-center justify-center py-3 px-1 font-semibold text-xs transition rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 hover:from-green-600 hover:to-emerald-800 active:scale-95 shadow-md hover:shadow-lg border border-green-400"
            >
              <span className="text-4xl mb-1">➡️</span>
              <span className="leading-tight">{isLastHole ? 'Finish' : 'Next'}</span>
            </button>
          </div>
        ) : (
          // Normal Navigation
          <div className="flex justify-around">
            <button
              onClick={() => router.push('/')}
              className={`flex-1 flex flex-col items-center justify-center py-2 font-semibold text-xs transition ${
                isActive('/') && pathname !== '/course-search' && pathname !== '/manage-courses'
                  ? 'bg-green-600 text-white'
                  : 'hover:bg-green-600'
              }`}
            >
              <img src="/apex_tracer.png" alt="Home" className="h-10 w-10" />
              Home
            </button>
            <button
              onClick={() => router.push('/players')}
              className={`flex-1 flex flex-col items-center justify-center py-2 font-semibold text-xs transition ${
                pathname === '/players' ? 'bg-green-600 text-white' : 'hover:bg-green-600'
              }`}
            >
              <img src="/list_of_golfers.png" alt="Golfers" className="h-10 w-10" />
              Golfers
            </button>
            {/* Start/Return to Round Button (middle position) */}
            {!isTrackRoundPage ? (
              <button
                onClick={() => {
                  if (currentRoundId) {
                    router.push(`/track-round?id=${currentRoundId}`);
                  } else {
                    router.push('/courses');
                  }
                }}
                className={`flex-1 flex flex-col items-center justify-center py-2 font-semibold text-xs transition shadow-lg rounded ${
                  currentRoundId
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                style={{ minWidth: '0' }}
              >
                {currentRoundId ? (
                  <>
                    <img src="/Players.png" alt="Return to Round" className="h-10 w-10" />
                    Return to
                    <br />
                    Round
                  </>
                ) : (
                  <>
                    <span className="text-lg">▶</span>
                    Start Round
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-2 font-semibold text-xs text-black">
                <img src="/Players.png" alt="Round in Process" className="h-10 w-10 opacity-50" />
                Round in
                <br />
                Progress
              </div>
            )}
            <button
              onClick={() => router.push('/courses')}
              className={`flex-1 flex flex-col items-center justify-center py-2 font-semibold text-xs transition ${
                pathname === '/courses' || pathname === '/manage-courses' || pathname === '/course-search' || pathname === '/add-course'
                  ? 'bg-green-600 text-white'
                  : 'hover:bg-green-600'
              }`}
            >
              <img src="/courses.png" alt="Courses" className="h-10 w-10" />
              Courses
            </button>
            <button
              onClick={() => router.push('/settings')}
              className={`flex-1 flex flex-col items-center justify-center py-2 font-semibold text-xs transition ${
                pathname === '/settings' ? 'bg-green-600 text-white' : 'hover:bg-green-600'
              }`}
            >
              <img src="/settings1.png" alt="Settings" className="h-10 w-10" />
              Settings
            </button>
          </div>
        )}
      </nav>
    </>
  )
}

