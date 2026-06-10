import { NextRequest, NextResponse } from 'next/server'
import { EventTeam, EventTeamMember } from '@/types'
import { buildEventLeaderboardEntries, buildScrambleLeaderboardEntries, getSupabaseClients, requireEventsCoreAccess } from '@/lib/eventsServer'

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

    const [{ data: event, error: eventError }, { data: members, error: membersError }, { data: rounds, error: roundsError }, { data: teams, error: teamsError }, { data: teamMembers, error: teamMembersError }, { data: teamScores, error: teamScoresError }] = await Promise.all([
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
      supabaseAdmin
        .from('event_teams')
        .select('id, event_id, name, created_at')
        .eq('event_id', id)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('event_team_members')
        .select('id, team_id, event_id, user_id, created_at')
        .eq('event_id', id),
      supabaseAdmin
        .from('event_team_scores')
        .select('id, event_id, team_id, scores, total_score, in_progress, updated_at, last_activity_at')
        .eq('event_id', id),
    ])

    if (eventError) throw eventError
    if (membersError) throw membersError
    if (roundsError) throw roundsError
    if (teamsError) throw teamsError
    if (teamMembersError) throw teamMembersError
    if (teamScoresError) throw teamScoresError

    const memberUserIds = Array.from(new Set([
      ...(members || []).map((member: any) => member.user_id),
      ...(teamMembers || []).map((member: any) => member.user_id),
    ]))
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

    const teamMembersByTeamId = new Map<string, EventTeamMember[]>()
    for (const member of teamMembers || []) {
      const enrichedMember: EventTeamMember = {
        ...member,
        user_name: usersById.get(member.user_id) || 'Unknown Player',
      }
      const existingMembers = teamMembersByTeamId.get(member.team_id) || []
      existingMembers.push(enrichedMember)
      teamMembersByTeamId.set(member.team_id, existingMembers)
    }

    const enrichedTeams: EventTeam[] = (teams || []).map((team: any) => ({
      ...team,
      members: teamMembersByTeamId.get(team.id) || [],
    }))

    const leaderboard = event?.format === 'scramble'
      ? buildScrambleLeaderboardEntries(teamScores || [], enrichedTeams)
      : buildEventLeaderboardEntries(rounds || [])

    return NextResponse.json({
      event,
      members: enrichedMembers,
      teams: enrichedTeams,
      leaderboard,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load event.' }, { status: 500 })
  }
}