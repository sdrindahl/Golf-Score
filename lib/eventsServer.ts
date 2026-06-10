import { createClient } from '@supabase/supabase-js'
import { EventLeaderboardEntry, FeatureFlag } from '@/types'
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