'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Round } from '@/types'
import { useAuth } from '@/lib/useAuth'

export default function Players() {
  const [players, setPlayers] = useState<User[]>([])
  const [playerStats, setPlayerStats] = useState<Record<string, { roundCount: number; handicap: number }>>({})
  const [loading, setLoading] = useState(true)
  const auth = useAuth()

  useEffect(() => {
    const loadPlayers = async () => {
      try {
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
            const recentRounds = userRounds.slice(-8)
            const avgScore = recentRounds.reduce((sum, r) => sum + r.totalScore, 0) / recentRounds.length
            const bestScore = Math.min(...recentRounds.map(r => r.totalScore))
            handicap = Math.round((avgScore - bestScore) * 10) / 10
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

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="card mb-6">
        <h1 className="text-3xl font-bold mb-2">👥 Golfers</h1>
        <p className="text-gray-600">
          Click on any player to view their scorecard and statistics
        </p>
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
          {players.map(player => (
            <Link key={player.id} href={`/player?id=${player.id}`}>
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
          ))}
        </div>
      )}

      <Link href="/">
        <button className="btn-secondary w-full mt-8">← Back to Home</button>
      </Link>
    </div>
  )
}
