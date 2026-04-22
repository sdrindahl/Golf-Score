'use client'


import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageWrapper from '@/components/PageWrapper'
import { Course, User } from '@/types'
import { COURSES_DATABASE } from '@/data/courses'
import { useAuth } from '@/lib/useAuth'

export default function CoursesPage() {
    // Load courses from localStorage or COURSES_DATABASE on mount
    useEffect(() => {
      setAllCourses(COURSES_DATABASE);
      setDisplayedCourses(COURSES_DATABASE);
    }, []);
  const router = useRouter()
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

  // ...other logic and hooks...

  // Helper to get parent and child courses
  const parentCourses = displayedCourses.filter(course => !course.parent_id);

  return (
    <PageWrapper title="Courses">
      <div className="mb-4">
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
          className="input-field mb-4 w-full"
        />
      </div>
      <div className="space-y-4">
        {parentCourses.length === 0 ? (
          <div className="card text-center text-gray-500">
            No courses added yet. Add courses to get started.
          </div>
        ) : (
          parentCourses.map((parent) => (
            <div key={parent.id}>
              <div
                className="card cursor-pointer transition-all hover:ring-2 hover:ring-green-500 hover:bg-green-50"
                onClick={() => router.push(`/course-nines?id=${parent.id}`)}
              >
                <h3 className="text-lg font-bold">{parent.name}</h3>
                <div className="mt-2 flex gap-4 text-sm">
                  <span>⛳ {parent.holeCount} Holes</span>
                  {parent.par && <span>📍 Par {parent.par}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </PageWrapper>
  );
}
