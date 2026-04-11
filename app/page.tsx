'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ScoreHistory from '@/components/ScoreHistory'
import HandicapDisplay from '@/components/HandicapDisplay'
import { Round, User } from '@/types'
import { useAuth } from '@/lib/useAuth'

export default function Home() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const router = useRouter()
  const auth = useAuth()

  useEffect(() => {
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

  const handleDeleteRound = (roundId: string) => {
    const updated = rounds.filter(r => r.id !== roundId)
    setRounds(updated)
    localStorage.setItem('golfRounds', JSON.stringify(updated))
  }

  const handicap = calculateHandicap()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
      <div className="md:col-span-2">
        <div className="card mb-6">
          <h2 className="text-2xl font-bold mb-4 text-center">Golf Score Tracker</h2>
          <div className="hidden md:flex gap-4 flex-wrap">
            <Link href="/add-course">
              <button className="btn-primary">
                ➕ Add Course
              </button>
            </Link>
            <Link href="/manage-courses">
              <button className="btn-secondary">
                📋 Select Course
              </button>
            </Link>
            <Link href="/players">
              <button className="btn-secondary">
                👥 View Golfers
              </button>
            </Link>
          </div>
        </div>

        <ScoreHistory rounds={rounds} onDelete={handleDeleteRound} userId={currentUser?.id} />
      </div>

      <div>
        <HandicapDisplay handicap={handicap} totalRounds={rounds.length} />
        
        <div className="card mt-6">
          <h3 className="text-lg font-bold mb-3">Best Rounds</h3>
          {rounds.length > 0 ? (
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
                  <div className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded text-sm">
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
                  <div className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded text-sm">
                    <span className="text-gray-700 font-medium">9-Hole:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">{best9.courseName}</span>
                      <span className="font-bold text-green-600">{best9.totalScore}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No rounds recorded yet. Start by recording your first round!</p>
          )}
        </div>
      </div>
    </div>
  )
}
