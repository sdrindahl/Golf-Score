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
    newScores[holeIndex] = score
    setScores(newScores)
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
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {course.holes.map((hole, index) => (
                <div key={hole.holeNumber} className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600 mb-2">
                    Hole {hole.holeNumber} (Par {hole.par})
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="13"
                    value={scores[index] || ''}
                    onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 0)}
                    placeholder="Score"
                    className="w-full p-2 border border-gray-300 rounded text-center font-bold"
                  />
                </div>
              ))}
            </div>
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
              className="btn-danger flex-1"
            >
              🗑️ Delete Round
            </button>
            <button 
              type="button"
              onClick={() => router.push('/')}
              className="btn-secondary flex-1"
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
