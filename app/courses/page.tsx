'use client'

import { useState, useEffect } from 'react'
// import { useRouter } from 'next/navigation' (removed duplicate)
import Link from 'next/link'
import PageWrapper from '@/components/PageWrapper'
import { Course, User } from '@/types'
import { COURSES_DATABASE } from '@/data/courses'
import { saveRoundToSupabase, deleteCourseFromSupabase } from '@/lib/dataSync'
import { useAuth } from '@/lib/useAuth'

import { useRouter } from 'next/navigation'

export default function CoursesPage() {
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

  useEffect(() => {
    // Reset tee selection when a new course is selected
    if (selectedCourse) {
      setSelectedTee(null)
    }
  }, [selectedCourse?.id])

  useEffect(() => {
    // Set client flag and load user
    setIsClient(true)
    const user = auth.getCurrentUser()
    setCurrentUser(user)
  }, [])


  useEffect(() => {
    // Load courses from localStorage
    const savedCourses = localStorage.getItem('golfCourses')
    if (savedCourses) {
      setAllCourses(JSON.parse(savedCourses))
    } else {
      setAllCourses(COURSES_DATABASE)
      localStorage.setItem('golfCourses', JSON.stringify(COURSES_DATABASE))
    }

    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('favoriteCourses')
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites))
    }
  }, [])

  // Update displayedCourses when allCourses, searchTerm, or showFavoritesOnly changes
  useEffect(() => {
    let filtered = allCourses;
    if (showFavoritesOnly) {
      filtered = filtered.filter((course) => favorites.includes(course.id));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((course) =>
        course.name.toLowerCase().includes(term) ||
        course.location.toLowerCase().includes(term) ||
        course.state.toLowerCase().includes(term)
      );
    }
    setDisplayedCourses(filtered);
  }, [allCourses, searchTerm, showFavoritesOnly, favorites]);


  // --- Helper functions (must be inside CoursesPage) ---
  const toggleFavorite = (courseId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newFavorites = favorites.includes(courseId)
      ? favorites.filter((id: string) => id !== courseId)
      : [...favorites, courseId];
    setFavorites(newFavorites);
    localStorage.setItem('favoriteCourses', JSON.stringify(newFavorites));
  };

  const isFavorite = (courseId: string) => favorites.includes(courseId);

  const getTotalYardage = (course: Course, tee: 'men' | 'women' | 'senior' | 'championship') => {
    if (!course.holes || !Array.isArray(course.holes)) return 0;
    return course.holes.reduce((sum, hole) => {
      const teeData = hole[tee] || hole['men'];
      return sum + (teeData?.yardage || 0);
    }, 0);
  };

  const getTeeLabel = (tee: string) => {
    switch (tee) {
      case 'men': return 'Men';
      case 'women': return 'Women';
      case 'senior': return 'Senior';
      case 'championship': return 'Champ';
      default: return tee;
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!currentUser?.is_admin) {
      alert('You must be logged in as an admin to delete courses');
      return;
    }
    setDeleteLoading(true);
    try {
      console.log(`🗑️ Admin deleting course: ${courseId}`);
      await deleteCourseFromSupabase(courseId);
      setAllCourses(allCourses.filter((c: Course) => c.id !== courseId));
      setDisplayedCourses(displayedCourses.filter((c: Course) => c.id !== courseId));
      const localCourses = allCourses.filter((c: Course) => c.id !== courseId);
      localStorage.setItem('golfCourses', JSON.stringify(localCourses));
      setDeleteModal(null);
      alert('Course deleted successfully');
    } catch (error: any) {
      console.error('❌ Error deleting course:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Don't render until client is hydrated
  if (!isClient) {
    return null
  }

  // Navigation handlers for bottom nav
  const handleViewRounds = () => router.push('/')
  const handleViewCourses = () => router.push('/courses')
  const handleViewGolfers = () => router.push('/players')
  const handleSettings = () => router.push('/settings')

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col pb-24">
      {/* Modal for round in progress warning */}
      {showRoundInProgressMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-bold mb-2 text-gray-800">Round In Progress</h2>
            <p className="text-gray-700 mb-4">You already have a round in progress. Would you like to continue that round or stop it and start a new one?</p>
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg shadow transition"
                onClick={() => {
                  setShowRoundInProgressMsg(false);
                  if (currentRoundId) {
                    router.push(`/track-round?id=${currentRoundId}`);
                  }
                }}
              >
                Continue Round
              </button>
              <button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg shadow transition"
                onClick={() => {
                  setShowRoundInProgressMsg(false);
                  // Remove current round from localStorage
                  const savedRounds = localStorage.getItem('golfRounds');
                  if (savedRounds && currentRoundId) {
                    const allRounds = JSON.parse(savedRounds) as { id: string }[];
                    const filteredRounds = allRounds.filter((r) => r.id !== currentRoundId);
                    localStorage.setItem('golfRounds', JSON.stringify(filteredRounds));
                  }
                  // Remove round from Supabase if it exists
                  if (currentRoundId) {
                    import('@/lib/dataSync').then(({ deleteRoundFromSupabase }) => {
                      deleteRoundFromSupabase(currentRoundId);
                    });
                    localStorage.removeItem('currentRoundId');
                    localStorage.removeItem(`currentHoleIndex-${currentRoundId}`);
                    setCurrentRoundId(null);
                  }
                }}
              >
                Stop & Start New
              </button>
            </div>
            <button
              className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg transition"
              onClick={() => setShowRoundInProgressMsg(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <PageWrapper title="Courses" userName="">
        <div className="space-y-4">

        {/* Stop Round in Progress Button */}
        {currentRoundId && (
          <div className="mb-4">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to stop and discard the round in progress? This cannot be undone.')) {
                  // Remove current round from localStorage
                  const savedRounds = localStorage.getItem('golfRounds')
                  if (savedRounds) {
                    const allRounds = JSON.parse(savedRounds)
                    const filteredRounds = allRounds.filter((r: any) => r.id !== currentRoundId)
                    localStorage.setItem('golfRounds', JSON.stringify(filteredRounds))
                  }
                  // Remove round from Supabase if it exists
                  import('@/lib/dataSync').then(({ deleteRoundFromSupabase }) => {
                    deleteRoundFromSupabase(currentRoundId)
                  })
                  // Remove round progress
                  localStorage.removeItem('currentRoundId')
                  localStorage.removeItem(`currentHoleIndex-${currentRoundId}`)
                  setCurrentRoundId(null)
                  alert('Round in progress has been stopped and removed.')
                }
              }}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all text-base mb-2"
            >
              <span className="text-lg">🛑</span>
              <span>Stop Round in Progress</span>
            </button>
          </div>
        )}
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Favorites Filter */}
        <div className="flex gap-3 mb-4 items-center">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors border-2 ${
              showFavoritesOnly
                ? 'bg-green-600 text-white border-green-700'
                : 'bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300'
            }`}
          >
            {showFavoritesOnly ? 'All Courses' : '⛳ Favorites'}
          </button>
          <p className="text-gray-600 text-xs">Tap the flag icon to favorite</p>
        </div>

        {/* Courses List */}

        {displayedCourses.map((course, idx) => {
          // All cards use the same green gradient and border
          const bgGradient = 'from-green-100 to-green-200';
          const borderColor = 'border-green-400';
          const shadow = '';
          return (
            <div key={course.id}>
              {/* Course Card */}
              <div
                onClick={() => selectedCourse?.id === course.id ? setSelectedCourse(null) : setSelectedCourse(course)}
                className={`bg-gradient-to-br ${bgGradient} card cursor-pointer hover:shadow-2xl hover:scale-105 hover:-translate-y-1 flex items-center gap-2 border-2 ${borderColor} ${shadow} py-2 px-3 min-h-0 transition-all`}
                style={{minHeight:'0',paddingTop:'0.5rem',paddingBottom:'0.5rem',paddingLeft:'0.75rem',paddingRight:'0.75rem'}}
              >
                <button
                  onClick={(e) => toggleFavorite(course.id, e)}
                  className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isFavorite(course.id)
                      ? 'bg-green-500 border-2 border-green-600'
                      : 'bg-white border-2 border-gray-300 hover:border-green-500'
                  }`}
                  title={isFavorite(course.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <span className={`text-xl transition-colors ${isFavorite(course.id) ? 'text-white' : 'text-gray-600'}`}>
                    ⛳
                  </span>
                </button>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900 truncate" style={{maxWidth:'7.5rem'}}>{course.name}</h3>
                  {course.location && course.state &&
                    course.location !== 'Unknown' &&
                    course.state !== 'Unknown' && (
                      <span className="text-xs text-gray-600">{course.location}, {course.state}</span>
                  )}
                  {course.par && <span className="text-xs font-semibold text-gray-600">Par {course.par}</span>}
                  {course.holes && <span className="text-xs text-gray-600">{course.holes.length} holes</span>}
                  {course.holes && <span className="text-xs text-gray-600">{getTotalYardage(course, 'men').toLocaleString()} yds</span>}
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-xl transition-transform ${selectedCourse?.id === course.id ? 'transform rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </div>
              {/* Expanded Course Details */}
              {selectedCourse?.id === course.id && (
                <div className="card rounded-t-none border-t-0 space-y-4">
                  {/* Full Course Name with Play Button */}
                  <div className="mb-4 pb-4 border-b border-gray-200 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900">{course.name}</h2>
                      <p className="text-gray-600 text-sm mt-1">{course.location}, {course.state}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          alert('Please log in to start a round');
                          return;
                        }
                        if (currentRoundId) {
                          setShowRoundInProgressMsg(true);
                          return;
                        }
                        if (!selectedTee) {
                          alert('Select Tee to Start your Round');
                          return;
                        }
                        try {
                          const newRound = {
                            id: `round-${Date.now()}`,
                            userId: currentUser.id,
                            userName: currentUser.name,
                            courseId: course.id,
                            courseName: course.name,
                            selectedTee: selectedTee,
                            date: new Date().toISOString(),
                            scores: Array(course.holes.length).fill(0),
                            totalScore: 0,
                            in_progress: true,
                          };
                          const savedRounds = localStorage.getItem('golfRounds');
                          const golfRounds = savedRounds ? JSON.parse(savedRounds) : [];
                          golfRounds.push(newRound);
                          localStorage.setItem('golfRounds', JSON.stringify(golfRounds));
                          saveRoundToSupabase(newRound).catch(error => {
                            console.warn('Warning: Could not save round to Supabase, but saved locally:', error.message);
                          });
                          localStorage.setItem('currentRoundId', newRound.id);
                          setCurrentRoundId(newRound.id);
                          router.push(`/track-round?id=${newRound.id}`);
                        } catch (error) {
                          console.error('Error starting round:', error);
                          alert('Error starting round. Please try again.');
                        }
                      }}
                      className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full px-4 py-3 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 font-semibold"
                      title="Start Round"
                    >
                      <span className="text-xl">▶</span>
                      <span className="text-sm">Start Round</span>
                    </button>
                  </div>

                  {/* Tee Selection */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {(['men', 'women', 'senior', 'championship'] as const).map((tee) => (
                      <button
                        key={tee}
                        onClick={() => setSelectedTee(tee)}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                          selectedTee === tee
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {getTeeLabel(tee)}
                      </button>
                    ))}
                  </div>

                  {/* Scorecard */}
                  <div className="overflow-x-auto text-sm">
                    <table className="w-full">
                      <tbody>
                        {/* FRONT 9 */}
                        <tr className="border-b border-gray-200">
                          <td colSpan={10} className="font-bold text-gray-900 py-2 text-xs uppercase">
                            FRONT 9
                          </td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Hole</td>
                          {course.holes.slice(0, 9).map((hole) => (
                            <td key={hole.holeNumber} className="text-center font-semibold px-1 py-2 text-xs">
                              {hole.holeNumber}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Par</td>
                          {course.holes.slice(0, 9).map((hole) => (
                            <td key={`par-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                              {hole.par}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Yds</td>
                          {course.holes.slice(0, 9).map((hole) => {
                            const teeData = hole[selectedTee || 'men'];
                            const yardage = teeData?.yardage || hole.men?.yardage || '—';
                            return (
                              <td key={`yds-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                                {yardage}
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Hcp</td>
                          {course.holes.slice(0, 9).map((hole) => (
                            <td key={`hcp-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                              {hole.handicap}
                            </td>
                          ))}
                        </tr>

                        {/* BACK 9 */}
                        <tr className="border-t-2 border-gray-300 border-b border-gray-200">
                          <td colSpan={10} className="font-bold text-gray-900 py-2 text-xs uppercase">
                            BACK 9
                          </td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Hole</td>
                          {course.holes.slice(9, 18).map((hole) => (
                            <td key={hole.holeNumber} className="text-center font-semibold px-1 py-2 text-xs">
                              {hole.holeNumber}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Par</td>
                          {course.holes.slice(9, 18).map((hole) => (
                            <td key={`par-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                              {hole.par}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Yds</td>
                          {course.holes.slice(9, 18).map((hole) => {
                            const teeData = hole[selectedTee || 'men'];
                            const yardage = teeData?.yardage || hole.men?.yardage || '—';
                            return (
                              <td key={`yds-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                                {yardage}
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td className="font-semibold text-gray-600 py-2 px-2 text-xs">Hcp</td>
                          {course.holes.slice(9, 18).map((hole) => (
                            <td key={`hcp-${hole.holeNumber}`} className="text-center px-1 py-2 text-xs">
                              {hole.handicap}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Admin Actions */}
                  {currentUser?.is_admin && (
                    <div className="mt-6 pt-4 border-t border-gray-200 flex gap-2">
                      <Link
                        href={`/edit-course?id=${course.id}`}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-center"
                      >
                        ✏️ Edit Course
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteModal({ courseId: course.id, courseName: course.name });
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        🗑️ Delete Course
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {displayedCourses.length === 0 && allCourses.length > 0 && (
          <div className="card text-center text-gray-500">
            No courses match your search.
          </div>
        )}

        {allCourses.length === 0 && (
          <div className="card text-center text-gray-500">
            No courses added yet.
          </div>
        )}

        {deleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full">
              <h2 className="text-xl font-bold mb-4 text-red-600">⚠️ Delete Course</h2>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete <strong>{deleteModal.courseName}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteModal(null)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCourse(deleteModal.courseId)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Course'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>


    </div>
  )
}
