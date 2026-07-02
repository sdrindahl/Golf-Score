import { createClient } from '@supabase/supabase-js'
import { EventLeaderboardEntry, EventMatchPlayHoleResult, EventMatchPlayScore, EventSkinHoleResult, EventSkinsSummary, EventTeam, EventTeamPlayerScore, Event, FeatureFlag, Round } from '@/types'
import { DEFAULT_FEATURE_FLAGS, isFeatureEnabled, mergeFeatureFlags } from '@/lib/featureFlags'

export function getSupabaseServerConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    isConfigured: Boolean(supabaseUrl && anonKey && serviceRoleKey),
  }
}

export function getSupabaseClients() {
  const { supabaseUrl, anonKey, serviceRoleKey, isConfigured } = getSupabaseServerConfig()
  if (!isConfigured) {
    throw new Error('Events API is missing Supabase server configuration.')
  }

  return {
    supabase: createClient(supabaseUrl, anonKey),
    supabaseAdmin: createClient(supabaseUrl, serviceRoleKey),
  }
}

export async function requireEventsCoreAccess(userId?: string | null) {
  if (!userId) {
    return { allowed: false, error: 'Missing userId.' }
  }

  const { supabaseAdmin } = getSupabaseClients()

  const [{ data: user, error: userError }, { data: flagsData, error: flagsError }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, is_admin')
      .eq('id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('feature_flags')
      .select('key, name, description, enabled, audience, enabled_user_ids, updated_at, updated_by'),
  ])

  if (userError) {
    throw userError
  }

  if (flagsError) {
    throw flagsError
  }

  const flags = mergeFeatureFlags((flagsData || DEFAULT_FEATURE_FLAGS) as FeatureFlag[])
  const eventsFlag = flags.find((flag) => flag.key === 'events_core')
  if (!user) {
    return {
      allowed: false,
      user: null,
      flags,
      error: 'Current user was not found in Supabase. Sign in again or re-sync your account.',
    }
  }

  const allowed = eventsFlag
    ? isFeatureEnabled(eventsFlag, { userId, isAdmin: user?.is_admin })
    : false

  return {
    allowed,
    user,
    flags,
    error: allowed ? null : 'Events are not enabled for this user.',
  }
}

export function buildEventLeaderboardEntries(rounds: any[]): EventLeaderboardEntry[] {
  return (rounds || []).map((round) => {
    const scores: number[] = Array.isArray(round.scores) ? round.scores : []
    const thru = scores.filter((score: number) => Number(score) > 0).length

    return {
      round_id: round.id,
      user_id: round.user_id,
      user_name: round.user_name,
      total_score: round.total_score || 0,
      scores,
      in_progress: Boolean(round.in_progress),
      thru,
      status_label: round.in_progress ? `Through ${thru}` : 'Finished',
      updated_at: round.updated_at,
      last_activity_at: round.last_activity_at,
    }
  }).sort((left, right) => {
    if (left.in_progress !== right.in_progress) {
      return left.in_progress ? -1 : 1
    }

    if (left.total_score !== right.total_score) {
      return left.total_score - right.total_score
    }

    return right.thru - left.thru
  })
}

function sumScores(scores: number[], startIndex: number) {
  return scores.slice(startIndex).reduce((total, score) => total + (Number(score) > 0 ? Number(score) : 0), 0)
}

function compareScrambleTiebreak(leftScores: number[], rightScores: number[]) {
  const slices = [9, 6, 3, 1]

  for (const size of slices) {
    const leftValue = sumScores(leftScores, Math.max(leftScores.length - size, 0))
    const rightValue = sumScores(rightScores, Math.max(rightScores.length - size, 0))
    if (leftValue !== rightValue) {
      return leftValue - rightValue
    }
  }

  return 0
}

export function buildScrambleLeaderboardEntries(teamScores: any[], teams: EventTeam[]): EventLeaderboardEntry[] {
  const teamMap = new Map(teams.map((team) => [team.id, team]))

  return (teamScores || []).map((teamScore) => {
    const scores: number[] = Array.isArray(teamScore.scores) ? teamScore.scores : []
    const thru = scores.filter((score) => Number(score) > 0).length
    const team = teamMap.get(teamScore.team_id)

    return {
      round_id: `team:${teamScore.team_id}`,
      user_id: teamScore.team_id,
      user_name: team?.name || 'Team',
      total_score: teamScore.total_score || 0,
      scores,
      in_progress: Boolean(teamScore.in_progress),
      thru,
      status_label: teamScore.in_progress ? `Through ${thru}` : 'Finished',
      updated_at: teamScore.updated_at,
      last_activity_at: teamScore.last_activity_at,
      entry_kind: 'team' as const,
      team_id: teamScore.team_id,
      team_name: team?.name || 'Team',
      member_names: (team?.members || []).map((member) => member.user_name || 'Unknown Player'),
    }
  }).sort((left, right) => {
    if (left.in_progress !== right.in_progress) {
      return left.in_progress ? -1 : 1
    }

    if (left.total_score !== right.total_score) {
      return left.total_score - right.total_score
    }

    const playoffCompare = compareScrambleTiebreak(left.scores, right.scores)
    if (playoffCompare !== 0) {
      return playoffCompare
    }

    return (left.team_name || left.user_name).localeCompare(right.team_name || right.user_name)
  })
}

