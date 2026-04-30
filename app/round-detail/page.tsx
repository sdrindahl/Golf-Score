'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Round, Course } from '@/types'
import { useAuth } from '@/lib/useAuth'
import PageWrapper from '@/components/PageWrapper'

function RoundDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roundId = searchParams ? searchParams.get('id') : null
  const isJustCompleted = searchParams ? searchParams.get('completed') === 'true' : false
  const auth = useAuth()

  const [round, setRound] = useState<Round | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [editingHoleIndex, setEditingHoleIndex] = useState<number | null>(null)
  const [editScore, setEditScore] = useState<number | string>('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Polling interval in ms
  const REFRESH_INTERVAL = 5000; // 5 seconds

  useEffect(() => {
    if (!roundId) return;

    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchRound = async () => {
        // Don't fetch if editing or there are unsaved changes
        if (editingHoleIndex !== null || hasUnsavedChanges) return;

        // Get current user for permission checking
        const user = auth.getCurrentUser();
        if (isMounted) setCurrentUser(user);

        try {
          const res = await fetch(`/api/get-round?id=${roundId}`, { cache: 'no-store' })
          if (!res.ok) {
            if (isMounted) setRound(null);
          } else {
            const { round: data, courses: apiCourses } = await res.json()
            if (data) {
              let courseIds: string[] = [];
              if (apiCourses && apiCourses.length > 0) {
                courseIds = apiCourses.map((c: any) => c.id)
              } else if (data.course_id) {
                courseIds = String(data.course_id).split(',').map((id: string) => id.trim()).filter(Boolean);
              }
              // Convert snake_case to camelCase and map per_hole_stats
              const camelRound: Round = {
                id: data.id,
                userId: data.user_id,
                userName: data.user_name,
                courseId: courseIds.join(','),
                courseName: data.course_name,
                selectedTee: data.selected_tee,
                date: data.date,
                scores: data.scores,
                totalScore: data.total_score,
                notes: data.notes,
                in_progress: data.in_progress,
                perHoleStats: data.per_hole_stats || [],
              };
              if (isMounted) setRound(camelRound);

              // Fetch course info from localStorage (for now)
              const savedCourses = localStorage.getItem('golfCourses');
              if (savedCourses) {
                const allCourses = JSON.parse(savedCourses) as Course[];
                const courseIdsArr = courseIds;
                let foundCourse: Course | null = null;
                if (courseIdsArr.length > 1) {
                  const selectedCourses = allCourses.filter(c => courseIdsArr.includes(c.id));
                  if (selectedCourses.length > 0) {
                    foundCourse = {
                      ...selectedCourses[0],
                      id: courseIdsArr.join(','),
                      name: camelRound.courseName,
                      holes: selectedCourses.flatMap(c => c.holes),
                      holeCount: selectedCourses.reduce((sum, c) => sum + (c.holes?.length || 0), 0),
                      par: selectedCourses.reduce((sum, c) => sum + (c.par || 0), 0),
                    };
                  }
                } else {
                  foundCourse = allCourses.find(c => c.id === camelRound.courseId) || null;
                }
                if (foundCourse && isMounted) {
                  setCourse(foundCourse);
                }
              }
            } else {
              if (isMounted) setRound(null);
            }
          }
        } catch (error) {
          console.error('Error loading round detail:', error);
        } finally {
          if (isMounted) setLoading(false);
        }
    };

    fetchRound();
    intervalId = setInterval(fetchRound, REFRESH_INTERVAL);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [roundId, editingHoleIndex, hasUnsavedChanges]);

  // Check if user can edit this round
  const canEditRound = (): boolean => {
    if (!currentUser || !round) return false
    if (currentUser.is_admin) return true
    return currentUser.id === round.userId
  }

  const handleDeleteRound = async () => {
    if (confirm('Are you sure you want to delete this round? This action cannot be undone.')) {
      // Delete from localStorage
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds)
        const updated = allRounds.filter((r: Round) => r.id !== roundId)
        localStorage.setItem('golfRounds', JSON.stringify(updated))
      }

      // Delete from Supabase via API
      if (roundId) {
        try {
          await fetch('/api/delete-round', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId }),
          })
        } catch (error) {
          console.log('Could not delete from Supabase:', error)
        }
      }

      // Redirect back to player profile
      if (round?.userId) {
        router.push(`/player?id=${round.userId}`)
      } else {
        router.push('/')
      }
    }
  }

  const handleHoleEdit = (holeIndex: number) => {
    if (!canEditRound()) return
    setEditingHoleIndex(holeIndex)
    setEditScore(round?.scores[holeIndex] || '')
  }

  const handleConfirmHoleScore = () => {
    if (editingHoleIndex === null || !round || !course) return
    
    const newScore = parseInt(String(editScore))
    if (isNaN(newScore) || newScore < 1) {
      alert('Please enter a valid score')
      return
    }

    // Create updated scores array with the new score for the edited hole
    const updatedScores = round.scores.map((score, idx) => idx === editingHoleIndex ? newScore : score)
    
    // Calculate total from the new scores array - sum all scores
    const totalScore = updatedScores.reduce((sum, score) => {
      const numScore = Number(score) || 0
      return sum + numScore
    }, 0)

    // Update the round locally
    const updatedRound = {
      ...round,
      scores: updatedScores,
      totalScore,
    }

    setRound(updatedRound)
    setHasUnsavedChanges(true)
    setEditingHoleIndex(null)
    setEditScore('')
  }

  const handleSaveAllChanges = async () => {
    console.log('🟢 Save Changes handler fired!')
    if (!round) {
      console.log('❌ No round found, aborting save.')
      return
    }

    // Save to localStorage
    const savedRoundsStr = localStorage.getItem('golfRounds')
    if (savedRoundsStr) {
      const allRounds = JSON.parse(savedRoundsStr) as Round[]
      const updated = allRounds.map((r: Round) => r.id === roundId ? round : r)
      localStorage.setItem('golfRounds', JSON.stringify(updated))
      console.log('✅ Updated round in localStorage:', round)
    } else {
      console.log('⚠️ No savedRounds found in localStorage')
    }

    // Save to Supabase via API
    try {
      await fetch('/api/save-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(round),
      })
      setHasUnsavedChanges(false)
      window.location.href = `/player?id=${round.userId}`
    } catch (error) {
      alert('Error saving changes to Supabase')
      setHasUnsavedChanges(false)
      window.location.href = `/player?id=${round.userId}`
    }
  }

  const handleDiscardChanges = () => {
    if (!roundId) return
    // Reload the round from localStorage
    try {
      const savedRounds = localStorage.getItem('golfRounds')
      if (savedRounds) {
        const allRounds = JSON.parse(savedRounds) as Round[]
        const foundRound = allRounds.find(r => r.id === roundId)
        if (foundRound) {
          setRound(foundRound)
        }
      }
    } catch (error) {
      console.error('Error reloading round:', error)
    }
    setHasUnsavedChanges(false)
  }

  // Compute nines for multi-nine support (mirroring track-round logic)
  const [nines, setNines] = useState<{ name: string; holes: import('@/types').Hole[] }[]>([]);
  useEffect(() => {
    if (!course) return;
    // Multi-nine: split holes by course if possible
    const courseIds = (round?.courseId || '').split(',');
    const savedCourses = localStorage.getItem('golfCourses');
    if (savedCourses && courseIds.length > 1) {
      const allCourses = JSON.parse(savedCourses);
      const selectedCourses = allCourses.filter((c: any) => courseIds.includes(c.id));
      const ninesArr = selectedCourses.map((c: any) => ({ name: c.name, holes: c.holes }));
      setNines(ninesArr);
    } else {
      setNines([{ name: course.name, holes: course.holes }]);
    }
  }, [course, round]);

  const [showPerformance, setShowPerformance] = useState(false);
  const [showPerHole, setShowPerHole] = useState(false);

  if (loading) {
    return (
      <PageWrapper title="Scorecard">
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
          <p className="text-gray-500">Loading scorecard...</p>
        </div>
      </PageWrapper>
    )
  }

  if (!round || !course) {
    return (
      <PageWrapper title="Scorecard">
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
          <p className="text-gray-500">Round not found</p>
          <button onClick={() => router.push('/')} className="btn-primary mt-4">Back to Home</button>
        </div>
      </PageWrapper>
    )
  }

  // Calculate round totals
  const roundData = {
    parTotal: course.holes.reduce((sum, hole) => sum + hole.par, 0),
    scoreTotal: round.scores.reduce((sum, score) => sum + score, 0),
  }

  // Find parent course name
  let parentCourseName = '';
  if (course && course.parent_id) {
    const savedCourses = typeof window !== 'undefined' ? localStorage.getItem('golfCourses') : null;
    if (savedCourses) {
      try {
        const allCourses = JSON.parse(savedCourses);
        const parent = allCourses.find((c: any) => c.id === course.parent_id);
        if (parent) parentCourseName = parent.name;
      } catch {}
    }
  }
  if (!parentCourseName && course) parentCourseName = course.name;

  // Helper function to get score type label
  const getScoreType = (score: number, par: number): string => {
    const diff = score - par
    if (score === 1) return 'Ace'
    if (diff === -3) return 'Alb'
    if (diff === -2) return 'Eagle'
    if (diff === -1) return 'Birdie'
    if (diff === 0) return 'Par'
    if (diff === 1) return 'Bogey'
    if (diff === 2) return 'D.Bogey'
    return 'Triple+'
  }

  // Helper function to get color for score type
  const getScoreColor = (score: number, par: number): string => {
    const diff = score - par
    if (score === 1) return 'from-purple-500 to-purple-700'
    if (diff === -3) return 'from-indigo-500 to-indigo-700'
    if (diff === -2) return 'from-blue-500 to-blue-700'
    if (diff === -1) return 'from-green-500 to-green-700'
    if (diff === 0) return 'from-gray-400 to-gray-600'
    if (diff === 1) return 'from-orange-500 to-orange-700'
    if (diff === 2) return 'from-red-500 to-red-700'
    return 'from-red-700 to-red-900'
  }

  // Calculate score distribution for this round
  const calculateScoreDistribution = () => {
    const distribution = {
      'Hole in 1': 0,
      'Alb': 0,
      'Eagle': 0,
      'Birdie': 0,
      'Par': 0,
      'Bogey': 0,
      'Double+': 0,
    }

    // Count score types across all holes in this round
    for (let i = 0; i < round.scores.length; i++) {
      const score = round.scores[i]
      if (score === 0) continue; // Ignore unplayed holes
      const hole = course.holes[i]
      const diff = score - hole.par

      if (score === 1) {
        distribution['Hole in 1']++
      } else if (diff === -3) {
        distribution['Alb']++
      } else if (diff === -2) {
        distribution['Eagle']++
      } else if (diff === -1) {
        distribution['Birdie']++
      } else if (diff === 0) {
        distribution['Par']++
      } else if (diff === 1) {
        distribution['Bogey']++
      } else if (diff >= 2) {
        distribution['Double+']++
      }
    }

    return distribution
  }

  const scoreDistribution = calculateScoreDistribution()
  const maxDistribution = Math.max(...Object.values(scoreDistribution), 1)

  return (

    <>
      <PageWrapper title="">
        <div className="max-w-4xl mx-auto space-y-6 pb-32 mt-8">

          {/* Move header just above Holes Completed card */}
          <div className="flex flex-col items-center mb-4">
            <div className="text-2xl font-bold text-white text-center drop-shadow-md">{parentCourseName}</div>
            <div className="text-lg font-semibold text-white text-center mt-1 drop-shadow-md">{round.userName}</div>
            <div className="text-sm text-white text-center mt-0.5 drop-shadow-md">{new Date(round.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            {round.notes && (
              <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm text-gray-700 border border-blue-200 w-full max-w-md text-center">
                <strong>Notes:</strong> {round.notes}
              </div>
            )}
          </div>

          {/* All Holes Grid - Grouped by Nines (Track Round style) */}
          <div className="mb-6 p-6 rounded-xl border-2 border-green-600 bg-green-50">
            <div className="font-semibold text-green-900 mb-2 text-base">Holes Completed</div>
            {nines.map((nine, nineIdx) => {
              // Find the starting index for this nine's holes in the flat course.holes array
              const startIdx = nines.slice(0, nineIdx).reduce((sum, n) => sum + n.holes.length, 0)
              // Helper for abbreviation
              const getResultLabel = (score: number, par: number) => {
                if (!score) return '';
                const diff = score - par;
                if (score === 1) return 'A';      // Ace
                if (diff <= -3) return 'Alb';     // Albatross
                if (diff === -2) return 'E';      // Eagle
                if (diff === -1) return 'B';      // Birdie
                if (diff === 0) return 'P';       // Par
                if (diff === 1) return 'Bo';      // Bogey
                if (diff === 2) return 'Db';      // Double Bogey
                if (diff > 2) return 'Tb';        // Triple+ Bogey
                return '';
              };
              // Helper for color
              const getColorClass = (score: number, par: number) => {
                if (!score) return 'bg-gray-50 border-gray-300 text-gray-700';
                const diff = score - par;
                if (score === 1) return 'bg-purple-600 text-white';
                if (diff <= -3) return 'bg-blue-900 text-white';
                if (diff === -2) return 'bg-blue-600 text-white';
                if (diff === -1) return 'bg-green-600 text-white';
                if (diff === 0) return 'bg-gray-500 text-white';
                if (diff === 1) return 'bg-orange-500 text-white';
                if (diff === 2) return 'bg-red-600 text-white';
                if (diff > 2) return 'bg-red-800 text-white';
                return 'bg-gray-50 border-gray-300 text-gray-700';
              };
              return (
                <div key={nineIdx}>
                  <div className="font-semibold text-green-700 mb-1 text-xs pl-1">{nine.name}</div>
                  <div className="grid grid-cols-9 gap-1 mb-1 w-full">
                    {nine.holes.map((hole, idx) => {
                      const flatIdx = startIdx + idx;
                      const score = round.scores[flatIdx];
                      const par = hole.par;
                      const label = getResultLabel(score, par);
                      const colorClass = getColorClass(score, par);
                      return (
                        <div
                          key={hole.holeNumber + '-' + nineIdx}
                          className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg border font-bold text-xs sm:text-base transition p-0 flex flex-col items-center justify-center ${colorClass}`}
                          title={score > 0 ? `Hole ${hole.holeNumber}: Score ${score} (${label})` : `Hole ${hole.holeNumber}`}
                        >
                          <span className="absolute top-0.5 left-0.5 text-[10px] font-semibold text-gray-700" style={{letterSpacing: '0.02em'}}>{hole.holeNumber}</span>
                          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-base sm:text-lg font-extrabold w-full text-center">{score > 0 ? score : ''}</span>
                          </span>
                          <span className="absolute left-0 right-0 text-[9px] font-medium break-words text-center w-full text-black" style={{bottom: 0}}>{score > 0 ? label : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center p-2 rounded-lg font-semibold text-sm bg-gray-100 mt-3">
              {(() => {
                // Only count completed holes for score and vs par
                const completed = round.scores.map((s, i) => ({ score: s, par: course.holes[i]?.par })).filter(x => x.score > 0);
                const completedScore = completed.reduce((sum, x) => sum + x.score, 0);
                // Par for the displayed holes (all holes in this card)
                const displayedPar = nines.reduce((sum, nine) => sum + nine.holes.reduce((s, h) => s + (h.par || 0), 0), 0);
                // Par for completed holes (for vs par)
                const completedPar = completed.reduce((sum, x) => sum + (x.par || 0), 0);
                const diff = completedScore - completedPar;
                return <>
                  <span className="text-gray-800 mr-2">Total</span>
                  <span className="text-blue-600 font-bold text-lg mr-4">{completedScore}</span>
                  <span className="text-gray-700 mr-4">Par {displayedPar}</span>
                  <span className={diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : 'text-gray-700'}>
                    {diff === 0 ? 'E' : (diff < 0 ? diff : '+' + diff)}
                  </span>
                </>;
              })()}
            </div>
          </div>


          {/* Performance Breakdown (collapsible) */}
          <div className="bg-white/95 backdrop-blur rounded-2xl p-4 shadow-lg border border-white/20">
            <button
              className="flex items-center w-full justify-between text-lg font-bold text-gray-800 mb-3 focus:outline-none"
              onClick={() => setShowPerformance(v => !v)}
              aria-expanded={showPerformance}
              aria-controls="performance-breakdown"
            >
              Performance Breakdown
              <span className="ml-2 text-xl">{showPerformance ? '▼' : '▶'}</span>
            </button>
            {showPerformance && (
              <div id="performance-breakdown" className="space-y-2">
                {Object.entries(scoreDistribution).map(([type, count]) => {
                  const percentage = (count / maxDistribution) * 100
                  const colors: { [key: string]: string } = {
                    'Hole in 1': 'from-purple-500 to-purple-400',
                    'Eagle': 'from-blue-500 to-blue-400',
                    'Birdie': 'from-green-500 to-green-400',
                    'Par': 'from-yellow-500 to-yellow-400',
                    'Bogey': 'from-orange-500 to-orange-400',
                    'Double+': 'from-red-500 to-red-400',
                  }
                  const emojis: { [key: string]: string } = {
                    'Hole in 1': '⭐',
                    'Eagle': '🦅',
                    'Birdie': '🐦',
                    'Par': '✔️',
                    'Bogey': '⚠️',
                    'Double+': '❌',
                  }
                  return count > 0 ? (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{emojis[type]}</span>
                          <span className="text-sm font-semibold text-gray-700">{type}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-800">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`bg-gradient-to-r ${colors[type]} h-2 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  ) : null
                })}
              </div>
            )}
          </div>

          {/* Per-Hole Stats Breakdown (collapsible) */}
          <div className="bg-white/95 backdrop-blur rounded-2xl p-4 shadow-lg border border-white/20">
            <button
              className="flex items-center w-full justify-between text-lg font-bold text-gray-800 mb-3 focus:outline-none"
              onClick={() => setShowPerHole(v => !v)}
              aria-expanded={showPerHole}
              aria-controls="per-hole-breakdown"
            >
              Per-Hole Stats Breakdown
              <span className="ml-2 text-xl">{showPerHole ? '▼' : '▶'}</span>
            </button>
            {showPerHole && (
              <div id="per-hole-breakdown" className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2">Hole</th>
                      <th className="p-2">Score</th>
                      <th className="p-2">FIR</th>
                      <th className="p-2">GIR</th>
                      <th className="p-2">Putts</th>
                      <th className="p-2">Putt 1 Dist</th>
                      <th className="p-2">Putt 2 Dist</th>
                      <th className="p-2">Putt 3 Dist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.holes.map((hole, idx) => {
                      const stats = round.perHoleStats && round.perHoleStats[idx] ? round.perHoleStats[idx] : {};
                      const puttDistances = Array.isArray(stats.puttDistances) ? stats.puttDistances : [];
                      return (
                        <tr key={hole.holeNumber} className="border-b last:border-0">
                          <td className="p-2 text-center font-bold">{hole.holeNumber}</td>
                          <td className="p-2 text-center">{round.scores[idx] || '-'}</td>
                          <td className="p-2 text-center">{stats.fairwayHit === 'hit' ? '✓' : stats.fairwayHit === 'L' ? 'L' : stats.fairwayHit === 'R' ? 'R' : '-'}</td>
                          <td className="p-2 text-center">{stats.gir === true ? '✓' : stats.gir === false ? '✗' : '-'}</td>
                          <td className="p-2 text-center">{puttDistances.length > 0 ? puttDistances.length : '-'}</td>
                          <td className="p-2 text-center">{puttDistances[0] !== undefined ? `${puttDistances[0]} ft` : '-'}</td>
                          <td className="p-2 text-center">{puttDistances[1] !== undefined ? `${puttDistances[1]} ft` : '-'}</td>
                          <td className="p-2 text-center">{puttDistances[2] !== undefined ? `${puttDistances[2]} ft` : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => {
                const from = searchParams ? searchParams.get('from') : null;
                if (from === 'rounds-in-progress') {
                  router.push('/rounds-in-progress');
                } else {
                  router.push(`/player?id=${round.userId}`);
                }
              }}
              className={`flex-1 min-w-32 font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all ${
                isJustCompleted
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-white/90 hover:bg-white text-green-700 border border-white/20'
              }`}
            >
              {isJustCompleted ? 'Complete Round' : '← Back'}
            </button>
            {hasUnsavedChanges && canEditRound() && (
              <>
                <button onClick={handleDiscardChanges} className="flex-1 min-w-32 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  Discard Changes
                </button>
                <button onClick={handleSaveAllChanges} className="flex-1 min-w-32 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  Save Changes
                </button>
              </>
            )}
            {canEditRound() && !hasUnsavedChanges && (
              <button onClick={handleDeleteRound} className="flex-1 min-w-32 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                Delete Round
              </button>
            )}
          </div>
        </div>
      </PageWrapper>

      {/* Edit Hole Modal */}
      {editingHoleIndex !== null && course && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-lg max-w-sm w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Hole {course.holes[editingHoleIndex].holeNumber}</h2>
            <p className="text-sm text-gray-600 mb-6 text-center">Par: {course.holes[editingHoleIndex].par}</p>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => {
                  const current = parseInt(String(editScore)) || round.scores[editingHoleIndex] || 0
                  setEditScore(Math.max(1, current - 1))
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl text-3xl transition-all"
              >
                −
              </button>
              <div className="text-5xl font-bold text-blue-600 w-24 text-center">
                {editScore || 0}
              </div>
              <button
                onClick={() => {
                  const current = parseInt(String(editScore)) || round.scores[editingHoleIndex] || 0
                  setEditScore(current + 1)
                }}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl text-3xl transition-all"
              >
                +
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingHoleIndex(null)
                  setEditScore('')
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmHoleScore}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Home Button - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 px-4 py-4 z-10">
        <Link href="/">
          <button className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20">
            🏠 Home
          </button>
        </Link>
      </div>
    </>
  )
}

export default function RoundDetail() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <RoundDetailContent />
    </Suspense>
  )
}
