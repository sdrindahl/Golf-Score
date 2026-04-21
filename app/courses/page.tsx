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
  const getChildCourses = (parentId: string) =>
    allCourses.filter(course => course.parent_id === parentId);

  const [expandedParent, setExpandedParent] = useState<string | null>(null);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [teeSelection, setTeeSelection] = useState<'men' | 'women' | 'senior' | 'championship' | null>(null);

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
                className={`card cursor-pointer transition-all ${expandedParent === parent.id ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
                onClick={() => setExpandedParent(expandedParent === parent.id ? null : parent.id)}
              >
                <h3 className="text-lg font-bold">{parent.name}</h3>
                <div className="mt-2 flex gap-4 text-sm">
                  <span>⛳ {parent.holeCount} Holes</span>
                  {parent.par && <span>📍 Par {parent.par}</span>}
                </div>
              </div>
              {expandedParent === parent.id && (
                <div className="ml-6 mt-2 space-y-2">
                  {getChildCourses(parent.id).map(child => {
                    const isSelected = selectedChildIds.includes(child.id);
                    return (
                      <div key={child.id} className={`flex items-center gap-2 card bg-green-100 hover:bg-green-200 transition-all p-2 mb-2`}>
                        <div>
                          <h4 className="text-base font-semibold">{child.name}</h4>
                          <div className="mt-1 flex gap-4 text-xs">
                            <span>⛳ {child.holeCount} Holes</span>
                            {child.par && <span>📍 Par {child.par}</span>}
                          </div>
                        </div>
                        <button
                          className={`ml-auto px-3 py-1 rounded ${isSelected ? 'bg-red-400 text-white' : 'bg-blue-500 text-white'} disabled:opacity-50`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedChildIds(selectedChildIds.filter(id => id !== child.id));
                            } else if (selectedChildIds.length < 2) {
                              setSelectedChildIds([...selectedChildIds, child.id]);
                            }
                          }}
                          disabled={!isSelected && selectedChildIds.length >= 2}
                          type="button"
                        >
                          {isSelected ? 'Deselect' : 'Select'}
                        </button>
                      </div>
                    );
                  })}
                  {/* Tee selection and Start Round button */}
                  {selectedChildIds.length > 0 && selectedChildIds.length <= 2 && (
                    <div className="mt-4">
                      {/* Course detail table */}
                      <div className="bg-white rounded shadow p-4 mt-4">
                        {selectedChildIds.map((childId, idx) => {
                          const course = allCourses.find(c => c.id === childId);
                          if (!course) return null;
                          const nineLabel = idx === 0 ? 'Front 9' : 'Back 9';
                          return (
                            <div key={childId} className="mb-4">
                              <div className="font-bold mb-2">{nineLabel}: {course.name}</div>
                              <table className="w-full text-xs mb-2">
                                <thead>
                                  <tr>
                                    <th className="text-left">Hole</th>
                                    {course.holes.map(h => <th key={h.holeNumber}>{h.holeNumber}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td>Par</td>
                                    {course.holes.map(h => <td key={h.holeNumber}>{h.par}</td>)}
                                  </tr>
                                  <tr>
                                    <td>Hcp</td>
                                    {course.holes.map(h => <td key={h.holeNumber}>{h.handicap}</td>)}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        className={`btn btn-primary mt-2 w-full`}
                        disabled={selectedChildIds.length === 0}
                        onClick={() => {
                          // Route to tee selection page, passing selected nines as query param
                          const ninesParam = selectedChildIds.join(',');
                          router.push(`/select-tee?nines=${ninesParam}`);
                        }}
                        type="button"
                      >
                        Start Round
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </PageWrapper>
  );
}
