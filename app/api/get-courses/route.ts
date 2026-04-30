import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
      .from('courses')
      .select('*');
    if (error) return NextResponse.json({ error: error.message, courses: [] });
    return NextResponse.json({ courses: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, courses: [] });
  }
}
