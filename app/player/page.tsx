'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ScoreHistory from '@/components/ScoreHistory'
import HandicapDisplay from '@/components/HandicapDisplay'
import { Round, User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { syncDataFromSupabase } from '@/lib/dataSync'

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

    const loadPlayerData = async () => {
      try {
        // Sync from Supabase first to get latest rounds
        console.log('📥 Syncing data from Supabase...')
        await syncDataFromSupabase()
        console.log('✅ Sync complete')
      } catch (error) {
        console.error('Error syncing data:', error)
      }

      // Get current user
      const user = auth.getCurrentUser()
      setCurrentUser(user)

      // Find the player
      const allUsers = auth.getAllUsers()
      const foundPlayer = allUsers.find(u => u.id === playerId)

      if (foundPlayer) {
        setPlayer(foundPlayer)

        // Load player's rounds from synced localStorage
        const savedRounds = localStorage.getItem('golfRounds')
        if (savedRounds) {
          const allRounds = JSON.parse(savedRounds) as Round[]
          const playerRounds = allRounds.filter(r => r.userId === playerId)
          console.log(`📊 Found ${playerRounds.length} rounds for player ${foundPlayer.name}`)
          console.log('Player ID:', playerId)
          setRounds(playerRounds)
        }
      } else {
        setPlayer(null)
      }

      setLoading(false)
    }

    loadPlayerData()
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
    
    let handicap = 0
    
    // Get course data to find course ratings
    const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')
    
    console.log('📊 All courses in storage:', courses)
    console.log('📊 Calculating handicap for', rounds.length, 'rounds')

    // Calculate handicap differential for each round
    // Formula: (Score - Course Rating) × 113 / Slope Rating
    const differentials = rounds
      .map(round => {
        const course = courses.find((c: any) => c.id === round.courseId)
        console.log(`Round ${round.id}: looking for course ${round.courseId}`, course)
        
        if (!course) {
          console.log(`  ❌ Course not found`)
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
          // Note: This is using par as rating, which is not ideal
          console.log(`  ⚠️  Using par (${totalPar}) as course rating (should be ~71-73 for 18 holes, ~35-36 for 9 holes)`)
        }
        
        if (!courseRating) courseRating = is9Hole ? 36 : 72
        if (!slopeRating) slopeRating = 130
        
        console.log(`  Holes: ${is9Hole ? '9-hole' : '18-hole'}, Rating: ${courseRating}, Slope: ${slopeRating}`)
        
        if (!slopeRating) {
          return null
        }
        
        // For 9-hole rounds, we need to convert to 18-hole equivalent
        let adjustedScore = round.totalScore
        let adjustedRating = courseRating
        
        if (is9Hole) {
          // Double 9-hole scores and ratings to get 18-hole equivalents
          adjustedScore = round.totalScore * 2
          adjustedRating = courseRating * 2
          console.log(`  Converting 9-hole to 18-hole equivalent: ${round.totalScore} → ${adjustedScore}, rating ${courseRating} → ${adjustedRating}`)
        }
        
        const differential = (adjustedScore - adjustedRating) * 113 / slopeRating
        console.log(`  Differential: (${adjustedScore} - ${adjustedRating}) * 113 / ${slopeRating} = ${differential.toFixed(2)}`)
        return differential
      })
      .filter((d: any) => d !== null) as number[]

    console.log('📊 Valid differentials:', differentials)

    // Use best X of last 20 in the calculation based on USGA rules
    if (differentials.length > 0) {
      const recentDifferentials = differentials.slice(-20)
      const sortedDifferentials = recentDifferentials.sort((a, b) => a - b)
      
      // USGA Handicap calculation based on number of scores
      let bestCount = 1
      const roundCount = sortedDifferentials.length
      if (roundCount >= 6) bestCount = 2
      if (roundCount >= 7) bestCount = 3
      if (roundCount >= 9) bestCount = 4
      if (roundCount >= 11) bestCount = 5
      if (roundCount >= 13) bestCount = 6
      if (roundCount >= 15) bestCount = 7
      if (roundCount >= 17) bestCount = 8
      
      const bestDifferentials = sortedDifferentials.slice(0, bestCount)
      handicap = Math.round(bestDifferentials.reduce((a, b) => a + b, 0) / bestCount * 10) / 10
      
      console.log(`🎯 Handicap calculation: ${roundCount} differentials, using best ${bestCount}`)
      console.log(`   Best: ${bestDifferentials.map(d => d.toFixed(1)).join(', ')}`)
      console.log(`   Handicap: ${handicap}`)
    } else {
      console.log('❌ No valid differentials calculated')
    }

    return handicap
  }

  const handicap = calculateHandicap()
  const isOwnProfile = currentUser?.id === player.id

  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">👤 {player.name}'s Profile</h1>
            {isOwnProfile && (
              <p className="text-green-600 font-semibold text-sm mt-1">This is your profile</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Rounds</p>
            <p className="text-4xl font-bold">{rounds.length}</p>
          </div>
        </div>
      </div>

      {/* Handicap Display */}
      <div className="mb-6">
        <HandicapDisplay handicap={handicap} totalRounds={rounds.length} />
      </div>

      {/* Statistics */}
      {rounds.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-2xl font-bold mb-4">Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Best Score</p>
              <p className="text-3xl font-bold text-green-600">{Math.min(...rounds.map(r => r.totalScore))}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm">Worst Score</p>
              <p className="text-3xl font-bold text-red-600">{Math.max(...rounds.map(r => r.totalScore))}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm">Average Score</p>
              <p className="text-3xl font-bold text-blue-600">
                {(rounds.reduce((sum, r) => sum + r.totalScore, 0) / rounds.length).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Rounds */}
      {rounds.length > 0 ? (
        <ScoreHistory rounds={rounds} onDelete={() => {}} readOnly={!isOwnProfile} userId={player?.id} />
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-lg">No rounds recorded yet</p>
        </div>
      )}

      {/* Back Button */}
      <Link href="/players">
        <button className="btn-secondary w-full mt-6">← Back to Golfer Profiles</button>
      </Link>
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
