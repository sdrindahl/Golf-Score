import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ rounds: [] });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    // Fetch all rounds for the user (completed and in-progress)
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message, rounds: [] });

    // Fetch course IDs for each round from round_courses join table
    if (data && data.length > 0) {
      const roundsWithCourses = await Promise.all(
        data.map(async (round: any) => {
          const { data: courseLinks } = await supabase
            .from('round_courses')
            .select('course_id')
            .eq('round_id', round.id)
            .order('course_order');

          if (courseLinks && courseLinks.length > 0) {
            const courseIds = courseLinks.map((rc: any) => rc.course_id);
            // Always use camelCase 'courseId' for consistency
            return {
              ...round,
              courseId: courseIds.join(',')
            };
          }
          // If round already has course_id, rename to courseId for consistency
          if (round.course_id) {
            return {
              ...round,
              courseId: round.course_id
            };
          }
          return round;
        })
      );
      return NextResponse.json({ rounds: roundsWithCourses });
    }

    // If no rounds or no join table, still normalize course_id to courseId
    const normalized = (data || []).map((round: any) => {
      if (round.course_id) {
        return {
          ...round,
          courseId: round.course_id
        };
      }
      return round;
    });
    return NextResponse.json({ rounds: normalized });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, rounds: [] });
  }
}
