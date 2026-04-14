'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Round, Course } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { deleteRoundFromSupabase } from '@/lib/dataSync'

function EditRoundContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roundId = searchParams.get('id')
  const auth = useAuth()

  const [round, setRound] = useState<Round | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [scores, setScores] = useState<number[]>([])
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (!roundId) return

    // Get current user to check authorization
    const currentUser = auth.getCurrentUser()
    
    const savedRounds = localStorage.getItem('golfRounds')
    if (savedRounds) {
      const rounds = JSON.parse(savedRounds)
      const foundRound = rounds.find((r: Round) => r.id === roundId)
      
      if (foundRound) {
        // Check if user is authorized to edit this round
        // User can edit if they own the round or are an admin
        const isOwner = currentUser && foundRound.userId === currentUser.id
        const isAdmin = currentUser?.is_admin
        
        if (!isOwner && !isAdmin) {
          setAuthorized(false)
          setLoading(false)
          return
        }

        setAuthorized(true)
        setRound(foundRound)
        setScores(foundRound.scores)
        setDate(foundRound.date)
        setNotes(foundRound.notes || '')

        // Load the course for this round
        const savedCourses = localStorage.getItem('golfCourses')
        if (savedCourses) {
          const courses = JSON.parse(savedCourses)
          const foundCourse = courses.find((c: Course) => c.id === foundRound.courseId)
          if (foundCourse) {
            setCourse(foundCourse)
          }
        }
      }
    }
    setLoading(false)
  }, [roundId])

  const handleScoreChange = (holeIndex: number, score: number) => {
    const newScores = [...scores]
    newScores[holeIndex] = Math.max(1, Math.min(13, score)) // Ensure score is between 1-13
    setScores(newScores)
  }

  const getScoreStatus = (score: number, par: number): string => {
    const diff = score - par
    if (diff < -1) return 'Eagle'
    if (diff === -1) return 'Birdie'
    if (diff === 0) return 'Par'
    if (diff === 1) return 'Bogey'
    if (diff === 2) return 'Double'
    return `+${diff}`
  }

  const getScoreColor = (score: number, par: number): string => {
    const diff = score - par
    if (diff <= -1) return 'text-green-600'
    if (diff === 0) return 'text-gray-600'
    if (diff >= 1) return 'text-red-600'
    return 'text-gray-600'
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this round? This action cannot be undone.')) {
      // Delete from localStorage
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const rounds = JSON.parse(savedRounds)
        const updated = rounds.filter((r: Round) => r.id !== roundId)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!round || !course || scores.some(s => s === 0)) {
      alert('Please enter all scores')
      return
    }

    // Update the round
    const updatedRound: Round = {
      ...round,
      date,
      scores,
      totalScore: scores.reduce((a, b) => a + b, 0),
      notes,
    }

    // Update in localStorage
    const savedRounds = localStorage.getItem('golfRounds')
    if (savedRounds) {
      const rounds = JSON.parse(savedRounds)
      const index = rounds.findIndex((r: Round) => r.id === roundId)
      if (index >= 0) {
        rounds[index] = updatedRound
        localStorage.setItem('golfRounds', JSON.stringify(rounds))
      }
    }

    setSubmitted(true)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading round...</p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-red-600 text-lg font-semibold">❌ Access Denied</p>
          <p className="text-gray-600 mt-2">You can only edit your own rounds. Only admins can edit other users' rounds.</p>
          <Link href="/" className="inline-block mt-4">
            <button className="btn-primary">Back to Dashboard</button>
          </Link>
        </div>
      </div>
    )
  }

  if (!round || !course) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Round not found</p>
          <Link href="/" className="inline-block mt-4">
            <button className="btn-primary">Back to Dashboard</button>
          </Link>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <h2 className="text-3xl font-bold mb-4 text-green-600">✅ Round Updated!</h2>
          <p className="text-lg mb-2">
            {course.name} - Score: {scores.reduce((a, b) => a + b, 0)}
          </p>
          <p className="text-gray-600 mb-6">
            vs Par {course.par}: {' '}
            <span className={scores.reduce((a, b) => a + b, 0) - course.par < 0 ? 'text-green-600' : 'text-red-600'}>
              {scores.reduce((a, b) => a + b, 0) - course.par > 0 ? '+' : ''}
              {scores.reduce((a, b) => a + b, 0) - course.par}
            </span>
          </p>
          <Link href="/">
            <button className="btn-primary">Back to Dashboard</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="card mb-6">
        <h2 className="text-2xl font-bold mb-2">{course.name}</h2>
        <p className="text-gray-600 mb-4">Par {course.par}</p>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Windy day, great putting..."
                className="input-field"
              />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold mb-4">Edit Scores by Hole</h3>
            
            {/* Front Nine */}
            {course.holes.length > 0 && (
              <div className="mb-8">
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-4">Front Nine</h4>
                <div className="space-y-3">
                  {course.holes.slice(0, 9).map((hole, index) => {
                    const score = scores[index] || 0
                    const status = score > 0 ? getScoreStatus(score, hole.par) : ''
                    const statusColor = getScoreColor(score, hole.par)
                    
                    return (
                      <div key={hole.holeNumber} className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="bg-gray-200 rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm text-gray-700">
                            {hole.holeNumber}
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Par {hole.par}</span>
                          </div>
                          {score > 0 && (
                            <span className={`text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full`}>
                              {status}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleScoreChange(index, score - 1)}
                            disabled={score <= 1}
                            className="bg-gray-300 hover:bg-gray-400 disabled:opacity-50 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold"
                          >
                            −
                          </button>
                          <div className="w-12 text-center">
                            <span className="text-lg font-bold text-gray-800">{score || '−'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleScoreChange(index, score + 1)}
                            disabled={score >= 13}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Back Nine */}
            {course.holes.length > 9 && (
              <div>
                <h4 className="text-sm font-bold text-gray-600 uppercase mb-4">Back Nine</h4>
                <div className="space-y-3">
                  {course.holes.slice(9, 18).map((hole, index) => {
                    const holeIndex = index + 9
                    const score = scores[holeIndex] || 0
                    const status = score > 0 ? getScoreStatus(score, hole.par) : ''
                    const statusColor = getScoreColor(score, hole.par)
                    
                    return (
                      <div key={hole.holeNumber} className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="bg-gray-200 rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm text-gray-700">
                            {hole.holeNumber}
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-600">Par {hole.par}</span>
                          </div>
                          {score > 0 && (
                            <span className={`text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full`}>
                              {status}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleScoreChange(holeIndex, score - 1)}
                            disabled={score <= 1}
                            className="bg-gray-300 hover:bg-gray-400 disabled:opacity-50 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold"
                          >
                            −
                          </button>
                          <div className="w-12 text-center">
                            <span className="text-lg font-bold text-gray-800">{score || '−'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleScoreChange(holeIndex, score + 1)}
                            disabled={score >= 13}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="font-semibold">Total Score: {scores.reduce((a, b) => a + b, 0)}</p>
            <p className="text-gray-600">vs Par {course.par}: {' '}
              <span className={scores.reduce((a, b) => a + b, 0) - course.par < 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {scores.reduce((a, b) => a + b, 0) - course.par > 0 ? '+' : ''}
                {scores.reduce((a, b) => a + b, 0) - course.par}
              </span>
            </p>
          </div>

          <div className="flex gap-4">
            <button type="submit" className="btn-primary flex-1">
              💾 Save Changes
            </button>
            <button 
              type="button"
              onClick={handleDelete}
              className="btn-primary flex-1"
            >
              🗑️ Delete Round
            </button>
            <button 
              type="button"
              onClick={() => router.push('/')}
              className="btn-primary flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EditRound() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto py-6"><div className="card text-center"><p className="text-gray-500">Loading round...</p></div></div>}>
      <EditRoundContent />
    </Suspense>
  )
}
