'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Round } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { syncDataFromSupabase } from '@/lib/dataSync'
import PageWrapper from '@/components/PageWrapper'

import { useRouter } from 'next/navigation'

export default function Players() {
  const [players, setPlayers] = useState<User[]>([])
  const [playerStats, setPlayerStats] = useState<Record<string, { roundCount: number; handicap: number }>>({})
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ userId: string; userName: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const auth = useAuth()

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        // Sync from Supabase first to get latest rounds
        await syncDataFromSupabase()

        // Get current user
        const user = auth.getCurrentUser()
        setCurrentUser(user)

        // Get all players from Supabase or localStorage
        const allUsers = await auth.getAllUsersAsync()
        console.log('Loaded users:', allUsers)
        setPlayers(allUsers)

        // Calculate stats for each player
        const savedRounds = localStorage.getItem('golfRounds')
        const allRounds: Round[] = savedRounds ? JSON.parse(savedRounds) : []

        const stats: Record<string, { roundCount: number; handicap: number }> = {}
        
        allUsers.forEach(user => {
          const userRounds = allRounds.filter(r => r.userId === user.id)
          const roundCount = userRounds.length

          let handicap = 0
          if (userRounds.length > 0) {
            // Get course data to find course ratings
            const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')
            
            // Calculate handicap differential for each round
            // Formula: (Score - Course Rating) × 113 / Slope Rating
            const differentials = userRounds
              .map(round => {
                const course = courses.find((c: any) => c.id === round.courseId)
                
                if (!course) {
                  return null
                }
                
                const is9Hole = course.holes && course.holes.length === 9
                
                // Use provided courseRating or calculate from holes, default to 72 (or 36 for 9-hole)
                let courseRating = course.courseRating
                let slopeRating = course.slopeRating
                
                if (!courseRating && course.holes) {
                  // Calculate approximate rating from hole par values
                  const totalPar = course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
                  courseRating = totalPar
                }
                
                if (!courseRating) courseRating = is9Hole ? 36 : 72
                if (!slopeRating) slopeRating = 130
                
                if (!slopeRating) {
                  return null
                }
                
                // For 9-hole rounds, convert to 18-hole equivalent
                let adjustedScore = round.totalScore
                let adjustedRating = courseRating
                
                if (is9Hole) {
                  // Double 9-hole scores and ratings to get 18-hole equivalents
                  adjustedScore = round.totalScore * 2
                  adjustedRating = courseRating * 2
                }
                
                return (adjustedScore - adjustedRating) * 113 / slopeRating
              })
              .filter((d: any) => d !== null) as number[]

            // Use best X of last 20 in the calculation based on USGA rules
            if (differentials.length > 0) {
              const recentDifferentials = differentials.slice(-20)
              const sortedDifferentials = recentDifferentials.sort((a, b) => a - b)
              
              // USGA Handicap calculation based on number of scores
              let bestCount = 1
              const numDifferentials = sortedDifferentials.length
              if (numDifferentials >= 6) bestCount = 2
              if (numDifferentials >= 7) bestCount = 3
              if (numDifferentials >= 9) bestCount = 4
              if (numDifferentials >= 11) bestCount = 5
              if (numDifferentials >= 13) bestCount = 6
              if (numDifferentials >= 15) bestCount = 7
              if (numDifferentials >= 17) bestCount = 8
              
              const bestDifferentials = sortedDifferentials.slice(0, bestCount)
              handicap = Math.round(bestDifferentials.reduce((a, b) => a + b, 0) / bestCount * 10) / 10
            }
          }

          stats[user.id] = { roundCount, handicap }
        })

        setPlayerStats(stats)

        if (allUsers.length === 0) {
          console.warn('No users found. Supabase configured:', auth.isSupabaseActive())
        }
      } catch (error) {
        console.error('Error loading players:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlayers()
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
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col pb-24">
      <PageWrapper title="👥 Golfers" userName="View player profiles and statistics">
        <div className="max-w-6xl mx-auto space-y-6">
          {currentUser?.is_admin && (
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
              <p className="text-sm text-blue-700 font-semibold">👨‍💼 Admin privileges enabled</p>
            </div>
          )}

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

          {/* iOS-style Bottom Navigation */}
          <nav className="ios-bottom-nav fixed bottom-0 left-0 right-0 z-50">
            <button onClick={handleViewRounds} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
              <span className="text-xl">🏌️</span>
              <span className="text-xs">Home</span>
            </button>
            <button onClick={handleViewCourses} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
              <span className="text-xl">⛳</span>
              <span className="text-xs">Courses</span>
            </button>
            <button onClick={handleViewGolfers} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
                <span className="text-xl">👥</span>
                <span className="text-xs">Golfers</span>
              </button>
              <button onClick={handleSettings} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
                <span className="text-xl">⚙️</span>
                <span className="text-xs">Settings</span>
              </button>
            </nav>

          {players.length === 0 ? (
            <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
              <p className="text-gray-500 text-lg">No players yet</p>
            </div>
          ) : (
            (() => {
              // Filter and sort players by handicap (lowest first)
              const filteredPlayers = players
                .filter(player => {
                  if (currentUser?.is_admin) return true
                  return !player.is_admin
                })
                .map(player => ({
                  ...player,
                  handicap: playerStats[player.id]?.handicap ?? Infinity
                }))
                .sort((a, b) => {
                  if (a.handicap !== b.handicap) return a.handicap - b.handicap
                  return a.name.localeCompare(b.name)
                })

              const topThree = filteredPlayers.slice(0, 3)
              const rest = filteredPlayers.slice(3)

              return (
                <>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Top 3 Golfers</h3>
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
                                <span className="text-xs text-gray-600">{playerStats[player.id]?.roundCount || 0} Round{playerStats[player.id]?.roundCount !== 1 ? 's' : ''}</span>
                                <span className="text-xs font-semibold text-gray-600">HCP {player.handicap === Infinity ? '—' : player.handicap.toFixed(1)}</span>
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
                                <span className="text-xs text-gray-600">{playerStats[player.id]?.roundCount || 0} Round{playerStats[player.id]?.roundCount !== 1 ? 's' : ''}</span>
                                <span className="text-xs font-semibold text-gray-600">HCP {player.handicap === Infinity ? '—' : player.handicap.toFixed(1)}</span>
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
      </PageWrapper>
    </div>
  );
}
