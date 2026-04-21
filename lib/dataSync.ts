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
 * Delete a course (client stub)
 *
 * This function is now a stub. All Supabase logic must be handled via API routes or server files.
 */
export async function deleteCourseFromSupabase(courseId: string): Promise<void> {
  // No-op: Supabase logic removed from client bundle
  console.warn('deleteCourseFromSupabase is a client stub. Use API route for server actions.')
}

/**
 * Sync all courses (client stub)
 *
 * This function is now a stub. All Supabase logic must be handled via API routes or server files.
 */
export async function syncCoursesToSupabase(courses: any[]): Promise<void> {
  // No-op: Supabase logic removed from client bundle
  console.warn('syncCoursesToSupabase is a client stub. Use API route for server actions.')
}
