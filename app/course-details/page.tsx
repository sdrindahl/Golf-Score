'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Course, Round, PerHoleStats } from '@/types'
import { supabase } from '@/lib/supabase'
import { COURSES_DATABASE } from '@/data/courses'
import PageWrapper from '@/components/PageWrapper'

function CourseDetailsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const courseId = searchParams ? searchParams.get('id') : null

  const [course, setCourse] = useState<Course | null>(null)
  const [editingHoles, setEditingHoles] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [rounds, setRounds] = useState<Round[]>([])
  const [holeStats, setHoleStats] = useState<any[]>([])
  // Fetch all rounds for this course and aggregate per-hole stats
  useEffect(() => {
    if (!courseId) return;
    // Fetch all round_ids for this course from round_courses join table
    async function fetchRoundsAndStats() {
      if (!supabase) return;
      // 1. Get all round_ids for this course
      const { data: roundCourses, error: rcError } = await supabase
        .from('round_courses')
        .select('round_id')
        .eq('course_id', courseId);
      if (rcError) return;
      const roundIds = roundCourses?.map((rc: any) => rc.round_id) || [];
      if (roundIds.length === 0) {
        setRounds([]);
        setHoleStats([]);
        return;
      }
      // 2. Fetch all rounds with those ids
      const { data: roundData, error: rError } = await supabase
        .from('rounds')
        .select('*')
        .in('id', roundIds)
        .eq('in_progress', false);
      if (rError) return;
      setRounds(roundData || []);
      // 3. Aggregate per-hole stats
      if (!course) return;
      const numHoles = course.holes.length;
      // For each hole, collect stats from all rounds
      type StatsByHole = {
        scores: number[];
        fir: Array<'hit' | 'L' | 'R' | undefined>;
        gir: boolean[];
        putts: number[];
        puttDistances: number[];
      };
      const statsByHole: StatsByHole[] = Array(numHoles).fill(null).map(() => ({
        scores: [],
        fir: [],
        gir: [],
        putts: [],
        puttDistances: [],
      }));
      (roundData || []).forEach((round: Round) => {
        const perHole: PerHoleStats[] = round.perHoleStats || [];
        const scores: number[] = round.scores || [];
        for (let i = 0; i < numHoles; i++) {
          if (scores[i] !== undefined) statsByHole[i].scores.push(scores[i]);
          if (perHole[i]) {
            if (perHole[i].fairwayHit !== undefined) statsByHole[i].fir.push(perHole[i].fairwayHit);
            if (typeof perHole[i].gir === 'boolean') statsByHole[i].gir.push(perHole[i].gir);
            if (typeof perHole[i].putts === 'number') statsByHole[i].putts.push(perHole[i].putts);
            if (Array.isArray(perHole[i].puttDistances)) statsByHole[i].puttDistances.push(...(perHole[i].puttDistances as number[]));
          }
        }
      });
      setHoleStats(statsByHole);
    }
    fetchRoundsAndStats();
  }, [courseId, course]);

  useEffect(() => {
    if (!courseId) return

    console.log('🔍 CourseDetails - Loading course with ID:', courseId)

    // Helper to flatten parent/child structure
    function flattenCourses(courses: Course[]): Course[] {
      const flat: Course[] = []
      for (const c of courses) {
        flat.push(c)
        // Only push children if property exists and is an array
        if ('children' in c && Array.isArray((c as any).children)) {
          flat.push(...(c as any).children)
        }
      }
      return flat
    }

    // Try to find the course in COURSES_DATABASE (parent or child)
    let foundCourse = flattenCourses(COURSES_DATABASE).find((c: Course) => c.id === courseId)

    console.log('🔍 CourseDetails - Courses in COURSES_DATABASE:', flattenCourses(COURSES_DATABASE).map((c: any) => ({ id: c.id, name: c.name })))
    console.log('🔍 CourseDetails - Found in COURSES_DATABASE?', !!foundCourse)

    // If not in COURSES_DATABASE, try localStorage (parent or child)
    if (!foundCourse) {
      const savedCourses = localStorage.getItem('golfCourses')
      if (savedCourses) {
        const courses = JSON.parse(savedCourses)
        foundCourse = flattenCourses(courses).find((c: Course) => c.id === courseId)
        console.log('🔍 CourseDetails - Found in localStorage?', !!foundCourse)
      }
    }

    if (foundCourse) {
      console.log('✅ CourseDetails - Found course:', foundCourse)
      setCourse(foundCourse)
      setEditingHoles([...foundCourse.holes])
    } else {
      console.error('❌ CourseDetails - Course not found with ID:', courseId)
    }
    setLoading(false)
  }, [courseId])

  const handleHoleChange = (holeNumber: number, field: 'par' | 'handicap', value: number) => {
    const newHoles = [...editingHoles]
    const holeIndex = newHoles.findIndex(h => h.holeNumber === holeNumber)
    if (holeIndex >= 0) {
      newHoles[holeIndex][field] = value
      setEditingHoles(newHoles)
    }
  }

  const handleSaveChanges = () => {
    if (!course) return

    const updatedCourse: Course = {
      ...course,
      par: editingHoles.reduce((sum, h) => sum + h.par, 0),
      holes: editingHoles,
    }

    // Update in localStorage
    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      const index = courses.findIndex((c: Course) => c.id === courseId)
      if (index >= 0) {
        courses[index] = updatedCourse
        localStorage.setItem('golfCourses', JSON.stringify(courses))
        setCourse(updatedCourse)
        setIsEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }
  }

  const handleStartRound = async () => {
    if (course && course.id && course.name && Array.isArray(course.holes) && course.holes.length > 0) {
      try {
        console.log('🎯 CourseDetails - Starting round with course:', course)
        localStorage.setItem('selectedCourse', JSON.stringify(course))
        console.log('✅ CourseDetails - Course saved to localStorage:', localStorage.getItem('selectedCourse'))
        router.push(`/select-tee?courseId=${course.id}`)
      } catch (error) {
        console.error('❌ CourseDetails - Error starting round:', error)
        alert('Error starting round. Please try again.')
      }
    } else {
      console.error('❌ CourseDetails - No valid course object available!', course)
      alert('Course data is missing or invalid. Please refresh and try again.')
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading course...</p>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500 text-lg mb-4">Course not found</p>
          <Link href="/manage-courses">
            <button className="btn-primary">Back to Courses</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PageWrapper title={course.name} userName={`${course.location}, ${course.state}`}>
      {/* Compact Course Header */}
      <div className="card mb-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-gray-600 text-xs">Par</p>
            <p className="text-2xl font-bold">{course.par}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-xs">Holes</p>
            <p className="text-2xl font-bold">{course.holes.length}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-xs">Avg Par</p>
            <p className="text-2xl font-bold">{course.holes.length > 0 ? (course.holes.reduce((sum, h) => sum + h.par, 0) / course.holes.length).toFixed(1) : '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-600 text-xs">Type</p>
            <p className="text-2xl font-bold">{course.holes.length === 18 ? 'Full' : 'Exec'}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6 min-h-[44px]">
        <button
          onClick={handleStartRound}
          className="flex-1 bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base"
          disabled={!course || !course.id || !course.name || !Array.isArray(course.holes) || course.holes.length === 0}
          style={{ opacity: (!course || !course.id || !course.name || !Array.isArray(course.holes) || course.holes.length === 0) ? 0.5 : 1 }}
        >
          ▶️ Start Round
        </button>
        {!isEditing ? (
          <button
            onClick={() => {
              // Initialize holes if they don't exist when entering edit mode
              if (editingHoles.length === 0 && course) {
                const newHoles = Array.from({ length: course.holeCount }, (_, i) => ({
                  holeNumber: i + 1,
                  par: 4,
                  handicap: i + 1,
                }))
                setEditingHoles(newHoles)
              }
              setIsEditing(true)
            }}
            className="flex-1 bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base"
          >
            ✏️ Edit
          </button>
        ) : (
          <>
            <button
              onClick={handleSaveChanges}
              className="flex-1 bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base"
            >
              💾 Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setEditingHoles([...course.holes])
              }}
              className="flex-1 bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base"
            >
              Cancel
            </button>
          </>
        )}
        <Link href="/manage-courses" className="flex-1">
          <button className="w-full h-full bg-white text-gray-800 font-semibold py-2 px-2 md:px-4 rounded-lg shadow-md hover:bg-gray-100 transition-colors active:scale-95 text-sm md:text-base">
            ← Back
          </button>
        </Link>
      </div>

      {/* Status Messages */}
      {saved && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          ✅ Changes saved successfully!
        </div>
      )}

      {/* Stats Table: Hole-by-hole breakdown */}
      <div className="card mt-8">
        <h2 className="text-2xl font-bold mb-6">Hole-by-Hole Stats</h2>
        {course && holeStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-center px-2 py-2">Hole</th>
                  {course.holes.map((hole) => (
                    <th key={hole.holeNumber} className="text-center px-2 py-2 font-semibold">{hole.holeNumber}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-bold text-center">Avg Score</td>
                  {holeStats.map((h, i) => (
                    <td key={i} className="text-center">{h.scores.length ? (h.scores.reduce((a: number, b: number) => a + b, 0) / h.scores.length).toFixed(2) : '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="font-bold text-center">FIR %</td>
                  {holeStats.map((h, i) => {
                    const firHit = h.fir.filter((v: string) => v === 'hit').length;
                    return <td key={i} className="text-center">{h.fir.length ? ((firHit / h.fir.length) * 100).toFixed(0) + '%' : '—'}</td>;
                  })}
                </tr>
                <tr>
                  <td className="font-bold text-center">GIR %</td>
                  {holeStats.map((h, i) => {
                    const girTrue = h.gir.filter((v: boolean) => v).length;
                    return <td key={i} className="text-center">{h.gir.length ? ((girTrue / h.gir.length) * 100).toFixed(0) + '%' : '—'}</td>;
                  })}
                </tr>
                <tr>
                  <td className="font-bold text-center">Avg Putts</td>
                  {holeStats.map((h, i) => (
                    <td key={i} className="text-center">{h.putts.length ? (h.putts.reduce((a: number, b: number) => a + b, 0) / h.putts.length).toFixed(2) : '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="font-bold text-center">Avg Putt Dist</td>
                  {holeStats.map((h, i) => (
                    <td key={i} className="text-center">{h.puttDistances.length ? (h.puttDistances.reduce((a: number, b: number) => a + b, 0) / h.puttDistances.length).toFixed(1) + ' ft' : '—'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">No round stats available for this course yet.</div>
        )}
      </div>
    </PageWrapper>
  )
}

export default function CourseDetails() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-6"><div className="card text-center"><p className="text-gray-500">Loading course...</p></div></div>}>
      <CourseDetailsContent />
    </Suspense>
  )
}
