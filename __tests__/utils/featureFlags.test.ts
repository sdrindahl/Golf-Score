import { evaluateFeatureFlags, mergeFeatureFlags } from '@/lib/featureFlags'
import { FeatureFlag } from '@/types'

describe('feature flag evaluation', () => {
  it('keeps all default flags present when partial data is loaded', () => {
    const flags = mergeFeatureFlags([
      {
        key: 'events_core',
        name: 'Events',
        enabled: true,
        audience: 'admins',
      } as FeatureFlag,
    ])

    expect(flags.find((flag) => flag.key === 'events_core')?.enabled).toBe(true)
    expect(flags.find((flag) => flag.key === 'events_games')).toBeDefined()
    expect(flags).toHaveLength(5)
  })

  it('enables admin-only flags only for admins', () => {
    const flags = mergeFeatureFlags([
      {
        key: 'events_core',
        name: 'Events',
        enabled: true,
        audience: 'admins',
      } as FeatureFlag,
    ])

    const adminStates = evaluateFeatureFlags(flags, { userId: 'admin-1', isAdmin: true })
    const playerStates = evaluateFeatureFlags(flags, { userId: 'user-1', isAdmin: false })

    expect(adminStates.find((flag) => flag.key === 'events_core')?.enabled).toBe(true)
    expect(playerStates.find((flag) => flag.key === 'events_core')?.enabled).toBe(false)
  })

  it('enables allowlisted user flags only for matching users', () => {
    const flags = mergeFeatureFlags([
      {
        key: 'events_games',
        name: 'Event Games',
        enabled: true,
        audience: 'users',
        enabled_user_ids: ['user-1', 'user-2'],
      } as FeatureFlag,
    ])

    const allowedStates = evaluateFeatureFlags(flags, { userId: 'user-2', isAdmin: false })
    const blockedStates = evaluateFeatureFlags(flags, { userId: 'user-9', isAdmin: false })

    expect(allowedStates.find((flag) => flag.key === 'events_games')?.enabled).toBe(true)
    expect(blockedStates.find((flag) => flag.key === 'events_games')?.enabled).toBe(false)
  })
})