import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FeatureFlag, FeatureFlagsResponse } from '@/types'
import { DEFAULT_FEATURE_FLAGS, mergeFeatureFlags } from '@/lib/featureFlags'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !serviceRoleKey) {
    const response: FeatureFlagsResponse = {
      flags: DEFAULT_FEATURE_FLAGS,
      source: 'local',
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .select('key, name, description, enabled, audience, enabled_user_ids, updated_at, updated_by')
      .order('key', { ascending: true })

    if (error) {
      throw error
    }

    const response: FeatureFlagsResponse = {
      flags: mergeFeatureFlags((data || []) as FeatureFlag[]),
      source: 'supabase',
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load feature flags.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    )
  }
}