import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const course = await req.json();
    if (!course || !course.id || !course.name) {
      return NextResponse.json({ success: false, error: 'Missing course id or name' }, { status: 400 });
    }
    // Map camelCase to snake_case for DB
    const dbCourse = { ...course };
    if ('holeCount' in dbCourse) {
      dbCourse.hole_count = dbCourse.holeCount;
      delete dbCourse.holeCount;
    }
    // Upsert course by id
    const { data, error } = await supabase
      .from('courses')
      .upsert([dbCourse], { onConflict: 'id' })
      .select();
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    let errorMsg = 'Unknown error';
    if (error) {
      if (typeof error === 'string') errorMsg = error;
      else if (error instanceof Error && error.message) errorMsg = error.message;
      else try { errorMsg = JSON.stringify(error); } catch {}
    }
    console.error('API /api/save-course error:', errorMsg, error);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
