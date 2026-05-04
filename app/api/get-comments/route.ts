import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { roundId } = await req.json();

    if (!roundId) {
      return NextResponse.json({ error: 'Missing roundId' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch comments for the round
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select('*')
      .eq('round_id', roundId)
      .eq('deleted', false)
      .order('created_at', { ascending: true });

    if (commentsError) {
      return NextResponse.json(
        { error: commentsError.message },
        { status: 500 }
      );
    }

    // Fetch reactions for all comments
    const commentIds = comments?.map((c: any) => c.id) || [];
    let reactions: any[] = [];

    if (commentIds.length > 0) {
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('comment_reactions')
        .select('*')
        .in('comment_id', commentIds);

      if (!reactionsError) {
        reactions = reactionsData || [];
      }
    }

    // Merge reactions with comments
    const commentsWithReactions = comments?.map((comment: any) => ({
      ...comment,
      reactions: reactions
        .filter((r) => r.comment_id === comment.id)
        .map((r) => ({ emoji: r.emoji, count: r.count })),
    }));

    return NextResponse.json({ comments: commentsWithReactions || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
