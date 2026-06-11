import { NextRequest, NextResponse } from 'next/server'
import { EventMatchPlayHoleResult, EventMatchPlayScore, EventTeam } from '@/types'
import { getSupabaseClients, requireEventsCoreAccess } from '@/lib/eventsServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeHoleResults(results: unknown, holeCount: number) {
  const allowed = new Set<EventMatchPlayHoleResult>(['team1', 'team2', 'halved', ''])
  const values = Array.isArray(results)
    ? results.map((result) => (typeof result === 'string' && allowed.has(result as EventMatchPlayHoleResult) ? result as EventMatchPlayHoleResult : ''))
    : []

  return Array.from({ length: holeCount }, (_, index) => values[index] || '')
}

function summarizeMatchPlay(holeResults: EventMatchPlayHoleResult[], holeCount: number) {
  let lead = 0
  let playedHoles = 0

  for (const result of holeResults) {
    if (!result) {
      continue
    }

    playedHoles += 1
    if (result === 'team1') lead += 1
    if (result === 'team2') lead -= 1
  }

  const remainingHoles = holeCount - playedHoles
  const closed = Math.abs(lead) > remainingHoles || (playedHoles === holeCount && lead !== 0)

  return {
    lead,
    playedHoles,
    closed,
  }
}

async function ensureMemberAccess(eventId: string, userId?: string | null) {
  const access = await requireEventsCoreAccess(userId)
  if (!access.allowed) {
    return { response: NextResponse.json({ error: access.error }, { status: 403 }), allowed: false }
  }

  const { supabaseAdmin } = getSupabaseClients()
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) {
    throw membershipError
  }

  if (!membership) {
    return { response: NextResponse.json({ error: 'You do not have access to this event.' }, { status: 403 }), allowed: false }
  }

  return { allowed: true, supabaseAdmin }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = request.nextUrl.searchParams.get('userId')
    const access = await ensureMemberAccess(id, userId)
    if (!access.allowed || !access.supabaseAdmin) {
      return access.response
    }

    const supabaseAdmin = access.supabaseAdmin
    const [{ data: event, error: eventError }, { data: teams, error: teamsError }, { data: teamMembers, error: teamMembersError }, { data: matchPlayScore, error: matchPlayScoreError }] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select('id, name, course_name, event_date, hole_count, format')
        .eq('id', id)
        .single(),
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
        .from('event_match_play_scores')
        .select('id, event_id, team_one_id, team_two_id, hole_results, in_progress, winning_team_id, closing_hole, updated_at, last_activity_at')
        .eq('event_id', id)
        .maybeSingle(),
    ])

    if (eventError) throw eventError
    if (teamsError) throw teamsError
    if (teamMembersError) throw teamMembersError
    if (matchPlayScoreError) throw matchPlayScoreError

    if (event.format !== 'match_play') {
      return NextResponse.json({ error: 'This event is not a Match Play event.' }, { status: 400 })
    }

    if ((teams || []).length !== 2) {
      return NextResponse.json({ error: 'Match Play requires exactly two teams.' }, { status: 400 })
    }

    const memberUserIds = Array.from(new Set((teamMembers || []).map((member: any) => member.user_id)))
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

    const membersByTeamId = new Map<string, any[]>()
    for (const member of teamMembers || []) {
      const existing = membersByTeamId.get(member.team_id) || []
      existing.push({
        ...member,
        user_name: usersById.get(member.user_id) || 'Unknown Player',
      })
      membersByTeamId.set(member.team_id, existing)
    }

    const enrichedTeams: EventTeam[] = (teams || []).map((team: any) => ({
      ...team,
      members: membersByTeamId.get(team.id) || [],
    }))

    const holeCount = event.hole_count || 18
    const defaultScore: EventMatchPlayScore = {
      id: `${id}_match_play`,
      event_id: id,
      team_one_id: enrichedTeams[0].id,
      team_two_id: enrichedTeams[1].id,
      hole_results: Array(holeCount).fill(''),
      in_progress: true,
      winning_team_id: null,
      closing_hole: null,
    }

    return NextResponse.json({
      event,
      teams: enrichedTeams,
      matchPlayScore: matchPlayScore || defaultScore,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load Match Play scoring.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const userId = body.currentUserId
    const access = await ensureMemberAccess(id, userId)
    if (!access.allowed || !access.supabaseAdmin) {
      return access.response
    }

    const supabaseAdmin = access.supabaseAdmin
    const [{ data: event, error: eventError }, { data: teams, error: teamsError }] = await Promise.all([
      supabaseAdmin
        .from('events')
        .select('id, hole_count, format')
        .eq('id', id)
        .single(),
      supabaseAdmin
        .from('event_teams')
        .select('id, event_id, name, created_at')
        .eq('event_id', id)
        .order('created_at', { ascending: true }),
    ])

    if (eventError) throw eventError
    if (teamsError) throw teamsError

    if (event.format !== 'match_play') {
      return NextResponse.json({ error: 'This event is not a Match Play event.' }, { status: 400 })
    }

    if ((teams || []).length !== 2) {
      return NextResponse.json({ error: 'Match Play requires exactly two teams.' }, { status: 400 })
    }

    const holeCount = event.hole_count || 18
    const holeResults = normalizeHoleResults(body.holeResults, holeCount)
    const summary = summarizeMatchPlay(holeResults, holeCount)
    const winningTeamId = summary.closed && summary.lead !== 0
      ? (summary.lead > 0 ? teams[0].id : teams[1].id)
      : null

    const row: EventMatchPlayScore = {
      id: `${id}_match_play`,
      event_id: id,
      team_one_id: teams[0].id,
      team_two_id: teams[1].id,
      hole_results: holeResults,
      in_progress: !summary.closed,
      winning_team_id: winningTeamId,
      closing_hole: summary.closed && summary.playedHoles > 0 ? summary.playedHoles : null,
      last_activity_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabaseAdmin
      .from('event_match_play_scores')
      .upsert(row, { onConflict: 'event_id' })

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save Match Play scoring.' }, { status: 500 })
  }
}
