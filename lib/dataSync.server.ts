/**
 * Server-only Supabase sync logic for rounds/courses.
 * This file must only be imported by API routes or server components.
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { ensureValidTotalScore, roundToSupabase } from '@/lib/golfApi'

// --- Insert your server-only helpers here ---

async function insertRoundCourses(roundId: string, courseIds: string[]): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  if (!roundId || !courseIds || courseIds.length === 0) return;
  await supabase.from('round_courses').delete().eq('round_id', roundId);
  const rows = courseIds.map((courseId, idx) => ({
    round_id: roundId,
    course_id: courseId,
    course_order: idx
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from('round_courses').insert(rows);
    if (error) {
      console.error('Error inserting round_courses:', error);
      throw error;
    }
  }
}

export async function syncDataFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  // ...existing sync logic from dataSync.ts...
  // You can move the full implementation here if needed.
}

export async function saveRoundToSupabase(round: any): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    console.warn('Supabase not configured, round will not sync to other devices')
    return
  }
  try {
    const validRound = ensureValidTotalScore(round);
    const roundData = roundToSupabase(validRound);
    const { data, error } = await supabase
      .from('rounds')
      .upsert([roundData], { onConflict: 'id' })
      .select();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    let courseIds: string[] = [];
    if (Array.isArray(validRound.courseId)) {
      courseIds = validRound.courseId;
    } else if (typeof validRound.courseId === 'string') {
      courseIds = validRound.courseId.split(',').map((id: string) => id.trim()).filter(Boolean);
    }
    await insertRoundCourses(validRound.id, courseIds);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error saving round to Supabase:', errorMsg);
    throw error;
  }
}
