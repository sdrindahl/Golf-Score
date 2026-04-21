import { Round } from '@/types';
/**



// All Supabase/server-only code has been moved to lib/dataSync.server.ts or API routes.
// Only client-safe helpers or localStorage logic should remain here.

// Example: get rounds from localStorage
export function getLocalRounds(): Round[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem('golfRounds') || '[]');
  } catch {
    return [];
  }
}

/**
 * Save a round to Supabase
 */

/**
 * Delete a round from Supabase
 */

/**
 * Ensure totalScore matches the sum of scores (data integrity check)
 */
function ensureValidTotalScore(round: Round): Round {
  const calculatedTotal = round.scores.reduce((a, b) => a + b, 0)
  if (round.totalScore !== calculatedTotal) {
    console.warn('⚠️ Total score mismatch detected:', {
      stored: round.totalScore,
      calculated: calculatedTotal,
      roundId: round.id
    })
    return {
      ...round,
      totalScore: calculatedTotal
    }
  }
  return round
}

/**
 * Update a round in Supabase
 */

/**
 * Save a course to Supabase
 */

/**
 * Update a course in Supabase
 */

/**
 * Delete a course from Supabase and local storage
 */
export async function deleteCourseFromSupabase(courseId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured, course deletion local only')
    return
  }

  try {
    console.log(`🗑️ Deleting course ${courseId} from Supabase...`)
    
    // Delete from Supabase
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)

    if (error) {
      console.error('Supabase error deleting course:', error)
      throw error
    }
    
    console.log(`✅ Course ${courseId} successfully deleted from Supabase`)
  } catch (error) {
    console.error('Error deleting course from Supabase:', error)
    throw error
  }
}

/**
 * Sync all courses to Supabase
 */
export async function syncCoursesToSupabase(courses: Course[]): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  try {
    for (const course of courses) {
      // Only send fields that exist in Supabase table
      const courseData = {
        id: course.id,
        name: course.name,
        par: course.par,
        hole_count: course.holeCount,
        holes: course.holes,
      }
      
      const { error } = await supabase
        .from('courses')
        .upsert([courseData])

      if (error) throw error
    }
    console.log(`Synced ${courses.length} courses to Supabase`)
  } catch (error) {
    console.error('Error syncing courses to Supabase:', error)
  }
}
