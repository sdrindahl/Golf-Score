'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Course } from '@/types'

export default function CourseSearch() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [displayedCourses, setDisplayedCourses] = useState<Course[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])

  useEffect(() => {
    // Load courses from localStorage
    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      setAllCourses(JSON.parse(savedCourses))
    }
  }, [])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setDisplayedCourses([])
      return
    }

    const filtered = allCourses.filter(course =>
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.state.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setDisplayedCourses(filtered)
  }, [searchTerm, allCourses])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
      <div className="md:col-span-2">
        <div className="card mb-6">
          <h2 className="text-2xl font-bold mb-4">My Courses</h2>
          <input
            type="text"
            placeholder="Search by course name, city, or state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field mb-4"
          />
          <p className="text-gray-600 text-sm">
            📍 {allCourses.length} course{allCourses.length !== 1 ? 's' : ''} added
          </p>
          {allCourses.length === 0 && (
            <Link href="/add-course" className="inline-block mt-4">
              <button className="btn-primary">➕ Add Your First Course</button>
            </Link>
          )}
        </div>

        <div className="space-y-4">
          {displayedCourses.length > 0 ? (
            displayedCourses.map((course) => (
              <div
                key={course.id}
                className={`card cursor-pointer transition-all ${
                  selectedCourse?.id === course.id ? 'ring-2 ring-green-500 bg-green-50' : ''
                }`}
                onClick={() => setSelectedCourse(course)}
              >
                <h3 className="text-lg font-bold">{course.name}</h3>
                <div className="mt-2 flex gap-4 text-sm">
                  <span>⛳ {course.holeCount} Holes</span>
                  <span>📍 Par {course.par}</span>
                </div>
              </div>
            ))
          ) : searchTerm && allCourses.length > 0 ? (
            <div className="card text-center text-gray-500">
              No courses match your search.
            </div>
          ) : allCourses.length === 0 ? (
            <div className="card text-center text-gray-500">
              No courses added yet. Add courses to get started.
            </div>
          ) : (
            <div className="card text-center text-gray-500">
              Start typing to search your courses.
            </div>
          )}
        </div>
      </div>

      <div>
        {selectedCourse ? (
          <div className="card sticky top-20">
            <h3 className="text-xl font-bold mb-4">{selectedCourse.name}</h3>
            <div className="space-y-3 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Holes</p>
                <p className="font-semibold">{selectedCourse.holeCount}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Par</p>
                <p className="font-semibold">{selectedCourse.par}</p>
              </div>
            </div>
            <button
              onClick={() => {
                try {
                  console.log('🎯 CourseSearch - Starting round with course:', {
                    name: selectedCourse.name,
                    id: selectedCourse.id,
                    holesLength: selectedCourse.holes?.length,
                    hasHoles: Array.isArray(selectedCourse.holes)
                  })
                  localStorage.setItem('selectedCourse', JSON.stringify(selectedCourse))
                  console.log('✅ CourseSearch - Course saved to localStorage. Navigating to /new-round')
                  router.push('/new-round')
                } catch (error) {
                  console.error('❌ CourseSearch - Error starting round:', error)
                  alert('Error starting round. Please try again.')
                }
              }}
              className="btn-primary w-full"
            >
              Record Score at this Course
            </button>
          </div>
        ) : (
          <div className="card text-center text-gray-500">
            Select a course to get started
          </div>
        )}
      </div>
    </div>
  )
}
