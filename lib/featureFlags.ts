import { FeatureFlag, FeatureFlagEvaluationContext, FeatureFlagKey, FeatureFlagState } from '@/types'

export const FEATURE_FLAG_STORAGE_KEY = 'tapit_feature_flags'

export const FEATURE_FLAG_DEFINITIONS: Record<FeatureFlagKey, { name: string; description: string }> = {
  events_core: {
    name: 'Events',
    description: 'Enables the core Events experience and event-scoped leaderboards.',
  },
  events_teams: {
    name: 'Event Teams',
    description: 'Shows team setup and team leaderboard surfaces inside Events.',
  },
  events_games: {
    name: 'Event Games',
    description: 'Shows side game modules such as skins, Nassau, and similar formats.',
  },
  events_public_view: {
    name: 'Public Event View',
    description: 'Allows spectator or shareable read-only event views.',
  },
  events_payouts: {
    name: 'Event Payouts',
    description: 'Enables payout tracking and settlement surfaces for Events.',
  },
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = (Object.entries(FEATURE_FLAG_DEFINITIONS) as Array<[FeatureFlagKey, { name: string; description: string }]>)
  .map(([key, definition]) => ({
    key,
    name: definition.name,
    description: definition.description,
    enabled: false,
    audience: 'off',
    enabled_user_ids: [],
  }))

export function mergeFeatureFlags(flags?: FeatureFlag[] | null): FeatureFlag[] {
  const incoming = new Map((flags || []).map((flag) => [flag.key, flag]))

  return DEFAULT_FEATURE_FLAGS.map((defaultFlag) => {
    const override = incoming.get(defaultFlag.key)
    if (!override) return defaultFlag

    return {
      ...defaultFlag,
      ...override,
      enabled_user_ids: override.enabled_user_ids || [],
    }
  })
}

export function isFeatureEnabled(flag: FeatureFlag, context: FeatureFlagEvaluationContext): boolean {
  if (!flag.enabled) return false

  const userId = context.userId ?? null

  switch (flag.audience) {
    case 'all':
      return true
    case 'admins':
      return Boolean(context.isAdmin)
    case 'users': {
      if (!userId) return false
      return Boolean(flag.enabled_user_ids?.includes(userId))
    }
    case 'off':
    default:
      return false
  }
}

export function evaluateFeatureFlags(flags: FeatureFlag[], context: FeatureFlagEvaluationContext): FeatureFlagState[] {
  return mergeFeatureFlags(flags).map((flag) => ({
    key: flag.key,
    enabled: isFeatureEnabled(flag, context),
  }))
}

export function getFeatureFlagValue(states: FeatureFlagState[], key: FeatureFlagKey): boolean {
  return states.find((state) => state.key === key)?.enabled ?? false
}

export function loadLocalFeatureFlags(): FeatureFlag[] {
  if (typeof window === 'undefined') {
    return DEFAULT_FEATURE_FLAGS
  }

  try {
    const raw = localStorage.getItem(FEATURE_FLAG_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_FEATURE_FLAGS
    }

    return mergeFeatureFlags(JSON.parse(raw))
  } catch (error) {
    console.warn('Failed to load local feature flags:', error)
    return DEFAULT_FEATURE_FLAGS
  }
}

export function saveLocalFeatureFlags(flags: FeatureFlag[]): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(mergeFeatureFlags(flags)))
}