export function buildBestBallLeaderboardEntries(playerScores: EventTeamPlayerScore[], teams: EventTeam[]): EventLeaderboardEntry[] {
  const scoresByTeam = new Map<string, EventTeamPlayerScore[]>()
  for (const score of playerScores || []) {
    const existingScores = scoresByTeam.get(score.team_id) || []
    existingScores.push(score)
    scoresByTeam.set(score.team_id, existingScores)
  }

  return teams.map((team) => {
    const teamPlayerScores = scoresByTeam.get(team.id) || []
    const holeCount = teamPlayerScores.reduce((max, score) => Math.max(max, Array.isArray(score.scores) ? score.scores.length : 0), 18)
    const lowBallScores = Array.from({ length: holeCount }, (_, holeIndex) => {
      const holeScores = teamPlayerScores
        .map((score) => Number(score.scores?.[holeIndex] || 0))
        .filter((score) => score > 0)

      if (holeScores.length === 0) {
        return 0
      }

      return Math.min(...holeScores)
    })

    const thru = lowBallScores.filter((score) => score > 0).length
    const totalScore = lowBallScores.reduce((sum, score) => sum + score, 0)
    const memberNames = (team.members || []).map((member) => member.user_name || 'Unknown Player')
    const inProgress = teamPlayerScores.some((score) => score.in_progress !== false) || thru < holeCount

    return {
      round_id: `best-ball:${team.id}`,
      user_id: team.id,
      user_name: team.name,
      total_score: totalScore,
      scores: lowBallScores,
      in_progress: inProgress,
      thru,
      status_label: inProgress ? `Through ${thru}` : 'Finished',
      updated_at: teamPlayerScores[0]?.updated_at,
      last_activity_at: teamPlayerScores[0]?.last_activity_at,
      entry_kind: 'team' as const,
      team_id: team.id,
      team_name: team.name,
      member_names: memberNames,
    }
  }).sort((left, right) => {
    if (left.in_progress !== right.in_progress) {
      return left.in_progress ? -1 : 1
    }

    if (left.total_score !== right.total_score) {
      return left.total_score - right.total_score
    }

    return right.thru - left.thru
  })
}

function getMatchPlayDelta(result: EventMatchPlayHoleResult) {
  if (result === 'team1') return 1
  if (result === 'team2') return -1
  return 0
}

function getMatchPlayState(lead: number, playedHoles: number, holeCount: number, winnerTeamId?: string | null) {
  if (playedHoles === 0) {
    return {
      teamOne: 'Not started',
      teamTwo: 'Not started',
      summary: 'Not started',
    }
  }

  const remainingHoles = holeCount - playedHoles
  if (winnerTeamId && Math.abs(lead) > remainingHoles && lead !== 0) {
    const closeOut = `${Math.abs(lead)} & ${remainingHoles}`
    return {
      teamOne: lead > 0 ? `Won ${closeOut}` : `Lost ${closeOut}`,
      teamTwo: lead < 0 ? `Won ${closeOut}` : `Lost ${closeOut}`,
      summary: closeOut,
    }
  }

  if (lead === 0) {
    const summary = playedHoles === holeCount ? 'Halved Match' : `All Square thru ${playedHoles}`
    return {
      teamOne: summary,
      teamTwo: summary,
      summary,
    }
  }

  return {
    teamOne: lead > 0 ? `${Math.abs(lead)} Up thru ${playedHoles}` : `${Math.abs(lead)} Down thru ${playedHoles}`,
    teamTwo: lead < 0 ? `${Math.abs(lead)} Up thru ${playedHoles}` : `${Math.abs(lead)} Down thru ${playedHoles}`,
    summary: `${Math.abs(lead)} Up thru ${playedHoles}`,
  }
}

