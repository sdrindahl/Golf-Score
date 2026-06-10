import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Rounds in progress API is missing Supabase server configuration.' },
        { status: 500 }
      );
    }

    // Service role key bypasses RLS — required for cross-user leaderboard reads
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseAdmin
      .from('rounds')
      .select('id, user_name, user_id, date, scores, total_score, in_progress, updated_at, last_activity_at')
      .eq('in_progress', true)
      .order('last_activity_at', { ascending: false })
      .order('updated_at', { ascending: false })
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

    return NextResponse.json({ rounds: roundsWithCourses, count: roundsWithCourses.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
