'use client'

import { useEffect } from 'react'
import { DEFAULT_COURSES } from '@/lib/initializeCourses'
import { syncDataFromSupabase } from '@/lib/dataSync'

export default function CourseInitializer() {
  useEffect(() => {
    const initializeData = async () => {
      try {
        // First, sync data from Supabase (if available)
        await syncDataFromSupabase()
      } catch (error) {
        console.error('Error syncing from Supabase:', error)
      }

      // Then ensure local data is initialized
      const existingCourses = localStorage.getItem('golfCourses')

      if (!existingCourses) {
        localStorage.setItem('golfCourses', JSON.stringify(DEFAULT_COURSES))
      } else {
        try {
          const courses = JSON.parse(existingCourses)
          // If courses exist but are empty, reinitialize with defaults
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

      // Ensure golfUsers exists (even if empty)
      if (!localStorage.getItem('golfUsers')) {
        localStorage.setItem('golfUsers', JSON.stringify([]))
      }
    }

    initializeData()
  }, [])

  return null
}
