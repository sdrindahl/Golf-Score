'use client'

import { useState, useEffect, useRef, Suspense } from 'react';

function getDistanceYards(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = R * c;
  return meters * 1.09361; // convert to yards
}
import { useRouter, useSearchParams } from 'next/navigation';
import { Round, Course } from '@/types';
import { useAuth } from '@/lib/useAuth';
import PageWrapper from '@/components/PageWrapper';
import { getRoundsInProgress, subscribeToRoundsInProgress } from '@/lib/roundsInProgress';

function TrackRoundContent() {

  // State declarations (must be before usage)
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = searchParams ? searchParams.get('id') : null;
  const auth = useAuth();
  const [round, setRound] = useState<Round | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  // Per-hole stats: FIR, GIR, puttDistances
  const [perHoleStats, setPerHoleStats] = useState<{
    fairwayHit?: 'hit' | 'L' | 'R';
    gir?: boolean;
    puttDistances?: number[];
    puttExpanded?: number | null; // index of expanded putt, or null if all collapsed
  }[]>([]);
  const [selectedTee, setSelectedTee] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // --- All state/vars must be declared before this point ---

  // Helper: check if all holes are scored
  const allScored = scores.length === course?.holes?.length && scores.every(s => s !== null && s !== undefined && s > 0);

  // Save/finish round handler
  const handleFinishRound = async () => {
    setFinishing(true);
    setShowIncompleteWarning(false);
    try {
      const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
      // Robustly determine selectedTee: state, round.selectedTee, round.selected_tee
      let teeToSend = selectedTee || round?.selectedTee || (round && (round as any).selected_tee) || '';
      const updatedRound = {
        ...round,
        scores,
        in_progress: false, // Always boolean
        completed_at: new Date().toISOString(),
        userId: round?.userId || user?.id,
        userName: round?.userName || user?.name,
        courseId: round?.courseId || course?.id,
        courseName: round?.courseName || course?.name,
        selectedTee: teeToSend,
        // Always use the perHoleStats state
        perHoleStats,
      };
      // Remove any snake_case fields if present (defensive)
      if ('selected_tee' in updatedRound) delete (updatedRound as any).selected_tee;
      if ('inProgress' in updatedRound) delete (updatedRound as any).inProgress;
      // Debug log outgoing payload
      console.log('[handleFinishRound] Outgoing payload:', updatedRound);
      await fetch('/api/save-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRound),
      });
      // Remove or update round in localStorage so it's not in progress
      if (typeof window !== 'undefined' && round) {
        const savedRounds = localStorage.getItem('golfRounds');
        if (savedRounds) {
          let allRounds = [];
          try {
            allRounds = JSON.parse(savedRounds);
          } catch {}
          // Remove or update the finished round
          const updatedRounds = allRounds.map((r: any) =>
            r.id === round.id ? { ...r, in_progress: false } : r
          );
          localStorage.setItem('golfRounds', JSON.stringify(updatedRounds));
          // Optionally, remove currentRoundId if it matches
          const currentRoundId = localStorage.getItem('currentRoundId');
          if (currentRoundId && currentRoundId === round.id) {
            localStorage.removeItem('currentRoundId');
          }
        }
      }
      // Redirect to round details page
      if (round) {
        router.push(`/round-detail?id=${round.id}`);
      } else {
        router.push('/');
      }
    } catch (e) {
      alert('Failed to save round.');
    } finally {
      setFinishing(false);
    }
  };

  // End round early handler
  const handleEndEarly = () => {
    if (allScored) {
      handleFinishRound();
    } else {
      if (confirm("You haven't entered scores for all holes. End round early?")) {
        handleFinishRound();
      } else {
        setShowIncompleteWarning(true);
      }
    }
  };
    useEffect(() => {
      if (!('geolocation' in navigator)) return;
      function success(pos: GeolocationPosition) {
        console.log('[GeoLocation Debug] Success:', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
      function error(err: GeolocationPositionError) {
        console.log('[GeoLocation Debug] Error:', err);
      }
      watchIdRef.current = navigator.geolocation.watchPosition(success, error, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      };
    }, []);
  // ...existing code...

  // ...existing code...

  // Debug logs for loading issues
  useEffect(() => {
    console.log('[TrackRoundContent] auth:', auth);
    try {
      const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
      console.log('[TrackRoundContent] auth.user:', user);
    } catch (e) {
      console.log('[TrackRoundContent] auth.user: error', e);
    }
    console.log('[TrackRoundContent] round:', round);
    console.log('[TrackRoundContent] course:', course);
  }, [auth, round, course]);
  // ...existing code...

  // Real-time sync subscription
  useEffect(() => {
    setIsClient(true);
  }, []);


  useEffect(() => {
    if (!isClient || !roundId) return;
    let subscription: any;
    getRoundsInProgress().then(data => {
      const found = data?.find((r: any) => r.id === roundId);
      setRound(found || null);
      setScores(found?.scores || []);
      // Initialize perHoleStats if not set
      if (found && found.scores) {
        setPerHoleStats((prev) => prev.length === found.scores.length ? prev : Array(found.scores.length).fill({}));
      }
      setLoading(false);
      subscription = subscribeToRoundsInProgress(() => {
        getRoundsInProgress().then(data => {
          const updated = data?.find((r: any) => r.id === roundId);
          setRound(updated || null);
          setScores(updated?.scores || []);
          if (updated && updated.scores) {
            setPerHoleStats((prev) => prev.length === updated.scores.length ? prev : Array(updated.scores.length).fill({}));
          }
        });
      });
    }).catch(() => setLoading(false));
    return () => {
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };
  }, [isClient, roundId]);

  // 1B: Set selectedTee from round if it exists and state is empty
  // Always sync selectedTee from round when round changes
  useEffect(() => {
  if (round) {
    if (round.selectedTee) {
      setSelectedTee(round.selectedTee);
    } else if ((round as any).selected_tee) {
      setSelectedTee((round as any).selected_tee);
    } else {
      setSelectedTee('');
    }
  }
}, [round]);

  // Load course info from localStorage (as in round-detail)
  useEffect(() => {
    if (!round) return;
    const savedCourses = localStorage.getItem('golfCourses');
    if (savedCourses) {
      const allCourses = JSON.parse(savedCourses) as Course[];
      // Support both camelCase (courseId) and snake_case (course_id) for compatibility
      const rawCourseId = (round as any).courseId || (round as any).course_id;
      const courseIds = Array.isArray(rawCourseId)
        ? rawCourseId
        : typeof rawCourseId === 'string'
          ? rawCourseId.split(',').map((id: string) => id.trim()).filter(Boolean)
          : [];
      console.log('Looking for courseIds:', courseIds, 'in', allCourses.map(c => c.id));
      const foundCourses = allCourses.filter(c => courseIds.includes(c.id));
      console.log('Found courses:', foundCourses);
      if (foundCourses.length > 0) {
        // Merge holes for multi-nine support
        const mergedCourse: Course = {
          ...foundCourses[0],
          id: courseIds.join(','),
          name: round.courseName,
          holes: foundCourses.flatMap(c => c.holes),
          holeCount: foundCourses.reduce((sum, c) => sum + (c.holes?.length || 0), 0),
          par: foundCourses.reduce((sum, c) => sum + (c.par || 0), 0),
        };
        setCourse(mergedCourse);
      } else {
        setCourse(null);
      }
    }
  }, [round]);

  const handleScoreChange = async (score: number) => {
    if (!round) return;
    const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
    if (!auth || !user) {
      console.error('[handleScoreChange] Blocked: user not loaded');
      return;
    }
    if (!course) {
      console.error('[handleScoreChange] Blocked: course not loaded');
      return;
    }
    const newScores = [...scores];
    newScores[currentHoleIndex] = score;
    setScores(newScores);
    // Live sync to Supabase
    try {
      // Ensure all required fields are present and valid
      const userId = round.userId || user?.id;
      const userName = round.userName || user?.name;
      const courseName = round.courseName || course.name;
      const updatedRound = {
        id: round.id,
        userId,
        userName,
        courseId: round.courseId || course.id,
        courseName,
        selectedTee: round.selectedTee || 'men',
        date: round.date || new Date().toISOString(),
        scores: newScores,
        totalScore: newScores.reduce((a, b) => a + b, 0),
        notes: round.notes || '',
        in_progress: typeof round.in_progress === 'boolean' ? round.in_progress : true,
        startingHole: (round as any).startingHole || (round as any).starting_hole || 1,
      };
      // Debug log outgoing payload
      console.log('[handleScoreChange] Sending updatedRound:', updatedRound);
      await fetch('/api/save-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRound),
      });
    } catch (e) {
      // Optionally: show error or retry
      console.error('Failed to sync score to Supabase', e);
    }
  };

  const handleNextHole = () => {
    if (!course) return;
    if (currentHoleIndex < course.holes.length - 1) {
      setCurrentHoleIndex(currentHoleIndex + 1);
    }
  };

  const handlePreviousHole = () => {
    if (currentHoleIndex > 0) {
      setCurrentHoleIndex(currentHoleIndex - 1);
    }
  };


  // Delete round handler
  const [deleting, setDeleting] = useState(false);
  const handleDeleteRound = async () => {
    if (deleting) return;
    if (!round) return;
    if (!confirm('Are you sure you want to delete this round? This action cannot be undone.')) return;
    setDeleting(true);
    // Remove from localStorage
    const savedRounds = localStorage.getItem('golfRounds');
    if (savedRounds) {
      const allRounds = JSON.parse(savedRounds);
      const updated = allRounds.filter((r: any) => r.id !== round.id);
      localStorage.setItem('golfRounds', JSON.stringify(updated));
    }
    // Remove from Supabase
    try {
      const res = await fetch('/api/delete-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: round.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert('Failed to delete from server: ' + (data.error || 'Unknown error'));
        setDeleting(false);
        return;
      }
    } catch (e) {
      alert('Network error while deleting round.');
      setDeleting(false);
      return;
    }
    // Redirect home
    router.push('/');
  };

  const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
  if (loading || !auth || !user) return <div className="p-8 text-center">Loading user and round data...</div>;
  if (!round || !course) return <div className="p-8 text-center">Round or course not found.</div>;

  return (
    <PageWrapper title="" userName={round.userName}>
      <div className="max-w-2xl mx-auto py-4">
        {/* Custom condensed header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-black text-center mb-2">Score Round</h1>
        </div>
        {/* Summary Bar */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="p-2 bg-green-50 rounded-lg text-center border border-l-4 border-l-green-600 border-gray-200">
            <p className="text-gray-700 text-xs font-semibold">SCORE</p>
            <p className="text-2xl font-bold text-green-700">
              {scores.reduce((sum, score) => sum + (score > 0 ? score : 0), 0)}
            </p>
          </div>
          <div className="p-2 bg-white rounded-lg text-center border border-l-4 border-l-purple-600 border-gray-200">
            <p className="text-gray-700 text-xs font-semibold">vs PAR</p>
            <p className={`text-2xl font-bold ${
              (() => {
                const totalScore = scores.reduce((sum, score) => sum + (score > 0 ? score : 0), 0);
                const totalPar = course.holes.reduce((sum, hole, idx) => scores[idx] > 0 ? sum + hole.par : sum, 0);
                const diff = totalScore - totalPar;
                return diff < 0 ? 'text-green-700' : diff > 0 ? 'text-red-700' : 'text-gray-700';
              })()
            }`}>
              {(() => {
                const totalScore = scores.reduce((sum, score) => sum + (score > 0 ? score : 0), 0);
                const totalPar = course.holes.reduce((sum, hole, idx) => scores[idx] > 0 ? sum + hole.par : sum, 0);
                const diff = totalScore - totalPar;
                return diff === 0 ? 'E' : (diff > 0 ? '+' + diff : diff);
              })()}
            </p>
          </div>
          <div className="p-2 bg-white rounded-lg text-center border border-l-4 border-l-blue-600 border-gray-200">
            <p className="text-gray-700 text-xs font-semibold">HOLES</p>
            <p className="text-2xl font-bold text-blue-700">
              {scores.filter(s => s > 0).length}/{course.holes.length}
            </p>
          </div>
        </div>

        {/* Distance to Center of the Green label and compact card */}
        <div className="mb-1 font-semibold text-green-900 text-base text-center">Distance to Center of the Green</div>
        <div className="mb-4 flex justify-center">
          <div className="rounded-xl border-2 border-green-600 bg-green-50 flex items-center justify-center w-52 h-20 px-4 overflow-hidden">
            <span className="text-4xl font-extrabold text-blue-700 leading-none truncate w-full text-center">
              {(() => {
                const hole = course.holes[currentHoleIndex];
                // Debug log for distance calculation
                console.log('[Distance Debug]', {
                  hole,
                  userLocation,
                  greenLat: hole?.greenLat,
                  greenLng: hole?.greenLng
                });
                if (!hole || !userLocation || typeof hole.greenLat !== 'number' || typeof hole.greenLng !== 'number') return '—';
                const dist = getDistanceYards(userLocation.lat, userLocation.lng, hole.greenLat, hole.greenLng);
                return Math.round(dist) + ' yd';
              })()}
            </span>
          </div>
        </div>

        {/* Holes Completed Card (responsive grid, never runs off card) */}
                {/* Incomplete warning */}
                {showIncompleteWarning && !allScored && (
                  <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 rounded">
                    You haven&apos;t entered scores for all holes.
                  </div>
                )}
        <div className="mb-6 p-6 rounded-xl border-2 border-green-600 bg-green-50">
          <div className="font-semibold text-green-900 mb-2 text-base">Holes Completed</div>
            {(() => {
              const holes = course.holes;
              const getResultLabel = (score: number, par: number) => {
                if (!score) return '';
                const diff = score - par;
                if (score === 1) return 'Ace';
                if (diff <= -3) return 'Alb.';
                if (diff === -2) return 'Eagle';
                if (diff === -1) return 'Birdie';
                if (diff === 0) return 'Par';
                if (diff === 1) return 'Bogey';
                if (diff === 2) return 'D. Bogey';
                if (diff > 2) return `${diff} Over`;
                return '';
              };
              const getColorClass = (score: number, par: number, isCurrent: boolean) => {
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
              // Responsive grid for holes
              const renderHoleSquare = (hole: import('@/types').Hole, idx: number) => {
                const score = scores[idx];
                const par = hole.par;
                const isCurrent = currentHoleIndex === idx;
                const label = getResultLabel(score, par);
                const colorClass = getColorClass(score, par, isCurrent);
                return (
                  <button
                    key={hole.holeNumber}
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl border font-bold text-xl sm:text-2xl transition p-0 ${colorClass} ${isCurrent ? 'ring-2 ring-green-600' : ''}`}
                    style={{ minWidth: '4rem', minHeight: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setCurrentHoleIndex(idx)}
                  >
                    <span className="absolute top-1 left-1 text-sm font-semibold text-gray-700" style={{letterSpacing: '0.02em'}}>{`H${hole.holeNumber}`}</span>
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-2xl sm:text-3xl font-extrabold w-full text-center">{score > 0 ? score : ''}</span>
                    </span>
                    <span className="absolute bottom-1 left-0 right-0 text-xs font-medium break-words text-center w-full">{score > 0 ? label : ''}</span>
                  </button>
                );
              };
              // Front 9
              const frontNine = holes.slice(0, 9);
              // Back 9
              const backNine = holes.slice(9, 18);
              return (
                <>
                  <div className="mb-0.5 font-semibold text-green-700 text-xs">Gold Front 9</div>
                  <div className="grid grid-cols-6 gap-2 mb-1 w-full">
                    {frontNine.map((hole, idx) => renderHoleSquare(hole, idx))}
                  </div>
                  <div className="mb-0.5 font-semibold text-green-700 text-xs">Gold Back 9</div>
                  <div className="grid grid-cols-6 gap-2 mb-1 w-full">
                    {backNine.map((hole, idx) => renderHoleSquare(hole, 9 + idx))}
                  </div>
                </>
              );
            })()}
        </div>

        {/* Per-Hole Entry Card (styled, advanced stats, production layout) */}
        <div className="mb-6 p-6 rounded-xl border-2 border-green-600 bg-green-50">
          {course.holes[currentHoleIndex] && (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <span className="font-bold text-xl">Hole {course.holes[currentHoleIndex]?.holeNumber || currentHoleIndex + 1}</span>
                  <span className="text-gray-600 ml-3 text-lg">Par {course.holes[currentHoleIndex]?.par || '-'}</span>
                  <span className="text-gray-500 ml-3 text-base">
                    {(() => {
                      const hole = course.holes[currentHoleIndex];
                      if (!hole) return '-';
                      // Robust tee selection: camelCase, snake_case, fallback to 'men'
                      const tee = round.selectedTee || (round as any).selected_tee || 'men';
                      const teeBox = hole[tee];
                      const yardage = teeBox?.yardage;
                      // Remove debug log for production
                      return typeof yardage === 'number' ? `${yardage}yd` : '-';
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleScoreChange(Math.max(1, (scores[currentHoleIndex] || 0) - 1))}
                    className="w-12 h-12 rounded-lg bg-gray-200 text-3xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 transition"
                  >
                    −
                  </button>
                  <span className="text-4xl font-extrabold w-10 text-center text-blue-700">
                    {scores[currentHoleIndex] || 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleScoreChange((scores[currentHoleIndex] || 0) + 1)}
                    className="w-12 h-12 rounded-lg bg-green-500 text-3xl font-bold text-white flex items-center justify-center hover:bg-green-600 transition"
                  >
                    +
                  </button>
                </div>
                {/* Score vs Par */}
                <div className="ml-4 text-xl font-bold">
                  <span className={(() => {
                    const score = scores[currentHoleIndex] || 0;
                    const par = course.holes[currentHoleIndex]?.par || 0;
                    const diff = score - par;
                    return diff < 0 ? 'text-green-700' : diff > 0 ? 'text-red-700' : 'text-gray-700';
                  })()}>
                    {(() => {
                      const score = scores[currentHoleIndex] || 0;
                      const par = course.holes[currentHoleIndex]?.par || 0;
                      const diff = score - par;
                      return diff === 0 ? 'E' : (diff > 0 ? '+' + diff : diff);
                    })()}
                  </span>
                </div>
              </div>
              {/* Advanced Stats Row - FIR on first row, GIR and Putts below */}
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">FIR:</span>
                  {['hit', 'L', 'R'].map((val, idx) => (
                    <button
                      key={val}
                      className={`w-8 h-8 rounded border font-bold ${perHoleStats[currentHoleIndex]?.fairwayHit === val ? (val === 'hit' ? 'bg-green-200 border-green-600' : 'bg-blue-200 border-blue-600') : 'bg-white border-gray-400'} ${val === 'hit' ? '' : ''}`}
                      onClick={() => {
                        setPerHoleStats(stats => {
                          const updated = [...stats];
                          updated[currentHoleIndex] = { ...updated[currentHoleIndex], fairwayHit: updated[currentHoleIndex]?.fairwayHit === val ? undefined : val as 'hit' | 'L' | 'R' };
                          return updated;
                        });
                      }}
                      type="button"
                    >
                      {val === 'hit' ? '✓' : val}
                    </button>
                  ))}
                </div>
                <div className="flex flex-row flex-wrap gap-4 mt-1">
                  {/* GIR */}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">GIR</span>
                    <input
                      type="checkbox"
                      className="w-5 h-5"
                      checked={!!perHoleStats[currentHoleIndex]?.gir}
                      onChange={e => {
                        setPerHoleStats(stats => {
                          const updated = [...stats];
                          updated[currentHoleIndex] = { ...updated[currentHoleIndex], gir: e.target.checked };
                          return updated;
                        });
                      }}
                    />
                  </div>
                  {/* Putts (Stepper) */}
                  <div className="flex items-center gap-2 min-w-[120px] flex-shrink-0">
                    <span className="font-semibold">Putts:</span>
                    <button
                      type="button"
                      className="w-8 h-8 rounded bg-red-500 text-xl font-bold text-white flex items-center justify-center hover:bg-red-600 border"
                      onClick={() => {
                        setPerHoleStats(stats => {
                          const updated = [...stats];
                          const prev = updated[currentHoleIndex]?.puttDistances || [];
                          const currentCount = prev.length;
                          const newCount = Math.max(0, currentCount - 1);
                          updated[currentHoleIndex] = {
                            ...updated[currentHoleIndex],
                            puttDistances: Array(newCount).fill(0).map((v, i) => prev[i] || 0),
                            puttExpanded: newCount > 0 ? 0 : null
                          };
                          return updated;
                        });
                      }}
                      aria-label="Decrease putts"
                    >
                      −
                    </button>
                    <span className="text-lg font-bold w-6 text-center">{perHoleStats[currentHoleIndex]?.puttDistances?.length || 0}</span>
                    <button
                      type="button"
                      className="w-8 h-8 rounded bg-green-500 text-xl font-bold text-white flex items-center justify-center hover:bg-green-600 border"
                      onClick={() => {
                        setPerHoleStats(stats => {
                          const updated = [...stats];
                          const prev = updated[currentHoleIndex]?.puttDistances || [];
                          const currentCount = prev.length;
                          const newCount = Math.min(6, currentCount + 1);
                          updated[currentHoleIndex] = {
                            ...updated[currentHoleIndex],
                            puttDistances: Array(newCount).fill(0).map((v, i) => prev[i] || 0),
                            puttExpanded: newCount > 0 ? 0 : null
                          };
                          return updated;
                        });
                      }}
                      aria-label="Increase putts"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              {/* Putt Distance Entry */}
              {perHoleStats[currentHoleIndex]?.puttDistances && perHoleStats[currentHoleIndex].puttDistances.length > 0 && (
                <div className="mt-4 p-4 rounded-xl border-2 border-green-600 bg-white">
                  <div className="font-semibold mb-2">Putt Distance to the Cup.</div>
                  {perHoleStats[currentHoleIndex].puttDistances.map((dist, idx) => {
                    const expanded = perHoleStats[currentHoleIndex]?.puttExpanded === idx;
                    return (
                      <div key={idx} className="mb-4">
                        {expanded ? (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">Putt {idx + 1}:</span>
                              {/* - button */}
                              <button
                                type="button"
                                className="w-8 h-8 rounded bg-gray-200 text-xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                                onClick={() => {
                                  setPerHoleStats(stats => {
                                    const updated = [...stats];
                                    const puttDistances = [...(updated[currentHoleIndex]?.puttDistances || [])];
                                    puttDistances[idx] = Math.max(0, (puttDistances[idx] || 0) - 1);
                                    updated[currentHoleIndex] = { ...updated[currentHoleIndex], puttDistances };
                                    return updated;
                                  });
                                }}
                              >
                                −
                              </button>
                              {/* Number input */}
                              <input
                                type="number"
                                min={0}
                                className="border rounded px-2 py-1 w-16 text-center"
                                value={dist}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setPerHoleStats(stats => {
                                    const updated = [...stats];
                                    const puttDistances = [...(updated[currentHoleIndex]?.puttDistances || [])];
                                    puttDistances[idx] = val;
                                    updated[currentHoleIndex] = { ...updated[currentHoleIndex], puttDistances };
                                    return updated;
                                  });
                                }}
                              />
                              <span>feet</span>
                              {/* + button */}
                              <button
                                type="button"
                                className="w-8 h-8 rounded bg-gray-200 text-xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                                onClick={() => {
                                  setPerHoleStats(stats => {
                                    const updated = [...stats];
                                    const puttDistances = [...(updated[currentHoleIndex]?.puttDistances || [])];
                                    puttDistances[idx] = (puttDistances[idx] || 0) + 1;
                                    updated[currentHoleIndex] = { ...updated[currentHoleIndex], puttDistances };
                                    return updated;
                                  });
                                }}
                              >
                                +
                              </button>
                              {/* Done button: collapse this putt, expand next if any */}
                              <button
                                type="button"
                                className="ml-2 px-4 py-1 rounded bg-blue-600 text-white font-semibold"
                                onClick={() => {
                                  setPerHoleStats(stats => {
                                    const updated = [...stats];
                                    const puttCount = updated[currentHoleIndex]?.puttDistances?.length || 0;
                                    // If not last putt, expand next; else collapse all
                                    updated[currentHoleIndex] = {
                                      ...updated[currentHoleIndex],
                                      puttExpanded: (idx + 1 < puttCount) ? idx + 1 : null
                                    };
                                    return updated;
                                  });
                                }}
                              >Done</button>
                            </div>
                            {/* Slider */}
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={dist}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setPerHoleStats(stats => {
                                    const updated = [...stats];
                                    const puttDistances = [...(updated[currentHoleIndex]?.puttDistances || [])];
                                    puttDistances[idx] = val;
                                    updated[currentHoleIndex] = { ...updated[currentHoleIndex], puttDistances };
                                    return updated;
                                  });
                                }}
                              />
                              <span>{dist} ft</span>
                            </div>
                            {/* Quick select buttons */}
                            <div className="flex gap-2 mb-2">
                              {[5, 10, 15, 20, 50].map(q => (
                                <button
                                  key={q}
                                  type="button"
                                  className="px-3 py-1 rounded bg-blue-100 text-blue-700 text-sm"
                                  onClick={() => {
                                    setPerHoleStats(stats => {
                                      const updated = [...stats];
                                      const puttDistances = [...(updated[currentHoleIndex]?.puttDistances || [])];
                                      puttDistances[idx] = q;
                                      updated[currentHoleIndex] = { ...updated[currentHoleIndex], puttDistances };
                                      return updated;
                                    });
                                  }}
                                >
                                  {q} ft
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div
                            className="mb-2 cursor-pointer"
                            onClick={() => {
                              setPerHoleStats(stats => {
                                const updated = [...stats];
                                updated[currentHoleIndex] = { ...updated[currentHoleIndex], puttExpanded: idx };
                                return updated;
                              });
                            }}
                          >
                            <span className="font-semibold">Putt {idx + 1}:</span>
                            <span className="ml-2 px-2 py-1 rounded bg-gray-100 border text-base">{dist} ft</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Removed duplicate static Putt Distance to the Cup card */}
              {/* Navigation Buttons */}
              <div className="flex gap-4 mt-6">
                {currentHoleIndex > 0 && (
                  <button type="button" onClick={handlePreviousHole} className="btn-secondary flex-1">← Previous Hole</button>
                )}
                {scores[currentHoleIndex] > 0 && currentHoleIndex < course.holes.length - 1 && (
                  <button type="button" onClick={handleNextHole} className="btn-primary flex-1">Next Hole →</button>
                )}
                {/* Finish/Save and End Early buttons */}
                {allScored ? (
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    onClick={handleFinishRound}
                    disabled={finishing}
                  >
                    {finishing ? 'Saving...' : 'Finish Round'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-warning flex-1"
                    onClick={handleEndEarly}
                    disabled={finishing}
                  >
                    {finishing ? 'Saving...' : 'End Round Early'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Delete Round Button (destructive, bottom of page) */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleDeleteRound}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all text-lg flex items-center gap-2 disabled:opacity-60"
            disabled={deleting}
          >
            <span role="img" aria-label="Delete">🗑️</span> Delete Round
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}

export default function TrackRound() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TrackRoundContent />
    </Suspense>
  );
}
