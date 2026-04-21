import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COURSES_DATABASE } from '@/data/courses';

// Inline Supabase config (replace with your actual env vars or config)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    // Sync all courses to Supabase
    for (const course of COURSES_DATABASE) {
      const courseData = {
        id: course.id,
        name: course.name,
        par: course.par,
        hole_count: course.holeCount,
        holes: course.holes,
      };
      const { error } = await supabase.from('courses').upsert([courseData]);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
