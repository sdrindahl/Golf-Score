import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  if (!roundId || !courseIds || courseIds.length === 0) return;
  // Remove any existing links for this round (idempotent)
  await supabase.from('round_courses').delete().eq('round_id', roundId);
  // Insert new links
  const rows = courseIds.map((courseId: string, idx: number) => ({
    round_id: roundId,
    course_id: courseId,
    course_order: idx
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from('round_courses').insert(rows);
    if (error) throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const round: Round = await req.json();
    console.log('[DEBUG] Raw incoming round payload:', round);
    console.log('[DEBUG] Incoming round payload (stringified):', JSON.stringify(round));
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
    const roundData = {
      id: validRound.id,
      user_id: validRound.userId,
      user_name: validRound.userName,
      date: validRound.date,
      scores: validRound.scores,
      total_score: validRound.totalScore,
      notes: validRound.notes,
      in_progress: inProgressValue,
      course_id: Array.isArray(validRound.courseId)
        ? validRound.courseId.join(',')
        : validRound.courseId || null,
      selected_tee: selectedTeeFinal,
      per_hole_stats: (validRound as any).perHoleStats || [],
    };
    console.log('[DEBUG] Upserting round data:', JSON.stringify(roundData));
    console.log('[DEBUG] selected_tee value being sent to Supabase:', roundData.selected_tee);
    // Upsert round (only safe fields)
    const { data, error } = await supabase
      .from('rounds')
      .upsert([roundData], { onConflict: 'id' })
      .select();
    if (error) {
      console.error('[DEBUG] Upsert error:', error);
      throw error;
    }
    // Insert into round_courses join table
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
