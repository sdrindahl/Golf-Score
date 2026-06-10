import { NextRequest, NextResponse } from 'next/server'
import { Event } from '@/types'
import { getSupabaseClients, requireEventsCoreAccess } from '@/lib/eventsServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

    return NextResponse.json({ success: true, event: eventPayload })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create event.' }, { status: 500 })
  }
}