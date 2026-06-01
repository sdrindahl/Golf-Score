'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { getRoundsInProgress } from '@/lib/roundsInProgress'

export default function NavBar() {
    // Listen for localStorage changes and custom roundStateChanged event to update courseSelectedButNoRound
    useEffect(() => {
      const updateState = () => {
        setCourseSelectedButNoRound(!!localStorage.getItem('courseSelectedButNoRound'));
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
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // State for current round in progress
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const [courseSelectedButNoRound, setCourseSelectedButNoRound] = useState(false)
  const [isLastHole, setIsLastHole] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [currentHole, setCurrentHole] = useState<number>(1)

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

        // Pass user ID to filter rounds by current user only (FIX: prevent cross-user access bug)
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
  const isWalletPage = pathname && pathname.startsWith('/wallet');
  const isTopMicroBarHiddenPage =
    pathname === '/' ||
    pathname?.startsWith('/player') ||
    pathname?.startsWith('/players') ||
    pathname?.startsWith('/courses') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/round-detail');

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
                <button
                  onClick={() => router.push('/wallet')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded font-semibold text-sm transition ${
                    pathname === '/wallet' || pathname?.startsWith('/wallet/')
                      ? 'bg-green-600 text-white'
                      : 'bg-green-700 hover:bg-green-600 text-white'
                  }`}
                >
                  💳 Golf Wallet
                </button>
                <button
                  onClick={() => router.push('/settings')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded font-semibold text-sm transition ${
                    pathname === '/settings' ? 'bg-green-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'
                  }`}
                  title="Settings"
                >
                  ⚙️ Settings
                </button>
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

      {/* Mobile top micro-bar: Settings gear — hidden on Track Round page */}
      {!isTrackRoundPage && !isWalletPage && !isTopMicroBarHiddenPage && currentUser && (
        <div className="md:hidden flex justify-end px-3 py-1 border-b border-black/10" style={{ background: 'var(--green-bg)' }}>
          <button
            onClick={() => router.push('/settings')}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition ${
              pathname === '/settings' ? 'bg-green-600 text-white' : 'text-green-300 hover:text-white'
            }`}
          >
            ⚙️ Settings
          </button>
        </div>
      )}

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
              className={`flex-1 flex flex-col items-center justify-end pb-3 pt-2 gap-0.5 transition ${
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
              className={`flex-1 flex flex-col items-center justify-end pb-3 pt-2 gap-0.5 transition ${
                pathname === '/players' ? 'text-green-400' : 'text-white/60 active:text-white'
              }`}
            >
              <img src="/list_of_golfers.png" alt="Golfers" className="h-8 w-8 opacity-80" />
              <span className="text-[10px] font-medium">Golfers</span>
            </button>

            {/* Start / Return to Round — elevated circle */}
            <div className="flex-1 flex flex-col items-center justify-end pb-2">
              <button
                onClick={() => {
                  if (currentRoundId) {
                    router.push(`/track-round?id=${currentRoundId}`);
                  } else if (!courseSelectedButNoRound) {
                    router.push('/courses');
                  }
                }}
                disabled={!!courseSelectedButNoRound && !currentRoundId}
                className={`-translate-y-4 w-[62px] h-[62px] rounded-full flex flex-col items-center justify-center shadow-xl transition border-2 ${
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
              className={`flex-1 flex flex-col items-center justify-end pb-3 pt-2 gap-0.5 transition ${
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
              className={`flex-1 flex flex-col items-center justify-end pb-3 pt-2 gap-0.5 transition ${
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
    </>
  )
}

