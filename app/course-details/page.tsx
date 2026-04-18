'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Course } from '@/types'
import { COURSES_DATABASE } from '@/data/courses'
import PageWrapper from '@/components/PageWrapper'

function CourseDetailsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const courseId = searchParams ? searchParams.get('id') : null

  const [course, setCourse] = useState<Course | null>(null)
  const [editingHoles, setEditingHoles] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!courseId) return

    console.log('🔍 CourseDetails - Loading course with ID:', courseId)
    
    // First, try to find the course in COURSES_DATABASE (for new tee box structure)
    let foundCourse = COURSES_DATABASE.find((c: Course) => c.id === courseId)
    
    console.log('🔍 CourseDetails - Courses in COURSES_DATABASE:', COURSES_DATABASE.map((c: any) => ({ id: c.id, name: c.name })))
    console.log('🔍 CourseDetails - Found in COURSES_DATABASE?', !!foundCourse)
    
    // If not in COURSES_DATABASE, try localStorage
    if (!foundCourse) {
      const savedCourses = localStorage.getItem('golfCourses')
      if (savedCourses) {
        const courses = JSON.parse(savedCourses)
        foundCourse = courses.find((c: Course) => c.id === courseId)
        console.log('🔍 CourseDetails - Found in localStorage?', !!foundCourse)
      }
    }
    
    if (foundCourse) {
      console.log('✅ CourseDetails - Found course:', {
        name: foundCourse.name,
        id: foundCourse.id,
        holesCount: foundCourse.holes?.length,
        hasTeeTags: foundCourse.holes?.[0] && 'men' in foundCourse.holes[0],
        firstHole: foundCourse.holes?.[0]
      })
      setCourse(foundCourse)
      setEditingHoles([...foundCourse.holes])
    } else {
      console.error('❌ CourseDetails - Course not found with ID:', courseId)
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
        console.log('✅ CourseDetails - Course saved to localStorage. Navigating to /select-tee')
        
        // Navigate to tee selection instead of new-round
        router.push(`/select-tee?courseId=${course.id}`)
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
    <PageWrapper title={course.name} userName={`${course.location}, ${course.state}`}>
      {/* Compact Course Header */}
      <div className="card mb-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-gray-600 text-xs">Par</p>
            <p className="text-2xl font-bold">{course.par}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-xs">Holes</p>
            <p className="text-2xl font-bold">{course.holes.length}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-xs">Avg Par</p>
            <p className="text-2xl font-bold">{course.holes.length > 0 ? (course.holes.reduce((sum, h) => sum + h.par, 0) / course.holes.length).toFixed(1) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-xs">Type</p>
            <p className="text-2xl font-bold">{course.holes.length === 18 ? 'Full' : 'Exec'}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6 min-h-[44px]">
        <button
          onClick={handleStartRound}
          className="flex-1 bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base"
        >
          ▶️ Start Round
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
            className="flex-1 bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base"
          >
            ✏️ Edit
          </button>
        ) : (
          <>
            <button
              onClick={handleSaveChanges}
              className="flex-1 bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base"
            >
              💾 Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditingHoles([...course.holes])
              }}
              className="flex-1 bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base"
            >
              Cancel
            </button>
          </>
        )}
        <Link href="/manage-courses" className="flex-1">
          <button className="w-full h-full bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base">
            ← Back
          </button>
        </Link>
      </div>

      {/* Status Messages */}
      {saved && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          ✅ Changes saved successfully!
        </div>
      )}

      {/* Score Card - Editable or View Only */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Score Card {isEditing && '(Editing)'}</h2>
        
        {isEditing ? (
          // Editable Grid
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editingHoles.map((hole) => (
                <div key={hole.holeNumber} className="bg-green-900 bg-opacity-40 border-2 border-green-600 p-4 rounded-lg">
                  <h4 className="font-bold mb-4 text-lg text-white">Hole {hole.holeNumber}</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold block mb-2 text-white">Par</label>
                      <select
                        value={String(hole.par)}
                        onChange={(e) => handleHoleChange(hole.holeNumber, 'par', parseInt(e.target.value))}
                        className="input-field mt-1 font-semibold"
                      >
                        <option value="3">Par 3</option>
                        <option value="4">Par 4</option>
                        <option value="5">Par 5</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-bold block mb-2 text-white">Handicap Index</label>
                      <input
                        type="number"
                        value={String(hole.handicap)}
                        onChange={(e) => handleHoleChange(hole.holeNumber, 'handicap', parseInt(e.target.value) || 0)}
                        min="1"
                        max={course.holeCount}
                        className="input-field mt-1 font-semibold"
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
            {/* Front 9 Card */}
            <div className="card mb-6">
              <h3 className="text-xl font-bold mb-4">Front 9</h3>
              <div className="overflow-x-auto">
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
                      {course.holes.slice(0, 9).map((hole: any) => (
                        <td key={`yds-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                          {hole.men?.yardage || hole.yardage || '—'}
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

            {/* Back 9 Card */}
            {course.holes.length > 9 && (
              <div className="card mb-6">
                <h3 className="text-xl font-bold mb-4">Back 9</h3>
                <div className="overflow-x-auto">
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
                        {course.holes.slice(9, 18).map((hole: any) => (
                          <td key={`yds-${hole.holeNumber}`} className="text-center px-0.5 md:px-2 py-1 md:py-2 text-xs md:text-sm">
                            {hole.men?.yardage || hole.yardage || '—'}
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
    </PageWrapper>
  )
}

export default function CourseDetails() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-6"><div className="card text-center"><p className="text-gray-500">Loading course...</p></div></div>}>
      <CourseDetailsContent />
    </Suspense>
  )
}
