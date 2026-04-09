'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ScoreHistory from '@/components/ScoreHistory'
import HandicapDisplay from '@/components/HandicapDisplay'
import { Round, User } from '@/types'
import { useAuth } from '@/lib/useAuth'

function PlayerProfileContent() {
  const searchParams = useSearchParams()
  const playerId = searchParams.get('id')
  const auth = useAuth()

  const [player, setPlayer] = useState<User | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playerId) return

    // Get current user
    const user = auth.getCurrentUser()
    setCurrentUser(user)

    // Find the player
    const allUsers = auth.getAllUsers()
    const foundPlayer = allUsers.find(u => u.id === playerId)

    if (foundPlayer) {
      setPlayer(foundPlayer)

      // Load player's rounds
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds) as Round[]
        const playerRounds = allRounds.filter(r => r.userId === playerId)
        setRounds(playerRounds)
      }
    }

    setLoading(false)
  }, [playerId])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Player not found</p>
          <Link href="/">
            <button className="btn-primary mt-4">Back to Home</button>
          </Link>
        </div>
      </div>
    )
  }

  const calculateHandicap = (): number => {
    if (rounds.length === 0) return 0
    const recentRounds = rounds.slice(-8)
    const avgScore = recentRounds.reduce((sum, r) => sum + r.totalScore, 0) / recentRounds.length
    const bestScore = Math.min(...recentRounds.map(r => r.totalScore))
    return Math.round((avgScore - bestScore) * 10) / 10
  }

  const handicap = calculateHandicap()
  const isOwnProfile = currentUser?.id === player.id

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
      <div className="md:col-span-2">
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">👤 {player.name}'s Profile</h1>
              {isOwnProfile && (
                <p className="text-green-600 font-semibold">This is your profile</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-gray-600">Total Rounds</p>
              <p className="text-4xl font-bold">{rounds.length}</p>
            </div>
          </div>
        </div>

        {rounds.length > 0 ? (
          <ScoreHistory rounds={rounds} onDelete={() => {}} readOnly={!isOwnProfile} />
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-500 text-lg">No rounds recorded yet</p>
          </div>
        )}
      </div>

      <div>
        <HandicapDisplay handicap={handicap} totalRounds={rounds.length} />

        {rounds.length > 0 && (
          <div className="card mt-6">
            <h3 className="text-lg font-bold mb-4">Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Best Score:</span>
                <span className="font-bold">{Math.min(...rounds.map(r => r.totalScore))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Worst Score:</span>
                <span className="font-bold">{Math.max(...rounds.map(r => r.totalScore))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Score:</span>
                <span className="font-bold">
                  {(rounds.reduce((sum, r) => sum + r.totalScore, 0) / rounds.length).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        <Link href="/">
          <button className="btn-secondary w-full mt-6">Back to Home</button>
        </Link>
      </div>
    </div>
  )
}

export default function PlayerProfile() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-6"><div className="card text-center"><p className="text-gray-500">Loading profile...</p></div></div>}>
      <PlayerProfileContent />
    </Suspense>
  )
}
