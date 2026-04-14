'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Course } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { COURSES_DATABASE } from '@/data/courses'
import PageWrapper from '@/components/PageWrapper'

export default function ManageCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const auth = useAuth()

  useEffect(() => {
    const loadCourses = async () => {
      // Get current user
      const user = auth.getCurrentUser()
      setCurrentUser(user)

      let coursesToDisplay: Course[] = []

      // PRIORITY: Always use COURSES_DATABASE as the source of truth for course structure
      // This ensures all courses have proper tee box data
      console.log('✅ Using COURSES_DATABASE as primary source:', COURSES_DATABASE.length, 'courses')
      coursesToDisplay = COURSES_DATABASE
      
      // Deduplicate courses by ID (keep first occurrence)
      const seenIds = new Set<string>()
      const uniqueCourses = coursesToDisplay.filter(course => {
        if (seenIds.has(course.id)) {
          console.warn(`⚠️ Removing duplicate course with ID: ${course.id}`)
          return false
        }
        seenIds.add(course.id)
        return true
      })
      
      localStorage.setItem('golfCourses', JSON.stringify(uniqueCourses))

      setCourses(uniqueCourses)
      setLoading(false)
    }

    loadCourses()
  }, [])

  const handleDelete = async (courseId: string) => {
    if (confirm('Are you sure you want to Delete This?')) {
      const updated = courses.filter(c => c.id !== courseId)
      setCourses(updated)
      localStorage.setItem('golfCourses', JSON.stringify(updated))

      // Delete from Supabase if configured
      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', courseId)

          if (error) {
            console.error('Error deleting course from Supabase:', error)
          } else {
            console.log('Course deleted from Supabase successfully')
          }
        } catch (error) {
          console.error('Error deleting course from Supabase:', error)
        }
      }
    }
  }

  if (loading) {
    return (
      <PageWrapper title="Select Course">
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
          <p className="text-gray-500">Loading courses...</p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Select Course">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-800">Available Courses</h2>
            <Link href="/add-course">
              <button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap shadow-md">➕ Add Course</button>
            </Link>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
              <p className="text-gray-500 text-lg mb-4">No courses added yet</p>
              <Link href="/add-course">
                <button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md">Add Your First Course</button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {courses.sort((a, b) => a.name.localeCompare(b.name)).map((course) => (
                <div key={course.id} className="bg-white/95 backdrop-blur rounded-xl p-3 shadow-md border border-white/20">
                  <div className="mb-2">
                    <Link href={`/course-details?id=${course.id}`}>
                      <h3 className="text-base font-bold text-green-600 hover:text-green-700 cursor-pointer mb-0.5">{course.name}</h3>
                    </Link>
                    <p className="text-xs text-gray-600">{course.location}, {course.state}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 bg-gray-50 rounded-lg p-2">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Holes</p>
                      <p className="text-base font-bold text-gray-800">{course.holes.length}</p>
                    </div>
                    <div className="text-center border-l border-r border-gray-200">
                      <p className="text-xs text-gray-500">Par</p>
                      <p className="text-base font-bold text-gray-800">{course.par}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Yards</p>
                      <p className="text-base font-bold text-gray-800">{course.holes.reduce((sum, h) => sum + h.men.yardage, 0)}</p>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <Link href={`/course-details?id=${course.id}`} className="flex-1">
                      <button className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-2 py-1.5 rounded-lg transition-colors">
                        View
                      </button>
                    </Link>
                    {currentUser?.is_admin && (
                      <>
                        <Link href={`/edit-course?id=${course.id}`} className="flex-1">
                          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2 py-1.5 rounded-lg transition-colors">
                            Edit
                          </button>
                        </Link>
                        <button
                          onClick={() => handleDelete(course.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-2 py-1.5 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Link href="/">
          <button className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20">Back to Dashboard</button>
        </Link>
      </div>
    </PageWrapper>
  )
}
