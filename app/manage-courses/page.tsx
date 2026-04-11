'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Course } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function ManageCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const auth = useAuth()

  useEffect(() => {
    // Get current user
    const user = auth.getCurrentUser()
    setCurrentUser(user)

    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      setCourses(JSON.parse(savedCourses))
    }
    setLoading(false)
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
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading courses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6">
      <div className="card mb-6">
        <div className="flex justify-between items-center gap-2 mb-6 flex-wrap">
          <h2 className="text-2xl font-bold">Select Course</h2>
          <Link href="/add-course">
            <button className="btn-primary whitespace-nowrap">➕ Add Course</button>
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 text-lg mb-4">No courses added yet</p>
            <Link href="/add-course">
              <button className="btn-primary">Add Your First Course</button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-3 py-2 md:py-3 font-semibold">Course</th>
                  <th className="text-left px-3 py-2 md:py-3 font-semibold hidden md:table-cell">Location</th>
                  <th className="text-center px-3 py-2 md:py-3 font-semibold">Holes</th>
                  <th className="text-center px-3 py-2 md:py-3 font-semibold">Par</th>
                  {currentUser?.is_admin && (
                    <th className="text-center px-3 py-2 md:py-3 font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} className="table-row border-b">
                    <td className="px-3 py-2 md:py-3">
                      <Link href={`/course-details?id=${course.id}`}>
                        <button
                          className="font-bold text-blue-600 hover:underline text-left"
                        >
                          {course.name}
                        </button>
                      </Link>
                    </td>
                    <td className="px-3 py-2 md:py-3 text-gray-600 hidden md:table-cell text-sm">
                      {course.location}, {course.state}
                    </td>
                    <td className="text-center px-3 py-2 md:py-3 font-semibold">
                      {course.holes.length}
                    </td>
                    <td className="text-center px-3 py-2 md:py-3 font-semibold">
                      {course.par}
                    </td>
                    {currentUser?.is_admin && (
                      <td className="text-center px-3 py-2 md:py-3">
                        <div className="flex gap-1 justify-center">
                          <Link href={`/edit-course?id=${course.id}`}>
                            <button
                              className="btn-primary text-xs px-2 py-1"
                            >
                              Edit
                            </button>
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              handleDelete(course.id)
                            }}
                            className="btn-primary text-xs px-2 py-1"
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
        <button className="btn-primary w-full">Back to Dashboard</button>
      </Link>
    </div>
  )
}
