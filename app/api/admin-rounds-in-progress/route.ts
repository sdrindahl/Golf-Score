import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role key bypasses RLS — admin-only endpoint
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('rounds')
      .select('id, user_name, user_id, date, scores, total_score, in_progress')
      .eq('in_progress', true)
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rounds: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
