import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { commentId, emoji, increment = true } = await req.json();

    if (!commentId || !emoji) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Use service role key for writes to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Check if reaction exists
    const { data: existing } = await supabase
      .from('comment_reactions')
      .select('*')
      .eq('comment_id', commentId)
      .eq('emoji', emoji)
      .single();

    if (existing) {
      // Update existing reaction - use admin client
      const newCount = Math.max(0, existing.count + (increment ? 1 : -1));
      if (newCount === 0) {
        // Delete if count reaches 0
        await supabaseAdmin
          .from('comment_reactions')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('comment_reactions')
          .update({ count: newCount })
          .eq('id', existing.id);
      }
    } else if (increment) {
      // Create new reaction - use admin client
      await supabaseAdmin.from('comment_reactions').insert([
        {
          comment_id: commentId,
          emoji: emoji,
          count: 1,
        },
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
