import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// You may want to move this to a shared util
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { roundId } = await req.json();
    if (!roundId) {
      return NextResponse.json({ error: 'Missing roundId' }, { status: 400 });
    }

    // Delete from round_courses first (if using join table)
    await supabase.from('round_courses').delete().eq('round_id', roundId);
    // Delete the round itself
    const { error } = await supabase.from('rounds').delete().eq('id', roundId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
