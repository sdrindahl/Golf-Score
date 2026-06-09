import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { userId, userName } = await req.json();
    if (!userId && !userName) return NextResponse.json({ rounds: [] });

    // Use service role key to bypass RLS and read any user's rounds
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Primary: query by user_id, ordered by most recently active first
    let data: any[] | null = null;
    if (userId) {
      const { data: byId, error: idError } = await supabase
        .from('rounds')
        .select('*')
        .eq('user_id', userId)
        .eq('in_progress', true)
        .order('last_activity_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false, nullsFirst: false });
      if (!idError && byId && byId.length > 0) {
        data = byId;
      }
    }

    // Fallback: if no results by user_id, try by user_name
    if ((!data || data.length === 0) && userName) {
      const { data: byName, error: nameError } = await supabase
        .from('rounds')
        .select('*')
        .eq('user_name', userName)
        .eq('in_progress', true)
        .order('last_activity_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false, nullsFirst: false });
      if (!nameError && byName && byName.length > 0) {
        data = byName;
      }
    }

    return NextResponse.json({ rounds: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, rounds: [] });
  }
}