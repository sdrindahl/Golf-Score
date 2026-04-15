'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Round, Course, Hole } from '@/types'
import Link from 'next/link'
import { saveRoundToSupabase } from '@/lib/dataSync'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import PageWrapper from '@/components/PageWrapper'

function TrackRoundContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roundId = searchParams.get('id')

  const [round, setRound] = useState<Round | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [startingHoleSelected, setStartingHoleSelected] = useState(false)
  const [showScorecard, setShowScorecard] = useState(false)
  
  // GPS state
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [geolocationError, setGeolocationError] = useState<string | null>(null)
  
  const [loading, setLoading] = useState(true)

  // Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const km = R * c
    const yards = km * 1093.61
    return Math.round(yards)
  }

  // Helper function to get score type label
  const getScoreType = (score: number, par: number): string => {
    const diff = score - par
    if (score === 1) return 'Ace'
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
    if (diff === -2) return 'from-blue-500 to-blue-700'
    if (diff === -1) return 'from-green-500 to-green-700'
    if (diff === 0) return 'from-gray-400 to-gray-600'
    if (diff === 1) return 'from-orange-500 to-orange-700'
    if (diff === 2) return 'from-red-500 to-red-700'
    return 'from-red-700 to-red-900'
  }

  // Load round and course
  useEffect(() => {
    if (!roundId) return

    const loadRound = async () => {
      try {
        let foundRound: Round | null = null
        
        // First, try to find in localStorage
        const savedRounds = localStorage.getItem('golfRounds')
        if (savedRounds) {
          const allRounds = JSON.parse(savedRounds) as Round[]
          foundRound = allRounds.find((r) => r.id === roundId) || null
        }

        // If not in localStorage, try to fetch from Supabase
        if (!foundRound && isSupabaseConfigured() && supabase) {
          console.log('Round not in localStorage, fetching from Supabase...')
          try {
            const { data, error } = await supabase
              .from('rounds')
              .select('*')
              .eq('id', roundId)
              .single()
            
            if (!error && data) {
              foundRound = data as Round
              // Restore to localStorage for future access
              const allRounds = savedRounds ? JSON.parse(savedRounds) : []
              allRounds.push(foundRound)
              localStorage.setItem('golfRounds', JSON.stringify(allRounds))
              console.log('✅ Round restored from Supabase and saved to localStorage')
            } else {
              console.error('Could not fetch round from Supabase:', error?.message)
            }
          } catch (supabaseError) {
            console.error('Supabase fetch error:', supabaseError)
          }
        }

        if (foundRound) {
          setRound(foundRound)
          setScores([...foundRound.scores])
          // Store current round ID for "Return to Round" feature
          localStorage.setItem('currentRoundId', roundId)

          // Restore the hole they were on
          const savedHoleIndex = localStorage.getItem(`currentHoleIndex-${roundId}`)
          if (savedHoleIndex) {
            const holeIndex = parseInt(savedHoleIndex, 10)
            setCurrentHoleIndex(holeIndex)
            setStartingHoleSelected(true)
            console.log(`✅ Restored to hole ${holeIndex + 1}`)
          }

          const savedCourses = localStorage.getItem('golfCourses')
          if (savedCourses) {
            const allCourses = JSON.parse(savedCourses) as Course[]
            const foundCourse = allCourses.find((c) => c.id === foundRound.courseId)
            if (foundCourse) {
              setCourse(foundCourse)
            }
          }
        }
      } catch (error) {
        console.error('Error loading round:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRound()
  }, [roundId])

  // Request geolocation
  useEffect(() => {
    if (!loading && round) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLat(position.coords.latitude)
            setUserLng(position.coords.longitude)
            setGpsAccuracy(position.coords.accuracy)
            setGeolocationError(null)
          },
          (error) => {
            let errorMsg = 'Unable to get location'
            if (error.code === error.PERMISSION_DENIED) {
              errorMsg = 'Location permission denied. Please enable location services.'
            }
            setGeolocationError(errorMsg)
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )

        // Watch position for continuous updates
        const id = navigator.geolocation.watchPosition(
          (position) => {
            setUserLat(position.coords.latitude)
            setUserLng(position.coords.longitude)
            setGpsAccuracy(position.coords.accuracy)
            setGeolocationError(null)
          },
          () => {},
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )

        return () => navigator.geolocation.clearWatch(id)
      }
    }
  }, [loading, round])

  // Calculate distance to current hole
  useEffect(() => {
    if (
      userLat !== null &&
      userLng !== null &&
      course &&
      currentHoleIndex < course.holes.length
    ) {
      const hole = course.holes[currentHoleIndex]
      const distanceToGreen = calculateDistance(userLat, userLng, hole.greenLat, hole.greenLng)
      setDistance(distanceToGreen)
    }
  }, [userLat, userLng, currentHoleIndex, course])

  // Save current hole index to localStorage for round recovery
  useEffect(() => {
    if (roundId && startingHoleSelected) {
      localStorage.setItem(`currentHoleIndex-${roundId}`, currentHoleIndex.toString())
    }
  }, [currentHoleIndex, roundId, startingHoleSelected])

  // Prevent navigation away if round is in progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (startingHoleSelected && currentHoleIndex < course?.holes.length! - 1) {
        const message = 'Your round will not be saved if you don\'t finish the round.'
        e.preventDefault()
        e.returnValue = message
        return message
      }
    }

    const handlePopState = () => {
      if (startingHoleSelected && currentHoleIndex < course?.holes.length! - 1) {
        const message = 'Your round will not be saved if you don\'t finish the round. Do you want to leave?'
        if (!confirm(message)) {
          // Push the same route back to prevent navigation
          window.history.pushState(null, '', window.location.href)
          return
        }
      }
    }

    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (target && target.href && !target.href.includes(`?id=${roundId}`)) {
        if (startingHoleSelected && currentHoleIndex < course?.holes.length! - 1) {
          const message = 'Your round will not be saved if you don\'t finish the round. Do you want to leave?'
          if (!confirm(message)) {
            e.preventDefault()
            e.stopPropagation()
            return false
          }
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    document.addEventListener('click', handleLinkClick, true)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [startingHoleSelected, currentHoleIndex, course, roundId])

  // Auto-save round after each hole
  const saveRound = (updatedScores: number[]) => {
    if (!round) return

    try {
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds) as Round[]
        const index = allRounds.findIndex((r) => r.id === roundId)
        if (index >= 0) {
          const totalScore = updatedScores.reduce((sum, score) => sum + score, 0)
          allRounds[index].scores = updatedScores
          allRounds[index].totalScore = totalScore
          localStorage.setItem('golfRounds', JSON.stringify(allRounds))
          console.log('💾 Round auto-saved locally after hole', currentHoleIndex + 1)
          
          // Update the round state so we have the latest data
          const updatedRound = allRounds[index]
          setRound(updatedRound)
          
          // Also sync to Supabase so other devices see the update
          saveRoundToSupabase(updatedRound).catch(error => {
            console.error('❌ Failed to sync round to Supabase:', error.message)
            // Don't stop the app if Supabase sync fails - but log the error
          })
        }
      }
    } catch (error) {
      console.error('Error saving round:', error)
    }
  }

  const handleScoreChange = (delta: number) => {
    const newScores = [...scores]
    newScores[currentHoleIndex] = Math.max(0, newScores[currentHoleIndex] + delta)
    setScores(newScores)
    saveRound(newScores)
  }

  const handleNextHole = () => {
    if (course && currentHoleIndex < course.holes.length - 1) {
      setCurrentHoleIndex(currentHoleIndex + 1)
    }
  }

  const handlePreviousHole = () => {
    if (currentHoleIndex > 0) {
      setCurrentHoleIndex(currentHoleIndex - 1)
    }
  }

  const handleFinishRound = () => {
    if (round) {
      // Final sync to Supabase before navigating away
      saveRoundToSupabase(round).catch(error => {
        console.error('❌ Failed to sync final round to Supabase:', error.message)
        // Still navigate even if sync fails - rounds are saved locally
      })
      // Clear the current round ID and hole index since round is finished
      localStorage.removeItem('currentRoundId')
      localStorage.removeItem(`currentHoleIndex-${roundId}`)
      router.push(`/round-detail?id=${round.id}`)
    }
  }

  const handleCancelRound = () => {
    if (confirm('Cancel this round? It will not be saved.')) {
      try {
        const savedRounds = localStorage.getItem('golfRounds')
        if (savedRounds) {
          const allRounds = JSON.parse(savedRounds) as Round[]
          const filteredRounds = allRounds.filter((r) => r.id !== roundId)
          localStorage.setItem('golfRounds', JSON.stringify(filteredRounds))
          console.log('🗑️ Round cancelled and deleted')
        }
        // Clear the current round ID and hole index
        localStorage.removeItem('currentRoundId')
        localStorage.removeItem(`currentHoleIndex-${roundId}`)
      } catch (error) {
        console.error('Error cancelling round:', error)
      }
      router.push('/')
    }
  }



  if (loading) {
    return (
      <PageWrapper title="Loading" userName="Round Details">
        <div className="card text-center">
          <p className="text-gray-500">Loading round...</p>
        </div>
      </PageWrapper>
    )
  }

  if (!round || !course) {
    return (
      <PageWrapper title="Round Not Found" userName="Error">
        <div className="card text-center">
          <p className="text-gray-500 mb-4">Round not found</p>
          <Link href="/">
            <button className="btn-primary">Back to Home</button>
          </Link>
        </div>
      </PageWrapper>
    )
  }

  if (currentHoleIndex >= course.holes.length) {
    return (
      <PageWrapper title="Round Complete" userName="🎉 Congratulations">
        <div className="card text-center">
          <h2 className="text-2xl font-bold mb-4">Round Complete! 🎉</h2>
          <p className="text-gray-600 mb-6">
            You've finished all {course.holes.length} holes!
          </p>
          <button onClick={handleFinishRound} className="btn-primary">
            View Scorecard
          </button>
        </div>
      </PageWrapper>
    )
  }

  // Safety check - don't render if course isn't loaded
  if (!course) {
    return (
      <PageWrapper title="Loading" userName="Round Details">
        <div className="card text-center">
          <p className="text-gray-500">Loading course details...</p>
        </div>
      </PageWrapper>
    )
  }

  const currentHole: Hole = course.holes[currentHoleIndex]
  const selectedTee = round.selectedTee
  const teeBox = currentHole[selectedTee]
  const currentScore = scores[currentHoleIndex] || 0
  const parDifference = currentScore - currentHole.par

  return (
    <PageWrapper title={`Hole ${currentHole.holeNumber}`} userName={`${round.courseName} • ${selectedTee.charAt(0).toUpperCase() + selectedTee.slice(1)}'s`}>
      {/* Scorecard Modal */}
      {showScorecard && course && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Scorecard</h2>
              <button
                onClick={() => setShowScorecard(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-2">
              {course.holes.map((hole, index) => (
                <div key={hole.holeNumber} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-800">Hole {hole.holeNumber}</p>
                    <p className="text-xs text-gray-500">Par {hole.par}</p>
                  </div>
                  <div className="text-center">
                    {scores[index] ? (
                      <div>
                        <p className="text-2xl font-bold text-green-600">{scores[index]}</p>
                        <p className="text-xs text-gray-500">{scores[index] - hole.par > 0 ? '+' : ''}{scores[index] - hole.par}</p>
                      </div>
                    ) : (
                      <p className="text-gray-400">—</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t p-4">
              <div className="text-center mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-gray-600 text-sm">Total Score (Completed)</p>
                <p className="text-2xl font-bold text-blue-600">
                  {scores.filter(s => s > 0).reduce((sum, score) => sum + score, 0)}
                </p>
              </div>
              <button
                onClick={() => setShowScorecard(false)}
                className="w-full py-2 px-4 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Starting Hole Selector */}
      {!startingHoleSelected && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">Select Starting Hole</h2>
          <div className="grid grid-cols-6 gap-2">
            {course.holes.map((hole) => (
              <button
                key={hole.holeNumber}
                onClick={() => {
                  setCurrentHoleIndex(hole.holeNumber - 1)
                  setStartingHoleSelected(true)
                }}
                className="p-2 bg-white border-2 border-green-600 text-gray-800 font-semibold rounded-lg hover:bg-green-50"
              >
                {hole.holeNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GPS Status */}
      {startingHoleSelected && geolocationError && (
        <div className="card mb-4 bg-red-50 border-red-200">
          <p className="text-red-700 text-sm">
            <strong>⚠️ Location Error:</strong> {geolocationError}
          </p>
        </div>
      )}

      {startingHoleSelected && (
      <>
        {/* Top Info Bar - Running Tally */}
        <div className="grid grid-cols-3 gap-1 mb-2">
          <div className="p-2 bg-green-50 rounded-lg text-center border border-l-4 border-l-green-600 border-gray-200">
            <p className="text-gray-700 text-xs font-semibold">SCORE</p>
            <p className="text-2xl font-bold text-green-700">{scores.filter(s => s > 0).reduce((sum, score) => sum + score, 0)}</p>
          </div>
          <div className="p-2 bg-white rounded-lg text-center border border-l-4 border-l-purple-600 border-gray-200">
            <p className="text-gray-700 text-xs font-semibold">vs PAR</p>
            <p className={`text-2xl font-bold ${
              scores.filter(s => s > 0).reduce((sum, score) => sum + score, 0) - scores.filter((s, i) => s > 0).reduce((sum, score, index) => sum + course.holes[index].par, 0) < 0 
                ? 'text-green-700' 
                : 'text-red-700'
            }`}>
              {(() => {
                const totalScore = scores.filter(s => s > 0).reduce((sum, score) => sum + score, 0)
                const totalPar = scores.reduce((sum, score, index) => score > 0 ? sum + course.holes[index].par : sum, 0)
                const diff = totalScore - totalPar
                return diff === 0 ? 'E' : (diff > 0 ? '+' + diff : diff)
              })()}
            </p>
          </div>
          <div className="p-2 bg-white rounded-lg text-center border border-l-4 border-l-blue-600 border-gray-200">
            <p className="text-gray-700 text-xs font-semibold">HOLES</p>
            <p className="text-2xl font-bold text-blue-700">{scores.filter(s => s > 0).length}/{course.holes.length}</p>
          </div>
        </div>

        {/* Hole Completion Tracker */}
        <div className="mb-3 p-2 bg-white rounded-lg border border-gray-200">
          <h3 className="text-xs font-bold text-gray-700 mb-2">Holes Completed</h3>
          <div className="grid grid-cols-6 gap-2">
            {course.holes.map((hole, index) => {
              const score = scores[index]
              const isCompleted = score > 0
              const isCurrent = currentHoleIndex === index
              
              return (
                <button
                  key={hole.holeNumber}
                  onClick={() => setCurrentHoleIndex(index)}
                  className={`aspect-square rounded text-xs font-semibold flex flex-col items-center justify-center transition-all relative ${
                    isCurrent
                      ? 'ring-2 ring-green-800'
                      : ''
                  } ${
                    isCompleted
                      ? `bg-gradient-to-br ${getScoreColor(score, hole.par)} text-white`
                      : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={isCompleted ? `Hole ${hole.holeNumber}: Score ${score} (${getScoreType(score, hole.par)})` : `Hole ${hole.holeNumber}`}
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
                </button>
              )
            })}
          </div>
        </div>

        {/* Distance to Green */}
        <div className="card mb-3">
          <div className="text-center">
            <p className="text-gray-600 text-xs font-semibold mb-2">Distance to Center of the Green</p>
            {distance !== null ? (
              <>
                <div className="text-4xl font-bold text-blue-600">{distance}</div>
                <p className="text-gray-700 text-xs">yards</p>
              </>
            ) : (
              <p className="text-gray-500 text-xs">Getting location...</p>
            )}
          </div>
        </div>

        <div className="card">
          {/* Score Entry */}
          <div className="flex items-center justify-between">
            {/* Hole Info */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center font-bold text-lg text-gray-700">
                {currentHoleIndex + 1}
              </div>
              <div>
                <span className="text-sm font-bold text-gray-700 block">Par {currentHole.par}</span>
                <span className="text-xs text-gray-600">{teeBox?.yardage ? `${teeBox.yardage}yd` : '—'}</span>
              </div>
            </div>

            {/* Score Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScoreChange(-1)}
                className="w-12 h-12 bg-gray-400 text-white font-bold rounded-lg hover:bg-gray-500 transition active:scale-95 flex items-center justify-center text-xl"
              >
                −
              </button>
              <div className="w-14 text-center">
                <div className="text-3xl font-bold text-gray-800">{currentScore}</div>
                <div className={`text-xs font-bold ${
                  parDifference < 0 ? 'text-green-600' : 
                  parDifference > 0 ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {parDifference === 0 ? 'E' : 
                   parDifference < 0 ? `-${Math.abs(parDifference)}` : 
                   `+${parDifference}`}
                </div>
              </div>
              <button
                onClick={() => handleScoreChange(1)}
                className="w-12 h-12 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition active:scale-95 flex items-center justify-center text-xl"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2 mb-2 mt-4">
          {currentHoleIndex > 0 && (
            <button onClick={handlePreviousHole} className="flex-1 py-2 text-sm font-bold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition">
              ← Prev
            </button>
          )}
          {currentHoleIndex < course.holes.length - 1 && (
            <button 
              onClick={handleNextHole} 
              disabled={currentScore === 0}
              className={`flex-1 font-bold py-2 px-2 rounded-lg text-sm transition ${
                currentScore === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-300 text-gray-800 hover:bg-green-400'
              }`}
            >
              Next →
            </button>
          )}
          {currentHoleIndex === course.holes.length - 1 && (
            <button 
              onClick={handleFinishRound}
              disabled={currentScore === 0}
              className={`flex-1 font-bold py-2 px-2 rounded-lg text-sm transition ${
                currentScore === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-300 text-gray-800 hover:bg-green-400'
              }`}
            >
              Finish ✓
            </button>
          )}
        </div>

        {/* Cancel button */}
        <button
          onClick={handleCancelRound}
          className="w-full py-2 px-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition text-sm"
        >
          Cancel
        </button>
      </>
      )}
    </PageWrapper>
  )
}

export default function TrackRound() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TrackRoundContent />
    </Suspense>
  )
}
