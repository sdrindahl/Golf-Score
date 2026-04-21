/**
 * Insert course links for a round into round_courses join table
 */
async function insertRoundCourses(roundId: string, courseIds: string[]): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  if (!roundId || !courseIds || courseIds.length === 0) return;

  // Remove any existing links for this round (idempotent)
  await supabase.from('round_courses').delete().eq('round_id', roundId);

  // Insert new links (no-op for localStorage here)
  // All Supabase/server-only code has been moved to lib/dataSync.server.ts
  // Only client-safe helpers or localStorage logic should remain here.
  // If you need to migrate localStorage rounds, call migrateLocalStorageRoundsToSupabase() from a client-only context.
  return;
}


/**
 * Migrate localStorage rounds to Supabase (client-only)
 */
export async function migrateLocalStorageRoundsToSupabase(userIdMap: Map<string, string>, roundToSupabase: (r: any) => any, supabase: any, supabaseRoundIds: Set<string>) {
  if (typeof window === 'undefined') return;
  // All localStorage access must be inside this block
  const localStorageRounds = JSON.parse(window.localStorage.getItem('golfRounds') || '[]');
  const updatedLocalStorageRounds: any[] = [];
  for (const round of localStorageRounds) {
    try {
      // Update the userId reference if it changed during migration
      const updatedRound = {
        ...round,
        userId: userIdMap.get(round.userId) || round.userId
      };
      // Convert to Supabase format (without ID, let it generate)
      const { id, ...roundWithoutId } = roundToSupabase(updatedRound);
      // Insert without ID and let Supabase generate UUID
      const { data, error } = await supabase
        .from('rounds')
        .insert([roundWithoutId])
        .select();
      if (error) throw error;
      if (data && data.length > 0) {
        updatedLocalStorageRounds.push({ ...updatedRound, id: data[0].id });
        console.log(`Migrated round to Supabase: ${round.id}`);
        supabaseRoundIds.add(data[0].id);
      }
    } catch (error) {
      console.error(`Error migrating round ${round.id}:`, error);
      // Keep original if migration fails
      updatedLocalStorageRounds.push(round);
    }
  }
  // Update localStorage with corrected round IDs from Supabase
  if (updatedLocalStorageRounds.length > 0) {
    window.localStorage.setItem('golfRounds', JSON.stringify(updatedLocalStorageRounds));
  }
  console.log('Local storage migration to Supabase complete');
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
    const validRound = ensureValidTotalScore(round);
    const roundData = roundToSupabase(validRound);
    console.log('📤 Attempting to save round to Supabase:', roundData);

    // Use upsert to insert if new, update if already exists
    const { data, error } = await supabase
      .from('rounds')
      .upsert([roundData], { onConflict: 'id' })
      .select();

    if (error) {
      console.error('❌ Supabase upsert error response:', error);
      throw new Error(`Supabase error: ${error.message}`);
    }

    // Insert into round_courses join table
    // Accepts comma-separated or array courseId
    let courseIds: string[] = [];
    if (Array.isArray(validRound.courseId)) {
      courseIds = validRound.courseId;
    } else if (typeof validRound.courseId === 'string') {
      courseIds = validRound.courseId.split(',').map((id: string) => id.trim()).filter(Boolean);
    }
    await insertRoundCourses(validRound.id, courseIds);

    if (data && data.length > 0) {
      console.log('✅ Round successfully saved to Supabase:', data[0]);
    } else {
      console.warn('⚠️ Upsert returned no data:', data);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error saving round to Supabase:', errorMsg);
    throw error;
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

  console.log('🟢 Entered updateRoundInSupabase', { round })
  try {
    // Ensure totalScore matches the sum of scores
    const validRound = ensureValidTotalScore(round)
    const supabaseRound = roundToSupabase(validRound)
    // Remove id from update object (can't update primary key)
    const { id, ...updateData } = supabaseRound

    // Log payload and types
    console.log('🟦 Supabase update payload:', {
      updateData,
      types: Object.fromEntries(Object.entries(updateData).map(([k, v]) => [k, typeof v]))
    })

    // Log before update
    console.log('🟡 About to call supabase update', { total_score: updateData.total_score, id: round.id })

    let error = undefined
    try {
      const result = await supabase
        .from('rounds')
        .update({ total_score: updateData.total_score })
        .eq('id', round.id)
      error = result.error
      console.log('🟣 Supabase update result:', result)
    } catch (updateErr) {
      console.error('❌ Exception thrown during supabase update:', updateErr)
      throw updateErr
    }

    if (error) {
      console.error('❌ Supabase error updating ONLY total_score:', {
        error,
        roundId: round.id,
        code: error.code,
        message: error.message
      })
      throw error
    }

    console.log('✅ Only total_score updated in Supabase:', {
      id: round.id,
      newScore: updateData.total_score
    })
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
