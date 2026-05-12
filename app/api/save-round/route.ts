import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);
// Use service role key for writes to bypass RLS (required for custom auth)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

type Round = {
  id: string;
  userId: string;
  userName: string;
  courseId: string | string[];
  courseName: string;
  selectedTee: string;
  date: string;
  scores: number[];
  totalScore: number;
  notes: string;
  in_progress?: boolean;
  startingHole?: number;
};

function ensureValidTotalScore(round: Round): Round {
  const calculatedTotal = round.scores.reduce((a: number, b: number) => a + b, 0);
  if (round.totalScore !== calculatedTotal) {
    return { ...round, totalScore: calculatedTotal };
  }
  return round;
}

async function insertRoundCourses(roundId: string, courseIds: string[]): Promise<void> {
  if (!roundId || !courseIds || courseIds.length === 0) {
    console.log('[DEBUG] insertRoundCourses: Skipping - invalid roundId or empty courseIds');
    return;
  }
  
  // Remove any existing links for this round (idempotent)
  const { error: deleteError } = await supabaseAdmin.from('round_courses').delete().eq('round_id', roundId);
  if (deleteError) {
    console.error('[DEBUG] Error deleting old round_courses:', deleteError);
  }
  
  // Insert new links
  const rows = courseIds.map((courseId: string, idx: number) => ({
    round_id: roundId,
    course_id: courseId,
    course_order: idx
  }));
  console.log('[DEBUG] Inserting into round_courses - rows to insert:', JSON.stringify(rows));
  
  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from('round_courses').insert(rows);
    if (error) {
      console.error('[DEBUG] Error inserting into round_courses:', error);
      throw error;
    } else {
      console.log('[DEBUG] Successfully inserted into round_courses:', rows.length, 'rows');
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[DEBUG] API Hit: /api/save-round');
    console.log('[DEBUG] Service role key present:', !!serviceRoleKey, 'Length:', serviceRoleKey.length);
    if (!serviceRoleKey || serviceRoleKey.length === 0) {
      console.error('[DEBUG] ⚠️ CRITICAL: Service role key is empty or undefined!');
    }
    const round: Round = await req.json();
    console.log('[DEBUG] Raw incoming round payload:', round);
    console.log('[DEBUG] Incoming round payload (stringified):', JSON.stringify(round));
    console.log('[DEBUG] perHoleStats from incoming payload:', JSON.stringify((round as any).perHoleStats));
    const validRound = ensureValidTotalScore(round);
    // Debug log for in_progress value and type
    console.log('[DEBUG] Received in_progress:', validRound.in_progress, 'Type:', typeof validRound.in_progress);

    // 2: Backend validation for selectedTee (robust)
    // Accept selectedTee from validRound, or selected_tee from raw round, or ''
    let selectedTeeFinal = validRound.selectedTee && typeof validRound.selectedTee === 'string' && validRound.selectedTee.trim()
      ? validRound.selectedTee.trim()
      : (typeof (round as any).selected_tee === 'string' && (round as any).selected_tee.trim() ? (round as any).selected_tee.trim() : '');
    if (!selectedTeeFinal) {
      return NextResponse.json({ success: false, error: 'selectedTee is required and cannot be empty.' }, { status: 400 });
    }

    // Only include fields that exist in the rounds table, using snake_case
    // Coerce in_progress to boolean, default to true only if missing
    let inProgressValue = true;
    if (typeof validRound.in_progress === 'boolean') {
      inProgressValue = validRound.in_progress;
    } else if (typeof validRound.in_progress === 'string') {
      // Accept string 'false' or 'true' from legacy or buggy clients
      inProgressValue = validRound.in_progress === 'true';
    }
    // Debug log for coerced value
    console.log('[DEBUG] Coerced in_progress to:', inProgressValue, 'Type:', typeof inProgressValue);
    
    // Check if this is an update and if scores have changed
    let hasScoreChanges = true;
    if (validRound.id) {
      // Fetch existing round to compare scores
      const { data: existingRound } = await supabase
        .from('rounds')
        .select('scores, notes, in_progress')
        .eq('id', validRound.id)
        .single();
      
      if (existingRound) {
        // Compare scores and notes to determine if there's actual activity
        const scoresUnchanged = JSON.stringify(existingRound.scores || []) === JSON.stringify(validRound.scores || []);
        const notesUnchanged = existingRound.notes === validRound.notes;
        const inProgressUnchanged = existingRound.in_progress === inProgressValue;
        
        // Only consider it a real activity if scores or notes changed, or round status changed
        hasScoreChanges = !scoresUnchanged || !notesUnchanged || !inProgressUnchanged;
        
        if (!hasScoreChanges) {
          console.log('[DEBUG] Heartbeat detected - no score/note changes, skipping last_activity_at update');
        } else {
          console.log('[DEBUG] Real activity detected - updating last_activity_at');
        }
      }
    }
    
    const roundData = {
      id: validRound.id,
      user_id: validRound.userId,
      user_name: validRound.userName,
      date: validRound.date,
      scores: validRound.scores,
      total_score: validRound.totalScore,
      notes: validRound.notes,
      in_progress: inProgressValue,
      selected_tee: selectedTeeFinal,
      per_hole_stats: (validRound as any).perHoleStats || [],
      updated_at: new Date().toISOString(),
      // Only update last_activity_at if there are actual score/note changes
      ...(hasScoreChanges && { last_activity_at: new Date().toISOString() }),
      // NOTE: course_id column was removed - use round_courses join table instead
    };
    console.log('[DEBUG] Upserting round data:', JSON.stringify(roundData));
    console.log('[DEBUG] per_hole_stats about to be written:', JSON.stringify(roundData.per_hole_stats));
    console.log('[DEBUG] selected_tee value being sent to Supabase:', roundData.selected_tee);
    // Upsert round (only safe fields) - use admin client to bypass RLS
    console.log('[DEBUG] UPSERT ABOUT TO EXECUTE - roundData.per_hole_stats type:', typeof roundData.per_hole_stats, 'value:', JSON.stringify(roundData.per_hole_stats));
    console.log('[DEBUG] roundData.id:', roundData.id, 'Type:', typeof roundData.id);
    const { data, error } = await supabaseAdmin
      .from('rounds')
      .upsert([roundData], { onConflict: 'id' })
      .select();
    if (error) {
      console.error('[DEBUG] Upsert error:', JSON.stringify(error));
      console.error('[DEBUG] Upsert error message:', error.message);
      console.error('[DEBUG] Upsert error code:', error.code);
      throw error;
    }
    console.log('[DEBUG] ✅ Upsert returned no error, data rows:', data ? data.length : 0, 'rows');
    if (data && data.length > 0) {
      console.log('[DEBUG] Upsert response per_hole_stats:', JSON.stringify(data[0].per_hole_stats));
    }
    
    // CRITICAL: Verify the write actually happened by doing a read-back
    console.log('[DEBUG] VERIFICATION: Reading back the round from database to confirm write...');
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('rounds')
      .select('id, per_hole_stats, updated_at')
      .eq('id', roundData.id)
      .single();
    
    if (verifyError) {
      console.error('[DEBUG] VERIFICATION ERROR - Could not read back round:', verifyError.message);
    } else if (verifyData) {
      console.log('[DEBUG] VERIFICATION READ RESULT:', JSON.stringify(verifyData));
      
      // Deep equality check (handles JSON property order differences from PostgreSQL JSONB)
      const deepEqual = (obj1: any, obj2: any): boolean => {
        if (obj1 === obj2) return true;
        if (obj1 == null || obj2 == null) return obj1 === obj2;
        if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length) return false;
        
        for (const key of keys1) {
          if (!keys2.includes(key)) return false;
          if (!deepEqual(obj1[key], obj2[key])) return false;
        }
        return true;
      };
      
      const dataMatches = deepEqual(verifyData.per_hole_stats, roundData.per_hole_stats);
      if (dataMatches) {
        console.log('[DEBUG] ✅ VERIFICATION PASSED - Database has the NEW data');
      } else {
        console.error('[DEBUG] ❌ VERIFICATION FAILED - Database still has OLD data!');
        console.error('[DEBUG] Expected:', JSON.stringify(roundData.per_hole_stats));
        console.error('[DEBUG] Got from DB:', JSON.stringify(verifyData.per_hole_stats));
      }
    }
    let courseIds: string[] = [];
    if (Array.isArray(round.courseId)) {
      courseIds = round.courseId;
    } else if (typeof round.courseId === 'string') {
      courseIds = round.courseId.split(',').map((id: string) => id.trim()).filter(Boolean);
    }
    console.log('[DEBUG] Inserting into round_courses with roundId:', validRound.id, 'courseIds:', courseIds);
    await insertRoundCourses(validRound.id, courseIds);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    // Improved error logging
    let errorMsg = 'Unknown error';
    if (error) {
      if (typeof error === 'string') errorMsg = error;
      else if (error instanceof Error && error.message) errorMsg = error.message;
      else try { errorMsg = JSON.stringify(error); } catch {}
    }
    console.error('API /api/save-round error:', errorMsg, error);
    if (error && typeof error === 'object') {
      try { console.error('Error (JSON):', JSON.stringify(error)); } catch {}
      if ('stack' in error) console.error('Error stack:', (error as any).stack);
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
