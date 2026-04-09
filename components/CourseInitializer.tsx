'use client'

import { useEffect } from 'react'
import { DEFAULT_COURSES } from '@/lib/initializeCourses'

export default function CourseInitializer() {
  useEffect(() => {
    // Always ensure courses are initialized on every page load
    const existingCourses = localStorage.getItem('golfCourses')
    
    if (!existingCourses) {
      localStorage.setItem('golfCourses', JSON.stringify(DEFAULT_COURSES))
    } else {
      try {
        const courses = JSON.parse(existingCourses)
        // If courses exist but are empty, reinitialize
        if (Array.isArray(courses) && courses.length === 0) {
          localStorage.setItem('golfCourses', JSON.stringify(DEFAULT_COURSES))
        }
      } catch (error) {
        // If localStorage is corrupted, reinitialize
        localStorage.setItem('golfCourses', JSON.stringify(DEFAULT_COURSES))
      }
    }

    // Also ensure golfRounds exists (even if empty)
    if (!localStorage.getItem('golfRounds')) {
      localStorage.setItem('golfRounds', JSON.stringify([]))
    }
  }, [])

  return null
}
