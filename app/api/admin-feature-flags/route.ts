import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FeatureFlag, FeatureFlagAudience, FeatureFlagKey } from '@/types'
import { DEFAULT_FEATURE_FLAGS, FEATURE_FLAG_DEFINITIONS, mergeFeatureFlags } from '@/lib/featureFlags'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type FeatureFlagUpdatePayload = {
  currentUserId?: string
  flag: {
    key: FeatureFlagKey
    enabled: boolean
    audience: FeatureFlagAudience
    enabled_user_ids?: string[]
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Feature flag admin updates require Supabase server configuration.' },
      { status: 400 }
    )
  }

  try {
    const body = (await request.json()) as FeatureFlagUpdatePayload
    const currentUserId = body.currentUserId
    const incomingFlag = body.flag

    if (!currentUserId || !incomingFlag?.key) {
      return NextResponse.json({ error: 'Missing current user or flag payload.' }, { status: 400 })
    }

    if (!(incomingFlag.key in FEATURE_FLAG_DEFINITIONS)) {
      return NextResponse.json({ error: 'Unknown feature flag key.' }, { status: 400 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('id, is_admin')
      .eq('id', currentUserId)
      .single()

    if (adminError) {
      throw adminError
    }

    if (!adminUser?.is_admin) {
      return NextResponse.json({ error: 'Only admins can update feature flags.' }, { status: 403 })
    }

    const definition = FEATURE_FLAG_DEFINITIONS[incomingFlag.key]
    const payload: FeatureFlag = {
      key: incomingFlag.key,
      name: definition.name,
      description: definition.description,
      enabled: incomingFlag.enabled,
      audience: incomingFlag.audience,
      enabled_user_ids: incomingFlag.enabled_user_ids || [],
      updated_by: currentUserId,
    }

    const { error: upsertError } = await supabaseAdmin
      .from('feature_flags')
      .upsert(payload, { onConflict: 'key' })

    if (upsertError) {
      throw upsertError
    }

    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .select('key, name, description, enabled, audience, enabled_user_ids, updated_at, updated_by')
      .order('key', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ flags: mergeFeatureFlags((data || DEFAULT_FEATURE_FLAGS) as FeatureFlag[]) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update feature flags.' }, { status: 500 })
  }
}