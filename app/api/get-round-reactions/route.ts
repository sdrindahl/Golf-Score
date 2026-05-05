import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { roundId } = await req.json();

    if (!roundId) {
      return NextResponse.json({ error: 'roundId required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('round_reactions')
      .select('*')
      .eq('round_id', roundId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching round reactions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group reactions by emoji and count
    const grouped: { [emoji: string]: { count: number; users: { user_id: string; user_name: string }[] } } = {};
    
    for (const reaction of data || []) {
      if (!grouped[reaction.emoji]) {
        grouped[reaction.emoji] = { count: 0, users: [] };
      }
      grouped[reaction.emoji].count++;
      grouped[reaction.emoji].users.push({ user_id: reaction.user_id, user_name: reaction.user_name });
    }

    return NextResponse.json({ reactions: grouped });
  } catch (error) {
    console.error('Error in get-round-reactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
