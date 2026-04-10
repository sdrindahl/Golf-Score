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

    // First, migrate any localStorage users that don't exist in Supabase
    await migrateLocalStorageUsersToSupabase()

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
      const { data: supabaseRounds, error: roundsError } = await supabase
        .from('rounds')
        .select('*')

      if (roundsError) throw roundsError

      if (supabaseRounds && supabaseRounds.length > 0) {
        // Convert from snake_case to camelCase for local storage
        const roundsInCamelCase = supabaseRounds.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name,
          courseId: r.course_id,
          courseName: r.course_name,
          date: r.date,
          scores: r.scores,
          totalScore: r.total_score,
          notes: r.notes
        }))
        localStorage.setItem('golfRounds', JSON.stringify(roundsInCamelCase))
        console.log(`Synced ${roundsInCamelCase.length} rounds from Supabase`)
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
 * Migrate users and rounds from localStorage to Supabase
 * This ensures users created before Supabase was configured still sync across devices
 */
async function migrateLocalStorageUsersToSupabase(): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return
  }

  try {
    // Get all users from Supabase
    const { data: supabaseUsers, error: usersError } = await supabase
      .from('users')
      .select('id')

    if (usersError) throw usersError

    const supabaseUserIds = new Set(supabaseUsers?.map(u => u.id) || [])

    // Get all users from localStorage
    const localStorageUsers: User[] = JSON.parse(localStorage.getItem('golfUsers') || '[]')

    // Migrate users that exist locally but not in Supabase
    const updatedLocalStorageUsers: User[] = []
    
    for (const user of localStorageUsers) {
      try {
        // Check if user with this name already exists in Supabase
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('name', user.name)

        if (checkError && checkError.code !== 'PGRST116') throw checkError

        if (existingUser && existingUser.length > 0) {
          // User already exists by name, update local ID to match Supabase ID
          updatedLocalStorageUsers.push({ ...user, id: existingUser[0].id })
          console.log(`User ${user.name} already exists in Supabase`)
        } else {
          // User doesn't exist, insert without ID and let Supabase generate UUID
          const { data, error } = await supabase
            .from('users')
            .insert([{ name: user.name, password: user.password }])
            .select()

          if (error) throw error
          
          if (data && data.length > 0) {
            updatedLocalStorageUsers.push({ ...user, id: data[0].id })
            console.log(`Migrated user to Supabase: ${user.name}`)
            supabaseUserIds.add(data[0].id)
          }
        }
      } catch (error) {
        console.error(`Error migrating user ${user.name}:`, error)
        // Keep original if migration fails
        updatedLocalStorageUsers.push(user)
      }
    }
    
    // Update localStorage with corrected IDs from Supabase
    if (updatedLocalStorageUsers.length > 0) {
      localStorage.setItem('golfUsers', JSON.stringify(updatedLocalStorageUsers))
    }

    // Migrate rounds
    const { data: supabaseRounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id')

    if (roundsError) throw roundsError

    const supabaseRoundIds = new Set(supabaseRounds?.map(r => r.id) || [])
    const localStorageRounds: Round[] = JSON.parse(localStorage.getItem('golfRounds') || '[]')
    
    // Create a map of old user IDs to new UUID IDs for updating round references
    const userIdMap = new Map<string, string>()
    for (let i = 0; i < localStorageUsers.length; i++) {
      if (updatedLocalStorageUsers[i]) {
        userIdMap.set(localStorageUsers[i].id, updatedLocalStorageUsers[i].id)
      }
    }

    // Migrate rounds - don't send ID, let Supabase generate it
    const updatedLocalStorageRounds: Round[] = []
    
    for (const round of localStorageRounds) {
      try {
        // Update the userId reference if it changed during migration
        const updatedRound = {
          ...round,
          userId: userIdMap.get(round.userId) || round.userId
        }
        
        // Convert to Supabase format (without ID, let it generate)
        const { id, ...roundWithoutId } = roundToSupabase(updatedRound)
        
        // Insert without ID and let Supabase generate UUID
        const { data, error } = await supabase
          .from('rounds')
          .insert([roundWithoutId])
          .select()

        if (error) throw error
        
        if (data && data.length > 0) {
          updatedLocalStorageRounds.push({ ...updatedRound, id: data[0].id })
          console.log(`Migrated round to Supabase: ${round.id}`)
          supabaseRoundIds.add(data[0].id)
        }
      } catch (error) {
        console.error(`Error migrating round ${round.id}:`, error)
        // Keep original if migration fails
        updatedLocalStorageRounds.push(round)
      }
    }
    
    // Update localStorage with corrected round IDs from Supabase
    if (updatedLocalStorageRounds.length > 0) {
      localStorage.setItem('golfRounds', JSON.stringify(updatedLocalStorageRounds))
    }

    console.log('Local storage migration to Supabase complete')
  } catch (error) {
    console.error('Error during local storage migration:', error)
  }
}

/**
 * Save a round to Supabase
 */
/**
 * Convert Round object from camelCase to snake_case for Supabase
 */
function roundToSupabase(round: Round) {
  return {
    id: round.id,
    user_id: round.userId,
    user_name: round.userName,
    course_id: round.courseId,
    course_name: round.courseName,
    date: round.date,
    scores: round.scores,
    total_score: round.totalScore,
    notes: round.notes || null
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
      .insert([roundToSupabase(round)])

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
    const supabaseRound = roundToSupabase(round)
    // Remove id from update object (can't update primary key)
    const { id, ...updateData } = supabaseRound

    const { error } = await supabase
      .from('rounds')
      .update(updateData)
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