export function buildMatchPlayLeaderboardEntries(matchScore: EventMatchPlayScore | null | undefined, teams: EventTeam[], holeCount = 18): EventLeaderboardEntry[] {
  if (teams.length < 2) {
    return []
  }

  const orderedTeams = matchScore
    ? [teams.find((team) => team.id === matchScore.team_one_id), teams.find((team) => team.id === matchScore.team_two_id)].filter(Boolean) as EventTeam[]
    : teams.slice(0, 2)

  if (orderedTeams.length < 2) {
    return []
  }

  const [teamOne, teamTwo] = orderedTeams
  const holeResults = Array.isArray(matchScore?.hole_results) ? matchScore.hole_results as EventMatchPlayHoleResult[] : []
  let lead = 0
  let playedHoles = 0

  for (const result of holeResults) {
    if (!result) {
      continue
    }

    playedHoles += 1
    lead += getMatchPlayDelta(result)
  }

  const state = getMatchPlayState(lead, playedHoles, holeCount, matchScore?.winning_team_id)

  return [
    {
      round_id: `match-play:${teamOne.id}`,
      user_id: teamOne.id,
      user_name: teamOne.name,
      total_score: lead,
      scores: holeResults.map((result) => getMatchPlayDelta(result)),
      in_progress: Boolean(matchScore?.in_progress ?? true),
      thru: playedHoles,
      status_label: state.teamOne,
      updated_at: matchScore?.updated_at,
      last_activity_at: matchScore?.last_activity_at,
      entry_kind: 'team' as const,
      team_id: teamOne.id,
      team_name: teamOne.name,
      member_names: (teamOne.members || []).map((member) => member.user_name || 'Unknown Player'),
      match_state: state.teamOne,
      versus_name: teamTwo.name,
    },
    {
      round_id: `match-play:${teamTwo.id}`,
      user_id: teamTwo.id,
      user_name: teamTwo.name,
      total_score: lead * -1,
      scores: holeResults.map((result) => getMatchPlayDelta(result) * -1),
      in_progress: Boolean(matchScore?.in_progress ?? true),
      thru: playedHoles,
      status_label: state.teamTwo,
      updated_at: matchScore?.updated_at,
      last_activity_at: matchScore?.last_activity_at,
      entry_kind: 'team' as const,
      team_id: teamTwo.id,
      team_name: teamTwo.name,
      member_names: (teamTwo.members || []).map((member) => member.user_name || 'Unknown Player'),
      match_state: state.teamTwo,
      versus_name: teamOne.name,
    },
  ].sort((left, right) => right.total_score - left.total_score)
}

type SkinsEntry = {
  entry_id: string
  entry_name: string
  scores: number[]
}

function buildBestBallSkinsEntries(playerScores: EventTeamPlayerScore[], teams: EventTeam[]): SkinsEntry[] {
  const scoresByTeam = new Map<string, EventTeamPlayerScore[]>()
  for (const score of playerScores || []) {
    const existingScores = scoresByTeam.get(score.team_id) || []
    existingScores.push(score)
    scoresByTeam.set(score.team_id, existingScores)
  }

  return teams.map((team) => {
    const teamPlayerScores = scoresByTeam.get(team.id) || []
    const holeCount = teamPlayerScores.reduce((max, score) => Math.max(max, Array.isArray(score.scores) ? score.scores.length : 0), 18)
    const lowBallScores = Array.from({ length: holeCount }, (_, holeIndex) => {
      const holeScores = teamPlayerScores
        .map((score) => Number(score.scores?.[holeIndex] || 0))
        .filter((score) => score > 0)

      return holeScores.length > 0 ? Math.min(...holeScores) : 0
    })

    return {
      entry_id: team.id,
      entry_name: team.name,
      scores: lowBallScores,
    }
  })
}

function buildScrambleSkinsEntries(teamScores: any[], teams: EventTeam[]): SkinsEntry[] {
  const teamMap = new Map(teams.map((team) => [team.id, team]))
  return (teamScores || []).map((teamScore) => ({
    entry_id: teamScore.team_id,
    entry_name: teamMap.get(teamScore.team_id)?.name || 'Team',
    scores: Array.isArray(teamScore.scores) ? teamScore.scores : [],
  }))
}

function buildRoundSkinsEntries(rounds: any[]): SkinsEntry[] {
  return (rounds || []).map((round: Round | any) => ({
    entry_id: round.user_id,
    entry_name: round.user_name || 'Player',
    scores: Array.isArray(round.scores) ? round.scores : [],
  }))
}

