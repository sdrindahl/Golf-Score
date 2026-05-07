import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Get a round by ID regardless of in_progress status
 * Used for viewing auto-completed or finished rounds
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const roundId = searchParams.get('id')

    console.log('[DEBUG] get-round-by-id: Fetching roundId:', roundId)

    if (!roundId) {
      return NextResponse.json({ error: 'Missing round id' }, { status: 400 })
    }

    // Fetch round - no filter on in_progress
    const { data: roundsData, error: roundError } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', roundId)

    if (roundError) {
      console.error('[DEBUG] Round fetch error:', roundError)
      return NextResponse.json(
        {
          error: 'Failed to fetch round',
          details: roundError.message,
        },
        { status: 500 }
      )
    }

    if (!roundsData || roundsData.length === 0) {
      console.warn('[DEBUG] Round not found for id:', roundId)
      return NextResponse.json({ error: 'Round not found' }, { status: 404 })
    }

    const round = roundsData[0]
    console.log('[DEBUG] Round fetched successfully:', round.id)

    // Fetch associated course IDs from join table
    let roundCourses: any[] = []
    try {
      const { data, error: joinError } = await supabase
        .from('round_courses')
        .select('course_id')
        .eq('round_id', roundId)
        .order('course_order')

      if (joinError) {
        console.error('[DEBUG] Join table error:', joinError)
      } else {
        roundCourses = data || []
      }
    } catch (err) {
      console.error('[DEBUG] Exception in join table query:', err)
    }

    const courseIds = roundCourses.map((rc: any) => rc.course_id) || []
    console.log('[DEBUG] Course IDs from join table:', courseIds)

    // Fetch all associated courses
    let courses: any[] = []
    if (courseIds.length > 0) {
      try {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .in('id', courseIds)

        if (courseError) {
          console.error('[DEBUG] Course fetch error:', courseError)
        } else {
          courses = courseData || []
        }
      } catch (err) {
        console.error('[DEBUG] Exception in course fetch:', err)
      }
    }

    // Enrich round with courseId from join table (same as getRoundsInProgress does)
    const enrichedRound = {
      ...round,
      courseId: courseIds.length === 1 ? courseIds[0] : courseIds.join(','),
      course_id: courseIds.join(','), // For backward compatibility
    }

    console.log('[DEBUG] get-round-by-id returning: round id', enrichedRound.id, 'courseId', enrichedRound.courseId, 'courses count', courses.length)
    return NextResponse.json({ round: enrichedRound, courses })
  } catch (error) {
    console.error('[DEBUG] Unexpected error in get-round-by-id:', error)
    let errorMsg = 'Unknown error'
    if (error instanceof Error) {
      errorMsg = error.message
    }
    return NextResponse.json(
      {
        error: 'Server error',
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}
