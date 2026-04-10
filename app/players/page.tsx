'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Round } from '@/types'
import { useAuth } from '@/lib/useAuth'

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
                if (!course || !course.courseRating || !course.slopeRating) {
                  return null
                }
                return (round.totalScore - course.courseRating) * 113 / course.slopeRating
              })
              .filter((d: any) => d !== null) as number[]

            // Use best 8 of last 20 in the calculation (if available)
            if (differentials.length > 0) {
              const recentDifferentials = differentials.slice(-20)
              const sortedDifferentials = recentDifferentials.sort((a, b) => a - b)
              const bestCount = Math.min(8, Math.ceil(sortedDifferentials.length / 2))
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
      await auth.deleteUserByAdmin(currentUser.id, userId)
      
      // Remove from local state
      setPlayers(players.filter(p => p.id !== userId))
      setDeleteModal(null)
      alert('User deleted successfully')
      
      // Refresh the players list to ensure sync with Supabase
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="card mb-6">
        <h1 className="text-3xl font-bold mb-2">👥 Golfers</h1>
        <p className="text-gray-600">
          Click on any player to view their scorecard and statistics
        </p>
        {currentUser?.is_admin && (
          <p className="text-sm text-blue-600 mt-2">👨‍💼 Admin privileges enabled</p>
        )}
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-lg">Loading golfers...</p>
        </div>
      ) : players.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-lg">No players yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {players
            .filter(player => {
              // Show all players if current user is admin
              if (currentUser?.is_admin) return true
              // Regular users don't see admin users
              return !player.is_admin
            })
            .map(player => (
            <div key={player.id} className="relative">
              <Link href={`/player?id=${player.id}`}>
                <div className="card hover:shadow-lg cursor-pointer transition transform hover:scale-105">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{player.name}</h3>
                      <p className="text-sm text-gray-500">Player ID: {player.id.slice(0, 8)}...</p>
                    </div>
                    <span className="text-3xl">⛳</span>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rounds:</span>
                      <span className="font-bold text-lg">{playerStats[player.id]?.roundCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Handicap:</span>
                      <span className="font-bold text-lg">
                        {playerStats[player.id]?.handicap.toFixed(1) || '—'}
                      </span>
                    </div>
                  </div>

                  <button className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition">
                    View Profile →
                  </button>
                </div>
              </Link>

              {currentUser?.is_admin && currentUser.id !== player.id && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setDeleteModal({ userId: player.id, userName: player.name })
                  }}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Link href="/">
        <button className="btn-secondary w-full mt-8">← Back to Home</button>
      </Link>

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
    </div>
  )
}
