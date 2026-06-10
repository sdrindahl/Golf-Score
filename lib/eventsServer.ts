import { createClient } from '@supabase/supabase-js'
import { EventLeaderboardEntry, EventTeam, FeatureFlag } from '@/types'
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