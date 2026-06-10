import { NextRequest, NextResponse } from 'next/server'
import { buildEventLeaderboardEntries, getSupabaseClients, requireEventsCoreAccess } from '@/lib/eventsServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = request.nextUrl.searchParams.get('userId')

    const access = await requireEventsCoreAccess(userId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 })
    }

    const { supabaseAdmin } = getSupabaseClients()

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('event_members')
      .select('event_id')
      .eq('event_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (membershipError) {
      throw membershipError
    }

    if (!membership) {
      return NextResponse.json({ error: 'You do not have access to this event.' }, { status: 403 })
    }

    const [{ data: event, error: eventError }, { data: members, error: membersError }, { data: rounds, error: roundsError }] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', id)
        .single(),
      supabaseAdmin
        .from('event_members')
        .select('id, event_id, user_id, role')
        .eq('event_id', id),
      supabaseAdmin
        .from('rounds')
        .select('id, user_id, user_name, scores, total_score, in_progress, updated_at, last_activity_at')
        .eq('event_id', id)
        .order('in_progress', { ascending: false })
        .order('last_activity_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false, nullsFirst: false }),
    ])

    if (eventError) throw eventError
    if (membersError) throw membersError
    if (roundsError) throw roundsError

    const memberUserIds = (members || []).map((member: any) => member.user_id)
    let usersById = new Map<string, string>()

    if (memberUserIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, name')
        .in('id', memberUserIds)

      if (usersError) {
        throw usersError
      }

      usersById = new Map((users || []).map((user: any) => [user.id, user.name]))
    }

    const enrichedMembers = (members || []).map((member: any) => ({
      ...member,
      user_name: usersById.get(member.user_id) || 'Unknown Player',
    }))

    return NextResponse.json({
      event,
      members: enrichedMembers,
      leaderboard: buildEventLeaderboardEntries(rounds || []),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load event.' }, { status: 500 })
  }
}