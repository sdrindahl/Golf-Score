import { NextRequest, NextResponse } from 'next/server'
import { EventTeam, EventTeamScore } from '@/types'
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
    const [{ data: event, error: eventError }, { data: teams, error: teamsError }, { data: teamMembers, error: teamMembersError }, { data: scores, error: scoresError }] = await Promise.all([
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
        .from('event_team_scores')
        .select('id, event_id, team_id, scores, total_score, in_progress, updated_at, last_activity_at')
        .eq('event_id', id),
    ])

    if (eventError) throw eventError
    if (teamsError) throw teamsError
    if (teamMembersError) throw teamMembersError
    if (scoresError) throw scoresError

    if (event.format !== 'scramble') {
      return NextResponse.json({ error: 'This event is not a scramble.' }, { status: 400 })
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

    const teamMembersByTeamId = new Map<string, any[]>()
    for (const member of teamMembers || []) {
      const existing = teamMembersByTeamId.get(member.team_id) || []
      existing.push({
        ...member,
        user_name: usersById.get(member.user_id) || 'Unknown Player',
      })
      teamMembersByTeamId.set(member.team_id, existing)
    }

    const scoreMap = new Map<string, EventTeamScore>((scores || []).map((score: EventTeamScore) => [score.team_id, score]))
    const enrichedTeams: EventTeam[] = (teams || []).map((team: any) => ({
      ...team,
      members: teamMembersByTeamId.get(team.id) || [],
    }))

    return NextResponse.json({
      event,
      teams: enrichedTeams,
      scores: enrichedTeams.map((team) => scoreMap.get(team.id) || {
        id: `${id}_${team.id}`,
        event_id: id,
        team_id: team.id,
        scores: Array(event.hole_count || 18).fill(0),
        total_score: 0,
        in_progress: true,
      }),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load scramble scoring.' }, { status: 500 })
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
    if (event.format !== 'scramble') {
      return NextResponse.json({ error: 'This event is not a scramble.' }, { status: 400 })
    }

    const teams = Array.isArray(body.teams) ? body.teams : []
    if (teams.length === 0) {
      return NextResponse.json({ error: 'No team scores were provided.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const rows = teams.map((team: any) => {
      const scores = Array.isArray(team.scores)
        ? team.scores.map((score: unknown) => {
          const value = Number(score)
          return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
        }).slice(0, event.hole_count || 18)
        : []

      while (scores.length < (event.hole_count || 18)) {
        scores.push(0)
      }

      return {
        id: `${id}_${team.teamId}`,
        event_id: id,
        team_id: team.teamId,
        scores,
        total_score: getScoreTotal(scores),
        in_progress: team.inProgress !== false,
        updated_at: now,
        last_activity_at: now,
      }
    })

    const { error: upsertError } = await supabaseAdmin
      .from('event_team_scores')
      .upsert(rows, { onConflict: 'id' })

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save scramble scoring.' }, { status: 500 })
  }
}