import { Course } from '@/types'

// Legacy file - no longer used. Courses are now loaded from COURSES_DATABASE in data/courses.ts
export const DEFAULT_COURSES: Course[] = []

export function initializeCoursesIfNeeded() {
  // No longer needed - courses are initialized in CourseInitializer.tsx from COURSES_DATABASE
}
