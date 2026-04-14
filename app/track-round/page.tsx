'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Round, Course, Hole } from '@/types'
import Link from 'next/link'

function TrackRoundContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roundId = searchParams.get('id')

  const [round, setRound] = useState<Round | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [geolocationError, setGeolocationError] = useState<string | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)

  // Haversine formula to calculate distance between two coordinates
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
    const yards = km * 1093.61 // Convert km to yards
    return Math.round(yards)
  }

  useEffect(() => {
    if (!roundId) return

    try {
      // Load round from localStorage
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds) as Round[]
        const foundRound = allRounds.find((r) => r.id === roundId)
        if (foundRound) {
          setRound(foundRound)

          // Load course from localStorage
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

  // Request geolocation permission and start tracking
  useEffect(() => {
    if (!loading && !round) return

    if ('geolocation' in navigator) {
      // Request location immediately
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
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMsg = 'Location information is unavailable.'
          }
          setGeolocationError(errorMsg)
          console.error('Geolocation error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      )

      // Watch position for continuous updates
      const id = navigator.geolocation.watchPosition(
        (position) => {
          setUserLat(position.coords.latitude)
          setUserLng(position.coords.longitude)
          setGpsAccuracy(position.coords.accuracy)
          setGeolocationError(null)
        },
        (error) => {
          console.error('Watch position error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      )

      setWatchId(id)

      return () => {
        navigator.geolocation.clearWatch(id)
      }
    }
  }, [loading, round])

  // Calculate distance to current hole whenever location or hole changes
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading round...</p>
        </div>
      </div>
    )
  }

  if (!round || !course) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500 mb-4">Round not found</p>
          <Link href="/">
            <button className="btn-primary">Back to Home</button>
          </Link>
        </div>
      </div>
    )
  }

  if (currentHoleIndex >= course.holes.length) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <h2 className="text-2xl font-bold mb-4">Round Complete</h2>
          <p className="text-gray-600 mb-6">
            You've finished all {course.holes.length} holes!
          </p>
          <Link href={`/round-detail?id=${roundId}`}>
            <button className="btn-primary">View Scorecard</button>
          </Link>
        </div>
      </div>
    )
  }

  const currentHole: Hole = course.holes[currentHoleIndex]
  const selectedTee = round.selectedTee
  const teeBox = currentHole[selectedTee]

  return (
    <div className="max-w-2xl mx-auto py-6">
      {/* GPS Status */}
      {geolocationError && (
        <div className="card mb-6 bg-red-50 border-red-200">
          <p className="text-red-700">
            <strong>⚠️ Location Error:</strong> {geolocationError}
          </p>
        </div>
      )}

      {userLat !== null && (
        <div className="card mb-6 bg-green-50 border-green-200">
          <p className="text-green-700 text-sm">
            ✅ GPS Active • Accuracy: ±{Math.round(gpsAccuracy || 0)}m
          </p>
        </div>
      )}

      {/* Main display */}
      <div className="card mb-6">
        {/* Course and hole header */}
        <div className="mb-6 pb-6 border-b">
          <p className="text-gray-600 text-sm">
            {round.courseName} • {selectedTee.charAt(0).toUpperCase() + selectedTee.slice(1)}'s Tee
          </p>
          <h1 className="text-4xl font-bold mt-2">
            Hole {currentHole.holeNumber}
            <span className="text-2xl text-gray-600 ml-4">Par {currentHole.par}</span>
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Hole {currentHoleIndex + 1} of {course.holes.length}
          </p>
        </div>

        {/* Distance to pin - Main focus */}
        <div className="mb-8 text-center p-8 bg-blue-50 rounded-lg">
          <p className="text-gray-600 text-sm mb-2">Distance to Green</p>
          {distance !== null ? (
            <>
              <div className="text-7xl font-bold text-blue-600">{distance}</div>
              <p className="text-gray-600 text-lg mt-2">yards</p>
            </>
          ) : (
            <p className="text-gray-500 text-lg">Getting location...</p>
          )}
        </div>

        {/* Hole info grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600 text-sm">Yardage</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{teeBox.yardage}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600 text-sm">Rating</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{teeBox.courseRating.toFixed(1)}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600 text-sm">Slope</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{teeBox.slopeRating}</p>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3 mb-6">
          {currentHoleIndex > 0 && (
            <button onClick={handlePreviousHole} className="btn-secondary flex-1">
              ← Previous Hole
            </button>
          )}
          {currentHoleIndex < course.holes.length - 1 && (
            <button onClick={handleNextHole} className="btn-primary flex-1">
              Next Hole →
            </button>
          )}
          {currentHoleIndex === course.holes.length - 1 && (
            <button
              onClick={() => setCurrentHoleIndex(currentHoleIndex + 1)}
              className="btn-primary flex-1"
            >
              Finish Round ✓
            </button>
          )}
        </div>

        {/* Back to scorecard button */}
        <Link href={`/round-detail?id=${roundId}`}>
          <button className="btn-secondary w-full">Back to Scorecard</button>
        </Link>
      </div>

      {/* Debug info (optional) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="card bg-gray-50 text-xs">
          <p className="text-gray-600">
            <strong>Debug:</strong> Hole GPS: ({currentHole.greenLat}, {currentHole.greenLng}) | User GPS: (
            {userLat?.toFixed(4)}, {userLng?.toFixed(4)})
          </p>
        </div>
      )}
    </div>
  )
}

export default function TrackRoundPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto py-6">
          <div className="card text-center">
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      }
    >
      <TrackRoundContent />
    </Suspense>
  )
}
