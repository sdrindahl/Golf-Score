import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COURSES_DATABASE } from '@/data/courses';

/**
 * GET /api/watch-active-round?userId=<id>
 *
 * Returns the active in-progress round for a user, including the courseId
 * so the watch can auto-select the correct course.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ round: null });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get the most recent in-progress round
    const { data: round, error } = await supabase
      .from('rounds')
      .select('id, in_progress, updated_at')
      .eq('user_id', userId)
      .eq('in_progress', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !round) return NextResponse.json({ round: null });

    // Get the course(s) linked to this round
    const { data: roundCourses } = await supabase
      .from('round_courses')
      .select('course_id, course_order')
      .eq('round_id', round.id)
      .order('course_order', { ascending: true });

    const courseId = roundCourses?.[0]?.course_id ?? null;
    if (!courseId) return NextResponse.json({ round: null });

    // Resolve to parent course ID if it's a child
    const courseEntry = COURSES_DATABASE.find((c) => c.id === courseId);
    const resolvedId = courseEntry?.parent_id ?? courseId;

    // Get course name from local data
    const parentEntry = COURSES_DATABASE.find((c) => c.id === resolvedId);
    const courseName = parentEntry?.name ?? courseEntry?.name ?? courseId;

    const hasGPS = COURSES_DATABASE.some(
      (c) =>
        (c.id === resolvedId || c.parent_id === resolvedId) &&
        Array.isArray(c.holes) &&
        c.holes.some((h: any) => h.greenLat)
    );

    return NextResponse.json({
      round: {
        id: round.id,
        courseId: resolvedId,
        courseName,
        currentHole: 1,
        hasGPS,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ round: null });
  }
}
