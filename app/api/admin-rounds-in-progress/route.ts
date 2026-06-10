import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role key bypasses RLS — admin-only endpoint
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('rounds')
      .select('id, user_name, user_id, date, scores, total_score, in_progress, updated_at, last_activity_at')
      .eq('in_progress', true)
      .order('last_activity_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let roundsWithCourses = data || [];
    if (roundsWithCourses.length > 0) {
      roundsWithCourses = await Promise.all(
        roundsWithCourses.map(async (round: any) => {
          const { data: courseLinks } = await supabaseAdmin
            .from('round_courses')
            .select('course_id')
            .eq('round_id', round.id)
            .order('course_order');

          if (courseLinks && courseLinks.length > 0) {
            const courseIds = courseLinks.map((link: any) => link.course_id);
            return {
              ...round,
              courseId: courseIds.join(','),
              course_id: courseIds.join(','),
            };
          }

          return round;
        })
      );
    }

    return NextResponse.json({ rounds: roundsWithCourses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
