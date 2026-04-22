import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roundId = searchParams.get('id')
  if (!roundId) {
    return NextResponse.json({ error: 'Missing round id' }, { status: 400 })
  }

  // Fetch round
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single()

  if (roundError || !round) {
    return NextResponse.json({ error: 'Round not found' }, { status: 404 })
  }

  // Fetch associated course IDs from join table
  const { data: roundCourses, error: joinError } = await supabase
    .from('round_courses')
    .select('course_id')
    .eq('round_id', roundId)

  if (joinError) {
    return NextResponse.json({ error: 'Join table error' }, { status: 500 })
  }

  const courseIds = roundCourses?.map((rc: any) => rc.course_id) || []

  // Fetch all associated courses
  let courses = []
  if (courseIds.length > 0) {
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .in('id', courseIds)
    if (courseError) {
      return NextResponse.json({ error: 'Course fetch error' }, { status: 500 })
    }
    courses = courseData
  }

  return NextResponse.json({ round, courses })
}
