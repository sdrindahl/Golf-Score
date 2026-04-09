'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Course, User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { saveRoundToSupabase } from '@/lib/dataSync'

export default function NewRound() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [scores, setScores] = useState<number[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
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
      setScores(new Array(course.holeCount).fill(0))
      localStorage.removeItem('selectedCourse')
    }
  }, [auth])

  const handleScoreChange = (holeIndex: number, score: number) => {
    const newScores = [...scores]
    newScores[holeIndex] = score
    setScores(newScores)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
    await saveRoundToSupabase(round)

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
          <Link href="/">
            <button className="btn-primary">Back to Dashboard</button>
          </Link>
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
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2 md:gap-3">
              {selectedCourse.holes.map((hole, index) => (
                <div key={hole.holeNumber} className="bg-gray-50 p-2 md:p-3 rounded-lg">
                  <div className="text-xs md:text-sm text-gray-600 mb-1">
                    H{hole.holeNumber}
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="13"
                    value={scores[index] || ''}
                    onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2 border border-gray-300 rounded text-center font-bold text-sm"
                  />
                </div>
              ))}
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
            <button type="submit" className="btn-primary flex-1">
              Save Round
            </button>
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
