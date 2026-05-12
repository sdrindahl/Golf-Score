import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for writes to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: NextRequest) {
  try {
    const { roundId } = await req.json();
    if (!roundId) {
      return NextResponse.json({ error: 'Missing roundId' }, { status: 400 });
    }

    // Delete from round_courses first (if using join table)
    await supabaseAdmin.from('round_courses').delete().eq('round_id', roundId);
    // Delete the round itself
    const { error } = await supabaseAdmin.from('rounds').delete().eq('id', roundId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