export function buildSkinsSummary(params: {
  event: Event | null | undefined
  rounds?: any[]
  teams?: EventTeam[]
  teamScores?: any[]
  teamPlayerScores?: EventTeamPlayerScore[]
}): EventSkinsSummary {
  const { event, rounds = [], teams = [], teamScores = [], teamPlayerScores = [] } = params
  const enabled = Boolean(event?.side_games?.includes('skins'))
  const skinValue = event?.betting_config?.skin_value ?? 0
  const tiebreaker = event?.betting_config?.skins_tiebreaker ?? null
  const holeCount = event?.hole_count || 18

  if (!enabled) {
    return {
      supported: false,
      enabled: false,
      tiebreaker,
      skin_value: skinValue,
      total_skins_awarded: 0,
      total_payout_value: 0,
      pending_hole_count: 0,
      current_carryover_count: 0,
      holes: [],
      standings: [],
      message: 'Skins is not enabled on this event.',
    }
  }

  if (event?.format === 'match_play') {
    return {
      supported: false,
      enabled: true,
      tiebreaker,
      skin_value: skinValue,
      total_skins_awarded: 0,
      total_payout_value: 0,
      pending_hole_count: 0,
      current_carryover_count: 0,
      holes: [],
      standings: [],
      message: 'Skins is not derived for Match Play because only hole winners are stored, not stroke scores.',
    }
  }

  const entries = event?.format === 'scramble'
    ? buildScrambleSkinsEntries(teamScores, teams)
    : event?.format === 'best_ball'
      ? buildBestBallSkinsEntries(teamPlayerScores, teams)
      : buildRoundSkinsEntries(rounds)

  const standingsMap = new Map(entries.map((entry) => [entry.entry_id, {
    entry_id: entry.entry_id,
    entry_name: entry.entry_name,
    skins_won: 0,
    payout_value: 0,
  }]))

  const holes: EventSkinHoleResult[] = []
  let carryoverCount = 1
  let totalSkinsAwarded = 0
  let pendingHoleCount = 0

  for (let holeIndex = 0; holeIndex < holeCount; holeIndex += 1) {
    const holeScores = entries
      .map((entry) => ({
        entry_id: entry.entry_id,
        entry_name: entry.entry_name,
        score: Number(entry.scores?.[holeIndex] || 0),
      }))
      .filter((entry) => entry.score > 0)

    if (holeScores.length === 0) {
      holes.push({
        hole_number: holeIndex + 1,
        carryover_count: carryoverCount,
        skins_awarded: 0,
        status: 'not_played',
      })
      continue
    }

    const lowestScore = Math.min(...holeScores.map((entry) => entry.score))
    const winningEntries = holeScores.filter((entry) => entry.score === lowestScore)

    if (winningEntries.length === 1) {
      const winner = winningEntries[0]
      const standing = standingsMap.get(winner.entry_id)
      const skinsAwarded = carryoverCount

      if (standing) {
        standing.skins_won += skinsAwarded
        standing.payout_value += skinsAwarded * skinValue
      }

      totalSkinsAwarded += skinsAwarded
      holes.push({
        hole_number: holeIndex + 1,
        winning_entry_id: winner.entry_id,
        winning_name: winner.entry_name,
        winning_score: winner.score,
        carryover_count: carryoverCount,
        skins_awarded: skinsAwarded,
        status: 'won',
      })
      carryoverCount = 1
      continue
    }

    if (tiebreaker === 'chip_or_putt') {
      pendingHoleCount += 1
      holes.push({
        hole_number: holeIndex + 1,
        winning_score: lowestScore,
        carryover_count: carryoverCount,
        skins_awarded: 0,
        status: 'pending',
        tied_names: winningEntries.map((entry) => entry.entry_name),
      })
      continue
    }

    holes.push({
      hole_number: holeIndex + 1,
      winning_score: lowestScore,
      carryover_count: carryoverCount,
      skins_awarded: 0,
      status: 'carried',
      tied_names: winningEntries.map((entry) => entry.entry_name),
    })
    carryoverCount += 1
  }

  const standings = Array.from(standingsMap.values()).sort((left, right) => {
    if (left.skins_won !== right.skins_won) {
      return right.skins_won - left.skins_won
    }

    return left.entry_name.localeCompare(right.entry_name)
  })

  return {
    supported: true,
    enabled: true,
    tiebreaker,
    skin_value: skinValue,
    total_skins_awarded: totalSkinsAwarded,
    total_payout_value: totalSkinsAwarded * skinValue,
    pending_hole_count: pendingHoleCount,
    current_carryover_count: carryoverCount,
    holes,
    standings,
  }
}