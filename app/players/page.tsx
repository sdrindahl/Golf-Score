'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Round } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { syncDataFromSupabase } from '@/lib/dataSync'
import PageWrapper from '@/components/PageWrapper'

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

  return (
    <PageWrapper title="👥 Golfers" userName="View player profiles and statistics">
      <div className="max-w-6xl mx-auto space-y-6">
        {currentUser?.is_admin && (
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
            <p className="text-sm text-blue-700 font-semibold">👨‍💼 Admin privileges enabled</p>
          </div>
        )}

        {loading ? (
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
            <p className="text-gray-500 text-lg">Loading golfers...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
            <p className="text-gray-500 text-lg">No players yet</p>
          </div>
        ) : (
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg border border-white/20">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="border-b-2 border-gray-200">
                  <tr>
                    <th className="text-left p-1 md:p-3 text-xs md:text-sm font-bold text-gray-700">Player</th>
                    <th className="text-center p-1 md:p-3 text-xs md:text-sm font-bold text-gray-700">Rounds</th>
                    <th className="text-center p-1 md:p-3 text-xs md:text-sm hidden sm:table-cell font-bold text-gray-700">Handicap</th>
                    <th className="text-center p-1 md:p-3 text-xs md:text-sm font-bold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {players
                    .filter(player => {
                      // Show all players if current user is admin
                      if (currentUser?.is_admin) return true
                      // Regular users don't see admin users
                      return !player.is_admin
                    })
                    .map(player => (
                    <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-1 md:p-3 text-xs md:text-sm font-semibold text-gray-800">
                        <div>{player.name}</div>
                        <div className="text-gray-500 text-xs hidden md:block">ID: {player.id.slice(0, 8)}...</div>
                      </td>
                      <td className="text-center p-1 md:p-3 text-xs md:text-sm font-bold text-gray-700">
                        {playerStats[player.id]?.roundCount || 0}
                      </td>
                      <td className="text-center p-1 md:p-3 text-xs md:text-sm hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-green-600">{playerStats[player.id]?.handicap.toFixed(1) || '—'}</span>
                          <div className="group relative">
                            <span className="text-gray-400 text-xs cursor-help">ℹ️</span>
                            <div className="hidden group-hover:block absolute right-0 z-10 w-48 bg-gray-800 text-white text-xs rounded p-2 whitespace-wrap">
                              USGA Handicap: (Score - Course Rating) × 113 / Slope Rating
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center p-1 md:p-3 text-xs md:text-sm">
                        <div className="flex flex-col sm:flex-row gap-0.5 md:gap-2 justify-center">
                          <Link href={`/player?id=${player.id}`} className="inline-block">
                            <button className="text-green-600 hover:text-green-800 font-semibold text-xs">
                              View
                            </button>
                          </Link>
                          {currentUser?.is_admin && currentUser.id !== player.id && (
                            <button
                              onClick={() => setDeleteModal({ userId: player.id, userName: player.name })}
                              className="text-red-600 hover:text-red-800 font-semibold text-xs"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Link href="/">
          <button className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20">← Back to Home</button>
        </Link>
      </div>

      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-red-600">⚠️ Delete User</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete <strong>{deleteModal.userName}</strong> and all their golf rounds? This action cannot be undone.
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
    </PageWrapper>
  )
}
