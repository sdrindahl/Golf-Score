'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Round, User } from '@/types'
import { useAuth } from '@/lib/useAuth'

export default function Home() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const router = useRouter()
  const auth = useAuth()

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Only run client-only logic after hydration
  useEffect(() => {
    if (!isClient) return;
    // Get current user
    const user = auth.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentUser(user)

    // Load rounds from localStorage - only for current user
    const savedRounds = localStorage.getItem('golfRounds')
    if (savedRounds) {
      const allRounds = JSON.parse(savedRounds) as Round[]
      const userRounds = allRounds.filter(r => r.userId === user.id)
      setRounds(userRounds)
    }

    // Check if there's a current round in progress
    const inProgressRoundId = localStorage.getItem('currentRoundId')
    if (inProgressRoundId) {
      setCurrentRoundId(inProgressRoundId)
    }
  }, [isClient])

  const calculateHandicap = (): number => {
    if (!isClient || rounds.length === 0) return 0
    
    let handicap = 0
    
    // Get course data to find course ratings
    const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')

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
    }

    return handicap
  }

  const handicap = calculateHandicap()
  
  const calculateBestScore = (): number | null => {
    if (!isClient || rounds.length === 0) return null
    return Math.min(...rounds.map(r => r.totalScore))
  }

  const bestScore = calculateBestScore()

  const calculateScoreDistribution = (): { distribution: { [key: string]: number }; trend: 'improving' | 'declining' | 'stable'; recentBestType: string } => {
    const distribution = {
      'Hole in 1': 0,
      'Eagle': 0,
      'Birdie': 0,
      'Par': 0,
      'Bogey': 0,
      'Double+': 0,
    }

    if (!isClient) {
      return { distribution, trend: 'stable', recentBestType: 'Par' }
    }

    const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')
    
    // Count score types across all holes in all rounds
    for (const round of rounds) {
      const course = courses.find((c: any) => c.id === round.courseId)
      if (!course || !course.holes) continue
      
      for (let i = 0; i < course.holes.length; i++) {
        const hole = course.holes[i]
        const score = round.scores?.[i] || 0
        const par = hole.par
        const diff = score - par

        if (score === 1) {
          distribution['Hole in 1']++
        } else if (diff <= -2) {
          distribution['Eagle']++
        } else if (diff === -1) {
          distribution['Birdie']++
        } else if (diff === 0) {
          distribution['Par']++
        } else if (diff === 1) {
          distribution['Bogey']++
        } else {
          distribution['Double+']++
        }
      }
    }

    // Calculate trend - compare recent holes to overall
    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (rounds.length >= 2) {
      const recentRound = rounds[rounds.length - 1]
      const prevRound = rounds[rounds.length - 2]
      const recentScore = recentRound.totalScore
      const prevScore = prevRound.totalScore
      
      if (recentScore < prevScore - 1) trend = 'improving'
      else if (recentScore > prevScore + 1) trend = 'declining'
    }

    // Find best recent score type
    let recentBestType = 'Par'
    const recentRound = rounds[rounds.length - 1]
    if (recentRound) {
      const course = courses.find((c: any) => c.id === recentRound.courseId)
      if (course?.holes) {
        let bestDiff = 999
        for (let i = 0; i < course.holes.length; i++) {
          const hole = course.holes[i]
          const score = recentRound.scores?.[i] || 0
          const diff = score - hole.par
          if (diff < bestDiff) {
            bestDiff = diff
            if (diff <= -2) recentBestType = 'Eagle'
            else if (diff === -1) recentBestType = 'Birdie'
            else if (diff === 0) recentBestType = 'Par'
          }
        }
      }
    }

    return { distribution, trend, recentBestType }
  }

  const { distribution, trend: scoreTrend, recentBestType } = calculateScoreDistribution()
  const maxDistribution = Math.max(...Object.values(distribution), 1)

  // Don't render until client is hydrated and auth checked
  if (!isClient || !currentUser) {
    return null
  }

  const handleStartNewRound = () => {
    router.push('/courses')
  }

  const handleViewRounds = () => {
    router.push(`/player?id=${currentUser.id}`)
  }

  const handleViewCourses = () => {
    router.push('/courses')
  }

  const handleViewGolfers = () => {
    router.push('/players')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 pb-12">
      {/* Welcome Banner with Account Link */}
      <div className="px-4 sm:px-6 py-6 sm:py-8 text-white relative">
        <div className="absolute top-4 right-4 sm:right-6">
          <Link href="/settings">
            <button className="text-white/80 hover:text-white text-xs sm:text-sm font-medium underline transition-colors">
              Account
            </button>
          </Link>
        </div>
        <p className="text-xs sm:text-sm opacity-80 mb-1 font-medium">Welcome back</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{currentUser?.name || 'Golfer'}</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 space-y-4">
        {/* Stats Cards - 3 columns on all sizes */}
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {/* Rounds Card */}
          <button
            onClick={handleViewRounds}
            className="bg-white/95 backdrop-blur rounded-lg sm:rounded-xl p-2 sm:p-3 shadow-md hover:shadow-lg transition-all cursor-pointer border border-white/20 min-h-20 sm:min-h-24 flex flex-col items-center justify-center"
          >
            <div className="text-2xl sm:text-3xl mb-0.5 sm:mb-1">🏌️</div>
            <div className="text-lg sm:text-xl font-bold text-gray-800">{rounds.length}</div>
            <div className="text-[10px] sm:text-xs text-gray-600 text-center font-semibold uppercase tracking-wide mt-0.5">Rounds</div>
          </button>

          {/* Current Active Rounds Card */}
          <button
            onClick={() => router.push('/rounds-in-progress')}
            className="bg-white/95 backdrop-blur rounded-lg sm:rounded-xl p-2 sm:p-3 shadow-md border border-white/20 min-h-20 sm:min-h-24 flex flex-col items-center justify-center hover:shadow-lg transition-all cursor-pointer"
          >
            <div className="text-2xl sm:text-3xl mb-0.5 sm:mb-1">⏱️</div>
            <div className="text-sm sm:text-base font-bold text-blue-700 leading-tight text-center">
              Current Active<br className="hidden sm:block" />Golfers
            </div>
            <div className="text-[10px] sm:text-xs text-blue-600 text-center font-semibold uppercase tracking-wide mt-0.5">View Live</div>
          </button>

          {/* Handicap Card */}
          <div className="bg-white/95 backdrop-blur rounded-lg sm:rounded-xl p-2 sm:p-3 shadow-md border border-white/20 min-h-20 sm:min-h-24 flex flex-col items-center justify-center">
            <div className="text-2xl sm:text-3xl mb-0.5 sm:mb-1">⛳</div>
            <div className="text-lg sm:text-xl font-bold text-gray-800">
              {handicap > 0 ? handicap : '—'}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-600 text-center font-semibold uppercase tracking-wide mt-0.5">Handicap</div>
          </div>
        </div>

        {/* Score Distribution Chart */}
        {rounds.length > 0 && (
          <div className="bg-white/95 backdrop-blur rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg border border-white/20">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Performance Breakdown</h3>
            {/* Column Headers */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-semibold text-gray-600 uppercase">Type</span>
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-gray-600 uppercase w-8 text-center">Total</span>
                <span className="text-xs font-semibold text-gray-600 uppercase w-12 text-right">Avg/Rnd</span>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(distribution).map(([type, count]) => {
                const percentage = (count / maxDistribution) * 100
                const colors: { [key: string]: string } = {
                  'Hole in 1': 'from-purple-500 to-purple-400',
                  'Eagle': 'from-blue-500 to-blue-400',
                  'Birdie': 'from-green-500 to-green-400',
                  'Par': 'from-yellow-500 to-yellow-400',
                  'Bogey': 'from-orange-500 to-orange-400',
                  'Double+': 'from-red-500 to-red-400',
                }
                const emojis: { [key: string]: string } = {
                  'Hole in 1': '⭐',
                  'Eagle': '🦅',
                  'Birdie': '🐦',
                  'Par': '✔️',
                  'Bogey': '⚠️',
                  'Double+': '❌',
                }
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{emojis[type]}</span>
                        <span className="text-sm font-semibold text-gray-700">{type}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-gray-800 w-8 text-center">{count}</span>
                        <span className="text-xs text-gray-600 w-12 text-right">{(count / rounds.length).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`bg-gradient-to-r ${colors[type]} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Return to Round Button (if round in progress) */}
        {currentRoundId && (
          <button
            onClick={() => router.push(`/track-round?id=${currentRoundId}`)}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-2 sm:py-3 rounded-lg sm:rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all text-sm sm:text-base"
          >
            <span className="text-lg sm:text-xl">🎯</span>
            <span>Return to Round</span>
          </button>
        )}

        {/* Start New Round Button */}
        <button
          onClick={handleStartNewRound}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 sm:py-3 rounded-lg sm:rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all text-sm sm:text-base"
        >
          <span className="text-lg sm:text-xl">+</span>
          <span>Start New Round</span>
        </button>


        {/* View Courses and Golfers */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            onClick={handleViewCourses}
            className="bg-white/90 hover:bg-white text-green-700 font-semibold py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all border border-white/20 flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <span className="text-base sm:text-lg">⛳</span>
            <span>Courses</span>
          </button>

          <button
            onClick={handleViewGolfers}
            className="bg-white/90 hover:bg-white text-green-700 font-semibold py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all border border-white/20 flex items-center justify-center gap-2 text-xs sm:text-sm"
          >
            <span className="text-base sm:text-lg">👥</span>
            <span>Golfers</span>
          </button>
        </div>
      </div>
    </div>
  )
}
