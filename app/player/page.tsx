'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ScoreHistory from '@/components/ScoreHistory'
import PageWrapper from '@/components/PageWrapper'
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
      <PageWrapper title="Player Profile">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center">
            <p className="text-gray-500">Loading profile...</p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  if (!player) {
    return (
      <PageWrapper title="Player Profile">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center">
            <p className="text-gray-500">Player not found</p>
            <Link href="/">
              <button className="btn-primary mt-4">Back to Home</button>
            </Link>
          </div>
        </div>
      </PageWrapper>
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
        
        if (!course) {
          return null
        }
        
        const is9Hole = course.holes && course.holes.length === 9
        
        // Use provided courseRating or calculate from holes, default to 72 (or 36 for 9-hole)
        let courseRating = course.courseRating
        let slopeRating = course.slopeRating
        
        // If courseRating is set to default 18-hole rating (72) but this is a 9-hole course, adjust it
        if (is9Hole && courseRating === 72) {
          courseRating = 36
        }
        
        if (!courseRating && course.holes) {
          // Calculate approximate rating from hole par values
          const totalPar = course.holes.reduce((sum: number, h: any) => sum + h.par, 0)
          courseRating = totalPar
        }
        
        if (!courseRating) courseRating = is9Hole ? 36 : 72
        if (!slopeRating) slopeRating = 113
        
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
        }
        
        const differential = (adjustedScore - adjustedRating) * 113 / slopeRating
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

  const handleDeleteRound = (roundId: string) => {
    const updated = rounds.filter(r => r.id !== roundId)
    setRounds(updated)
    localStorage.setItem('golfRounds', JSON.stringify(updated))
  }

  return (
    <>
      <PageWrapper title={player.name} userName={isOwnProfile ? 'Your profile' : undefined}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/95 backdrop-blur rounded-3xl p-7 shadow-lg border border-white/20">
              <div className="text-5xl mb-3 text-center">⛳</div>
              <div className="text-3xl font-bold text-center text-gray-800">{handicap}</div>
              <div className="text-xs text-gray-600 text-center font-semibold uppercase tracking-wide">Handicap</div>
            </div>
            <div className="bg-white/95 backdrop-blur rounded-3xl p-7 shadow-lg border border-white/20">
              <div className="text-5xl mb-3 text-center">🏌️</div>
              <div className="text-3xl font-bold text-center text-gray-800">{rounds.length}</div>
              <div className="text-xs text-gray-600 text-center font-semibold uppercase tracking-wide">Rounds</div>
            </div>
          </div>

          {/* Statistics */}
          {rounds.length > 0 && (
            <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg border border-white/20">
              <h2 className="text-lg font-bold mb-3 text-gray-800">Best Rounds</h2>
              
              <div className="space-y-2">
              
              {/* Best 18-Hole Round */}
              {(() => {
                const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')
                const rounds18 = rounds.filter(r => {
                  const course = courses.find((c: any) => c.id === r.courseId)
                  return course && course.holes.length === 18
                })
                
                if (rounds18.length === 0) return null
                
                const best18 = rounds18.reduce((best, current) => 
                  current.totalScore < best.totalScore ? current : best
                )
                
                return (
                  <div className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded-lg text-sm">
                    <span className="text-gray-700 font-medium">18-Hole:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">{best18.courseName}</span>
                      <span className="font-bold text-green-600">{best18.totalScore}</span>
                    </div>
                  </div>
                )
              })()}
              
              {/* Best 9-Hole Round */}
              {(() => {
                const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')
                const rounds9 = rounds.filter(r => {
                  const course = courses.find((c: any) => c.id === r.courseId)
                  return course && course.holes.length === 9
                })
                
                if (rounds9.length === 0) return null
                
                const best9 = rounds9.reduce((best, current) => 
                  current.totalScore < best.totalScore ? current : best
                )
                
                return (
                  <div className="flex justify-between items-center py-2 px-4 bg-gray-50 rounded-lg text-sm">
                    <span className="text-gray-700 font-medium">9-Hole:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">{best9.courseName}</span>
                      <span className="font-bold text-green-600">{best9.totalScore}</span>
                    </div>
                  </div>
                )
              })()}
              </div>
            </div>
          )}

          {/* Recent Rounds */}
          {rounds.length > 0 ? (
            <ScoreHistory rounds={rounds} onDelete={handleDeleteRound} readOnly={!isOwnProfile} userId={player?.id} />
          ) : (
            <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
              <p className="text-gray-500 text-lg">No rounds recorded yet</p>
            </div>
          )}
        </div>
      </PageWrapper>

      {/* Home Button - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 px-4 py-4 z-10">
        <Link href="/">
          <button className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20">
            🏠 Home
          </button>
        </Link>
      </div>
    </>
  )
}

export default function PlayerProfile() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-6"><div className="card text-center"><p className="text-gray-500">Loading profile...</p></div></div>}>
      <PlayerProfileContent />
    </Suspense>
  )
}
