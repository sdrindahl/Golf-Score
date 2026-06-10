'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { FeatureFlag, FeatureFlagKey, FeatureFlagsResponse, FeatureFlagState, User } from '@/types'
import {
  DEFAULT_FEATURE_FLAGS,
  evaluateFeatureFlags,
  getFeatureFlagValue,
  loadLocalFeatureFlags,
  mergeFeatureFlags,
  saveLocalFeatureFlags,
} from '@/lib/featureFlags'

type FeatureFlagsContextType = {
  flags: FeatureFlag[]
  states: FeatureFlagState[]
  source: 'supabase' | 'local'
  loading: boolean
  refreshFlags: () => Promise<void>
  saveFlag: (flag: FeatureFlag) => Promise<void>
  isEnabled: (key: FeatureFlagKey) => boolean
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined)

function getCurrentUserFromStorage(): User | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem('currentUser')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FEATURE_FLAGS)
  const [states, setStates] = useState<FeatureFlagState[]>(evaluateFeatureFlags(DEFAULT_FEATURE_FLAGS, {}))
  const [source, setSource] = useState<'supabase' | 'local'>('local')
  const [loading, setLoading] = useState(true)

  async function refreshFlags() {
    setLoading(true)

    try {
      const response = await fetch('/api/feature-flags', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load feature flags')
      }

      const data = (await response.json()) as FeatureFlagsResponse
      const resolvedSource = data.source === 'supabase' ? 'supabase' : 'local'
      const mergedFlags = resolvedSource === 'supabase'
        ? mergeFeatureFlags(data.flags)
        : loadLocalFeatureFlags()

      const currentUser = getCurrentUserFromStorage()

      setFlags(mergedFlags)
      setSource(resolvedSource)
      setStates(evaluateFeatureFlags(mergedFlags, {
        userId: currentUser?.id,
        isAdmin: currentUser?.is_admin,
      }))
    } catch (error) {
      console.warn('Falling back to local feature flags:', error)
      const localFlags = loadLocalFeatureFlags()
      const currentUser = getCurrentUserFromStorage()

      setFlags(localFlags)
      setSource('local')
      setStates(evaluateFeatureFlags(localFlags, {
        userId: currentUser?.id,
        isAdmin: currentUser?.is_admin,
      }))
    } finally {
      setLoading(false)
    }
  }

  async function saveFlag(flag: FeatureFlag) {
    if (source === 'local') {
      const nextFlags = mergeFeatureFlags(flags.map((existingFlag) => existingFlag.key === flag.key ? flag : existingFlag))
      saveLocalFeatureFlags(nextFlags)
      setFlags(nextFlags)

      const currentUser = getCurrentUserFromStorage()
      setStates(evaluateFeatureFlags(nextFlags, {
        userId: currentUser?.id,
        isAdmin: currentUser?.is_admin,
      }))
      return
    }

    const currentUser = getCurrentUserFromStorage()
    const response = await fetch('/api/admin-feature-flags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentUserId: currentUser?.id,
        flag: {
          key: flag.key,
          enabled: flag.enabled,
          audience: flag.audience,
          enabled_user_ids: flag.enabled_user_ids || [],
        },
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update feature flag')
    }

    const nextFlags = mergeFeatureFlags(data.flags)
    setFlags(nextFlags)
    setStates(evaluateFeatureFlags(nextFlags, {
      userId: currentUser?.id,
      isAdmin: currentUser?.is_admin,
    }))
  }

  useEffect(() => {
    refreshFlags()
  }, [])

  return (
    <FeatureFlagsContext.Provider
      value={{
        flags,
        states,
        source,
        loading,
        refreshFlags,
        saveFlag,
        isEnabled: (key: FeatureFlagKey) => getFeatureFlagValue(states, key),
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext)
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider')
  }

  return context
}