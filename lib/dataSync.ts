import { User, Round, Course } from '@/types'
import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Sync service to keep localStorage in sync with Supabase
 * Runs on app initialization to load all data from database
 */

export async function syncDataFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    // Supabase not configured, use localStorage only
    return
  }

  try {
    console.log('Syncing data from Supabase...')

    // Sync users
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')

      if (usersError) throw usersError

      if (users && users.length > 0) {
        localStorage.setItem('golfUsers', JSON.stringify(users))
        console.log(`Synced ${users.length} users from Supabase`)
      }
    } catch (error) {
      console.error('Error syncing users:', error)
    }

    // Sync rounds
    try {
      const { data: rounds, error: roundsError } = await supabase
        .from('rounds')
        .select('*')

      if (roundsError) throw roundsError

      if (rounds && rounds.length > 0) {
        localStorage.setItem('golfRounds', JSON.stringify(rounds))
        console.log(`Synced ${rounds.length} rounds from Supabase`)
      }
    } catch (error) {
      console.error('Error syncing rounds:', error)
    }

    // Sync courses
    try {
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('*')

      if (coursesError) throw coursesError

      if (courses && courses.length > 0) {
        localStorage.setItem('golfCourses', JSON.stringify(courses))
        console.log(`Synced ${courses.length} courses from Supabase`)
      }
    } catch (error) {
      console.error('Error syncing courses:', error)
    }
  } catch (error) {
    console.error('Error during Supabase sync:', error)
    // Continue with localStorage data if sync fails
  }
}

/**
 * Save a round to Supabase
 */
export async function saveRoundToSupabase(round: Round): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  try {
    const { error } = await supabase
      .from('rounds')
      .insert([round])

    if (error) throw error
    console.log('Round saved to Supabase:', round.id)
  } catch (error) {
    console.error('Error saving round to Supabase:', error)
    // Continue - data will be in localStorage
  }
}

/**
 * Delete a round from Supabase
 */
export async function deleteRoundFromSupabase(roundId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  try {
    const { error } = await supabase
      .from('rounds')
      .delete()
      .eq('id', roundId)

    if (error) throw error
    console.log('Round deleted from Supabase:', roundId)
  } catch (error) {
    console.error('Error deleting round from Supabase:', error)
  }
}

/**
 * Update a round in Supabase
 */
export async function updateRoundInSupabase(round: Round): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  try {
    const { error } = await supabase
      .from('rounds')
      .update(round)
      .eq('id', round.id)

    if (error) throw error
    console.log('Round updated in Supabase:', round.id)
  } catch (error) {
    console.error('Error updating round in Supabase:', error)
  }
}

/**
 * Save a course to Supabase
 */
export async function saveCourseToSupabase(course: Course): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  try {
    const { error } = await supabase
      .from('courses')
      .insert([course])

    if (error) throw error
    console.log('Course saved to Supabase:', course.id)
  } catch (error) {
    console.error('Error saving course to Supabase:', error)
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
      const { error } = await supabase
        .from('courses')
        .upsert([course])

      if (error) throw error
    }
    console.log(`Synced ${courses.length} courses to Supabase`)
  } catch (error) {
    console.error('Error syncing courses to Supabase:', error)
  }
}
