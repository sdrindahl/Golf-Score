'use client'


import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PageWrapper from '@/components/PageWrapper'
import { Course, User } from '@/types'
import { COURSES_DATABASE } from '@/data/courses'
import { useAuth } from '@/lib/useAuth'

function CoursesPageInner() {
    // Load courses from localStorage or COURSES_DATABASE on mount
    useEffect(() => {
      setAllCourses(COURSES_DATABASE);
      setDisplayedCourses(COURSES_DATABASE);
    }, []);
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedTee, setSelectedTee] = useState<'men' | 'women' | 'senior' | 'championship' | null>(null)
  const [displayedCourses, setDisplayedCourses] = useState<Course[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ courseId: string; courseName: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const [showRoundInProgressMsg, setShowRoundInProgressMsg] = useState(false)
  const eventId = searchParams?.get('eventId') || ''
  const eventName = searchParams?.get('eventName') || ''
  useEffect(() => {
    // Check for round in progress
    const roundId = localStorage.getItem('currentRoundId')
    setCurrentRoundId(roundId)
  }, [])

  const getTeeLabel = (tee: string) => {
    switch (tee) {
      case 'men': return 'Men';
      case 'women': return 'Women';
      case 'senior': return 'Senior';
      case 'championship': return 'Championship';
      default: return tee;
    }
  };

  // Helper to get parent and child courses
  const parentCourses = displayedCourses
    .filter(course => !course.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageWrapper title="">
      {/* Sticky header with title and search */}
      <div className="sticky top-0 z-30 pb-2" style={{marginLeft: -16, marginRight: -16}}>
        <div className="pt-8 pb-4 text-white">
          <h1 className="text-4xl font-bold tracking-tight text-center">Select A Course</h1>
          <hr className="mt-4 border-t-2 border-black w-3/4 mx-auto" />
        </div>
        <div className="mb-4 px-4">
          <div className="bg-black bg-opacity-70 rounded-2xl shadow-2xl border-2 border-blue-600 px-4 py-3 w-full flex items-center" style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)'}}>
            <input
              type="text"
              placeholder="Search by course name, city, or state..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                const term = e.target.value.toLowerCase();
                if (!term) {
                  setDisplayedCourses(allCourses);
                  return;
                }
                setDisplayedCourses(
                  allCourses.filter(course =>
                    course.name.toLowerCase().includes(term) ||
                    (course.location && course.location.toLowerCase().includes(term)) ||
                    (course.state && course.state.toLowerCase().includes(term))
                  )
                );
              }}
              className="w-full bg-white/80 text-blue-600 placeholder:text-blue-600 text-lg px-2 py-2 rounded focus:outline-none"
            />
          </div>
        </div>
      </div>
      {/* End sticky header */}

      <div className="space-y-4">
        {eventId && (
          <div className="rounded-2xl border border-cyan-500 bg-cyan-950/70 px-5 py-4 text-white shadow-2xl">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">Event Round</div>
            <div className="mt-2 text-lg font-bold">{eventName || 'Unnamed Event'}</div>
            <div className="mt-1 text-sm text-cyan-100">Choose the course for this event round. The event will stay attached through tee selection and live scoring.</div>
          </div>
        )}
        {parentCourses.length === 0 ? (
          <div className="card text-center text-gray-500">
            No courses added yet. Add courses to get started.
          </div>
        ) : (
          parentCourses.map((parent) => {
            return (
              <div key={parent.id}>
                <div
                  className="bg-black bg-opacity-70 rounded-2xl shadow-2xl border border-green-400 cursor-pointer transition-all hover:shadow-2xl hover:scale-105 hover:-translate-y-1 px-6 py-4 w-full"
                  style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)'}}
                  onClick={() => {
                    localStorage.setItem('courseSelectedButNoRound', 'true');
                    window.dispatchEvent(new Event('roundStateChanged'));
                    const params = new URLSearchParams({ id: parent.id })
                    if (eventId) params.set('eventId', eventId)
                    if (eventName) params.set('eventName', eventName)
                    router.push(`/course-nines?${params.toString()}`);
                  }}
                >
                  <h3 className="text-lg font-bold text-white">{parent.name}</h3>
                  <div className="mt-2 flex gap-4 text-sm">
                    <span className="text-green-400">⛳ {parent.holeCount} Holes</span>
                    {parent.par && <span className="text-green-400">📍 Par {parent.par}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </PageWrapper>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={
      <PageWrapper title="">
        <div className="max-w-2xl mx-auto py-6 text-center text-white">Loading courses...</div>
      </PageWrapper>
    }>
      <CoursesPageInner />
    </Suspense>
  )
}
