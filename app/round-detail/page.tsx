'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Round, Course } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { deleteRoundFromSupabase } from '@/lib/dataSync'

function RoundDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roundId = searchParams.get('id')
  const auth = useAuth()

  const [round, setRound] = useState<Round | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    if (!roundId) return

    // Get current user for permission checking
    const user = auth.getCurrentUser()
    setCurrentUser(user)

    try {
      // Get round from localStorage
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds) as Round[]
        const foundRound = allRounds.find(r => r.id === roundId)
        if (foundRound) {
          setRound(foundRound)

          // Get course data
          const savedCourses = localStorage.getItem('golfCourses')
          if (savedCourses) {
            const allCourses = JSON.parse(savedCourses) as Course[]
            const foundCourse = allCourses.find(c => c.id === foundRound.courseId)
            if (foundCourse) {
              setCourse(foundCourse)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading round detail:', error)
    } finally {
      setLoading(false)
    }
  }, [roundId, auth])

  // Check if user can edit this round
  const canEditRound = (): boolean => {
    if (!currentUser || !round) return false
    if (currentUser.is_admin) return true
    return currentUser.id === round.userId
  }

  const handleDeleteRound = () => {
    if (confirm('Are you sure you want to delete this round? This action cannot be undone.')) {
      // Delete from localStorage
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds)
        const updated = allRounds.filter((r: Round) => r.id !== roundId)
        localStorage.setItem('golfRounds', JSON.stringify(updated))
      }

      // Delete from Supabase
      deleteRoundFromSupabase(roundId as string).catch(error => {
        console.log('Could not delete from Supabase:', error)
      })

      // Redirect back home
      router.push('/')
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading scorecard...</p>
        </div>
      </div>
    )
  }

  if (!round || !course) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Round not found</p>
          <button onClick={() => router.push('/')} className="btn-primary mt-4">Back to Home</button>
        </div>
      </div>
    )
  }

  // Calculate front 9 and back 9
  const frontNine = round.scores.slice(0, 9)
  const backNine = round.scores.slice(9, 18)
  const frontNinePar = course.holes.slice(0, 9).reduce((sum, hole) => sum + hole.par, 0)
  const backNinePar = course.holes.slice(9, 18).reduce((sum, hole) => sum + hole.par, 0)
  const frontNineTotal = frontNine.reduce((sum, score) => sum + score, 0)
  const backNineTotal = backNine.reduce((sum, score) => sum + score, 0)

  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">{round.courseName}</h1>
            <p className="text-gray-600">{new Date(round.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-sm text-gray-500">Player: {round.userName}</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-blue-600">{round.totalScore}</div>
            <div className="text-lg text-gray-600">Total Score</div>
          </div>
        </div>
        
        {round.notes && (
          <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
            <strong>Notes:</strong> {round.notes}
          </div>
        )}
      </div>

      {/* Front 9 Table */}
      <div className="card mb-6">
        <h2 className="text-2xl font-bold mb-4">Front 9</h2>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-center px-1 md:px-3 py-1 md:py-2">Hole</th>
                {course.holes.slice(0, 9).map((hole) => (
                  <th key={hole.holeNumber} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm font-semibold">
                    {hole.holeNumber}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Par</td>
                {course.holes.slice(0, 9).map((hole) => (
                  <td key={`par-${hole.holeNumber}`} className="text-center font-bold px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                    {hole.par}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Score</td>
                {round.scores.slice(0, 9).map((score, index) => (
                  <td key={`score-${index}`} className="text-center font-bold px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm text-blue-600">
                    {score}
                  </td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">vs Par</td>
                {round.scores.slice(0, 9).map((score, index) => {
                  const holeIndex = index
                  const hole = course.holes[holeIndex]
                  const vsPar = score - hole.par
                  const color = vsPar < 0 ? 'text-green-600' : vsPar > 0 ? 'text-red-600' : 'text-gray-600'
                  return (
                    <td key={`vsPar-${index}`} className={`text-center font-bold px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm ${color}`}>
                      {vsPar > 0 ? '+' : ''}{vsPar}
                    </td>
                  )
                })}
              </tr>
              <tr className="hidden md:table-row border-b">
                <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Yds</td>
                {course.holes.slice(0, 9).map((hole) => (
                  <td key={`yds-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                    {hole.yardage || '—'}
                  </td>
                ))}
              </tr>
              <tr className="hidden md:table-row">
                <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">HCP</td>
                {course.holes.slice(0, 9).map((hole) => (
                  <td key={`hcp-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                    {hole.handicap}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center p-3 bg-gray-100 rounded font-bold text-lg">
          <span>Front 9 Total</span>
          <div className="flex gap-4 items-center">
            <span>Par {frontNinePar}</span>
            <span className="text-blue-600">{frontNineTotal}</span>
            <span className={frontNineTotal < frontNinePar ? 'text-green-600' : 'text-red-600'}>
              {frontNineTotal < frontNinePar ? '-' : '+'}{Math.abs(frontNineTotal - frontNinePar)}
            </span>
          </div>
        </div>
      </div>

      {/* Back 9 Table */}
      {backNine.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-2xl font-bold mb-4">Back 9</h2>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-center px-1 md:px-3 py-1 md:py-2">Hole</th>
                  {course.holes.slice(9, 18).map((hole) => (
                    <th key={hole.holeNumber} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm font-semibold">
                      {hole.holeNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Par</td>
                  {course.holes.slice(9, 18).map((hole) => (
                    <td key={`par-${hole.holeNumber}`} className="text-center font-bold px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                      {hole.par}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Score</td>
                  {round.scores.slice(9, 18).map((score, index) => (
                    <td key={`score-${index + 9}`} className="text-center font-bold px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm text-blue-600">
                      {score}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">vs Par</td>
                  {round.scores.slice(9, 18).map((score, index) => {
                    const holeIndex = index + 9
                    const hole = course.holes[holeIndex]
                    const vsPar = score - hole.par
                    const color = vsPar < 0 ? 'text-green-600' : vsPar > 0 ? 'text-red-600' : 'text-gray-600'
                    return (
                      <td key={`vsPar-${index + 9}`} className={`text-center font-bold px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm ${color}`}>
                        {vsPar > 0 ? '+' : ''}{vsPar}
                      </td>
                    )
                  })}
                </tr>
                <tr className="hidden md:table-row border-b">
                  <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Yds</td>
                  {course.holes.slice(9, 18).map((hole) => (
                    <td key={`yds-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                      {hole.yardage || '—'}
                    </td>
                  ))}
                </tr>
                <tr className="hidden md:table-row">
                  <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">HCP</td>
                  {course.holes.slice(9, 18).map((hole) => (
                    <td key={`hcp-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                      {hole.handicap}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-100 rounded font-bold text-lg">
            <span>Back 9 Total</span>
            <div className="flex gap-4 items-center">
              <span>Par {backNinePar}</span>
              <span className="text-blue-600">{backNineTotal}</span>
              <span className={backNineTotal < backNinePar ? 'text-green-600' : 'text-red-600'}>
                {backNineTotal < backNinePar ? '-' : '+'}{Math.abs(backNineTotal - backNinePar)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="card mb-6">
        <h2 className="text-2xl font-bold mb-4">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-gray-600 text-sm">Total Score</p>
            <p className="text-2xl font-bold text-blue-600">{round.totalScore}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-sm">Total Par</p>
            <p className="text-2xl font-bold">72</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-sm">vs Par</p>
            <p className={`text-2xl font-bold ${round.totalScore < 72 ? 'text-green-600' : 'text-red-600'}`}>
              {round.totalScore < 72 ? '-' : '+'}{Math.abs(round.totalScore - 72)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-sm">Holes</p>
            <p className="text-2xl font-bold">{round.scores.length}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={() => window.location.href = `/player?id=${round.userId}`} className="btn-primary flex-1 min-w-32">
          Exit Scorecard
        </button>
        {canEditRound() && (
          <button onClick={() => window.location.href = `/edit-round?id=${round.id}`} className="btn-secondary flex-1 min-w-32">
            Edit Round
          </button>
        )}
        {canEditRound() && (
          <button onClick={handleDeleteRound} className="btn-danger flex-1 min-w-32">
            Delete Round
          </button>
        )}
      </div>
    </div>
  )
}

export default function RoundDetail() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <RoundDetailContent />
    </Suspense>
  )
}
