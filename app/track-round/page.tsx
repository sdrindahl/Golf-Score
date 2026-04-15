'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Round, Course, Hole } from '@/types'
import Link from 'next/link'
import { saveRoundToSupabase } from '@/lib/dataSync'
import PageWrapper from '@/components/PageWrapper'

function TrackRoundContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roundId = searchParams.get('id')

  const [round, setRound] = useState<Round | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  
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

  // Load round and course
  useEffect(() => {
    if (!roundId) return

    try {
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds) as Round[]
        const foundRound = allRounds.find((r) => r.id === roundId)
        if (foundRound) {
          setRound(foundRound)
          setScores([...foundRound.scores])

          const savedCourses = localStorage.getItem('golfCourses')
          if (savedCourses) {
            const allCourses = JSON.parse(savedCourses) as Course[]
            const foundCourse = allCourses.find((c) => c.id === foundRound.courseId)
            if (foundCourse) {
              setCourse(foundCourse)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading round:', error)
    } finally {
      setLoading(false)
    }
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
      router.push(`/round-detail?id=${round.id}`)
    }
  }

  const handleBackToTeeSelector = () => {
    if (confirm('Go back to tee selector? Your current round will be saved.')) {
      saveRound(scores)
      router.back()
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

  const currentHole: Hole = course.holes[currentHoleIndex]
  const selectedTee = round.selectedTee
  const teeBox = currentHole[selectedTee]
  const currentScore = scores[currentHoleIndex] || 0
  const parDifference = currentScore - currentHole.par

  return (
    <PageWrapper title={`Hole ${currentHole.holeNumber}`} userName={`${round.courseName} • ${selectedTee.charAt(0).toUpperCase() + selectedTee.slice(1)}'s`}>
      {/* Back button */}
      <button
        onClick={handleBackToTeeSelector}
        className="mb-4 px-3 py-1 bg-white text-gray-800 rounded text-sm hover:bg-gray-100"
      >
        ← Back to Tee
      </button>

      {/* GPS Status */}
      {geolocationError && (
        <div className="card mb-4 bg-red-50 border-red-200">
          <p className="text-red-700 text-sm">
            <strong>⚠️ Location Error:</strong> {geolocationError}
          </p>
        </div>
      )}

      <div className="card">
        {/* Distance to green - MAIN FOCUS */}
        <div className="mb-4 text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <p className="text-gray-600 text-xs mb-1">Distance to Green</p>
          {distance !== null ? (
            <>
              <div className="text-5xl md:text-7xl font-bold text-blue-600">{distance}</div>
              <p className="text-gray-600 text-sm mt-1">yards</p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">Getting location...</p>
          )}
        </div>

        {/* Hole progress */}
        <div className="mb-4 pb-3 border-b">
          <p className="text-gray-600 text-xs">
            Hole {currentHoleIndex + 1} of {course.holes.length}
          </p>
        </div>

        {/* Par and Yardage */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-gray-600 text-xs">Par</p>
            <p className="text-2xl font-bold text-gray-800">{currentHole.par}</p>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className="text-gray-600 text-xs">Yardage</p>
            <p className="text-2xl font-bold text-gray-800">{teeBox.yardage}</p>
          </div>
        </div>

        {/* Score entry with +/- buttons */}
        <div className="mb-4 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
          <p className="text-gray-600 text-xs text-center mb-3">Your Score</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handleScoreChange(-1)}
              className="px-4 py-2 bg-red-500 text-white text-xl font-bold rounded-lg hover:bg-red-600"
            >
              −
            </button>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-800">{currentScore}</div>
              <div className={`text-sm mt-1 font-semibold ${
                parDifference < 0 ? 'text-green-600' : 
                parDifference > 0 ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {parDifference === 0 ? 'Even' : 
                 parDifference < 0 ? `${Math.abs(parDifference)} under` : 
                 `${parDifference} over`}
              </div>
            </div>
            <button
              onClick={() => handleScoreChange(1)}
              className="px-4 py-2 bg-green-500 text-white text-xl font-bold rounded-lg hover:bg-green-600"
            >
              +
            </button>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {currentHoleIndex > 0 && (
            <button onClick={handlePreviousHole} className="btn-secondary flex-1">
              ← Previous
            </button>
          )}
          {currentHoleIndex < course.holes.length - 1 && (
            <button 
              onClick={handleNextHole} 
              disabled={currentScore === 0}
              className={`flex-1 font-semibold py-2 px-4 rounded-lg transition ${
                currentScore === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              Save & Next Hole →
            </button>
          )}
          {currentHoleIndex === course.holes.length - 1 && (
            <button 
              onClick={handleFinishRound}
              disabled={currentScore === 0}
              className={`flex-1 font-semibold py-2 px-4 rounded-lg transition ${
                currentScore === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              Finish Round ✓
            </button>
          )}
        </div>
      </div>
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
