'use client'

import { useEffect } from 'react'
import { COURSES_DATABASE } from '@/data/courses'
import { syncDataFromSupabase, saveCourseToSupabase } from '@/lib/dataSync'

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

        // First, sync data from Supabase (if available)
        await syncDataFromSupabase()
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
            // Migrate old courses to new tee box structure
            const migratedCourses = courses.map((course: any) => {
              if (!course.holes || course.holes.length === 0) return course
              
              const firstHole = course.holes[0]
              // Check if holes have old structure (flat yardage) instead of tee boxes
              if (firstHole && 'yardage' in firstHole && !('men' in firstHole)) {
                console.log(`⚠️ CourseInitializer - Migrating course ${course.name} to new tee box structure`)
                // Find the matching course from COURSES_DATABASE to get the proper structure
                const sourceCourse = COURSES_DATABASE.find(c => c.id === course.id)
                if (sourceCourse) {
                  return sourceCourse
                }
              }
              return course
            })
            
            // If any migrations occurred, update localStorage
            if (JSON.stringify(courses) !== JSON.stringify(migratedCourses)) {
              console.log('💾 CourseInitializer - Updated courses to new structure')
              localStorage.setItem('golfCourses', JSON.stringify(migratedCourses))
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

      // Sync courses to Supabase to ensure they exist for foreign key constraints
      try {
        const localCoursesStr = localStorage.getItem('golfCourses')
        if (localCoursesStr) {
          const localCourses = JSON.parse(localCoursesStr)
          console.log(`📤 Syncing ${localCourses.length} courses to Supabase...`)
          for (const course of localCourses) {
            // Fire and forget - don't wait for each one
            saveCourseToSupabase(course).catch(error => {
              // Courses might already exist, that's fine
              console.log(`Note: Course ${course.id} already in Supabase or sync skipped`)
            })
          }
        }
      } catch (error) {
        console.error('Error syncing courses to Supabase:', error)
      }
    }

    initializeData()
  }, [])

  return null
}
