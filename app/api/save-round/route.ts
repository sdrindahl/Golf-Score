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
    console.log('[DEBUG] Incoming round payload:', JSON.stringify(round));
    const validRound = ensureValidTotalScore(round);
    // Only include fields that exist in the rounds table, using snake_case
    const roundData = {
      id: validRound.id,
      user_id: validRound.userId,
      user_name: validRound.userName,
      date: validRound.date,
      scores: validRound.scores,
      total_score: validRound.totalScore,
      notes: validRound.notes,
      in_progress: typeof validRound.in_progress === 'boolean' ? validRound.in_progress : true,
      course_id: Array.isArray(validRound.courseId)
        ? validRound.courseId.join(',')
        : validRound.courseId || null,
      selected_tee: validRound.selectedTee,
      per_hole_stats: (validRound as any).perHoleStats || [],
    };
    console.log('[DEBUG] Upserting round data:', JSON.stringify(roundData));
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
