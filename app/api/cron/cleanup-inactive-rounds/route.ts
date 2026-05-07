import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// Cleanup inactive rounds - runs via Vercel Cron
// Deletes all rounds that have been inactive for 4+ hours
export async function GET(req: NextRequest) {
  // Verify the request is from Vercel's cron service
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not initialized' }, { status: 500 });
  }

  try {
    // Calculate cutoff time: 4 hours ago
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    console.log(`[CRON] Cleanup started - looking for rounds inactive since ${fourHoursAgo}`);

    // Find all inactive rounds
    const { data: inactiveRounds, error: fetchError } = await supabase
      .from('rounds')
      .select('id')
      .eq('in_progress', true)
      .lt('updated_at', fourHoursAgo);

    if (fetchError) {
      console.error('[CRON] Error fetching inactive rounds:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch rounds', details: fetchError }, { status: 500 });
    }

    const inactiveCount = inactiveRounds?.length || 0;
    console.log(`[CRON] Found ${inactiveCount} inactive rounds to delete`);

    if (inactiveCount === 0) {
      return NextResponse.json({ message: 'No inactive rounds to delete', deleted: 0 });
    }

    // Delete the inactive rounds
    const roundIds = inactiveRounds.map((r: any) => r.id);
    
    // First, delete from round_courses join table
    const { error: deleteJoinError } = await supabase
      .from('round_courses')
      .delete()
      .in('round_id', roundIds);

    if (deleteJoinError) {
      console.error('[CRON] Error deleting from round_courses:', deleteJoinError);
      // Continue anyway - try to delete the rounds themselves
    }

    // Then, delete from rounds table
    const { error: deleteRoundsError } = await supabase
      .from('rounds')
      .delete()
      .in('id', roundIds);

    if (deleteRoundsError) {
      console.error('[CRON] Error deleting rounds:', deleteRoundsError);
      return NextResponse.json({ error: 'Failed to delete rounds', details: deleteRoundsError }, { status: 500 });
    }

    console.log(`[CRON] Successfully deleted ${inactiveCount} inactive rounds`);

    return NextResponse.json({
      message: 'Cleanup completed successfully',
      deleted: inactiveCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[CRON] Unexpected error during cleanup:', err);
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 });
  }
}
