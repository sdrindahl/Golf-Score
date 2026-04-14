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
  const [favorites, setFavorites] = useState<string[]>([])
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

      // Load favorites from localStorage
      const savedFavorites = localStorage.getItem('favoriteCourses')
      const favoriteIds = savedFavorites ? JSON.parse(savedFavorites) : []
      setFavorites(favoriteIds)

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

  const toggleFavorite = (courseId: string) => {
    const newFavorites = favorites.includes(courseId)
      ? favorites.filter(id => id !== courseId)
      : [...favorites, courseId]
    setFavorites(newFavorites)
    localStorage.setItem('favoriteCourses', JSON.stringify(newFavorites))
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

          {/* Favorite Courses Section */}
          {favorites.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-800">⭐ Favorite Courses</h3>
              <div className="space-y-3">
                {courses
                  .filter(c => favorites.includes(c.id))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((course) => (
                    <Link key={course.id} href={`/course-details?id=${course.id}`}>
                      <div className="bg-green-50 rounded-lg m-0.5 p-2.5 shadow-md border-l-4 border-l-green-600 cursor-pointer hover:shadow-lg transition-all active:scale-95">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 mb-1">{course.location}, {course.state}</p>
                            <p className="font-semibold text-gray-800 truncate text-sm md:text-base">{course.name}</p>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3 ml-2 md:ml-4">
                            <div className="text-right">
                              <p className="text-base md:text-lg font-bold text-gray-800">{course.holes.length}</p>
                              <p className="text-xs text-gray-500">Holes</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleFavorite(course.id)
                              }}
                              className="text-xl md:text-2xl hover:scale-110 transition-transform flex-shrink-0"
                            >
                              ⭐
                            </button>
                          </div>
                        </div>

                        {currentUser?.is_admin && (
                          <div className="flex gap-1.5 mt-2">
                            <Link href={`/edit-course?id=${course.id}`} onClick={(e) => e.stopPropagation()} className="flex-1">
                              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-1 py-0.5 rounded-sm transition-colors">
                                Edit
                              </button>
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDelete(course.id)
                              }}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-1 py-0.5 rounded-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {courses.length === 0 ? (
            <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
              <p className="text-gray-500 text-lg mb-4">No courses added yet</p>
              <Link href="/add-course">
                <button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md">Add Your First Course</button>
              </Link>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">All Courses</h3>
              <div className="space-y-3">
                {courses
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((course) => (
                    <Link key={course.id} href={`/course-details?id=${course.id}`}>
                      <div className={`rounded-lg m-0.5 p-2.5 shadow-md border-l-4 border-l-green-600 cursor-pointer hover:shadow-lg transition-all active:scale-95 ${favorites.includes(course.id) ? 'bg-green-50' : 'bg-white'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 mb-1">{course.location}, {course.state}</p>
                            <p className="font-semibold text-gray-800 truncate text-sm md:text-base">{course.name}</p>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3 ml-2 md:ml-4">
                            <div className="text-right">
                              <p className="text-base md:text-lg font-bold text-gray-800">{course.holes.length}</p>
                              <p className="text-xs text-gray-500">Holes</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleFavorite(course.id)
                              }}
                              className="text-xl md:text-2xl hover:scale-110 transition-transform flex-shrink-0"
                            >
                              {favorites.includes(course.id) ? '⭐' : '☆'}
                            </button>
                          </div>
                        </div>

                        {currentUser?.is_admin && (
                          <div className="flex gap-1.5 mt-2">
                            <Link href={`/edit-course?id=${course.id}`} onClick={(e) => e.stopPropagation()} className="flex-1">
                              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-1 py-0.5 rounded-sm transition-colors">
                                Edit
                              </button>
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDelete(course.id)
                              }}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-1 py-0.5 rounded-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>

        <Link href="/">
          <button className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20">Home</button>
        </Link>
      </div>
    </PageWrapper>
  )
}
