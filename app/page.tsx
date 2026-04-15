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
  const router = useRouter()
  const auth = useAuth()

  useEffect(() => {
    setIsClient(true)
    
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
  }, [])

  const calculateHandicap = (): number => {
    if (rounds.length === 0) return 0
    
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
    if (rounds.length === 0) return null
    return Math.min(...rounds.map(r => r.totalScore))
  }

  const bestScore = calculateBestScore()

  // Don't render until client is hydrated and auth checked
  if (!isClient || !currentUser) {
    return null
  }

  const handleStartNewRound = () => {
    router.push('/manage-courses')
  }

  const handleViewRounds = () => {
    router.push(`/player?id=${currentUser.id}`)
  }

  const handleViewCourses = () => {
    router.push('/manage-courses')
  }

  const handleViewGolfers = () => {
    router.push('/players')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 pb-12">
      {/* Welcome Banner with Account Link */}
      <div className="px-6 py-10 text-white relative">
        <div className="absolute top-6 right-6">
          <Link href="/settings">
            <button className="text-white/80 hover:text-white text-sm font-medium underline transition-colors">
              Account
            </button>
          </Link>
        </div>
        <p className="text-base opacity-80 mb-1 font-medium">Welcome back</p>
        <h1 className="text-5xl font-bold tracking-tight">{currentUser?.name || 'Golfer'}</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Rounds Card */}
          <button
            onClick={handleViewRounds}
            className="bg-white/95 backdrop-blur rounded-3xl p-7 shadow-lg hover:shadow-xl hover:scale-105 transition-all cursor-pointer border border-white/20"
          >
            <div className="text-5xl mb-3 text-center">🏌️</div>
            <div className="text-3xl font-bold text-center text-gray-800">{rounds.length}</div>
            <div className="text-xs text-gray-600 text-center font-semibold uppercase tracking-wide">Rounds</div>
          </button>

          {/* Best Score Card */}
          <div className="bg-white/95 backdrop-blur rounded-3xl p-7 shadow-lg border border-white/20">
            <div className="text-5xl mb-3 text-center">🏆</div>
            <div className="text-3xl font-bold text-center text-gray-800">
              {bestScore ? bestScore : '—'}
            </div>
            <div className="text-xs text-gray-600 text-center font-semibold uppercase tracking-wide">Best</div>
          </div>

          {/* Handicap Card */}
          <div className="bg-white/95 backdrop-blur rounded-3xl p-7 shadow-lg border border-white/20">
            <div className="text-5xl mb-3 text-center">⛳</div>
            <div className="text-3xl font-bold text-center text-gray-800">
              {handicap > 0 ? handicap : '—'}
            </div>
            <div className="text-xs text-gray-600 text-center font-semibold uppercase tracking-wide">Handicap</div>
          </div>
        </div>

        {/* Start New Round Button */}
        <button
          onClick={handleStartNewRound}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1"
        >
          <span className="text-2xl">+</span>
          <span className="text-lg">Start New Round</span>
        </button>

        {/* View Courses and Golfers */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleViewCourses}
            className="bg-white/90 hover:bg-white text-green-700 font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20 flex items-center justify-center gap-2"
          >
            <span className="text-xl">🏌️‍♂️</span>
            <span>View Courses</span>
          </button>

          <button
            onClick={handleViewGolfers}
            className="bg-white/90 hover:bg-white text-green-700 font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20 flex items-center justify-center gap-2"
          >
            <span className="text-xl">👥</span>
            <span>View Golfers</span>
          </button>
        </div>
      </div>
    </div>
  )
}
