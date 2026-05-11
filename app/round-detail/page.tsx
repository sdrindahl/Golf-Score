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
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedHoleIndex, setSelectedHoleIndex] = useState<number | null>(null)
  const [editScore, setEditScore] = useState<number | string>('')
  const [editStats, setEditStats] = useState<any>({})
  const [puttBeingEdited, setPuttBeingEdited] = useState<number | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showEditHelpModal, setShowEditHelpModal] = useState(false)

  // Polling interval in ms
  const REFRESH_INTERVAL = 5000; // 5 seconds

  useEffect(() => {
    if (!roundId) return;

    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchRound = async () => {
        // Don't fetch if editing or there are unsaved changes
        if (isEditMode || hasUnsavedChanges) return;

        // Get current user for permission checking
        const user = auth.getCurrentUser();
        if (isMounted) setCurrentUser(user);

        try {
          console.log('[DEBUG] round-detail: Fetching fresh round data from API for id:', roundId)
          const res = await fetch(`/api/get-round?id=${roundId}`, { cache: 'no-store' })
          
          if (!res.ok) {
            console.warn('[DEBUG] round-detail: API returned non-ok status:', res.status)
            if (isMounted) setRound(null);
            return;
          }
          
          const responseData = await res.json()
          console.log('[DEBUG] round-detail: API response:', responseData)
          
          const data = responseData.round
          const apiCourses = responseData.courses
          
          if (data && data.id) {
            console.log('[DEBUG] round-detail: Processing round data:', data.id)
            let courseIds: string[] = [];
            if (apiCourses && apiCourses.length > 0) {
              courseIds = apiCourses.map((c: any) => c.id)
            } else if (data.course_id) {
              courseIds = String(data.course_id).split(',').map((id: string) => id.trim()).filter(Boolean);
            }
            // Convert snake_case to camelCase and map per_hole_stats
            let camelRound: Round = {
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
            console.log('[DEBUG] Loaded perHoleStats from API:', JSON.stringify(camelRound.perHoleStats));
            
            // Ensure perHoleStats array has proper structure (preserves conceded flag)
            const ensuredRound = {
              ...camelRound,
              perHoleStats: (camelRound.perHoleStats || []).map((stat: any) => ({
                ...stat, // Preserve all existing properties including 'conceded'
              })) || [],
            };
            console.log('[DEBUG] After ensuring structure, perHoleStats:', JSON.stringify(ensuredRound.perHoleStats));
            
            if (isMounted) {
              setRound(ensuredRound);
              
              // Also sync back to localStorage so local edits work
              const savedRoundsStr = localStorage.getItem('golfRounds')
              if (savedRoundsStr) {
                try {
                  const allRounds = JSON.parse(savedRoundsStr) as Round[]
                  const updated = allRounds.map((r: Round) => r.id === roundId ? ensuredRound : r)
                  localStorage.setItem('golfRounds', JSON.stringify(updated))
                } catch (e) {
                  console.warn('[DEBUG] Could not sync to localStorage:', e)
                }
              }
            }

            // Fetch course info from localStorage
            const savedCourses = localStorage.getItem('golfCourses');
            if (savedCourses) {
              const allCourses = JSON.parse(savedCourses) as Course[];
              let foundCourse: Course | null = null;
              const courseIdsArr = courseIds;
              if (courseIdsArr.length > 1) {
                const selectedCourses = allCourses.filter(c => courseIdsArr.includes(c.id));
                if (selectedCourses.length > 0) {
                  foundCourse = {
                    ...selectedCourses[0],
                    id: courseIdsArr.join(','),
                    name: ensuredRound.courseName || 'Combined Course',
                    holes: selectedCourses.flatMap(c => c.holes),
                    holeCount: selectedCourses.reduce((sum, c) => sum + (c.holes?.length || 0), 0),
                    par: selectedCourses.reduce((sum, c) => sum + (c.par || 0), 0),
                  };
                }
              } else {
                foundCourse = allCourses.find(c => c.id === ensuredRound.courseId) || null;
              }
              if (foundCourse && isMounted) {
                setCourse(foundCourse);
              }
            }
          } else {
            console.warn('[DEBUG] round-detail: No round data in response:', responseData)
            if (isMounted) setRound(null);
          }
        } catch (error) {
          console.error('[DEBUG] Error loading round detail:', error);
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
  }, [roundId, isEditMode, hasUnsavedChanges]);

  // Ensure edit mode is off when component loads
  useEffect(() => {
    if (roundId && isEditMode) {
      console.log('[DEBUG] Force exiting edit mode on component load for roundId:', roundId)
      setIsEditMode(false)
      setSelectedHoleIndex(null)
      setEditScore('')
      setEditStats({})
      setPuttBeingEdited(null)
    }
  }, [roundId]);

  // Check if user can edit this round
  const canEditRound = (): boolean => {
    if (!currentUser || !round) return false
    if (currentUser.is_admin) return true
    return currentUser.id === round.userId
  }

  // Check if round is within 24 hours (can edit holes)
  const isWithin24Hours = (): boolean => {
    if (!round) return false
    const roundDate = new Date(round.date)
    const now = new Date()
    const diffMs = now.getTime() - roundDate.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return diffHours < 24
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
    setSelectedHoleIndex(holeIndex)
    setEditScore(round?.scores[holeIndex] || '')
    // Initialize stats from existing data or empty object
    const existingStats = round?.perHoleStats?.[holeIndex] || {}
    const existingPutts = existingStats.putts || 0
    const existingDistances = Array.isArray(existingStats.puttDistances) ? [...existingStats.puttDistances] : []
    
    // Ensure puttDistances array matches the number of putts
    let puttDistances = [...existingDistances]
    while (puttDistances.length < existingPutts) {
      puttDistances.push(0)
    }
    puttDistances = puttDistances.slice(0, existingPutts)
    
    setEditStats({
      fairwayHit: existingStats.fairwayHit || undefined,
      gir: existingStats.gir || false,
      putts: existingPutts,
      puttDistances: puttDistances,
    })
    setPuttBeingEdited(null)
  }

  const enterEditMode = () => {
    if (!canEditRound()) return
    if (!isWithin24Hours()) {
      alert('Cannot edit holes on a round older than 24 hours')
      return
    }
    // Always show the help modal
    setShowEditHelpModal(true)
    setIsEditMode(true)
    setSelectedHoleIndex(null)
  }

  const exitEditMode = () => {
    setIsEditMode(false)
    setSelectedHoleIndex(null)
    setEditScore('')
    setEditStats({})
    setPuttBeingEdited(null)
    
    // Reload the round from localStorage to get the latest data with conceded flags
    if (roundId) {
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
    }
  }

  const handleConfirmHoleScore = async () => {
    if (selectedHoleIndex === null || !round || !course) return
    
    const newScore = parseInt(String(editScore))
    if (isNaN(newScore) || newScore < 0) {
      alert('Please enter a valid score (0 or higher)')
      return
    }

    // Create updated scores array with the new score for the edited hole
    const updatedScores = round.scores.map((score, idx) => idx === selectedHoleIndex ? newScore : score)
    
    // Calculate total from the new scores array - sum all scores
    const totalScore = updatedScores.reduce((sum, score) => {
      const numScore = Number(score) || 0
      return sum + numScore
    }, 0)

    // Update perHoleStats with the edited stats
    const updatedPerHoleStats = [...(round.perHoleStats || [])]
    updatedPerHoleStats[selectedHoleIndex] = {
      ...updatedPerHoleStats[selectedHoleIndex],
      fairwayHit: editStats.fairwayHit,
      gir: editStats.gir,
      putts: editStats.putts,
      puttDistances: editStats.puttDistances,
      conceded: false, // Clear conceded flag when a score is entered
    }

    // Update the round locally
    const updatedRound = {
      ...round,
      scores: updatedScores,
      totalScore,
      perHoleStats: updatedPerHoleStats,
    }

    setRound(updatedRound)
    
    // Immediately save to localStorage
    const savedRoundsStr = localStorage.getItem('golfRounds')
    if (savedRoundsStr) {
      const allRounds = JSON.parse(savedRoundsStr) as Round[]
      const updated = allRounds.map((r: Round) => r.id === roundId ? updatedRound : r)
      localStorage.setItem('golfRounds', JSON.stringify(updated))
      console.log('✅ Saved hole to localStorage:', updatedRound)
    }
    
    // Immediately save to Supabase
    try {
      await fetch('/api/save-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRound),
      })
      console.log('✅ Synced hole to Supabase:', updatedRound)
    } catch (error) {
      console.error('⚠️ Error syncing to Supabase:', error)
      alert('Note: Changes saved locally but sync to Supabase failed')
    }
    
    setHasUnsavedChanges(false)
    setSelectedHoleIndex(null)
    setEditScore('')
    setEditStats({})
    setPuttBeingEdited(null)
  }

  const handleConcedeHole = async () => {
    if (selectedHoleIndex === null || !round || !course) return
    
    // Create updated scores array with score of 0 for the edited hole
    const updatedScores = round.scores.map((score, idx) => idx === selectedHoleIndex ? 0 : score)
    
    // Calculate total from the new scores array - sum all scores
    const totalScore = updatedScores.reduce((sum, score) => {
      const numScore = Number(score) || 0
      return sum + numScore
    }, 0)

    // Update perHoleStats with cleared stats and conceded flag
    const updatedPerHoleStats = [...(round.perHoleStats || [])]
    updatedPerHoleStats[selectedHoleIndex] = {
      conceded: true,
      fairwayHit: undefined,
      gir: false,
      putts: 0,
      puttDistances: [],
    }
    console.log('[DEBUG] Conceding hole', selectedHoleIndex, 'with perHoleStats:', JSON.stringify(updatedPerHoleStats[selectedHoleIndex]));

    // Update the round locally
    const updatedRound = {
      ...round,
      scores: updatedScores,
      totalScore,
      perHoleStats: updatedPerHoleStats,
    }

    setRound(updatedRound)
    
    // Immediately save to localStorage
    const savedRoundsStr = localStorage.getItem('golfRounds')
    if (savedRoundsStr) {
      const allRounds = JSON.parse(savedRoundsStr) as Round[]
      const updated = allRounds.map((r: Round) => r.id === roundId ? updatedRound : r)
      localStorage.setItem('golfRounds', JSON.stringify(updated))
      console.log('✅ Saved conceded hole to localStorage. Hole', selectedHoleIndex, 'conceded flag:', updatedRound.perHoleStats?.[selectedHoleIndex]?.conceded)
    }
    
    // Immediately save to Supabase
    try {
      await fetch('/api/save-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRound),
      })
      console.log('✅ Synced conceded hole to Supabase:', updatedRound)
    } catch (error) {
      console.error('⚠️ Error syncing to Supabase:', error)
      alert('Note: Changes saved locally but sync to Supabase failed')
    }
    
    setHasUnsavedChanges(false)
    setSelectedHoleIndex(null)
    setEditScore('')
    setEditStats({})
    setPuttBeingEdited(null)
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
      // Clean up edit state before redirecting
      exitEditMode()
      setHasUnsavedChanges(false)
      window.location.href = `/player?id=${round.userId}`
    } catch (error) {
      alert('Error saving changes to Supabase')
      // Clean up edit state before redirecting
      exitEditMode()
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

  // Calculate FIR stats (hit, miss left, miss right)
  const calculateFIRStats = () => {
    let hit = 0, missLeft = 0, missRight = 0, total = 0;
    (round?.perHoleStats || []).forEach((stats) => {
      if (stats?.fairwayHit) {
        total++;
        if (stats.fairwayHit === 'hit') hit++;
        else if (stats.fairwayHit === 'L') missLeft++;
        else if (stats.fairwayHit === 'R') missRight++;
      }
    });
    return {
      hitPercent: total > 0 ? Math.round((hit / total) * 100) : 0,
      missLeftPercent: total > 0 ? Math.round((missLeft / total) * 100) : 0,
      missRightPercent: total > 0 ? Math.round((missRight / total) * 100) : 0,
      total,
    };
  }

  // Calculate GIR stats
  const calculateGIRStats = () => {
    let girCount = 0, totalHoles = 0;
    (round?.perHoleStats || []).forEach((stats) => {
      // Count all holes in perHoleStats
      totalHoles++;
      // Only count as GIR if explicitly checked (true)
      if (stats?.gir === true) girCount++;
    });
    return {
      girPercent: totalHoles > 0 ? Math.round((girCount / totalHoles) * 100) : 0,
      girCount,
      totalHoles,
    };
  }

  // Calculate putt make percentage by distance
  const calculatePuttMakeByDistance = () => {
    const makeByDistance: { [key: number]: { made: number; total: number } } = {};
    (round?.perHoleStats || []).forEach((stats) => {
      if (Array.isArray(stats?.puttDistances) && Array.isArray(stats?.puttResults)) {
        stats.puttDistances.forEach((distance, idx) => {
          if (!makeByDistance[distance]) {
            makeByDistance[distance] = { made: 0, total: 0 };
          }
          makeByDistance[distance].total++;
          if (stats.puttResults?.[idx] === true) {
            makeByDistance[distance].made++;
          }
        });
      }
    });
    return makeByDistance;
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
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-green-900 text-base">Holes Completed</div>
              {canEditRound() && !isEditMode && (
                <button
                  onClick={enterEditMode}
                  className="text-blue-600 hover:text-blue-800 font-semibold transition-colors cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>
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
                      const isSelected = isEditMode && selectedHoleIndex === flatIdx;
                      return (
                        <button
                          key={hole.holeNumber + '-' + nineIdx}
                          onClick={() => {
                            if (isEditMode) {
                              handleHoleEdit(flatIdx)
                            }
                          }}
                          disabled={!isEditMode}
                          className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg border font-bold text-xs sm:text-base transition p-0 flex flex-col items-center justify-center ${colorClass} ${
                            isEditMode ? 'hover:shadow-lg hover:scale-105 cursor-pointer' : 'cursor-default'
                          } ${isSelected ? 'ring-4 ring-blue-500' : ''}`}
                          title={isEditMode ? `Click to edit Hole ${hole.holeNumber}` : `Hole ${hole.holeNumber}`}
                        >
                          <span className="absolute top-0.5 left-0.5 text-[10px] font-semibold text-gray-700" style={{letterSpacing: '0.02em'}}>{hole.holeNumber}</span>
                          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-base sm:text-lg font-extrabold w-full text-center">
                              {round.perHoleStats?.[flatIdx]?.conceded ? 'C' : score > 0 ? score : ''}
                            </span>
                          </span>
                          <span className="absolute left-0 right-0 text-[9px] font-medium break-words text-center w-full text-black" style={{bottom: 0}}>{score > 0 ? label : ''}</span>
                        </button>
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
                {/* Add drive stats summary */}
                {(() => {
                  const driveYardages = (round?.perHoleStats || []).map(h => h?.drive?.yardage).filter(y => typeof y === 'number');
                  if (driveYardages.length === 0) return null;
                  const avgDrive = Math.round(driveYardages.reduce((a, b) => a + (b || 0), 0) / driveYardages.length);
                  return (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🚗</span>
                          <span className="text-sm font-semibold text-gray-700">Avg Drive</span>
                        </div>
                        <span className="text-sm font-bold text-blue-800">{avgDrive} yd</span>
                      </div>
                    </div>
                  );
                })()}
                {/* Add FIR stats */}
                {(() => {
                  const firStats = calculateFIRStats();
                  if (firStats.total === 0) return null;
                  return (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⛳</span>
                          <span className="text-sm font-semibold text-gray-700">FIR</span>
                        </div>
                        <span className="text-sm font-bold text-green-800">{firStats.hitPercent}%</span>
                      </div>
                      <div className="text-xs text-gray-600 pl-6 space-y-1">
                        <div>Miss Left: {firStats.missLeftPercent}%</div>
                        <div>Miss Right: {firStats.missRightPercent}%</div>
                      </div>
                    </div>
                  );
                })()}
                {/* Add GIR stats */}
                {(() => {
                  const girStats = calculateGIRStats();
                  if (girStats.totalHoles === 0) return null;
                  return (
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎯</span>
                          <span className="text-sm font-semibold text-gray-700">GIR</span>
                        </div>
                        <span className="text-sm font-bold text-blue-800">{girStats.girPercent}%</span>
                      </div>
                    </div>
                  );
                })()}
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
              <div id="per-hole-breakdown" className="overflow-x-auto max-h-96 overflow-y-auto">
                {(() => {
                  // Calculate max putts for header
                  const maxPutts = Math.max(
                    ...(course.holes.map((_, idx) => {
                      const stats = round.perHoleStats && round.perHoleStats[idx] ? round.perHoleStats[idx] : {};
                      const puttDistances = Array.isArray(stats.puttDistances) ? stats.puttDistances : [];
                      return puttDistances.length;
                    }) || [0])
                  );

                  return (
                    <table className="min-w-full text-xs md:text-sm border-collapse">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-gray-100">
                          <th className="p-2 sticky left-0 bg-gray-100 z-20">Hole</th>
                          <th className="p-2 sticky left-12 bg-gray-100 z-20">Par</th>
                          <th className="p-2">Score</th>
                          <th className="p-2">FIR</th>
                          <th className="p-2">GIR</th>
                          <th className="p-2">Putts</th>
                          {Array.from({ length: maxPutts }, (_, i) => (
                            <th key={`putt-${i + 1}`} className="p-2">Putt {i + 1}</th>
                          ))}
                          <th className="p-2">Drive (yd)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {course.holes.map((hole, idx) => {
                          const stats = round.perHoleStats && round.perHoleStats[idx] ? round.perHoleStats[idx] : {};
                          const puttDistances = Array.isArray(stats.puttDistances) ? stats.puttDistances : [];
                          return (
                            <tr key={hole.holeNumber} className="border-b last:border-0">
                              <td className="p-2 text-center font-bold sticky left-0 bg-white z-10">{hole.holeNumber}</td>
                              <td className="p-2 text-center font-semibold text-gray-700 sticky left-12 bg-white z-10">{hole.par}</td>
                              <td className="p-2 text-center">{round.scores[idx] || '-'}</td>
                              <td className="p-2 text-center">{stats.fairwayHit === 'hit' ? '✓' : stats.fairwayHit === 'L' ? 'L' : stats.fairwayHit === 'R' ? 'R' : '-'}</td>
                              <td className="p-2 text-center">{stats.gir === true ? '✓' : stats.gir === false ? '✗' : '-'}</td>
                              <td className="p-2 text-center">{puttDistances.length > 0 ? puttDistances.length : '-'}</td>
                              {Array.from({ length: maxPutts }, (_, i) => (
                                <td key={`putt-${i}-${idx}`} className="p-2 text-center">
                                  {puttDistances[i] ? `${puttDistances[i]}'` : '-'}
                                </td>
                              ))}
                              <td className="p-2 text-center">{stats.drive && typeof stats.drive.yardage === 'number' ? stats.drive.yardage : '-'}{stats.drive && typeof stats.drive.yardage === 'number' ? ' yd' : ''}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {!isEditMode ? (
              <>
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
                  <>
                    <button onClick={handleDeleteRound} className="flex-1 min-w-32 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                      Delete Round
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button onClick={handleSaveAllChanges} className="flex-1 min-w-32 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  Save All Edits
                </button>
              </>
            )}
          </div>

          {/* Inline Edit Mode - Show editor when a hole is selected */}
          {isEditMode && selectedHoleIndex !== null && course && round && (
            <div className="mt-8 p-6 rounded-xl border-2 border-green-600 bg-green-50">
              {/* Header */}
              <div className="mb-6 pb-4 border-b border-gray-300">
                <div className="flex items-baseline gap-4">
                  <span className="font-bold text-2xl">Hole {course.holes[selectedHoleIndex].holeNumber}</span>
                  <span className="text-black text-lg">Par {course.holes[selectedHoleIndex].par}</span>
                </div>
              </div>
              
              {/* Score Card - styled like track-round */}
              <div className="mb-6 p-6 rounded-xl border-2 border-green-600 bg-green-50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg text-gray-800">Score</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const current = parseInt(String(editScore)) || round.scores[selectedHoleIndex] || 0
                        setEditScore(Math.max(0, current - 1))
                      }}
                      className="w-12 h-12 rounded-lg bg-red-500 text-2xl font-bold text-white flex items-center justify-center hover:bg-red-600 transition"
                    >
                      −
                    </button>
                    <div className="w-16 h-12 rounded-lg bg-white border-2 border-blue-600 flex items-center justify-center">
                      <span className="text-3xl font-extrabold text-blue-700">
                        {editScore || 0}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const current = parseInt(String(editScore)) || round.scores[selectedHoleIndex] || 0
                        setEditScore(current + 1)
                      }}
                      className="w-12 h-12 rounded-lg bg-green-500 text-2xl font-bold text-white flex items-center justify-center hover:bg-green-600 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Card - styled like track-round */}
              <div className="mb-6 p-6 rounded-xl border-2 border-green-600 bg-green-50">
                {/* FIR Section */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-800">FIR:</span>
                    <button
                      onClick={() => setEditStats({ ...editStats, fairwayHit: 'hit' })}
                      className={`w-8 h-8 rounded border font-bold transition-all ${
                        editStats.fairwayHit === 'hit'
                          ? 'bg-green-200 border-green-600'
                          : 'bg-white border-gray-400 hover:border-gray-600'
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditStats({ ...editStats, fairwayHit: 'L' })}
                      className={`w-8 h-8 rounded border font-bold transition-all ${
                        editStats.fairwayHit === 'L'
                          ? 'bg-blue-200 border-blue-600'
                          : 'bg-white border-gray-400 hover:border-gray-600'
                      }`}
                    >
                      L
                    </button>
                    <button
                      onClick={() => setEditStats({ ...editStats, fairwayHit: 'R' })}
                      className={`w-8 h-8 rounded border font-bold transition-all ${
                        editStats.fairwayHit === 'R'
                          ? 'bg-blue-200 border-blue-600'
                          : 'bg-white border-gray-400 hover:border-gray-600'
                      }`}
                    >
                      R
                    </button>
                    <button
                      onClick={() => setEditStats({ ...editStats, fairwayHit: undefined })}
                      className={`w-8 h-8 rounded border font-bold text-xs transition-all ${
                        editStats.fairwayHit === undefined
                          ? 'bg-gray-400 border-gray-600 text-white'
                          : 'bg-white border-gray-400 hover:border-gray-600'
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* GIR & Putts Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* GIR Section */}
                  <div>
                    <span className="block font-semibold text-gray-800 mb-2">GIR</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditStats({ ...editStats, gir: true })}
                        className={`flex-1 py-2 px-3 rounded border-2 font-semibold transition-all ${
                          editStats.gir === true
                            ? 'bg-green-200 border-green-600 text-gray-800'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        Yes ✓
                      </button>
                      <button
                        onClick={() => setEditStats({ ...editStats, gir: false })}
                        className={`flex-1 py-2 px-3 rounded border-2 font-semibold transition-all ${
                          editStats.gir === false
                            ? 'bg-red-200 border-red-600 text-gray-800'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        No ✗
                      </button>
                    </div>
                  </div>

                  {/* Putts Section */}
                  <div>
                    <span className="block font-semibold text-gray-800 mb-2">Putts</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newPutts = Math.max(0, editStats.putts - 1)
                          const newDistances = (editStats.puttDistances || []).slice(0, newPutts)
                          setEditStats({ ...editStats, putts: newPutts, puttDistances: newDistances })
                          setPuttBeingEdited(null)
                        }}
                        className="w-10 h-10 rounded bg-red-500 text-lg font-bold text-white flex items-center justify-center hover:bg-red-600 transition"
                      >
                        −
                      </button>
                      <div className="flex-1 h-10 rounded border-2 border-blue-600 bg-white flex items-center justify-center">
                        <span className="text-xl font-extrabold text-blue-700">
                          {editStats.putts || 0}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const newPutts = editStats.putts + 1
                          const newDistances = [...(editStats.puttDistances || [])]
                          if (newDistances.length < newPutts) {
                            newDistances.push(0)
                          }
                          setEditStats({ ...editStats, putts: newPutts, puttDistances: newDistances })
                        }}
                        className="w-10 h-10 rounded bg-green-500 text-lg font-bold text-white flex items-center justify-center hover:bg-green-600 transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Putt Distances Section - Only show if putts > 0 */}
              {editStats.putts > 0 && (
                <div className="mb-6 p-6 rounded-xl border-2 border-green-600 bg-green-50">
                  <span className="block font-semibold text-gray-800 mb-4">Putt Distances (feet)</span>
                  
                  {/* Putt distance inputs - track-round style */}
                  <div className="space-y-4 mb-4">
                    {Array.from({ length: editStats.putts || 0 }).map((_, idx) => {
                      const currentDistance = (editStats.puttDistances || [])[idx] || 0;
                      const isEditing = puttBeingEdited === idx;
                      
                      return (
                        <div key={idx}>
                          {/* Putt display/edit row */}
                          <div className="flex items-center gap-3 mb-3 bg-white p-3 rounded-lg border-2 border-green-300">
                            <span className="text-sm font-semibold text-gray-700 min-w-fit">Putt {idx + 1}:</span>
                            
                            {!isEditing ? (
                              <>
                                <span className="flex-1 text-gray-700 font-semibold">
                                  {currentDistance > 0 ? `${currentDistance} feet` : 'Not set'}
                                </span>
                                <button
                                  onClick={() => setPuttBeingEdited(idx)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded transition-all text-sm"
                                >
                                  Edit
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    const newDistances = [...(editStats.puttDistances || [])]
                                    newDistances[idx] = Math.max(0, (newDistances[idx] || 0) - 1)
                                    setEditStats({ ...editStats, puttDistances: newDistances })
                                  }}
                                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded transition-all text-sm"
                                >
                                  −
                                </button>
                                <span className="text-lg font-bold text-blue-600 min-w-12 text-center">
                                  {currentDistance}
                                </span>
                                <span className="text-gray-600 text-sm">feet</span>
                                <button
                                  onClick={() => {
                                    const newDistances = [...(editStats.puttDistances || [])]
                                    newDistances[idx] = (newDistances[idx] || 0) + 1
                                    setEditStats({ ...editStats, puttDistances: newDistances })
                                  }}
                                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded transition-all text-sm"
                                >
                                  +
                                </button>
                                <button
                                  onClick={() => setPuttBeingEdited(null)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded transition-all text-sm"
                                >
                                  Done
                                </button>
                              </>
                            )}
                          </div>
                          
                          {/* Preset distance buttons - only show when editing this putt */}
                          {isEditing && (
                            <div className="grid grid-cols-5 gap-2 mb-4">
                              {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100].map((preset) => (
                                <button
                                  key={preset}
                                  onClick={() => {
                                    const newDistances = [...(editStats.puttDistances || [])]
                                    newDistances[idx] = preset
                                    setEditStats({ ...editStats, puttDistances: newDistances })
                                  }}
                                  className={`py-2 px-2 rounded font-semibold text-sm transition-all ${
                                    currentDistance === preset
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Total distance display */}
                  <div className="text-center pt-3 border-t border-green-300">
                    <span className="text-gray-700 font-semibold">
                      Total: {((editStats.puttDistances || []).reduce((sum: number, d: number) => sum + (d || 0), 0))} ft
                    </span>
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedHoleIndex(null)
                    setEditScore('')
                    setEditStats({})
                    setPuttBeingEdited(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 rounded-lg transition-all"
                >
                  Back to Holes
                </button>
                <button
                  onClick={handleConcedeHole}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg transition-all"
                >
                  Concede Hole
                </button>
                <button
                  onClick={handleConfirmHoleScore}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-all"
                >
                  Save This Hole
                </button>
              </div>
            </div>
          )}

          {/* Edit Help Modal */}
          {showEditHelpModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Edit Holes</h2>
                <div className="space-y-3 text-gray-700 mb-4">
                  <p className="text-center">Select hole to edit.</p>
                </div>
                <button
                  onClick={() => setShowEditHelpModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
                >
                  Got it
                </button>
              </div>
            </div>
          )}
        </div>
      </PageWrapper>

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
