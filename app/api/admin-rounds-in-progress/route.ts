import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const activeRoundCutoffMs = Date.now() - 4 * 60 * 60 * 1000;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Rounds in progress API is missing Supabase server configuration.' },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
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
      return NextResponse.json(
        { error: error.message },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    const activeRounds = (data || []).filter((round: any) => {
      const lastActivityAt = round.last_activity_at ? Date.parse(round.last_activity_at) : Number.NaN;
      if (Number.isFinite(lastActivityAt)) {
        return lastActivityAt >= activeRoundCutoffMs;
      }

      const updatedAt = round.updated_at ? Date.parse(round.updated_at) : Number.NaN;
      return Number.isFinite(updatedAt) && updatedAt >= activeRoundCutoffMs;
    });

    let roundsWithCourses = activeRounds;
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

    return NextResponse.json(
      { rounds: roundsWithCourses, count: roundsWithCourses.length },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
}
