import { NextRequest, NextResponse } from 'next/server'
import { EventTeam, EventTeamPlayerScore } from '@/types'
import { getSupabaseClients, requireEventsCoreAccess } from '@/lib/eventsServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getScoreTotal(scores: number[]) {
  return scores.reduce((total, score) => total + (Number.isFinite(score) ? score : 0), 0)
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
    const [{ data: event, error: eventError }, { data: teams, error: teamsError }, { data: teamMembers, error: teamMembersError }, { data: playerScores, error: playerScoresError }] = await Promise.all([
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
        .from('event_team_player_scores')
        .select('id, event_id, team_id, user_id, scores, total_score, in_progress, updated_at, last_activity_at')
        .eq('event_id', id),
    ])

    if (eventError) throw eventError
    if (teamsError) throw teamsError
    if (teamMembersError) throw teamMembersError
    if (playerScoresError) throw playerScoresError

    if (event.format !== 'best_ball') {
      return NextResponse.json({ error: 'This event is not a Best Ball event.' }, { status: 400 })
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

    const scoreMap = new Map<string, EventTeamPlayerScore>((playerScores || []).map((score: EventTeamPlayerScore) => [`${score.team_id}:${score.user_id}`, score]))
    const holeCount = event.hole_count || 18
    const enrichedTeams: EventTeam[] = (teams || []).map((team: any) => ({
      ...team,
      members: (membersByTeamId.get(team.id) || []).map((member) => ({
        ...member,
        score: scoreMap.get(`${team.id}:${member.user_id}`) || {
          id: `${id}_${team.id}_${member.user_id}`,
          event_id: id,
          team_id: team.id,
          user_id: member.user_id,
          scores: Array(holeCount).fill(0),
          total_score: 0,
          in_progress: true,
          user_name: member.user_name,
        },
      })),
    }))

    return NextResponse.json({
      event,
      teams: enrichedTeams,
      playerScores: playerScores || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load Best Ball scoring.' }, { status: 500 })
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
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, hole_count, format')
      .eq('id', id)
      .single()

    if (eventError) throw eventError
    if (event.format !== 'best_ball') {
      return NextResponse.json({ error: 'This event is not a Best Ball event.' }, { status: 400 })
    }

    const players = Array.isArray(body.players) ? body.players : []
    if (players.length === 0) {
      return NextResponse.json({ error: 'No player scores were provided.' }, { status: 400 })
    }

    const holeCount = event.hole_count || 18
    const now = new Date().toISOString()
    const rows: EventTeamPlayerScore[] = players.map((player: any) => {
      const scores = Array.isArray(player.scores)
        ? player.scores.map((score: unknown) => {
            const value = Number(score)
            return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
          }).slice(0, holeCount)
        : []

      while (scores.length < holeCount) {
        scores.push(0)
      }

      return {
        id: `${id}_${player.teamId}_${player.userId}`,
        event_id: id,
        team_id: player.teamId,
        user_id: player.userId,
        scores,
        total_score: getScoreTotal(scores),
        in_progress: player.inProgress !== false,
        updated_at: now,
        last_activity_at: now,
      }
    })

    const { error: upsertError } = await supabaseAdmin
      .from('event_team_player_scores')
      .upsert(rows, { onConflict: 'id' })

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save Best Ball scoring.' }, { status: 500 })
  }
}
