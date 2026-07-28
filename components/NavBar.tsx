'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { useFeatureFlags } from '@/lib/featureFlagsContext'
import { getRoundsInProgress } from '@/lib/roundsInProgress'

export default function NavBar() {
    // Listen for localStorage changes and custom roundStateChanged event to update courseSelectedButNoRound
    useEffect(() => {
      const updateState = () => {
        syncRoundStateFromStorage()
      };
      window.addEventListener('storage', updateState);
      window.addEventListener('roundStateChanged', updateState);
      return () => {
        window.removeEventListener('storage', updateState);
        window.removeEventListener('roundStateChanged', updateState);
      };
    }, []);
  const router = useRouter()
  const pathname = usePathname()
  const auth = useAuth()
  const { isEnabled } = useFeatureFlags()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // State for current round in progress
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const [courseSelectedButNoRound, setCourseSelectedButNoRound] = useState(false)

  const syncRoundStateFromStorage = () => {
    const storedRoundId = localStorage.getItem('currentRoundId')
    if (storedRoundId) {
      setCurrentRoundId(storedRoundId)
    } else {
      setCurrentRoundId(null)
    }

    setCourseSelectedButNoRound(!!localStorage.getItem('courseSelectedButNoRound'))
  }
  const [isLastHole, setIsLastHole] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [currentHole, setCurrentHole] = useState<number>(1)
  const [menuOpen, setMenuOpen] = useState(false)

  // Fetch active rounds from Supabase on mount and when pathname changes
  // Only clear courseSelectedButNoRound if a round is actually in progress
  useEffect(() => {
    const fetchActiveRound = async () => {
      try {
        const user = auth.getCurrentUser();
        if (!user) {
          setCurrentRoundId(null);
          return;
        }

        // Check localStorage first — if currentRoundId is not set, use that as the source of truth
        const storedRoundId = localStorage.getItem('currentRoundId');
        if (!storedRoundId) {
          setCurrentRoundId(null);
          return;
        }

        // Otherwise fetch from Supabase with cache-bust to ensure fresh data
        const rounds = await getRoundsInProgress(user.id);
        if (rounds && rounds.length > 0) {
          setCurrentRoundId(rounds[0].id);
          // Only clear the flag if a round is in progress
          if (typeof window !== 'undefined') {
            localStorage.removeItem('courseSelectedButNoRound');
            setCourseSelectedButNoRound(false);
          }
        } else {
          setCurrentRoundId(null);
          // Do NOT overwrite courseSelectedButNoRound here; let event listeners control it
        }
      } catch (err) {
        console.error('[NavBar] Error fetching rounds:', err);
        setCurrentRoundId(null);
        // Do NOT overwrite courseSelectedButNoRound here; let event listeners control it
      }
    };

    fetchActiveRound();
  }, [pathname, auth]);

  useEffect(() => {
    if (typeof window === 'undefined') return
    syncRoundStateFromStorage()
  }, [pathname])

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

  // Close hamburger menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const handleLogout = () => {
    setMenuOpen(false)
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
  const isWalletPage = pathname && pathname.startsWith('/wallet');
  const eventsEnabled = isEnabled('events_core')

  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden md:block text-white px-6 py-3 sticky top-0 z-50 border-b border-green-950/60" style={{ background: '#07150f', boxShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div
              onClick={() => router.push('/')}
              className="flex items-center gap-3 cursor-pointer"
            >
              <img src="/JustTapIt_Logo.png" alt="Just Tap It" className="h-10 w-10" />
              <h1 className="text-xl font-bold tracking-tight text-white">Just Tap It Golf</h1>
            </div>
            {currentUser && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/wallet')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm transition ${
                    pathname === '/wallet' || pathname?.startsWith('/wallet/')
                      ? 'bg-green-700 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  💳 Wallet
                </button>
                <button
                  onClick={() => router.push('/courses')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm transition ${
                    pathname?.startsWith('/courses') ? 'bg-green-700 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  🏌️ Courses
                </button>
                <button
                  onClick={() => router.push('/players')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm transition ${
                    pathname?.startsWith('/players') ? 'bg-green-700 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  👥 Golfers
                </button>
                {eventsEnabled && (
                  <button
                    onClick={() => router.push('/events')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm transition ${
                      pathname?.startsWith('/events') ? 'bg-green-700 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    🏆 Events
                  </button>
                )}
                <div className="w-px h-5 bg-green-900 mx-1" />
                <button
                  onClick={() => router.push('/settings')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-sm transition ${
                    pathname === '/settings' ? 'bg-green-700 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  ⚙️ Settings
                </button>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-900/50 border border-green-800/50 text-sm font-semibold">
                  <span className="w-6 h-6 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{currentUser.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg font-semibold text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - hidden ONLY on Track Round page */}
      {isTrackRoundPage ? null : (
        <nav
          className="md:hidden mobile-navbar text-white z-50 border-t border-green-950/60"
          style={{
            background: '#07150f',
            WebkitTransform: 'translate3d(0, 0, 0)',
            overflow: 'visible',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex justify-around items-end">
            {/* Home */}
            <button
              onClick={() => router.push('/')}
              className={`flex-1 flex flex-col items-center justify-end pb-1 pt-2 gap-0.5 transition ${
                isActive('/') && pathname !== '/course-search' && pathname !== '/manage-courses'
                  ? 'text-green-400'
                  : 'text-white/60 active:text-white'
              }`}
            >
              <img src="/JustTapIt_Logo.png" alt="Home" className="h-8 w-8" />
              <span className="text-[10px] font-medium">Home</span>
            </button>

            {/* Golfers */}
            <button
              onClick={() => router.push('/players')}
              className={`flex-1 flex flex-col items-center justify-end pb-1 pt-2 gap-0.5 transition ${
                pathname === '/players' ? 'text-green-400' : 'text-white/60 active:text-white'
              }`}
            >
              <img src="/list_of_golfers.png" alt="Golfers" className="h-8 w-8 opacity-80" />
              <span className="text-[10px] font-medium">Golfers</span>
            </button>

            {/* Start / Return to Round — elevated circle */}
            <div className="flex-1 flex flex-col items-center justify-end pb-1">
              <button
                onClick={() => {
                  if (currentRoundId) {
                    router.push(`/track-round?id=${currentRoundId}`);
                  } else if (!courseSelectedButNoRound) {
                    router.push('/courses');
                  }
                }}
                disabled={!!courseSelectedButNoRound && !currentRoundId}
                className={`-translate-y-3 w-[62px] h-[62px] rounded-full flex flex-col items-center justify-center shadow-xl transition border-2 ${
                  currentRoundId
                    ? 'bg-red-800 border-red-500 text-white'
                    : courseSelectedButNoRound
                      ? 'bg-[#0d2218] border-green-900 text-white/40 cursor-not-allowed'
                      : 'bg-[#0d2218] border-green-700 text-white active:bg-[#163322]'
                }`}
                style={{ minWidth: 0 }}
              >
                <span className="text-[9px] font-bold leading-tight text-center uppercase tracking-wide px-1">
                  {currentRoundId ? <>Return<br/>Round</> : <>Start<br/>Round</>}
                </span>
              </button>
            </div>

            {/* Courses */}
            <button
              onClick={() => router.push('/courses')}
              className={`flex-1 flex flex-col items-center justify-end pb-1 pt-2 gap-0.5 transition ${
                pathname === '/courses' || pathname === '/manage-courses' || pathname === '/course-search' || pathname === '/add-course'
                  ? 'text-green-400'
                  : 'text-white/60 active:text-white'
              }`}
            >
              <img src="/courses.png" alt="Courses" className="h-8 w-8 opacity-80" />
              <span className="text-[10px] font-medium">Courses</span>
            </button>

            {/* Wallet */}
            <button
              onClick={() => router.push('/wallet')}
              className={`flex-1 flex flex-col items-center justify-end pb-1 pt-2 gap-0.5 transition ${
                pathname === '/wallet' || pathname?.startsWith('/wallet/')
                  ? 'text-green-400'
                  : 'text-white/60 active:text-white'
              }`}
            >
              <span className="text-[26px] leading-none">💳</span>
              <span className="text-[10px] font-medium">Wallet</span>
            </button>
          </div>
        </nav>
      )}

      {/* Mobile hamburger button — fixed top-right, hidden on track-round */}
      {!isTrackRoundPage && currentUser && (
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden fixed right-3 z-40 w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg bg-black/40 backdrop-blur-sm border border-white/10"
          style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
          aria-label="Open menu"
        >
          <span className="block w-5 h-[2px] bg-white rounded-full" />
          <span className="block w-5 h-[2px] bg-white rounded-full" />
          <span className="block w-5 h-[2px] bg-white rounded-full" />
        </button>
      )}

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 drawer-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          {/* Dropdown sheet */}
          <div
            className="md:hidden fixed right-3 z-50 w-64 rounded-2xl overflow-hidden drawer-sheet"
            style={{ top: 'calc(env(safe-area-inset-top) + 60px)', background: '#0d1f16', border: '1px solid rgba(34,197,94,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
          >
            {/* User info */}
            {currentUser && (
              <div className="flex items-center gap-3 px-4 py-4 border-b border-green-950/60">
                <div className="w-10 h-10 rounded-full bg-green-800/60 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm leading-tight truncate">{currentUser.name}</p>
                  <p className="text-green-500 text-xs mt-0.5">Signed in</p>
                </div>
              </div>
            )}

            {/* Menu items */}
            <div className="py-2">
              <button
                onClick={() => { setMenuOpen(false); router.push('/player?id=' + currentUser?.id) }}
                className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-white/5 active:bg-white/10 transition text-left"
              >
                <span className="text-lg">👤</span>
                My Profile
              </button>
              <button
                onClick={() => { setMenuOpen(false); router.push('/settings') }}
                className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-white/5 active:bg-white/10 transition text-left"
              >
                <span className="text-lg">⚙️</span>
                Settings
              </button>
              {eventsEnabled && (
                <button
                  onClick={() => { setMenuOpen(false); router.push('/events') }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-white/5 active:bg-white/10 transition text-left"
                >
                  <span className="text-lg">🏆</span>
                  Events
                </button>
              )}
              <div className="mx-4 border-t border-green-950/60" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 text-sm font-medium hover:bg-red-950/30 active:bg-red-950/50 transition text-left"
              >
                <span className="text-lg">🚪</span>
                Log Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

