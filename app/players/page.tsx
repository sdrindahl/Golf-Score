'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Round } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { calculateHandicap } from '@/lib/handicapCalculator'

import { useRouter } from 'next/navigation'

export default function Players() {
  const [players, setPlayers] = useState<User[]>([])
  const [playerStats, setPlayerStats] = useState<Record<string, { roundCount: number; handicap: number }>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ userId: string; userName: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllPlayers, setShowAllPlayers] = useState(true)
  const [favoritePlayerIds, setFavoritePlayerIds] = useState<Set<string>>(new Set())
  const [isClient, setIsClient] = useState(false)
  const [courses, setCourses] = useState<any[]>([])
  const auth = useAuth()

  // Initialize client and load favorites from localStorage
  useEffect(() => {
    setIsClient(true)
    const savedFavorites = localStorage.getItem('favoritePlayerIds')
    if (savedFavorites) {
      try {
        const parsed = JSON.parse(savedFavorites)
        setFavoritePlayerIds(new Set(parsed))
      } catch (e) {
        console.error('Error loading favorites:', e)
      }
    }
  }, [])

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('favoritePlayerIds', JSON.stringify(Array.from(favoritePlayerIds)))
    }
  }, [favoritePlayerIds, isClient])

  const toggleFavorite = (playerId: string) => {
    const newFavorites = new Set(favoritePlayerIds)
    if (newFavorites.has(playerId)) {
      newFavorites.delete(playerId)
    } else {
      newFavorites.add(playerId)
    }
    setFavoritePlayerIds(newFavorites)
  }

  const loadPlayers = async () => {
    try {
      // Sync from Supabase first to get latest rounds (via API route)
      await fetch('/api/sync-players', { method: 'POST' })

      // Get current user
      const user = auth.getCurrentUser()
      setCurrentUser(user)

      // Get all players from Supabase or localStorage
      const allUsers = await auth.getAllUsersAsync()
      setPlayers(allUsers)

      // Calculate stats for each player
      // Try to get rounds from localStorage first, then fetch from Supabase if empty
      let allRounds: Round[] = []
      
      // Check localStorage first
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        try {
          const parsed = JSON.parse(savedRounds)
          if (Array.isArray(parsed) && parsed.length > 0) {
            allRounds = parsed
          }
        } catch (e) {
          console.error('[Players] Error parsing localStorage rounds:', e)
        }
      }
      
      // Always enrich rounds with courseIds from join table (for backwards compatibility)
      // and if no rounds found in localStorage
      if (allRounds.length > 0 || true) {
        try {
          // For rounds that don't have courseIds (migrated from old system), fetch from API
          const roundsNeedingCourses = allRounds.filter(r => !r.courseId && !r.course_id)
          
          if (roundsNeedingCourses.length > 0 || allRounds.length === 0) {
            console.log('[Players] Fetching rounds from Supabase to get courseIds...')
            // Fetch all rounds for all users
            const roundPromises = allUsers.map(user => {
              return fetch('/api/get-user-rounds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
              })
                .then(r => {
                  if (!r.ok) return { rounds: [] }
                  return r.json()
                })
                .then(data => data.rounds || [])
                .catch(e => {
                  console.error(`[Players] Error fetching rounds:`, e)
                  return []
                })
            })
            const allRoundsArrays = await Promise.all(roundPromises)
            const supabaseRounds = allRoundsArrays.flat()
            
            if (supabaseRounds.length > 0) {
              console.log('[Players] Got rounds from Supabase:', supabaseRounds.length)
              // Merge: use Supabase rounds (which have courseIds) as the source of truth
              allRounds = supabaseRounds
              // Save to localStorage for future use
              localStorage.setItem('golfRounds', JSON.stringify(allRounds))
            }
          }
        } catch (fetchError) {
          console.error('[Players] Error fetching rounds from Supabase:', fetchError)
        }
      }

      // LOAD COURSES FIRST before calculating stats
      let coursesToUse: any[] = []
      const savedCourses = localStorage.getItem('golfCourses')
      if (savedCourses) {
        try {
          const parsed = JSON.parse(savedCourses)
          if (Array.isArray(parsed) && parsed.length > 0) {
            coursesToUse = parsed
          }
        } catch (e) {
          console.error('[Players] Error parsing courses from localStorage:', e)
        }
      }
      
      // If no courses in localStorage, fetch from API
      if (coursesToUse.length === 0) {
        try {
          console.log('[Players] Fetching courses from API...')
          const res = await fetch('/api/get-courses')
          const data = await res.json()
          if (data && Array.isArray(data.courses) && data.courses.length > 0) {
            coursesToUse = data.courses
            console.log('[Players] Got courses from API:', data.courses.length)
            // Save to localStorage for next time
            localStorage.setItem('golfCourses', JSON.stringify(data.courses))
          }
        } catch (e) {
          console.error('[Players] Error fetching courses from API:', e)
        }
      } else {
        console.log('[Players] Using courses from localStorage:', coursesToUse.length)
      }

      // NOW calculate stats with loaded courses
      const stats: Record<string, { roundCount: number; handicap: number }> = {}
      
      allUsers.forEach(user => {
        // Rounds from Supabase have snake_case field names
        const userRounds = allRounds.filter(r => r.user_id === user.id || r.userId === user.id)
        const roundCount = userRounds.length
        const completedRounds = userRounds.filter(r => !r.in_progress)

        // Use the shared handicap calculation function
        const handicap = completedRounds.length > 0 ? calculateHandicap(completedRounds, coursesToUse) : 0
        console.log(`[Players] ${user.name}: ${roundCount} rounds, handicap=${handicap}, coursesAvailable=${coursesToUse.length}`)

        stats[user.id] = { roundCount, handicap: handicap || 99 }
      })

      // Set both stats and courses in state
      setPlayerStats(stats)
      setCourses(coursesToUse)

      if (allUsers.length === 0) {
        console.warn('No users found. Supabase configured:', auth.isSupabaseActive())
      }
    } catch (error) {
      console.error('Error loading players:', error)
    }
  }

  useEffect(() => {
    const initLoad = async () => {
      setLoading(true)
      await loadPlayers()
      setLoading(false)
    }
    initLoad()

    // Refresh when page comes back into focus
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[Players] Page came back into focus, refreshing data...')
        await loadPlayers()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const handleDeleteUser = async (userId: string) => {
    if (!currentUser) {
      alert('You must be logged in as an admin to delete users')
      return
    }

    setDeleteLoading(true)
    try {
      console.log(`🗑️ Admin deleting user: ${userId}`)
      await auth.deleteUserByAdmin(currentUser.id, userId)
      console.log(`✅ User deleted successfully from Supabase`)
      
      // Remove from local state
      setPlayers(players.filter(p => p.id !== userId))
      setDeleteModal(null)
      alert('User deleted successfully')
      
      // Refresh the players list to ensure sync with Supabase
      console.log('🔄 Refreshing page to sync with Supabase...')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      console.error('❌ Error deleting user:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  const router = useRouter()

  // Navigation handlers for bottom nav
  const handleViewRounds = () => router.push('/')
  const handleViewCourses = () => router.push('/courses')
  const handleViewGolfers = () => router.push('/players')
  const handleSettings = () => router.push('/settings')

  return (
    <div className="min-h-screen flex flex-col pb-32" style={{ background: 'var(--green-bg)' }}>
      {/* Custom Header with Players Icon */}
      <div className="px-6 py-8 text-white flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <img src="/Players.png" alt="Golfers" className="h-10 w-10" />
            <h1 className="text-4xl font-bold tracking-tight">Golfers</h1>
          </div>
          <p className="text-base opacity-80 mt-2">View player profiles and statistics</p>
        </div>
      </div>

      <div className="px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {currentUser?.is_admin && (
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
              <p className="text-sm text-blue-700 font-semibold">👨‍💼 Admin privileges enabled</p>
            </div>
          )}

          {/* Search Input */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-green-600 focus:outline-none bg-white shadow-sm"
            />
          </div>

          {/* View All Players / View Favorites Toggle Buttons */}
          <div className="mb-4 flex justify-center gap-3 flex-wrap">
            <button
              onClick={() => setShowAllPlayers(true)}
              className={`font-semibold py-1 px-4 rounded-full shadow transition-all duration-150 text-sm ${
                showAllPlayers
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-400 hover:bg-gray-500 text-white'
              }`}
            >
              All Players
            </button>
            <button
              onClick={() => setShowAllPlayers(false)}
              disabled={favoritePlayerIds.size === 0}
              className={`font-semibold py-1 px-4 rounded-full shadow transition-all duration-150 text-sm ${
                !showAllPlayers && favoritePlayerIds.size > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : favoritePlayerIds.size === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-400 hover:bg-gray-500 text-white'
              }`}
            >
              ⭐ Favorites ({favoritePlayerIds.size})
            </button>
          </div>

          {deleteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                <h2 className="text-xl font-bold mb-4 text-red-600">⚠️ Delete User</h2>
                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete <strong>{deleteModal.userName}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setDeleteModal(null)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(deleteModal.userId)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete User'}
                  </button>
                </div>
              </div>
            </div>
          )}



          {players.length === 0 ? (
            <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
              <p className="text-gray-500 text-lg">No players yet</p>
            </div>
          ) : (
            (() => {
              // Filter and sort players by handicap (lowest/best first), then alphabetically
              let filteredPlayers = players
                .filter(player => {
                  if (currentUser?.is_admin) return true
                  return !player.is_admin
                })
                .map(player => {
                  const stats = playerStats[player.id] || { roundCount: 0, handicap: 99 }
                  return {
                    ...player,
                    handicap: stats.handicap,
                  }
                })
                .sort((a, b) => {
                  // Sort by handicap (lowest/best first), then by name alphabetically
                  if (a.handicap !== b.handicap) {
                    if (a.handicap < 99 && b.handicap < 99) {
                      return a.handicap - b.handicap
                    }
                    if (a.handicap === 99) return 1
                    if (b.handicap === 99) return -1
                  }
                  return a.name.localeCompare(b.name)
                })

              // Apply search filter
              if (searchQuery.trim()) {
                filteredPlayers = filteredPlayers.filter(player =>
                  player.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
              }

              // Apply favorites filter
              if (!showAllPlayers && favoritePlayerIds.size > 0) {
                filteredPlayers = filteredPlayers.filter(player =>
                  favoritePlayerIds.has(player.id)
                )
              }

              const topThree = filteredPlayers.slice(0, 3)
              const rest = filteredPlayers.slice(3)

              if (filteredPlayers.length === 0) {
                return (
                  <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
                    <p className="text-gray-500 font-semibold">
                      {searchQuery ? `No players found matching "${searchQuery}"` : 'No favorite players yet'}
                    </p>
                  </div>
                )
              }

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Top 3 Golfers</h3>
                    <button
                      onClick={async () => {
                        setRefreshing(true)
                        await loadPlayers()
                        setRefreshing(false)
                      }}
                      disabled={refreshing}
                      className={`font-semibold py-1 px-4 rounded-full shadow transition-all duration-150 text-sm ${
                        refreshing
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Stats'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {topThree.map((player, index) => {
                      let bgGradient = 'from-gray-50 to-gray-100'
                      let borderColor = 'border-white/40'
                      let shadow = ''
                      let medal = null
                      if (index === 0) {
                        bgGradient = 'from-yellow-300 via-yellow-400 to-yellow-500'
                        borderColor = 'border-yellow-400'
                        shadow = 'shadow-[0_0_0_4px_rgba(250,204,21,0.3)]'
                        medal = '🥇'
                      } else if (index === 1) {
                        bgGradient = 'from-gray-300 via-gray-400 to-gray-500'
                        borderColor = 'border-gray-400'
                        shadow = 'shadow-[0_0_0_4px_rgba(156,163,175,0.3)]'
                        medal = '🥈'
                      } else if (index === 2) {
                        bgGradient = 'from-amber-700 via-orange-400 to-yellow-300'
                        borderColor = 'border-amber-700'
                        shadow = 'shadow-[0_0_0_4px_rgba(251,191,36,0.3)]'
                        medal = '🥉'
                      }
                      return (
                        <Link key={player.id} href={`/player?id=${player.id}`}>
                          <div className={`bg-gradient-to-br ${bgGradient} card cursor-pointer transition-all hover:shadow-2xl hover:scale-105 hover:-translate-y-1 flex items-center gap-2 border-2 ${borderColor} ${shadow} py-2 px-3 min-h-0`} style={{minHeight:'0',paddingTop:'0.5rem',paddingBottom:'0.5rem',paddingLeft:'0.75rem',paddingRight:'0.75rem'}}>
                            <div className="text-2xl flex-shrink-0">{medal}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-bold text-gray-800 truncate" style={{maxWidth:'7.5rem'}}>{player.name}</h3>
                                <span className="text-xs font-semibold text-gray-600">HCP {player.handicap >= 99 ? '—' : player.handicap.toFixed(1)}</span>
                              </div>
                              {currentUser?.is_admin && (
                                <button
                                  onClick={e => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setDeleteModal({ userId: player.id, userName: player.name })
                                  }}
                                  className="mt-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-2 py-1 rounded transition-colors"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                            <button
                              onClick={e => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleFavorite(player.id)
                              }}
                              className="flex-shrink-0 text-lg hover:scale-125 transition-transform"
                              title={favoritePlayerIds.has(player.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {favoritePlayerIds.has(player.id) ? '⭐' : '☆'}
                            </button>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">All Golfers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {rest.map((player, index) => {
                      let bgGradient = 'from-gray-50 to-gray-100'
                      let borderColor = 'border-white/40'
                      let shadow = ''
                      if (player.handicap <= 0) {
                        bgGradient = 'from-blue-100 to-blue-200'
                        borderColor = 'border-blue-400'
                      } else if (player.handicap <= 5) {
                        bgGradient = 'from-green-100 to-green-200'
                        borderColor = 'border-green-400'
                      } else if (player.handicap <= 10) {
                        bgGradient = 'from-yellow-100 to-yellow-200'
                        borderColor = 'border-yellow-300'
                      } else if (player.handicap <= 15) {
                        bgGradient = 'from-orange-100 to-orange-200'
                        borderColor = 'border-orange-300'
                      } else {
                        bgGradient = 'from-pink-100 to-pink-200'
                        borderColor = 'border-pink-300'
                      }
                      return (
                        <Link key={player.id} href={`/player?id=${player.id}`}>
                          <div className={`bg-gradient-to-br ${bgGradient} card cursor-pointer transition-all hover:shadow-2xl hover:scale-105 hover:-translate-y-1 flex items-center gap-2 border-2 ${borderColor} ${shadow} py-2 px-3 min-h-0`} style={{minHeight:'0',paddingTop:'0.5rem',paddingBottom:'0.5rem',paddingLeft:'0.75rem',paddingRight:'0.75rem'}}>
                            <div className="text-2xl flex-shrink-0">🏌️</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-bold text-gray-800 truncate" style={{maxWidth:'7.5rem'}}>{player.name}</h3>
                                <span className="text-xs font-semibold text-gray-600">HCP {player.handicap >= 99 ? '—' : player.handicap.toFixed(1)}</span>
                              </div>
                              {currentUser?.is_admin && (
                                <button
                                  onClick={e => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setDeleteModal({ userId: player.id, userName: player.name })
                                  }}
                                  className="mt-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-2 py-1 rounded transition-colors"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                            <button
                              onClick={e => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleFavorite(player.id)
                              }}
                              className="flex-shrink-0 text-lg hover:scale-125 transition-transform"
                              title={favoritePlayerIds.has(player.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {favoritePlayerIds.has(player.id) ? '⭐' : '☆'}
                            </button>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </>
              )
            })()
          )}
        </div>
      </div>
    </div>
  );
}
