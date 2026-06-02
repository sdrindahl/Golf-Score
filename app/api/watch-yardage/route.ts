import { NextRequest, NextResponse } from 'next/server';
import { COURSES_DATABASE } from '@/data/courses';

/**
 * GET /api/watch-yardage
 *
 * Returns courses grouped by parent, with all holes combined.
 * Child courses (Front 9 / Back 9) are merged under the parent name.
 * Standalone 9-hole courses are returned as-is.
 */
export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get('courseId');

    // Build a map of parent id → parent name
    const parentNames: Record<string, string> = {};
    for (const c of COURSES_DATABASE) {
      if (!c.parent_id) parentNames[c.id] = c.name;
    }

    // Group child courses under their parent; keep standalone courses as-is
    const grouped: Record<string, { id: string; name: string; holes: any[] }> = {};

    for (const course of COURSES_DATABASE) {
      if (!Array.isArray(course.holes) || course.holes.length === 0) continue;

      const holes = course.holes
        .filter((h: any) => h.greenLat != null && h.greenLng != null)
        .map((h: any) => ({
          holeNumber: h.holeNumber,
          par: h.par,
          greenLat: h.greenLat,
          greenLng: h.greenLng,
          yardage: h.men?.yardage ?? 0,
        }));

      if (holes.length === 0) continue;

      const groupId = course.parent_id ?? course.id;
      const groupName = course.parent_id
        ? (parentNames[course.parent_id] ?? course.name)
        : course.name;

      if (!grouped[groupId]) {
        grouped[groupId] = { id: groupId, name: groupName, holes: [] };
      }
      grouped[groupId].holes.push(...holes);
    }

    // Sort holes within each group
    let courses = Object.values(grouped).map((g) => ({
      ...g,
      holes: g.holes.sort((a, b) => a.holeNumber - b.holeNumber),
    }));

    // Filter by courseId if requested
    if (courseId) {
      courses = courses.filter((c) => c.id === courseId);
    }

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
