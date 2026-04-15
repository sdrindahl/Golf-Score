'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Round, Course } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { deleteRoundFromSupabase } from '@/lib/dataSync'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import PageWrapper from '@/components/PageWrapper'

function RoundDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roundId = searchParams.get('id')
  const isJustCompleted = searchParams.get('completed') === 'true'
  const auth = useAuth()

  const [round, setRound] = useState<Round | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [editingHoleIndex, setEditingHoleIndex] = useState<number | null>(null)
  const [editScore, setEditScore] = useState<number | string>('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

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
  }, [roundId])

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

      // Redirect back to player profile
      if (round?.userId) {
        router.push(`/player?id=${round.userId}`)
      } else {
        router.push('/')
      }
    }
  }

  const handleHoleEdit = (holeIndex: number) => {
    if (!canEditRound()) return
    setEditingHoleIndex(holeIndex)
    setEditScore(round?.scores[holeIndex] || '')
  }

  const handleConfirmHoleScore = () => {
    if (editingHoleIndex === null || !round || !course) return
    
    const newScore = parseInt(String(editScore))
    if (isNaN(newScore) || newScore < 1) {
      alert('Please enter a valid score')
      return
    }

    // Create updated scores array with the new score for the edited hole
    const updatedScores = round.scores.map((score, idx) => idx === editingHoleIndex ? newScore : score)
    
    // Calculate total from the new scores array - sum all scores
    const totalScore = updatedScores.reduce((sum, score) => {
      const numScore = Number(score) || 0
      return sum + numScore
    }, 0)

    // Update the round locally
    const updatedRound = {
      ...round,
      scores: updatedScores,
      totalScore,
    }

    setRound(updatedRound)
    setHasUnsavedChanges(true)
    setEditingHoleIndex(null)
    setEditScore('')
  }

  const handleSaveAllChanges = () => {
    if (!round) return

    // Save to localStorage
    const savedRounds = localStorage.getItem('golfRounds')
    if (savedRounds) {
      const allRounds = JSON.parse(savedRounds) as Round[]
      const updated = allRounds.map(r => r.id === roundId ? round : r)
      localStorage.setItem('golfRounds', JSON.stringify(updated))
    }

    // Save to Supabase
    if (isSupabaseConfigured() && supabase) {
      supabase
        .from('rounds')
        .update(round)
        .eq('id', roundId)
        .then(({ error }) => {
          if (error) {
            console.log('Could not update in Supabase:', error)
            alert('Error saving changes to Supabase')
          } else {
            setHasUnsavedChanges(false)
            // Redirect to player profile
            window.location.href = `/player?id=${round.userId}`
          }
        })
    } else {
      // If Supabase is not configured, redirect immediately
      setHasUnsavedChanges(false)
      window.location.href = `/player?id=${round.userId}`
    }
  }

  const handleDiscardChanges = () => {
    if (!roundId) return
    // Reload the round from localStorage
    try {
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds) as Round[]
        const foundRound = allRounds.find(r => r.id === roundId)
        if (foundRound) {
          setRound(foundRound)
        }
      }
    } catch (error) {
      console.error('Error reloading round:', error)
    }
    setHasUnsavedChanges(false)
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

  // Calculate round totals
  const roundData = {
    parTotal: course.holes.reduce((sum, hole) => sum + hole.par, 0),
    scoreTotal: round.scores.reduce((sum, score) => sum + score, 0),
  }

  // Helper function to get score type label
  const getScoreType = (score: number, par: number): string => {
    const diff = score - par
    if (score === 1) return 'Ace'
    if (diff === -3) return 'Alb'
    if (diff === -2) return 'Eagle'
    if (diff === -1) return 'Birdie'
    if (diff === 0) return 'Par'
    if (diff === 1) return 'Bogey'
    if (diff === 2) return 'D.Bogey'
    return 'Triple+'
  }

  // Helper function to get color for score type
  const getScoreColor = (score: number, par: number): string => {
    const diff = score - par
    if (score === 1) return 'from-purple-500 to-purple-700'
    if (diff === -3) return 'from-indigo-500 to-indigo-700'
    if (diff === -2) return 'from-blue-500 to-blue-700'
    if (diff === -1) return 'from-green-500 to-green-700'
    if (diff === 0) return 'from-gray-400 to-gray-600'
    if (diff === 1) return 'from-orange-500 to-orange-700'
    if (diff === 2) return 'from-red-500 to-red-700'
    return 'from-red-700 to-red-900'
  }

  // Calculate score distribution for this round
  const calculateScoreDistribution = () => {
    const distribution = {
      'Hole in 1': 0,
      'Alb': 0,
      'Eagle': 0,
      'Birdie': 0,
      'Par': 0,
      'Bogey': 0,
      'Double+': 0,
    }

    // Count score types across all holes in this round
    for (let i = 0; i < round.scores.length; i++) {
      const score = round.scores[i]
      const hole = course.holes[i]
      const diff = score - hole.par

      if (score === 1) {
        distribution['Hole in 1']++
      } else if (diff === -3) {
        distribution['Alb']++
      } else if (diff === -2) {
        distribution['Eagle']++
      } else if (diff === -1) {
        distribution['Birdie']++
      } else if (diff === 0) {
        distribution['Par']++
      } else if (diff === 1) {
        distribution['Bogey']++
      } else if (diff >= 2) {
        distribution['Double+']++
      }
    }

    return distribution
  }

  const scoreDistribution = calculateScoreDistribution()
  const maxDistribution = Math.max(...Object.values(scoreDistribution), 1)

  return (
    <>
      <PageWrapper title={round.courseName} userName={`${new Date(round.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}>
        <div className="max-w-4xl mx-auto space-y-6 pb-32">
          {/* Header with Score */}
          <div className="bg-white/95 backdrop-blur rounded-2xl p-4 shadow-lg border border-white/20">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-600 mb-1">Player: {round.userName}</p>
                {round.selectedTee && (
                  <p className="text-xs text-blue-600 font-semibold">
                    Tee: {round.selectedTee.charAt(0).toUpperCase() + round.selectedTee.slice(1)}'s
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-blue-600">{round.scores.reduce((sum, score) => sum + (Number(score) || 0), 0)}</div>
                <div className="text-sm text-gray-600">Total Score</div>
              </div>
            </div>
            
            {round.notes && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700 border border-blue-200">
                <strong>Notes:</strong> {round.notes}
              </div>
            )}
          </div>

          {/* All Holes Grid */}
          <div className="bg-white/95 backdrop-blur rounded-2xl p-4 shadow-lg border border-white/20">
            <h2 className="text-lg font-bold mb-3 text-gray-800">Holes Completed</h2>
            <div className="grid grid-cols-6 gap-2">
              {course.holes.map((hole, index) => {
                const score = round.scores[index]
                const isCompleted = score > 0
                
                return (
                  <div
                    key={hole.holeNumber}
                    onClick={() => handleHoleEdit(index)}
                    className={`aspect-square rounded text-xs font-semibold flex flex-col items-center justify-center transition-all relative cursor-pointer hover:opacity-80 ${
                      isCompleted
                        ? `bg-gradient-to-br ${getScoreColor(score, hole.par)} text-white`
                        : 'bg-gray-100 border border-gray-300 text-gray-700'
                    }`}
                    title={isCompleted ? `Hole ${hole.holeNumber}: Score ${score} (${getScoreType(score, hole.par)}) - Click to edit` : `Hole ${hole.holeNumber} - Click to edit`}
                  >
                    {isCompleted ? (
                      <>
                        <span className="text-[9px] absolute top-0.5 left-0.5 font-bold">H{hole.holeNumber}</span>
                        <span className="text-lg font-bold">{score}</span>
                        <span className="text-[9px] absolute bottom-0.5 leading-tight">{getScoreType(score, hole.par)}</span>
                      </>
                    ) : (
                      <span className="font-bold text-xs">{hole.holeNumber}</span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg font-semibold text-sm bg-gray-100 mt-3">
              <span className="text-gray-800">Total</span>
              <div className="flex gap-3 items-center text-xs md:text-sm">
                <span className="text-gray-700">Par {roundData.parTotal}</span>
                <span className="text-blue-600">{roundData.scoreTotal}</span>
                <span className={roundData.scoreTotal < roundData.parTotal ? 'text-green-600' : 'text-red-600'}>
                  {roundData.scoreTotal < roundData.parTotal ? '-' : '+'}{Math.abs(roundData.scoreTotal - roundData.parTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Performance Breakdown */}
          <div className="bg-white/95 backdrop-blur rounded-2xl p-4 shadow-lg border border-white/20">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Performance Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(scoreDistribution).map(([type, count]) => {
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
                return count > 0 ? (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{emojis[type]}</span>
                        <span className="text-sm font-semibold text-gray-700">{type}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-800">{count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`bg-gradient-to-r ${colors[type]} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                ) : null
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => window.location.href = `/player?id=${round.userId}`} className={`flex-1 min-w-32 font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all ${
              isJustCompleted
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-white/90 hover:bg-white text-green-700 border border-white/20'
            }`}>
              {isJustCompleted ? 'Complete Round' : '← Back'}
            </button>
            {hasUnsavedChanges && canEditRound() && (
              <>
                <button onClick={handleDiscardChanges} className="flex-1 min-w-32 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  Discard Changes
                </button>
                <button onClick={handleSaveAllChanges} className="flex-1 min-w-32 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  Save Changes
                </button>
              </>
            )}
            {canEditRound() && !hasUnsavedChanges && (
              <button onClick={handleDeleteRound} className="flex-1 min-w-32 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                Delete Round
              </button>
            )}
          </div>
        </div>
      </PageWrapper>

      {/* Edit Hole Modal */}
      {editingHoleIndex !== null && course && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Hole {course.holes[editingHoleIndex].holeNumber}</h2>
            <p className="text-sm text-gray-600 mb-6 text-center">Par: {course.holes[editingHoleIndex].par}</p>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => {
                  const current = parseInt(String(editScore)) || round.scores[editingHoleIndex] || 0
                  setEditScore(Math.max(1, current - 1))
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl text-3xl transition-all"
              >
                −
              </button>
              <div className="text-5xl font-bold text-blue-600 w-24 text-center">
                {editScore || 0}
              </div>
              <button
                onClick={() => {
                  const current = parseInt(String(editScore)) || round.scores[editingHoleIndex] || 0
                  setEditScore(current + 1)
                }}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl text-3xl transition-all"
              >
                +
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingHoleIndex(null)
                  setEditScore('')
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmHoleScore}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

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
