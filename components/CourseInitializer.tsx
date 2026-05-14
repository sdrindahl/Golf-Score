'use client'

import { useEffect } from 'react'
import { COURSES_DATABASE } from '@/data/courses'

export default function CourseInitializer() {
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Cleanup duplicates in localStorage
        const deduplicateFlag = localStorage.getItem('_deduplicated_courses_v1')
        if (!deduplicateFlag) {
          const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')
          const seenIds = new Set<string>()
          const deduped = courses.filter((c: any) => {
            if (seenIds.has(c.id)) {
              console.log(`🧹 Removing duplicate course: ${c.name} (${c.id})`)
              return false
            }
            seenIds.add(c.id)
            return true
          })
          
          if (deduped.length < courses.length) {
            console.log(`✅ Deduplicated courses: ${courses.length} → ${deduped.length}`)
            localStorage.setItem('golfCourses', JSON.stringify(deduped))
          }
          localStorage.setItem('_deduplicated_courses_v1', '1')
        }

        // One-time cleanup: clear localStorage for New3 test user to prevent re-migration
        const cleanupFlag = localStorage.getItem('_cleaned_new3_test_data')
        if (!cleanupFlag) {
          const rounds = JSON.parse(localStorage.getItem('golfRounds') || '[]')
          const new3Rounds = rounds.filter((r: any) => r.userId === 'New3')
          if (new3Rounds.length > 0) {
            console.log(`🧹 Cleaning up ${new3Rounds.length} test rounds for New3 user`)
            const cleanedRounds = rounds.filter((r: any) => r.userId !== 'New3')
            localStorage.setItem('golfRounds', JSON.stringify(cleanedRounds))
          }
          localStorage.setItem('_cleaned_new3_test_data', '1')
        }

        // First, sync data from Supabase (if available) via API route
        await fetch('/api/sync', { method: 'POST' })
      } catch (error) {
        console.error('Error syncing from Supabase:', error)
      }

      // Then ensure local data is initialized
      const existingCourses = localStorage.getItem('golfCourses')

      if (!existingCourses) {
        localStorage.setItem('golfCourses', JSON.stringify(COURSES_DATABASE))
      } else {
        try {
          const courses = JSON.parse(existingCourses)
          // If courses exist but are empty, reinitialize with defaults
          if (Array.isArray(courses) && courses.length === 0) {
            localStorage.setItem('golfCourses', JSON.stringify(COURSES_DATABASE))
          } else if (Array.isArray(courses)) {
            // Overwrite all official courses (by id) with the latest from COURSES_DATABASE
            const dbById = Object.fromEntries(COURSES_DATABASE.map(c => [c.id, c]))
            const merged = courses.map((course: any) => {
              if (dbById[course.id]) {
                // Overwrite with latest official data
                return dbById[course.id]
              }
              // Preserve user-created/custom courses
              return course
            })
            // Add any new official courses not present in localStorage
            for (const newCourse of COURSES_DATABASE) {
              if (!merged.some((c: any) => c.id === newCourse.id)) {
                merged.push(newCourse)
                console.log(`🆕 Added new course to localStorage: ${newCourse.name} (${newCourse.id})`)
              }
            }
            // If any changes occurred, update localStorage
            if (JSON.stringify(courses) !== JSON.stringify(merged)) {
              console.log('💾 CourseInitializer - Synced all official courses to latest version')
              localStorage.setItem('golfCourses', JSON.stringify(merged))
            }
          }
        } catch (error) {
          // If localStorage is corrupted, reinitialize
          localStorage.setItem('golfCourses', JSON.stringify(COURSES_DATABASE))
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

      // Sync ONLY hardcoded courses to Supabase to ensure they exist for foreign key constraints
      // This prevents syncing stale/deleted courses back to Supabase
      try {
        const hardcodedCourseIds = new Set(COURSES_DATABASE.map(c => c.id))
        console.log(`📤 Syncing ${COURSES_DATABASE.length} hardcoded courses to Supabase...`)
        for (const course of COURSES_DATABASE) {
          // Fire and forget - don't wait for each one
          // saveCourseToSupabase(course).catch(error => {
          //   // Courses might already exist, that's fine
          //   console.log(`Note: Course ${course.id} already in Supabase or sync skipped`)
          // })
        }
      } catch (error) {
        console.error('Error syncing courses to Supabase:', error)
      }
    }

    initializeData()
  }, [])

  return null
}
