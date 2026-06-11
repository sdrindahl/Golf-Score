import { NextRequest, NextResponse } from 'next/server'
import { Event, EventBettingConfig, EventFormat, EventSideGame, EventSkinsTiebreaker, EventWagerMode } from '@/types'
import { getSupabaseClients, requireEventsCoreAccess } from '@/lib/eventsServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const EVENT_FORMATS: EventFormat[] = ['scramble', 'best_ball', 'match_play']
const EVENT_SIDE_GAMES: EventSideGame[] = ['skins']
const EVENT_WAGER_MODES: EventWagerMode[] = ['per_hole', 'overall_match']
const SKINS_TIEBREAKERS: EventSkinsTiebreaker[] = ['carry_over_or_split', 'chip_or_putt']

function parseCurrencyAmount(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`)
  }

  return Math.round(parsed * 100) / 100
}

function normalizeTeams(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((team, index) => {
      if (!team || typeof team !== 'object') {
        return null
      }

      const name = typeof team.name === 'string' && team.name.trim() ? team.name.trim() : `Team ${index + 1}`
      const memberIds = Array.isArray(team.memberIds)
        ? Array.from(new Set(team.memberIds.filter((memberId: unknown): memberId is string => typeof memberId === 'string' && memberId.trim().length > 0)))
        : []

      return {
        name,
        memberIds,
      }
    })
    .filter((team): team is { name: string; memberIds: string[] } => team !== null && team.memberIds.length > 0)
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')
    const access = await requireEventsCoreAccess(userId)

    if (!access.allowed) {
      return NextResponse.json({ error: access.error, events: [] }, { status: 403 })
    }

    const { supabaseAdmin } = getSupabaseClients()
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('event_members')
      .select('event_id')
      .eq('user_id', userId)

    if (membershipError) {
      throw membershipError
    }

    const eventIds = Array.from(new Set((memberships || []).map((membership: any) => membership.event_id).filter(Boolean)))
    if (eventIds.length === 0) {
      return NextResponse.json({ events: [] })
    }

    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .in('id', eventIds)
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: false })

    if (eventsError) {
      throw eventsError
    }

    return NextResponse.json({ events: events || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load events.', events: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      currentUserId,
      name,
      format: rawFormat,
      sideGames: rawSideGames,
      bettingConfig: rawBettingConfig,
      teams: rawTeams,
      courseId,
      courseName,
      eventDate,
      holeCount,
      memberIds,
    } = body

    const access = await requireEventsCoreAccess(currentUserId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 })
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Event name is required.' }, { status: 400 })
    }

    const format = EVENT_FORMATS.includes(rawFormat) ? rawFormat : 'scramble'
    const sideGames = Array.isArray(rawSideGames)
      ? rawSideGames.filter((game): game is EventSideGame => EVENT_SIDE_GAMES.includes(game))
      : []
    const teams = normalizeTeams(rawTeams)

    const bettingSource = rawBettingConfig && typeof rawBettingConfig === 'object' ? rawBettingConfig : {}
    let bettingConfig: EventBettingConfig

    try {
      bettingConfig = {
        currency: bettingSource.currency === 'points' ? 'points' : 'usd',
        wager_mode: EVENT_WAGER_MODES.includes(bettingSource.wager_mode) ? bettingSource.wager_mode : 'per_hole',
        wager_value: parseCurrencyAmount(bettingSource.wager_value, 'Wager value') ?? 0,
        skin_value: sideGames.includes('skins')
          ? parseCurrencyAmount(bettingSource.skin_value, 'Skin value') ?? 0
          : null,
        skins_tiebreaker: sideGames.includes('skins') && SKINS_TIEBREAKERS.includes(bettingSource.skins_tiebreaker)
          ? bettingSource.skins_tiebreaker
          : (sideGames.includes('skins') ? 'chip_or_putt' : null),
        skins_validation_required: sideGames.includes('skins') ? Boolean(bettingSource.skins_validation_required) : false,
      }
    } catch (validationError: any) {
      return NextResponse.json({ error: validationError.message || 'Invalid betting configuration.' }, { status: 400 })
    }

    if (format === 'scramble' || format === 'best_ball') {
      if (teams.length < 2) {
        return NextResponse.json({ error: `${format === 'scramble' ? 'Scramble' : 'Best Ball'} events need at least two teams.` }, { status: 400 })
      }

      const invalidTeam = teams.find((team) => team.memberIds.length === 0 || team.memberIds.length > 4)
      if (invalidTeam) {
        return NextResponse.json({ error: 'Each team must have between 1 and 4 players.' }, { status: 400 })
      }
    }

    const { supabaseAdmin } = getSupabaseClients()
    const eventId = `event_${Date.now()}`
    const uniqueMemberIds = Array.from(new Set([currentUserId, ...(Array.isArray(memberIds) ? memberIds : [])].filter(Boolean)))

    const eventPayload: Event = {
      id: eventId,
      name: name.trim(),
      organizer_id: currentUserId,
      course_id: courseId || null,
      course_name: courseName || null,
      event_date: eventDate || null,
      hole_count: Number(holeCount) > 0 ? Number(holeCount) : 18,
      status: 'active',
      format,
      side_games: sideGames,
      format_config: {
        format,
        team_size_max: 4,
        team_count: teams.length || null,
        side_games: sideGames,
        betting: bettingConfig,
      },
      betting_config: bettingConfig,
      enabled_features: [],
    }

    const { error: eventError } = await supabaseAdmin
      .from('events')
      .insert(eventPayload)

    if (eventError) {
      throw eventError
    }

    const membershipRows = uniqueMemberIds.map((userId: string) => ({
      event_id: eventId,
      user_id: userId,
      role: userId === currentUserId ? 'organizer' : 'player',
    }))

    const { error: memberError } = await supabaseAdmin
      .from('event_members')
      .insert(membershipRows)

    if (memberError) {
      throw memberError
    }

    if ((format === 'scramble' || format === 'best_ball') && teams.length > 0) {
      const teamRows = teams.map((team, index) => ({
        id: `${eventId}_team_${index + 1}`,
        event_id: eventId,
        name: team.name,
      }))

      const { error: teamError } = await supabaseAdmin
        .from('event_teams')
        .insert(teamRows)

      if (teamError) {
        throw teamError
      }

      const teamMemberRows = teamRows.flatMap((teamRow, index) => teams[index].memberIds.map((userId) => ({
        team_id: teamRow.id,
        event_id: eventId,
        user_id: userId,
      })))

      if (teamMemberRows.length > 0) {
        const { error: teamMemberError } = await supabaseAdmin
          .from('event_team_members')
          .insert(teamMemberRows)

        if (teamMemberError) {
          throw teamMemberError
        }
      }
    }

    return NextResponse.json({ success: true, event: eventPayload })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create event.' }, { status: 500 })
  }
}