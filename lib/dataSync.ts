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
    // DISABLED: Migration was causing duplicate inserts on every sync
    // await migrateLocalStorageUsersToSupabase()

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
      console.log('📥 Fetching rounds from Supabase...')
      const { data: supabaseRounds, error: roundsError } = await supabase
        .from('rounds')
        .select('id, user_id, user_name, course_id, course_name, selected_tee, date, scores, total_score, notes')

      if (roundsError) {
        console.error('❌ Rounds query error:', {
          code: roundsError.code,
          message: roundsError.message,
          details: roundsError.details,
          hint: roundsError.hint
        })
        throw roundsError
      }

      if (supabaseRounds && supabaseRounds.length > 0) {
        // Convert from snake_case to camelCase for local storage
        const roundsInCamelCase = supabaseRounds.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name,
          courseId: r.course_id,
          courseName: r.course_name,
          selectedTee: r.selected_tee,
          date: r.date,
          scores: r.scores,
          totalScore: r.total_score,
          notes: r.notes
        }))

        console.log(`📊 Synced ${roundsInCamelCase.length} rounds from Supabase`, roundsInCamelCase)

        // Merge with existing local rounds
        const existingLocal = localStorage.getItem('golfRounds')
        const localRounds = existingLocal ? JSON.parse(existingLocal) : []
        
        // Create a map of Supabase rounds for efficient lookup
        const supabaseRoundMap = new Map(roundsInCamelCase.map(r => [r.id, r]))
        
        // Keep rounds from Supabase and new local rounds
        const now = Date.now()
        const fiveMinutesAgo = now - (5 * 60 * 1000) // 5 minute window for new rounds
        
        // Update local rounds: use Supabase version if it exists, remove if it's old and not in Supabase
        const mergedRounds = localRounds.filter((localRound: any) => {
          const roundId = parseInt(localRound.id)
          const wasCreatedRecently = roundId > fiveMinutesAgo
          const existsInSupabase = supabaseRoundMap.has(localRound.id)
          
          // Keep if: it's in Supabase OR it was created recently (still syncing)
          return existsInSupabase || wasCreatedRecently
        }).map((localRound: any) => 
          // Use Supabase version if available (more up-to-date), otherwise keep local
          supabaseRoundMap.get(localRound.id) || localRound
        )
        
        // Add any Supabase rounds that don't exist locally
        for (const supabaseRound of roundsInCamelCase) {
          if (!mergedRounds.some((r: any) => r.id === supabaseRound.id)) {
            mergedRounds.push(supabaseRound)
          }
        }
        
        localStorage.setItem('golfRounds', JSON.stringify(mergedRounds))
        console.log(`✅ Merged rounds: ${mergedRounds.length} total (${roundsInCamelCase.length} from Supabase)`)
      } else {
        // Clear localStorage if Supabase has no rounds (prevents stale cached data)
        localStorage.setItem('golfRounds', JSON.stringify([]))
        console.log('ℹ️ No rounds found in Supabase - cleared local cache')
      }
    } catch (error) {
      console.error('Error syncing rounds:', error)
    }

    // Sync courses
    try {
      const { data: supabaseCourses, error: coursesError } = await supabase
        .from('courses')
        .select('id, name, par, hole_count, holes')

      if (coursesError) {
        console.error('❌ Courses query error:', {
          code: coursesError.code,
          message: coursesError.message,
          details: coursesError.details,
          hint: coursesError.hint
        })
        throw coursesError
      }

      if (supabaseCourses && supabaseCourses.length > 0) {
        // Merge with existing local courses, but remove courses that were deleted in Supabase
        const existingLocal = localStorage.getItem('golfCourses')
        const localCourses = existingLocal ? JSON.parse(existingLocal) : []
        
        // Create maps for efficient lookup by ID
        const supabaseCourseMap = new Map(supabaseCourses.map(c => [c.id, c]))
        
        // Create merged array - prioritize Supabase courses, remove locally-deleted ones
        const mergedCourses: any[] = []
        
        // First, add all Supabase courses (these are the source of truth)
        for (const supabaseCourse of supabaseCourses) {
          if (supabaseCourse.holes && supabaseCourse.holes.length > 0) {
            // Find local version to preserve any user edits to non-core fields
            const localCourse = localCourses.find((c: any) => c.id === supabaseCourse.id)
            mergedCourses.push({
              id: supabaseCourse.id,
              name: supabaseCourse.name,
              location: localCourse?.location ?? 'Unknown',
              state: localCourse?.state ?? 'Unknown',
              holeCount: supabaseCourse.hole_count || localCourse?.holeCount,
              par: supabaseCourse.par,
              holes: supabaseCourse.holes,
              courseRating: localCourse?.courseRating ?? 72.0,
              slopeRating: localCourse?.slopeRating ?? 113,
            })
          }
        }
        
        // Then, add any local courses that don't exist in Supabase (newly created, not yet synced)
        // Only keep these if they were recently added (within 5 minutes - timestamp-based IDs)
        const now = Date.now()
        const fiveMinutesAgo = now - (5 * 60 * 1000)
        
        for (const localCourse of localCourses) {
          if (!supabaseCourseMap.has(localCourse.id)) {
            const courseId = parseInt(localCourse.id, 10)
            // Only keep if it's a recent numeric ID (timestamp-based), not an old string ID
            if (!isNaN(courseId) && courseId > fiveMinutesAgo) {
              console.log(`💾 Keeping newly created local course: ${localCourse.name} (${localCourse.id})`)
              mergedCourses.push(localCourse)
            } else {
              console.log(`🗑️ Removing deleted course: ${localCourse.name} (${localCourse.id}) - not in Supabase`)
            }
          }
        }
        
        localStorage.setItem('golfCourses', JSON.stringify(mergedCourses))
        console.log(`✅ Merged courses: ${mergedCourses.length} total (${supabaseCourses.length} from Supabase)`)
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
    selected_tee: round.selectedTee,
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
    console.warn('Supabase not configured, round will not sync to other devices')
    return
  }

  try {
    // Ensure totalScore matches the sum of scores
    const validRound = ensureValidTotalScore(round)
    
    const roundData = roundToSupabase(validRound)
    console.log('📤 Attempting to save round to Supabase:', roundData)
    
    // Use upsert to insert if new, update if already exists
    const { data, error } = await supabase
      .from('rounds')
      .upsert([roundData], { onConflict: 'id' })
      .select()

    if (error) {
      console.error('❌ Supabase upsert error response:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      throw new Error(`Supabase error: ${error.message}`)
    }
    
    if (data && data.length > 0) {
      console.log('✅ Round successfully saved to Supabase:', data[0])
    } else {
      console.warn('⚠️ Upsert returned no data:', data)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('❌ Error saving round to Supabase:', errorMsg)
    // Re-throw so track-round can see the error
    throw error
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
export async function updateRoundInSupabase(round: Round): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('⚠️ Supabase not configured, skipping update')
    return
  }

  try {
    // Ensure totalScore matches the sum of scores
    const validRound = ensureValidTotalScore(round)
    
    const supabaseRound = roundToSupabase(validRound)
    // Remove id from update object (can't update primary key)
    const { id, ...updateData } = supabaseRound

    console.log('📤 Updating round in Supabase:', {
      id: validRound.id,
      totalScore: validRound.totalScore,
      scores: validRound.scores,
      updateDataKeys: Object.keys(updateData),
      total_score_in_updateData: updateData.total_score
    })

    // Try updating both fields together with select to see row count
    try {
      const { data, error } = await supabase
        .from('rounds')
        .update(updateData)
        .eq('id', round.id)
        .select('id, total_score, scores')
        .single()

      if (error) {
        console.error('❌ Supabase error updating round:', {
          error,
          roundId: round.id,
          code: error.code,
          message: error.message,
          details: error.details
        })
        throw error
      }

      if (!data) {
        console.warn('⚠️ Update query returned no data - row may not exist or RLS blocked it:', {
          roundId: round.id,
          expectedId: updateData.id
        })
      } else {
        console.log('✅ Round updated successfully in Supabase:', {
          id: data.id,
          totalScoreInDb: data.total_score,
          scoresInDb: data.scores
        })
      }
    } catch (innerError) {
      // If select().single() fails due to no rows, try without select
      console.warn('⚠️ Update with select() failed, trying without select():', innerError)
      
      const { error: updateError } = await supabase
        .from('rounds')
        .update(updateData)
        .eq('id', round.id)

      if (updateError) {
        console.error('❌ Supabase error (second attempt):', {
          error: updateError,
          roundId: round.id,
          code: updateError.code,
          message: updateError.message
        })
        throw updateError
      }

      console.log('✅ Round updated successfully (without select):', {
        id: round.id,
        newScore: round.totalScore
      })
    }
  } catch (error) {
    console.error('❌ Error updating round in Supabase:', error)
    throw error
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
    // Only send fields that exist in Supabase courses table
    // Supabase uses snake_case for column names
    const courseData = {
      id: course.id,
      name: course.name,
      par: course.par,
      hole_count: course.holeCount,
      holes: course.holes,
      // Note: location, state, course_rating, slope_rating not synced if not in schema
    }

    // Use upsert to insert if new, update if already exists
    const { error } = await supabase
      .from('courses')
      .upsert([courseData], { onConflict: 'id' })

    if (error) {
      console.error('Error saving course to Supabase:', error)
      // Don't throw - let app continue if Supabase sync fails
      return
    }
    console.log('Course saved to Supabase:', course.id)
  } catch (error) {
    console.error('Error saving course to Supabase:', error)
    // Don't throw - let app continue if Supabase sync fails
  }
}

/**
 * Update a course in Supabase
 */
export async function updateCourseInSupabase(course: Course): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured, course changes saved locally only')
    return
  }

  try {
    console.log('💾 Updating course in Supabase:', course.id)
    
    // Only send fields that Supabase table has
    // location, state, course_rating and slope_rating may not exist in your schema
    const courseData: any = {
      id: course.id,
      name: course.name,
      par: course.par,
      hole_count: course.holeCount,
      holes: course.holes,
    }

    const { error } = await supabase
      .from('courses')
      .update(courseData)
      .eq('id', course.id)

    if (error) {
      // If error is about missing columns, that's okay - data is still in localStorage
      if (error.message?.includes('Could not find')) {
        console.log('⚠️ Supabase columns missing (course_rating/slope_rating) - data saved locally')
        return
      }
      console.error('Supabase error:', error)
      throw error
    }
    
    console.log('✅ Course successfully updated in Supabase')
  } catch (error) {
    console.warn('⚠️ Could not sync to Supabase, but data is saved locally:', error)
    // Continue anyway - data is still saved locally
  }
}

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
