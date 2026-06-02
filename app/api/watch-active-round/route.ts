import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COURSES_DATABASE } from '@/data/courses';

/**
 * GET /api/watch-active-round?userId=<id>
 *
 * Returns the active in-progress round for a user, including the courseId
 * and courseName so the watch can auto-select the correct course.
 * Returns { round: null } when no round is in progress.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ round: null });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('rounds')
      .select('id, course_id, course_name, current_hole')
      .eq('user_id', userId)
      .eq('in_progress', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ round: null });
    }

    // Find the course in local data to confirm it has GPS holes
    const courseId = data.course_id;
    const hasGPS = COURSES_DATABASE.some(
      (c) => c.id === courseId && Array.isArray(c.holes) && c.holes.some((h: any) => h.greenLat)
    );

    return NextResponse.json({
      round: {
        id: data.id,
        courseId: data.course_id,
        courseName: data.course_name,
        currentHole: data.current_hole ?? 1,
        hasGPS,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ round: null });
  }
}
