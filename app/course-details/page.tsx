'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Course } from '@/types'

function CourseDetailsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const courseId = searchParams.get('id')

  const [course, setCourse] = useState<Course | null>(null)
  const [editingHoles, setEditingHoles] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!courseId) return

    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      const foundCourse = courses.find((c: Course) => c.id === courseId)
      if (foundCourse) {
        setCourse(foundCourse)
        setEditingHoles([...foundCourse.holes])
      }
    }
    setLoading(false)
  }, [courseId])

  const handleHoleChange = (holeNumber: number, field: 'par' | 'handicap', value: number) => {
    const newHoles = [...editingHoles]
    const holeIndex = newHoles.findIndex(h => h.holeNumber === holeNumber)
    if (holeIndex >= 0) {
      newHoles[holeIndex][field] = value
      setEditingHoles(newHoles)
    }
  }

  const handleSaveChanges = () => {
    if (!course) return

    const updatedCourse: Course = {
      ...course,
      par: editingHoles.reduce((sum, h) => sum + h.par, 0),
      holes: editingHoles,
    }

    // Update in localStorage
    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      const index = courses.findIndex((c: Course) => c.id === courseId)
      if (index >= 0) {
        courses[index] = updatedCourse
        localStorage.setItem('golfCourses', JSON.stringify(courses))
        setCourse(updatedCourse)
        setIsEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }
  }

  const handleStartRound = async () => {
    if (course) {
      try {
        console.log('🎯 CourseDetails - Starting round with course:', {
          name: course.name,
          id: course.id,
          holesLength: course.holes?.length,
          hasHoles: Array.isArray(course.holes),
        })
        
        // Store course in localStorage
        localStorage.setItem('selectedCourse', JSON.stringify(course))
        console.log('✅ CourseDetails - Course saved to localStorage. Navigating to /new-round')
        
        // Use Next.js router instead of window.location.href for better reliability
        router.push('/new-round')
      } catch (error) {
        console.error('❌ CourseDetails - Error starting round:', error)
        alert('Error starting round. Please try again.')
      }
    } else {
      console.error('❌ CourseDetails - No course object available!')
      alert('Course data is missing. Please refresh and try again.')
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading course...</p>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500 text-lg mb-4">Course not found</p>
          <Link href="/manage-courses">
            <button className="btn-primary">Back to Courses</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* Course Header */}
      <div className="card mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">{course.name}</h1>
            <p className="text-gray-600 text-lg">{course.location}, {course.state}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-600 text-sm">Par</p>
            <p className="text-3xl font-bold">{course.par}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <p className="text-gray-600 text-sm">Holes</p>
            <p className="text-2xl font-bold">{course.holes.length}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-sm">Average Par</p>
            <p className="text-2xl font-bold">{course.holes.length > 0 ? (course.holes.reduce((sum, h) => sum + h.par, 0) / course.holes.length).toFixed(1) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-sm">Type</p>
            <p className="text-2xl font-bold">{course.holes.length === 18 ? 'Full' : 'Executive'}</p>
          </div>
        </div>

        {/* Status Messages */}
        {saved && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
            ✅ Changes saved successfully!
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleStartRound}
            className="btn-primary flex-1"
          >
            🎯 Start Round
          </button>
          {!isEditing ? (
            <button
              onClick={() => {
                // Initialize holes if they don't exist when entering edit mode
                if (editingHoles.length === 0 && course) {
                  const newHoles = Array.from({ length: course.holeCount }, (_, i) => ({
                    holeNumber: i + 1,
                    par: 4,
                    handicap: i + 1,
                  }))
                  setEditingHoles(newHoles)
                }
                setIsEditing(true)
              }}
              className="btn-secondary flex-1"
            >
              ✏️ Edit Holes
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveChanges}
                className="btn-primary flex-1"
              >
                💾 Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditingHoles([...course.holes])
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </>
          )}
          <Link href="/manage-courses" className="flex-1">
            <button className="btn-primary w-full">
              ← Back
            </button>
          </Link>
        </div>
      </div>

      {/* Score Card - Editable or View Only */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Score Card {isEditing && '(Editing)'}</h2>
        
        {isEditing ? (
          // Editable Grid
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editingHoles.map((hole) => (
                <div key={hole.holeNumber} className="border p-4 rounded bg-blue-50">
                  <h4 className="font-bold mb-3 text-lg">Hole {hole.holeNumber}</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-semibold block mb-1">Par</label>
                      <select
                        value={String(hole.par)}
                        onChange={(e) => handleHoleChange(hole.holeNumber, 'par', parseInt(e.target.value))}
                        className="input-field mt-1"
                      >
                        <option value="3">Par 3</option>
                        <option value="4">Par 4</option>
                        <option value="5">Par 5</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold block mb-1">Handicap Index</label>
                      <input
                        type="number"
                        value={String(hole.handicap)}
                        onChange={(e) => handleHoleChange(hole.holeNumber, 'handicap', parseInt(e.target.value) || 0)}
                        min="1"
                        max={course.holeCount}
                        className="input-field mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Mode Summary */}
            <div className="mt-6 pt-6 border-t bg-gray-50 p-4 rounded">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Total Par</p>
                  <p className="text-2xl font-bold">{editingHoles.reduce((sum, h) => sum + h.par, 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Holes</p>
                  <p className="text-2xl font-bold">{editingHoles.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Average Par</p>
                  <p className="text-2xl font-bold">{editingHoles.length > 0 ? (editingHoles.reduce((sum, h) => sum + h.par, 0) / editingHoles.length).toFixed(1) : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // View Only Table - Separated Front 9 and Back 9
          <>
            {/* Front 9 Table */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4">Front 9</h3>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs md:text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="text-center px-1 md:px-3 py-1 md:py-2 text-xs md:text-sm">Hole</th>
                      {course.holes.slice(0, 9).map((hole) => (
                        <th key={hole.holeNumber} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm font-semibold">
                          {hole.holeNumber}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Par</td>
                      {course.holes.slice(0, 9).map((hole) => (
                        <td key={`par-${hole.holeNumber}`} className="text-center font-bold px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                          {hole.par}
                        </td>
                      ))}
                    </tr>
                    <tr className="hidden md:table-row border-b">
                      <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Yds</td>
                      {course.holes.slice(0, 9).map((hole) => (
                        <td key={`yds-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                          {hole.yardage || '—'}
                        </td>
                      ))}
                    </tr>
                    <tr className="hidden md:table-row">
                      <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">HCP</td>
                      {course.holes.slice(0, 9).map((hole) => (
                        <td key={`hcp-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                          {hole.handicap}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Back 9 Table */}
            {course.holes.length > 9 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4">Back 9</h3>
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-xs md:text-sm">
                    <thead className="table-header">
                      <tr>
                        <th className="text-center px-1 md:px-3 py-1 md:py-2 text-xs md:text-sm">Hole</th>
                        {course.holes.slice(9, 18).map((hole) => (
                          <th key={hole.holeNumber} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm font-semibold">
                            {hole.holeNumber}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Par</td>
                        {course.holes.slice(9, 18).map((hole) => (
                          <td key={`par-${hole.holeNumber}`} className="text-center font-bold px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                            {hole.par}
                          </td>
                        ))}
                      </tr>
                      <tr className="hidden md:table-row border-b">
                        <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">Yds</td>
                        {course.holes.slice(9, 18).map((hole) => (
                          <td key={`yds-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                            {hole.yardage || '—'}
                          </td>
                        ))}
                      </tr>
                      <tr className="hidden md:table-row">
                        <td className="font-bold px-1 md:px-3 py-1 md:py-2 text-center text-xs">HCP</td>
                        {course.holes.slice(9, 18).map((hole) => (
                          <td key={`hcp-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                            {hole.handicap}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CourseDetails() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-6"><div className="card text-center"><p className="text-gray-500">Loading course...</p></div></div>}>
      <CourseDetailsContent />
    </Suspense>
  )
}
