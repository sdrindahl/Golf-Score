'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Course, User, Round } from '@/types'
import { useAuth } from '@/lib/useAuth'

export default function NewRound() {
  const router = useRouter()
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedTee, setSelectedTee] = useState<'men' | 'women' | 'senior' | 'championship' | ''>('')
  const [scores, setScores] = useState<number[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0)
  const [savedRoundId, setSavedRoundId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const auth = useAuth()

  useEffect(() => {
    // Get current user
    const user = auth.getCurrentUser()
    setCurrentUser(user)

    // Load selected course from localStorage
    const saved = localStorage.getItem('selectedCourse')
    console.log('🔍 NewRound - checking localStorage for selectedCourse:', saved ? 'Found' : 'Not found')
    
    if (saved) {
      try {
        const course = JSON.parse(saved)
        console.log('✅ NewRound - Course loaded:', {
          name: course.name,
          id: course.id,
          holesLength: course.holes?.length,
          holeCountProperty: course.holeCount,
          hasHolesArray: Array.isArray(course.holes),
          hasTeeTags: course.holes?.[0] && 'men' in course.holes[0],
          firstHole: course.holes?.[0],
          courseKeys: Object.keys(course)
        })
        
        if (!course.holes || !Array.isArray(course.holes) || course.holes.length === 0) {
          console.error('❌ NewRound - Course missing holes array or empty:', course)
          alert('Error: Course data is incomplete. Please select a course again.')
          setIsLoading(false)
          return
        }
        
        setSelectedCourse(course)
        setScores(new Array(course.holes.length).fill(0))
        localStorage.removeItem('selectedCourse')
      } catch (error) {
        console.error('❌ NewRound - Failed to parse course from localStorage:', error)
        alert('Error loading course. Please try selecting it again.')
      }
    } else {
      console.log('⚠️ NewRound - No selectedCourse in localStorage. Show course selection screen.')
    }
    
    setIsLoading(false)
  }, [])

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

    if (!selectedCourse || !selectedTee || scores.some(s => s === 0)) {
      alert('Please select a course, tee box, and enter all scores')
      return
    }

    if (!currentUser) {
      alert('Please log in first')
      return
    }

    // --- AUTO-CLEANUP STALE IN-PROGRESS ROUNDS ---
let supabaseHasInProgress = false;
try {
  const response = await fetch('/api/get-in-progress-rounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id })
  });
  const result = await response.json();
  supabaseHasInProgress = Array.isArray(result.rounds) && result.rounds.length > 0;
  if (!supabaseHasInProgress) {
    // If none in Supabase, clear all local in-progress rounds for this user
    const savedRounds = localStorage.getItem('golfRounds');
    if (savedRounds) {
      let rounds = JSON.parse(savedRounds);
      let changed = false;
      rounds = rounds.map((r: Round) => {
        if (r.userId === currentUser.id && r.in_progress) {
          changed = true;
          return { ...r, in_progress: false };
        }
        return r;
      });
      if (changed) {
        localStorage.setItem('golfRounds', JSON.stringify(rounds));
        localStorage.removeItem('currentRoundId');
      }
    }
  }
} catch (err) {
  console.warn('Could not check Supabase for in-progress rounds:', err);
}
// Now check localStorage again
const savedRounds = localStorage.getItem('golfRounds');
const rounds = savedRounds ? JSON.parse(savedRounds) : [];
const inProgress = rounds.find((r: any) => r.userId === currentUser.id && r.in_progress);
if (inProgress || supabaseHasInProgress) {
  alert('You already have a round in progress. Please finish or discard it before starting a new one.');
  return;
}

    // Save the round with user info
    const round = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      selectedTee: selectedTee as 'men' | 'women' | 'senior' | 'championship',
      date,
      scores,
      totalScore: scores.reduce((a, b) => a + b, 0),
      notes,
      in_progress: true, // Always boolean
    };
    // Remove any snake_case fields if present (defensive)
    if ('selected_tee' in round) delete (round as any).selected_tee;
    if ('inProgress' in round) delete (round as any).inProgress;
    rounds.push(round)
    localStorage.setItem('golfRounds', JSON.stringify(rounds))

    // Also save the course to golfCourses so round-detail can find it
    const savedCourses = localStorage.getItem('golfCourses')
    const courses = savedCourses ? JSON.parse(savedCourses) : []
    const courseExists = courses.some((c: Course) => c.id === selectedCourse.id)
    if (!courseExists) {
      courses.push(selectedCourse)
      localStorage.setItem('golfCourses', JSON.stringify(courses))
    }

    // Also save to Supabase
    try {
      const response = await fetch('/api/save-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(round),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Unknown error');
      console.log('✅ Round successfully saved to Supabase');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to save round to Supabase:', errorMsg);
      setSaveError(errorMsg);
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
          <button 
            onClick={() => {
              console.log('🔥 View Scorecard button clicked!')
              console.log('� Router object:', router ? 'exists' : 'MISSING')
              console.log('📍 savedRoundId:', savedRoundId)
              if (!router) {
                console.error('❌ Router is not available!')
                return
              }
              if (!savedRoundId) {
                console.error('❌ savedRoundId is not set!')
                return
              }
              const targetUrl = `/round-detail?id=${savedRoundId}`
              console.log('🔑 Navigating to:', targetUrl)
              window.location.href = targetUrl
            }} 
            className="btn-primary"
          >
            View Scorecard
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Loading...</h2>
          <p className="text-gray-600">Setting up your round...</p>
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
              <button className="btn-primary w-full">➕ Add New Course</button>
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
          {/* Tee Box Selector */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h3 className="text-lg font-bold mb-4">Select Your Tee Box</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {selectedCourse?.holes && Array.isArray(selectedCourse.holes) && selectedCourse.holes.length > 0 && (['men', 'women', 'senior', 'championship'] as const).map((tee) => {
                try {
                  const teeLabel = tee.charAt(0).toUpperCase() + tee.slice(1) + "'s"
                  const teeHole = selectedCourse?.holes?.[0]?.[tee]
                  
                  // Debug logging
                  if (tee === 'men') {
                    console.log('🔍 DEBUG - First hole structure:', selectedCourse.holes[0])
                    console.log('🔍 DEBUG - Men teeHole:', teeHole)
                  }
                  
                  // Calculate total yardage with full defensive checks
                  const totalYardage = selectedCourse?.holes?.reduce((sum: number, hole: any) => {
                    if (!hole || typeof hole !== 'object') return sum
                    const teeBox = hole[tee]
                    if (!teeBox || typeof teeBox !== 'object') return sum
                    const yardage = Number(teeBox.yardage)
                    return !isNaN(yardage) ? sum + yardage : sum
                  }, 0) || 0
                  
                  // Extract course rating safely
                  const courseRating = (teeHole && typeof teeHole === 'object' && 'courseRating' in teeHole) 
                    ? Number(teeHole.courseRating) 
                    : undefined
                  const isValidRating = courseRating && !isNaN(courseRating)
                
                return (
                  <button
                    key={tee}
                    type="button"
                    onClick={() => setSelectedTee(tee)}
                    className={`p-4 rounded-lg transition border-2 ${
                      selectedTee === tee
                        ? 'bg-blue-600 text-white border-blue-700 shadow-lg'
                        : 'bg-white text-gray-800 border-gray-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="font-bold text-lg">{teeLabel}</div>
                    <div className={`text-sm mt-1 ${selectedTee === tee ? 'text-blue-100' : 'text-gray-600'}`}>
                      {totalYardage || 0} yds
                    </div>
                    {isValidRating && (
                      <div className={`text-xs mt-1 ${selectedTee === tee ? 'text-blue-100' : 'text-gray-500'}`}>
                        {courseRating?.toFixed(1) || 'N/A'} rating
                      </div>
                    )}
                  </button>
                )
                } catch (error) {
                  console.error(`Error rendering tee ${tee}:`, error)
                  return null
                }
              })}
            </div>
            {!selectedTee && (
              <p className="text-red-600 mt-3 text-sm font-semibold">⚠️ Please select a tee box to continue</p>
            )}
          </div>

          {/* Only show score entry if tee is selected */}
          {selectedTee && (
            <>
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
                      <span className="font-bold text-xl">Hole {selectedCourse.holes[currentHoleIndex]?.holeNumber || currentHoleIndex + 1}</span>
                      <span className="text-gray-600 ml-3 text-lg">Par {selectedCourse.holes[currentHoleIndex]?.par || '-'}</span>
                      <span className="text-gray-600 ml-3 text-lg">
                        {selectedTee && selectedCourse.holes[currentHoleIndex]?.[selectedTee]?.yardage && (
                          <>{selectedCourse.holes[currentHoleIndex][selectedTee].yardage} yds</>
                        )}
                      </span>
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
            <button 
              type="button" 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('Cancel button clicked')
                window.location.href = '/'
              }}
              className="btn-secondary w-full"
            >
              Cancel
            </button>
          </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
