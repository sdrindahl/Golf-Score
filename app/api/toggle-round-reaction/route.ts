import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { roundId, userId, userName, emoji } = await req.json();

    if (!roundId || !userId || !userName || !emoji) {
      return NextResponse.json(
        { error: 'roundId, userId, userName, and emoji required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check if this user already reacted with this emoji
    const { data: existing, error: checkError } = await supabase
      .from('round_reactions')
      .select('id')
      .eq('round_id', roundId)
      .eq('user_id', userId)
      .eq('emoji', emoji);

    if (checkError) {
      console.error('Error checking existing reaction:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    // If reaction exists, delete it (toggle off)
    if (existing && existing.length > 0) {
      const { error: deleteError } = await supabase
        .from('round_reactions')
        .delete()
        .eq('round_id', roundId)
        .eq('user_id', userId)
        .eq('emoji', emoji);

      if (deleteError) {
        console.error('Error deleting reaction:', deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ toggled: 'off' });
    }

    // Otherwise add it (toggle on)
    const { data: newReaction, error: insertError } = await supabase
      .from('round_reactions')
      .insert({
        round_id: roundId,
        user_id: userId,
        user_name: userName,
        emoji,
      })
      .select();

    if (insertError) {
      console.error('Error inserting reaction:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ toggled: 'on', reaction: newReaction?.[0] });
  } catch (error) {
    console.error('Error in toggle-round-reaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
