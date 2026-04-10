'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Course } from '@/types'

function EditCourseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const courseId = searchParams.get('id')

  const [courseName, setCourseName] = useState('')
  const [location, setLocation] = useState('')
  const [state, setState] = useState('')
  const [holeCount, setHoleCount] = useState(18)
  const [courseRating, setCourseRating] = useState(72.0)
  const [slopeRating, setSlopeRating] = useState(113)
  const [holes, setHoles] = useState<any[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!courseId) return

    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      const course = courses.find((c: Course) => c.id === courseId)
      
      if (course) {
        setCourseName(course.name)
        setLocation(course.location)
        setState(course.state)
        setHoleCount(course.holeCount)
        setCourseRating(course.courseRating || 72.0)
        setSlopeRating(course.slopeRating || 113)
        setHoles(course.holes)
      }
    }
    setLoading(false)
  }, [courseId])

  const handleHoleChange = (holeNumber: number, field: 'par' | 'handicap', value: number) => {
    const newHoles = [...holes]
    const holeIndex = newHoles.findIndex(h => h.holeNumber === holeNumber)
    if (holeIndex >= 0) {
      newHoles[holeIndex][field] = value
      setHoles(newHoles)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!courseName.trim() || !location.trim() || !state.trim()) {
      alert('Please fill in all course details')
      return
    }

    if (holes.some(h => h.par === 0)) {
      alert('Please set par for all holes')
      return
    }

    const updatedCourse: Course = {
      id: courseId!,
      name: courseName,
      location,
      state,
      holeCount,
      par: holes.reduce((sum, h) => sum + h.par, 0),
      holes,
      courseRating,
      slopeRating,
    }

    // Update in localStorage
    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      const index = courses.findIndex((c: Course) => c.id === courseId)
      if (index >= 0) {
        courses[index] = updatedCourse
        localStorage.setItem('golfCourses', JSON.stringify(courses))
      }
    }

    setSubmitted(true)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading course...</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <h2 className="text-3xl font-bold mb-4 text-green-600">✅ Course Updated!</h2>
          <p className="text-lg mb-6">{courseName} - {location}, {state}</p>
          <div className="flex gap-4 justify-center">
            <Link href="/manage-courses">
              <button className="btn-primary">Back to Courses</button>
            </Link>
            <Link href="/">
              <button className="btn-secondary">Dashboard</button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <form onSubmit={handleSubmit}>
        {/* Course Details */}
        <div className="card mb-6">
          <h2 className="text-2xl font-bold mb-6">Edit Golf Course</h2>
          
          <div className="space-y-4">
            <div>
              <label className="label">Course Name</label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g., Pebble Beach Golf Links"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Location/City</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Pebble Beach"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">State/Region</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g., CA"
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Course Rating</label>
                <input
                  type="number"
                  value={courseRating}
                  onChange={(e) => setCourseRating(parseFloat(e.target.value))}
                  placeholder="e.g., 72.4"
                  step="0.1"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Slope Rating</label>
                <input
                  type="number"
                  value={slopeRating}
                  onChange={(e) => setSlopeRating(parseInt(e.target.value))}
                  placeholder="e.g., 135"
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hole Details */}
        {holes.length > 0 && (
          <div className="card mb-6">
            <h3 className="text-xl font-bold mb-6">Par and Handicap for Each Hole</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {holes.map((hole) => (
                <div key={hole.holeNumber} className="border p-4 rounded">
                  <h4 className="font-bold mb-3">Hole {hole.holeNumber}</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-semibold">Par</label>
                      <select
                        value={hole.par}
                        onChange={(e) => handleHoleChange(hole.holeNumber, 'par', parseInt(e.target.value))}
                        className="input-field mt-1"
                      >
                        <option value={3}>Par 3</option>
                        <option value={4}>Par 4</option>
                        <option value={5}>Par 5</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold">Handicap Index</label>
                      <input
                        type="number"
                        value={hole.handicap}
                        onChange={(e) => handleHoleChange(hole.holeNumber, 'handicap', parseInt(e.target.value))}
                        min="1"
                        max={holeCount}
                        className="input-field mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Total Par</p>
                  <p className="text-2xl font-bold">{holes.reduce((sum, h) => sum + h.par, 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Holes</p>
                  <p className="text-2xl font-bold">{holes.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Average Par</p>
                  <p className="text-2xl font-bold">{holes.length > 0 ? (holes.reduce((sum, h) => sum + h.par, 0) / holes.length).toFixed(1) : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button type="submit" className="btn-primary flex-1">
            💾 Save Changes
          </button>
          <Link href="/manage-courses" className="flex-1">
            <button type="button" className="btn-secondary w-full">
              Cancel
            </button>
          </Link>
        </div>
      </form>
    </div>
  )
}

export default function EditCourse() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto py-6"><div className="card text-center"><p className="text-gray-500">Loading course...</p></div></div>}>
      <EditCourseContent />
    </Suspense>
  )
}
