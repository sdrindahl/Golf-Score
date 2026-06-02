import { NextRequest, NextResponse } from 'next/server';
import { COURSES_DATABASE } from '@/data/courses';

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
    const courseId = req.nextUrl.searchParams.get('courseId');

    const source = courseId
      ? COURSES_DATABASE.filter((c) => c.id === courseId)
      : COURSES_DATABASE;

    const courses = source
      .map((course) => {
        const holes = (course.holes ?? [])
          .filter((h: any) => h.greenLat != null && h.greenLng != null)
          .map((h: any) => ({
            holeNumber: h.holeNumber,
            par: h.par,
            greenLat: h.greenLat,
            greenLng: h.greenLng,
            yardage: h.men?.yardage ?? 0,
          }))
          .sort((a: any, b: any) => a.holeNumber - b.holeNumber);

        return { id: course.id, name: course.name, holes };
      })
      .filter((c) => c.holes.length > 0);

    return NextResponse.json(
      { courses },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
