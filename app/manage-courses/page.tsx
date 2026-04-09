'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Course } from '@/types'

export default function ManageCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      setCourses(JSON.parse(savedCourses))
    }
    setLoading(false)
  }, [])

  const handleDelete = (courseId: string) => {
    if (confirm('Are you sure you want to Delete This?')) {
      const updated = courses.filter(c => c.id !== courseId)
      setCourses(updated)
      localStorage.setItem('golfCourses', JSON.stringify(updated))
    }
  }

  const handleSelectCourse = (course: Course) => {
    localStorage.setItem('selectedCourse', JSON.stringify(course))
    window.location.href = '/new-round'
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
    <div className="max-w-4xl mx-auto py-6">
      <div className="card mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Courses</h2>
          <Link href="/add-course">
            <button className="btn-primary">➕ Add Course</button>
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
          <div className="space-y-4">
            {courses.map((course) => (
              <Link key={course.id} href={`/course-details?id=${course.id}`}>
                <div className="border rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{course.name}</h3>
                      <p className="text-gray-600">{course.location}, {course.state}</p>
                      <div className="mt-2 flex gap-6 text-sm text-gray-600">
                        <span>⛳ {course.holeCount} Holes</span>
                        <span>📍 Par {course.par}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          handleDelete(course.id)
                        }}
                        className="btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Link href="/">
        <button className="btn-secondary w-full">Back to Dashboard</button>
      </Link>
    </div>
  )
}
