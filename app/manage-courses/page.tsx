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
        <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg border border-white/20">
          <div className="flex justify-between items-center gap-2 mb-6 flex-wrap">
            <h2 className="text-xl font-bold text-gray-800">Available Courses</h2>
            <Link href="/add-course">
              <button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap shadow-md">➕ Add Course</button>
            </Link>
          </div>

          {courses.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500 text-lg mb-4">No courses added yet</p>
              <Link href="/add-course">
                <button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md">Add Your First Course</button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="border-b-2 border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-3 font-bold text-gray-700">Course</th>
                    <th className="text-left px-3 py-3 font-bold text-gray-700 hidden md:table-cell">Location</th>
                    <th className="text-center px-3 py-3 font-bold text-gray-700">Holes</th>
                    <th className="text-center px-3 py-3 font-bold text-gray-700">Par</th>
                    {currentUser?.is_admin && (
                      <th className="text-center px-3 py-3 font-bold text-gray-700">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <Link href={`/course-details?id=${course.id}`}>
                          <button
                            className="font-bold text-green-600 hover:underline text-left"
                          >
                            {course.name}
                          </button>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-gray-600 hidden md:table-cell text-sm">
                        {course.location}, {course.state}
                      </td>
                      <td className="text-center px-3 py-3 font-semibold text-gray-700">
                        {course.holes.length}
                      </td>
                      <td className="text-center px-3 py-3 font-semibold text-gray-700">
                        {course.par}
                      </td>
                      {currentUser?.is_admin && (
                        <td className="text-center px-3 py-3">
                          <div className="flex gap-2 justify-center">
                            <Link href={`/edit-course?id=${course.id}`}>
                              <button
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                              >
                                Edit
                              </button>
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                handleDelete(course.id)
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
