// This file is deprecated - using local courses stored in localStorage instead
// Keeping for backwards compatibility only

import { Course } from '@/types'

export async function searchGolfCourses(query: string): Promise<Course[]> {
  // No longer using API - courses are managed locally
  return []
}
