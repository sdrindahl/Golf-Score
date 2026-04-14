'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Round, Course } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { deleteRoundFromSupabase } from '@/lib/dataSync'
import PageWrapper from '@/components/PageWrapper'

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
      if (roundId) {
        deleteRoundFromSupabase(roundId).catch(error => {
          console.log('Could not delete from Supabase:', error)
        })
      }

      // Redirect back home
      router.push('/')
    }
  }

  if (loading) {
    return (
      <PageWrapper title="Scorecard">
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
          <p className="text-gray-500">Loading scorecard...</p>
        </div>
      </PageWrapper>
    )
  }

  if (!round || !course) {
    return (
      <PageWrapper title="Scorecard">
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
          <p className="text-gray-500">Round not found</p>
          <button onClick={() => router.push('/')} className="btn-primary mt-4">Back to Home</button>
        </div>
      </PageWrapper>
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
    <>
      <PageWrapper title={round.courseName} userName={`${new Date(round.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}>
        <div className="max-w-4xl mx-auto space-y-6 pb-32">
          {/* Header with Score */}
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg border border-white/20">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Player: {round.userName}</p>
                {round.selectedTee && (
                  <p className="text-sm text-blue-600 font-semibold">
                    Tee: {round.selectedTee.charAt(0).toUpperCase() + round.selectedTee.slice(1)}'s
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-6xl font-bold text-blue-600">{round.totalScore}</div>
                <div className="text-lg text-gray-600">Total Score</div>
              </div>
            </div>
            
            {round.notes && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700 border border-blue-200">
                <strong>Notes:</strong> {round.notes}
              </div>
            )}
          </div>

          {/* Front 9 Table */}
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg border border-white/20">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Front 9</h2>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs md:text-sm">
                <thead className="border-b-2 border-gray-200">
                  <tr>
                    <th className="text-center px-1 md:px-3 py-2 font-bold text-gray-700">Hole</th>
                    {course.holes.slice(0, 9).map((hole) => (
                      <th key={hole.holeNumber} className="text-center px-0.5 md:px-2 py-2 text-xs md:text-sm font-bold text-gray-700">
                        {hole.holeNumber}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">Par</td>
                    {course.holes.slice(0, 9).map((hole) => (
                      <td key={`par-${hole.holeNumber}`} className="text-center font-bold px-0.5 md:px-2 py-2 text-xs md:text-sm text-gray-700">
                        {hole.par}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">Score</td>
                    {round.scores.slice(0, 9).map((score, index) => (
                      <td key={`score-${index}`} className="text-center font-bold px-0.5 md:px-2 py-2 text-xs md:text-sm text-blue-600">
                        {score}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">vs Par</td>
                    {round.scores.slice(0, 9).map((score, index) => {
                      const holeIndex = index
                      const hole = course.holes[holeIndex]
                      const vsPar = score - hole.par
                      const color = vsPar < 0 ? 'text-green-600' : vsPar > 0 ? 'text-red-600' : 'text-gray-600'
                      return (
                        <td key={`vsPar-${index}`} className={`text-center font-bold px-0.5 md:px-2 py-2 text-xs md:text-sm ${color}`}>
                          {vsPar > 0 ? '+' : ''}{vsPar}
                        </td>
                      )
                    })}
                  </tr>
                  <tr className="hidden md:table-row border-b border-gray-100">
                    <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">Yds</td>
                    {course.holes.slice(0, 9).map((hole) => {
                      let yardage = '—'
                      if (round.selectedTee && hole[round.selectedTee]) {
                        yardage = hole[round.selectedTee].yardage.toString()
                      }
                      return (
                        <td key={`yds-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-2 text-xs md:text-sm text-gray-600">
                          {yardage}
                        </td>
                      )
                    })}
                  </tr>
                  <tr className="hidden md:table-row">
                    <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">HCP</td>
                    {course.holes.slice(0, 9).map((hole) => (
                      <td key={`hcp-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-2 text-xs md:text-sm text-gray-600">
                        {hole.handicap}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center p-4 rounded-lg font-bold text-lg bg-gray-100">
              <span className="text-gray-800">Front 9 Total</span>
              <div className="flex gap-4 items-center">
                <span className="text-gray-700">Par {frontNinePar}</span>
                <span className="text-blue-600">{frontNineTotal}</span>
                <span className={frontNineTotal < frontNinePar ? 'text-green-600' : 'text-red-600'}>
                  {frontNineTotal < frontNinePar ? '-' : '+'}{Math.abs(frontNineTotal - frontNinePar)}
                </span>
              </div>
            </div>
          </div>

          {/* Back 9 Table */}
          {backNine.length > 0 && (
            <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg border border-white/20">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Back 9</h2>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs md:text-sm">
                  <thead className="border-b-2 border-gray-200">
                    <tr>
                      <th className="text-center px-1 md:px-3 py-2 font-bold text-gray-700">Hole</th>
                      {course.holes.slice(9, 18).map((hole) => (
                        <th key={hole.holeNumber} className="text-center px-0.5 md:px-2 py-2 text-xs md:text-sm font-bold text-gray-700">
                          {hole.holeNumber}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">Par</td>
                      {course.holes.slice(9, 18).map((hole) => (
                        <td key={`par-${hole.holeNumber}`} className="text-center font-bold px-0.5 md:px-2 py-2 text-xs md:text-sm text-gray-700">
                          {hole.par}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">Score</td>
                      {round.scores.slice(9, 18).map((score, index) => (
                        <td key={`score-${index + 9}`} className="text-center font-bold px-0.5 md:px-2 py-2 text-xs md:text-sm text-blue-600">
                          {score}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">vs Par</td>
                      {round.scores.slice(9, 18).map((score, index) => {
                        const holeIndex = index + 9
                        const hole = course.holes[holeIndex]
                        const vsPar = score - hole.par
                        const color = vsPar < 0 ? 'text-green-600' : vsPar > 0 ? 'text-red-600' : 'text-gray-600'
                        return (
                          <td key={`vsPar-${index + 9}`} className={`text-center font-bold px-0.5 md:px-2 py-2 text-xs md:text-sm ${color}`}>
                            {vsPar > 0 ? '+' : ''}{vsPar}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="hidden md:table-row border-b border-gray-100">
                      <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">Yds</td>
                      {course.holes.slice(9, 18).map((hole) => {
                        let yardage = '—'
                        if (round.selectedTee && hole[round.selectedTee]) {
                          yardage = hole[round.selectedTee].yardage.toString()
                        }
                        return (
                          <td key={`yds-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-2 text-xs md:text-sm text-gray-600">
                            {yardage}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="hidden md:table-row">
                      <td className="font-bold px-1 md:px-3 py-2 text-center text-xs text-gray-700">HCP</td>
                      {course.holes.slice(9, 18).map((hole) => (
                        <td key={`hcp-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-2 text-xs md:text-sm text-gray-600">
                          {hole.handicap}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center p-4 rounded-lg font-bold text-lg bg-gray-100">
                <span className="text-gray-800">Back 9 Total</span>
                <div className="flex gap-4 items-center">
                  <span className="text-gray-700">Par {backNinePar}</span>
                  <span className="text-blue-600">{backNineTotal}</span>
                  <span className={backNineTotal < backNinePar ? 'text-green-600' : 'text-red-600'}>
                    {backNineTotal < backNinePar ? '-' : '+'}{Math.abs(backNineTotal - backNinePar)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg border border-white/20">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">Total Score</p>
                <p className="text-3xl font-bold text-blue-600">{round.totalScore}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">Total Par</p>
                <p className="text-3xl font-bold text-gray-800">72</p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">vs Par</p>
                <p className={`text-3xl font-bold ${round.totalScore < 72 ? 'text-green-600' : 'text-red-600'}`}>
                  {round.totalScore < 72 ? '-' : '+'}{Math.abs(round.totalScore - 72)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">Holes</p>
                <p className="text-3xl font-bold text-gray-800">{round.scores.length}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => window.location.href = `/player?id=${round.userId}`} className="flex-1 min-w-32 bg-white/90 hover:bg-white text-green-700 font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all border border-white/20">
              View Profile
            </button>
            {canEditRound() && (
              <button onClick={() => window.location.href = `/edit-round?id=${round.id}`} className="flex-1 min-w-32 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                Edit Round
              </button>
            )}
            {canEditRound() && (
              <button onClick={handleDeleteRound} className="flex-1 min-w-32 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                Delete Round
              </button>
            )}
          </div>
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
