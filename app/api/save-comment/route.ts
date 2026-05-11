import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { roundId, userId, authorName, text } = await req.json();

    if (!roundId || !userId || !authorName || !text) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (text.length > 100) {
      return NextResponse.json(
        { error: 'Comment exceeds 100 character limit' },
        { status: 400 }
      );
    }

    // Use service role key for writes to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          round_id: roundId,
          user_id: userId,
          author_name: authorName,
          text: text,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment: data?.[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
