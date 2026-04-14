'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Course, Round } from '@/types'
import { useAuth } from '@/lib/useAuth'

function SelectTeeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const courseId = searchParams.get('courseId')
  
  const [course, setCourse] = useState<Course | null>(null)
  const [selectedTee, setSelectedTee] = useState<'men' | 'women' | 'senior' | 'championship' | ''>('')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const auth = useAuth()

  useEffect(() => {
    const user = auth.getCurrentUser()
    setCurrentUser(user)

    if (!courseId) {
      setLoading(false)
      return
    }

    // Load course from localStorage
    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      try {
        const courses = JSON.parse(savedCourses)
        const found = courses.find((c: Course) => c.id === courseId)
        if (found) {
          setCourse(found)
        }
      } catch (error) {
        console.error('Error loading course:', error)
      }
    }
    
    setLoading(false)
  }, [courseId, auth])

  const handleStartRound = () => {
    if (!course || !selectedTee || !currentUser) {
      console.error('Missing data:', { course: !!course, selectedTee, currentUser: !!currentUser })
      alert('Please select a tee box')
      return
    }

    try {
      // Create new round
      const newRound: Round = {
        id: Date.now().toString(),
        userId: currentUser.id,
        userName: currentUser.name,
        courseId: course.id,
        courseName: course.name,
        selectedTee: selectedTee,
        date: new Date().toISOString().split('T')[0],
        scores: new Array(course.holes.length).fill(0),
        totalScore: 0,
        notes: '',
      }

      // Save round to localStorage
      const savedRounds = localStorage.getItem('golfRounds')
      const rounds = savedRounds ? JSON.parse(savedRounds) : []
      rounds.push(newRound)
      localStorage.setItem('golfRounds', JSON.stringify(rounds))

      console.log('🎯 Starting round with tee:', selectedTee, 'Round ID:', newRound.id)
      
      // Navigate to track-round with the new round ID
      router.push(`/track-round?id=${newRound.id}`)
    } catch (error) {
      console.error('Error starting round:', error)
      alert('Error starting round. Please try again.')
    }
  }

  const handleBackToCourses = () => {
    console.log('📍 Going back to manage-courses')
    router.push('/manage-courses')
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500 mb-4">Course not found</p>
          <button onClick={() => router.push('/manage-courses')} className="btn-primary">
            Back to Courses
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="card">
        <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
        <p className="text-gray-600 mb-8">Par {course.par} • {course.holes.length} Holes</p>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-6">Select Your Tee</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['men', 'women', 'senior', 'championship'] as const).map((tee) => {
              const teeLabel = tee.charAt(0).toUpperCase() + tee.slice(1) + "'s"
              const firstHole = course.holes[0]
              const teeBox = firstHole[tee]
              
              return (
                <button
                  key={tee}
                  onClick={() => setSelectedTee(tee)}
                  className={`p-4 rounded-lg transition border-2 ${
                    selectedTee === tee
                      ? 'bg-blue-600 text-white border-blue-700 shadow-lg'
                      : 'bg-white text-gray-800 border-gray-300 hover:bg-blue-50'
                  }`}
                >
                  <div className="font-bold text-lg">{teeLabel}</div>
                  <div className={`text-sm mt-2 ${selectedTee === tee ? 'text-blue-100' : 'text-gray-600'}`}>
                    {teeBox?.yardage || 0} yds
                  </div>
                  {teeBox?.courseRating && (
                    <div className={`text-xs mt-1 ${selectedTee === tee ? 'text-blue-100' : 'text-gray-500'}`}>
                      {teeBox.courseRating.toFixed(1)} rating
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleBackToCourses}
            className="btn-secondary flex-1"
          >
            ← Back to Courses
          </button>
          <button
            onClick={handleStartRound}
            disabled={!selectedTee}
            className={`flex-1 ${selectedTee ? 'btn-primary' : 'bg-gray-300 text-gray-500 cursor-not-allowed rounded-lg py-2'}`}
          >
            Start Round
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SelectTee() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SelectTeeContent />
    </Suspense>
  )
}
