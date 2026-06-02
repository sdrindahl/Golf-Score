import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface HoleRow {
  holeNumber: number;
  par: number;
  greenLat?: number;
  greenLng?: number;
  men?: { yardage: number };
}

interface CourseRow {
  id: string;
  name: string;
  holes: HoleRow[] | null;
}

/**
 * GET /api/watch-yardage
 *
 * Returns a lightweight list of courses with per-hole GPS coordinates and
 * yardage, designed for consumption by the Apple Watch companion app.
 *
 * Optional query params:
 *   ?courseId=<id>  – return only that one course (faster for Watch refresh)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const courseId = req.nextUrl.searchParams.get('courseId');

    let query = supabase.from('courses').select('id, name, holes').not('holes', 'is', null);

    if (courseId) {
      query = query.eq('id', courseId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const courses = ((data as CourseRow[]) || [])
      .map((course) => {
        const holes = (course.holes ?? [])
          .filter((h) => h.greenLat != null && h.greenLng != null)
          .map((h) => ({
            holeNumber: h.holeNumber,
            par: h.par,
            greenLat: h.greenLat,
            greenLng: h.greenLng,
            yardage: h.men?.yardage ?? 0,
          }))
          .sort((a, b) => a.holeNumber - b.holeNumber);

        return { id: course.id, name: course.name, holes };
      })
      .filter((c) => c.holes.length > 0);

    return NextResponse.json(
      { courses },
      {
        headers: {
          // Cache for 1 hour – course GPS data changes rarely
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
