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
    return NextResponse.json({ rounds: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, rounds: [] });
  }
}
