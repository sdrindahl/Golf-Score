'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Course, User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { saveRoundToSupabase } from '@/lib/dataSync'

export default function NewRound() {
  const router = useRouter()
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [scores, setScores] = useState<number[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0)
  const [savedRoundId, setSavedRoundId] = useState<string | null>(null)
  const auth = useAuth()

  useEffect(() => {
    // Get current user
    const user = auth.getCurrentUser()
    setCurrentUser(user)

    // Load selected course from localStorage
    const saved = localStorage.getItem('selectedCourse')
    if (saved) {
      const course = JSON.parse(saved)
      setSelectedCourse(course)
      setScores(new Array(course.holes.length).fill(0))
      localStorage.removeItem('selectedCourse')
    }
  }, [auth])

  const handleScoreChange = (holeIndex: number, score: number) => {
    const newScores = [...scores]
    newScores[holeIndex] = score
    setScores(newScores)
  }

  const handleNextHole = () => {
    if (currentHoleIndex < (selectedCourse?.holes.length || 0) - 1) {
      setCurrentHoleIndex(currentHoleIndex + 1)
    }
  }

  const handlePreviousHole = () => {
    if (currentHoleIndex > 0) {
      setCurrentHoleIndex(currentHoleIndex - 1)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)

    if (!selectedCourse || scores.some(s => s === 0)) {
      alert('Please select a course and enter all scores')
      return
    }

    if (!currentUser) {
      alert('Please log in first')
      return
    }

    // Save the round with user info
    const round = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      date,
      scores,
      totalScore: scores.reduce((a, b) => a + b, 0),
      notes,
    }

    const savedRounds = localStorage.getItem('golfRounds')
    const rounds = savedRounds ? JSON.parse(savedRounds) : []
    rounds.push(round)
    localStorage.setItem('golfRounds', JSON.stringify(rounds))

    // Also save to Supabase
    try {
      await saveRoundToSupabase(round)
      console.log('✅ Round successfully saved to Supabase')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Failed to save round to Supabase:', errorMsg)
      setSaveError(errorMsg)
    }

    setSavedRoundId(round.id)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <h2 className="text-3xl font-bold mb-4 text-green-600">✅ Round Saved!</h2>
          <p className="text-lg mb-2">
            {selectedCourse?.name} - Score: {scores.reduce((a, b) => a + b, 0)}
          </p>
          <p className="text-gray-600 mb-6">
            vs Par {selectedCourse?.par}: {' '}
            <span className={scores.reduce((a, b) => a + b, 0) - (selectedCourse?.par || 72) < 0 ? 'text-green-600' : 'text-red-600'}>
              {scores.reduce((a, b) => a + b, 0) - (selectedCourse?.par || 72) > 0 ? '+' : ''}
              {scores.reduce((a, b) => a + b, 0) - (selectedCourse?.par || 72)}
            </span>
          </p>
          {saveError && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded mb-4">
              <p className="text-sm"><strong>⚠️ Cloud sync warning:</strong> {saveError}</p>
              <p className="text-xs mt-1">The round was saved locally. It may not sync to other devices.</p>
            </div>
          )}
          <button onClick={() => router.push(`/round-detail?id=${savedRoundId}`)} className="btn-primary">
            View Scorecard
          </button>
        </div>
      </div>
    )
  }

  if (!selectedCourse) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Record New Round</h2>
          <p className="text-gray-600 mb-6">
            First, you need to select a course. You can create a new course or select from your existing courses.
          </p>
          <div className="flex gap-4">
            <Link href="/manage-courses" className="flex-1">
              <button className="btn-primary w-full">📋 Select Course</button>
            </Link>
            <Link href="/add-course" className="flex-1">
              <button className="btn-secondary w-full">➕ Add New Course</button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="card mb-6">
        <h2 className="text-2xl font-bold mb-2">{selectedCourse.name}</h2>
        <p className="text-gray-600 mb-4">Par {selectedCourse.par}</p>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-gray-600 mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-2">Notes (Optional)</label>
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
            <h3 className="text-lg font-bold mb-4">Enter Scores by Hole</h3>
            
            {/* Progress indicator */}
            <div className="mb-4 p-3 bg-blue-100 rounded-lg">
              <p className="font-semibold text-blue-900">
                Progress: Hole {currentHoleIndex + 1} of {selectedCourse.holes.length}
                <span className="ml-2 text-sm font-normal">({scores.filter(s => s > 0).length}/{selectedCourse.holes.length} completed)</span>
              </p>
            </div>

            {/* Completed holes overview */}
            {currentHoleIndex > 0 && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <p className="font-semibold text-green-900 mb-3">Completed Holes</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedCourse.holes.slice(0, currentHoleIndex).map((hole, index) => (
                    <div key={hole.holeNumber} className="bg-white border border-green-300 rounded px-3 py-2 text-sm">
                      <span className="font-bold">#{hole.holeNumber}</span>
                      <span className="text-gray-600 mx-2">|</span>
                      <span className="font-bold">{scores[index]}</span>
                      <span className={`text-xs ml-2 ${scores[index] - hole.par < 0 ? 'text-green-600' : scores[index] - hole.par > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {scores[index] - hole.par > 0 ? '+' : ''}{scores[index] - hole.par}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current hole input */}
            <div className="bg-gray-50 p-6 rounded-lg mb-6">
              {selectedCourse.holes[currentHoleIndex] && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <span className="font-bold text-xl">Hole {selectedCourse.holes[currentHoleIndex].holeNumber}</span>
                      <span className="text-gray-600 ml-3 text-lg">Par {selectedCourse.holes[currentHoleIndex].par}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-5xl font-bold text-blue-600">{scores[currentHoleIndex] || '—'}</span>
                      {scores[currentHoleIndex] && (
                        <span className={`text-lg ml-2 ${scores[currentHoleIndex] - selectedCourse.holes[currentHoleIndex].par < 0 ? 'text-green-600' : scores[currentHoleIndex] - selectedCourse.holes[currentHoleIndex].par > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {scores[currentHoleIndex] - selectedCourse.holes[currentHoleIndex].par > 0 ? '+' : ''}{scores[currentHoleIndex] - selectedCourse.holes[currentHoleIndex].par}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleScoreChange(currentHoleIndex, num)}
                        className={`p-3 w-14 h-14 rounded font-bold text-lg transition ${
                          scores[currentHoleIndex] === num
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-blue-50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleScoreChange(currentHoleIndex, (scores[currentHoleIndex] || 0) + 1)}
                      className="p-3 px-4 rounded font-bold text-lg bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 transition"
                    >
                      +
                    </button>
                    {scores[currentHoleIndex] > 0 && (
                      <button
                        type="button"
                        onClick={() => handleScoreChange(currentHoleIndex, Math.max(0, (scores[currentHoleIndex] || 0) - 1))}
                        className="p-3 px-4 rounded font-bold text-lg bg-white border border-gray-300 text-gray-700 hover:bg-red-50 transition"
                      >
                        −
                      </button>
                    )}
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex gap-4">
                    {currentHoleIndex > 0 && (
                      <button
                        type="button"
                        onClick={handlePreviousHole}
                        className="btn-secondary flex-1"
                      >
                        ← Previous Hole
                      </button>
                    )}
                    {scores[currentHoleIndex] > 0 && currentHoleIndex < selectedCourse.holes.length - 1 && (
                      <button
                        type="button"
                        onClick={handleNextHole}
                        className="btn-primary flex-1"
                      >
                        Next Hole →
                      </button>
                    )}
                    {scores[currentHoleIndex] > 0 && currentHoleIndex === selectedCourse.holes.length - 1 && (
                      <button
                        type="submit"
                        className="btn-primary flex-1"
                      >
                        ✓ Finish Round
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="font-semibold">Total Score: {scores.reduce((a, b) => a + b, 0)}</p>
            <p className="text-gray-600">vs Par {selectedCourse.par}: {' '}
              <span className={scores.reduce((a, b) => a + b, 0) - selectedCourse.par < 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {scores.reduce((a, b) => a + b, 0) - selectedCourse.par > 0 ? '+' : ''}
                {scores.reduce((a, b) => a + b, 0) - selectedCourse.par}
              </span>
            </p>
          </div>

          <div className="flex gap-4">
            <Link href="/" className="flex-1">
              <button type="button" className="btn-secondary w-full">
                Cancel
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
