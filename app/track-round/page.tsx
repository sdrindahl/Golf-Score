


'use client'
import { useState, useEffect, useRef, Suspense } from 'react';

// Helper to chunk an array into subarrays of given size
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

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
import CommentsModal from '@/components/CommentsModal';
import HoleMap from '@/components/HoleMap';
import { useMemo } from 'react';
import { getRoundsInProgress, subscribeToRoundsInProgress } from '@/lib/roundsInProgress';
import { supabase } from '@/lib/supabase';

function TrackRoundContent() {
    // Live drive yardage overlay (shows only while measuring drive)
    const renderLiveDriveOverlay = () => {
      if (driveStart && userLocation) {
        return (
          <div className="fixed top-8 right-4 z-30 flex flex-col items-center gap-4">
            <div className="bg-yellow-600 bg-opacity-95 border-2 border-white text-white rounded-2xl px-8 py-5 text-5xl font-extrabold shadow-2xl tracking-wide flex flex-col items-center" style={{boxShadow: '0 4px 24px 0 rgba(0,0,0,0.5)'}}>
              <span className="text-base font-semibold text-gray-200 mb-1">Drive</span>
              {Math.round(getDistanceYards(driveStart.lat, driveStart.lng, userLocation.lat, userLocation.lng))} <span className="text-lg font-bold ml-1">yd</span>
            </div>
          </div>
        );
      }
      return null;
    };
  // State for editing a putt distance
  const [puttEdit, setPuttEdit] = useState<{ idx: number, value: number } | null>(null);

  // Score entry modal state
  const [showScoreModal, setShowScoreModal] = useState(false);

  // Show map or image?

  const [showMap, setShowMap] = useState(false);
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

  // Helper: calculate total score (sum of scores array)
  const totalScore = scores.reduce((sum, s) => sum + (typeof s === 'number' ? s : 0), 0);
  const [commentCount, setCommentCount] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  // ...other state declarations...

  // --- All state/vars must be declared before this point ---

  // List of available hole images (after course is declared)
  const holeImages = [
    '/hole1.png',
    '/hole2.png',
    '/hole3.png',
    '/hole4.png',
  ];

  // Memoized random image selection for each hole (stable for session)
  const randomHoleImages = useMemo(() => {
    if (!course || !Array.isArray(course.holes)) return [];
    const numHoles = course.holes.length;
    const arr: string[] = [];
    for (let i = 0; i < numHoles; i++) {
      arr.push(holeImages[Math.floor(Math.random() * holeImages.length)]);
    }
    return arr;
  }, [course]);

  // Load round from localStorage by roundId (must be after roundId is declared)
  useEffect(() => {
    if (!roundId) {
      setLoading(false);
      return;
    }
    // Try to load from localStorage
    const savedRounds = typeof window !== 'undefined' ? localStorage.getItem('golfRounds') : null;
    if (savedRounds) {
      try {
        const allRounds = JSON.parse(savedRounds);
        const found = allRounds.find((r: any) => r.id === roundId);
        if (found) {
          setRound(found);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    // If not found, set loading false
    setLoading(false);
  }, [roundId]);

  // Removed showHoleMap logic: map is always visible
  const [showDriveHelp, setShowDriveHelp] = useState(false);
  const [driveHelpDismissed, setDriveHelpDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('driveHelpDismissed') === 'true';
    }
    return false;
  });
  // Show drive help toast on first load if not dismissed
  useEffect(() => {
    if (!driveHelpDismissed && toastMessage == null) {
      setToastMessage('To measure your drive distance: Stand where you hit the ball and tap Track Drive. Your starting location is saved. Walk to your ball and tap Save Drive. Click Cancel if you do not want to save your drive distance.');
    }
  }, []);
  // Debug: log loading/auth/user state changes
  useEffect(() => {
    console.log('[DEBUG] loading:', loading, 'auth:', auth, 'user:', auth?.getCurrentUser ? auth.getCurrentUser() : undefined, 'round:', round, 'course:', course);
  }, [loading, auth, round, course]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // All code using 'loading' must be below this point!
  // Per-hole stats: FIR, GIR, puttDistances, drive tracking
  // Define a stricter type for per-hole stats
  type PerHoleStat = {
    fairwayHit: 'hit' | 'L' | 'R' | null;
    gir: boolean;
    puttDistances: number[];
    puttExpanded: number | null; // index of expanded putt, or null if all collapsed
    drive: {
      start: { lat: number; lng: number } | null;
      end: { lat: number; lng: number } | null;
      yardage: number | null;
    } | null;
  };

  // Helper to create a default PerHoleStat
  const defaultPerHoleStat = (): PerHoleStat => ({
    fairwayHit: null,
    gir: false,
    puttDistances: [],
    puttExpanded: null,
    drive: null,
  });

  const [perHoleStats, setPerHoleStats] = useState<PerHoleStat[]>([]);
  // Drive measurement: two-tap workflow
  // 1st tap: set tee (start) location
  // 2nd tap: set ball (end) location, calculate and save distance
  const [driveStart, setDriveStart] = useState<{ lat: number; lng: number } | null>(null);
  const handleMeasureDrive = () => {
    if (!userLocation) {
      alert('Location not available. Please enable GPS.');
      return;
    }
    if (!driveStart) {
      // First tap: set tee location
      setDriveStart({ ...userLocation });
      if (!driveHelpDismissed) {
        setToastMessage('Tee location saved! Walk to your ball and tap again.');
      }
      return;
    }
    // Second tap: set ball location, calculate distance
    const start = driveStart;
    const end = userLocation;
    const driveDistance = Math.round(getDistanceYards(start.lat, start.lng, end.lat, end.lng));
    setPerHoleStats(stats => {
      const updated = [...stats];
      if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
      updated[currentHoleIndex] = {
        ...updated[currentHoleIndex],
        drive: {
          start,
          end,
          yardage: driveDistance,
        },
      };
      return updated;
    });
    setDriveStart(null);
    setToastMessage(`Drive distance saved: ${driveDistance} yd`);
    setTimeout(() => {
      setToastMessage((msg) => (msg && msg.startsWith('Drive distance saved') ? null : msg));
    }, 1000);
  };

  // Discard completed drive measurement
  const handleDiscardDrive = () => {
    setDriveStart(null);
    setPerHoleStats(stats => {
      const updated = [...stats];
      if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
      updated[currentHoleIndex] = { ...updated[currentHoleIndex], drive: null };
      return updated;
    });
    setToastMessage(null);
  };
  const [selectedTee, setSelectedTee] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // --- All state/vars must be declared before this point ---
  // Heartbeat refs
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisibleRef = useRef<boolean>(true);
  // Keep selectedTee in a ref for heartbeat
  const selectedTeeRef = useRef<string>(selectedTee);
  useEffect(() => { selectedTeeRef.current = selectedTee; }, [selectedTee]);
  // Keep scores in a ref for heartbeat
  const scoresRef = useRef<number[]>(scores);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  // Keep course in a ref for heartbeat
  const courseRef = useRef<Course | null>(course);
  useEffect(() => { courseRef.current = course; }, [course]);
  // Keep round in a ref for heartbeat
  const roundRef = useRef<Round | null>(round);
  useEffect(() => { roundRef.current = round; }, [round]);
  // Keep perHoleStats in a ref for heartbeat
  const perHoleStatsRef = useRef<any[]>([]);
  useEffect(() => { perHoleStatsRef.current = perHoleStats; }, [perHoleStats]);
  // Heartbeat logic: auto-save round every 30s if page is visible
  useEffect(() => {
    if (!roundId || loading) return;

    const startHeartbeat = () => {
      if (heartbeatIntervalRef.current) return;
      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          const currentUser = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
          const currentRound = roundRef.current;
          const currentCourse = courseRef.current;
          if (!currentRound || !currentCourse) return;
          const heartbeatRound = {
            id: roundId,
            userId: currentUser?.id,
            userName: currentUser?.name,
            courseId: currentRound.courseId || (currentRound as any).course_id || currentCourse.id,
            courseName: currentCourse.name,
            selectedTee: selectedTeeRef.current || currentRound.selectedTee || (currentRound as any).selected_tee,
            date: currentRound.date,
            scores: scoresRef.current.length > 0 ? scoresRef.current : currentRound.scores,
            totalScore: currentRound.totalScore || (currentRound as any).total_score,
            notes: currentRound.notes,
            in_progress: currentRound.in_progress !== false,
            perHoleStats: perHoleStatsRef.current.length > 0 ? perHoleStatsRef.current : (currentRound as any).perHoleStats || (currentRound as any).per_hole_stats || [],
          };
          // Debug
          // console.log('[DEBUG] Heartbeat sending courseId:', heartbeatRound.courseId);
          const res = await fetch('/api/save-round', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(heartbeatRound),
          });
          if (res.ok) {
            // console.log('[DEBUG] Heartbeat: Updated round and round_courses join table');
          } else {
            // console.warn('[DEBUG] Heartbeat save failed:', res.status);
          }
        } catch (err) {
          // console.error('[DEBUG] Heartbeat update failed:', err);
        }
      }, 30000);
    };
    const stopHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
        // console.log('[DEBUG] Heartbeat stopped - page hidden');
      }
    };
    // Listen for visibility changes
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisibleRef.current;
      isPageVisibleRef.current = !document.hidden;
      // console.log('[DEBUG] Visibility changed - isPageVisible:', isPageVisibleRef.current, '(was:', wasVisible, ')');
      if (!isPageVisibleRef.current && heartbeatIntervalRef.current) {
        stopHeartbeat();
      } else if (isPageVisibleRef.current && !heartbeatIntervalRef.current) {
        startHeartbeat();
      }
    };
    // Start heartbeat if page is initially visible
    if (isPageVisibleRef.current) {
      startHeartbeat();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopHeartbeat();
    };
  }, [roundId, loading, auth]);

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
      
      // Save courses to Supabase before saving the round (fixes missing course data issue)
      // Get the individual course IDs and save them all
      if (course) {
        const courseIds = course.id.split(',').map((id: string) => id.trim()).filter(Boolean);
        const savedCourses = localStorage.getItem('golfCourses');
        if (savedCourses) {
          try {
            const allCourses = JSON.parse(savedCourses);
            // Save each individual course that was used in this round
            for (const courseId of courseIds) {
              const courseToSave = allCourses.find((c: any) => c.id === courseId);
              if (courseToSave) {
                console.log('[handleFinishRound] Saving course to Supabase:', courseToSave.name);
                await fetch('/api/save-course', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(courseToSave),
                });
              }
            }
          } catch (error) {
            console.error('[handleFinishRound] Error saving courses:', error);
            // Continue anyway, don't block round saving
          }
        }
      }
      
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
          } catch { }
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
      // Redirect to player profile page
      if (user) {
        router.push(`/player?id=${user.id}`);
      } else if (round?.userId) {
        router.push(`/player?id=${round.userId}`);
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

  // --- Modern bottom bar for navigation and hole info ---
  const renderBottomBar = () => {
    if (!course) return null;
    const hole = course.holes[currentHoleIndex];
    return (
      <div className="fixed bottom-0 left-0 w-full flex justify-center items-end z-50 pb-2 pointer-events-none">
        <div className="bg-gray-800 bg-opacity-95 rounded-t-2xl shadow-2xl flex items-center justify-center w-[95vw] max-w-md mx-auto h-20 relative pointer-events-auto">
          {/* Left Arrow */}
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-2xl text-white border border-gray-600 shadow"
            onClick={() => setCurrentHoleIndex(i => Math.max(0, i - 1))}
            aria-label="Previous Hole"
            disabled={currentHoleIndex === 0}
            style={{ opacity: currentHoleIndex === 0 ? 0.5 : 1 }}
          >
            &#x25C0;
          </button>
          {/* Center Info */}
          <div className="flex flex-col items-center justify-center px-12">
            <div className="w-12 h-1 rounded-full bg-gray-600 mb-1" />
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-white">{hole?.holeNumber ?? currentHoleIndex + 1}</span>
              <span className="text-lg text-gray-300 font-semibold ml-1">Par {hole?.par ?? '-'}</span>
            </div>
            <div className="text-sm text-gray-400 font-medium">Hdcp {hole?.handicap ?? '-'}</div>
          </div>
          {/* Exit Map button (only when map is shown) */}
          {showMap && (
            <button
              className="absolute right-16 top-1/2 -translate-y-1/2 h-10 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold shadow border border-red-800 transition"
              onClick={() => setShowMap(false)}
              aria-label="Exit map"
            >
              Exit Map
            </button>
          )}
          {/* Right Arrow */}
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-2xl text-white border border-gray-600 shadow"
            onClick={() => setCurrentHoleIndex(i => Math.min(course.holes.length - 1, i + 1))}
            aria-label="Next Hole"
            disabled={currentHoleIndex === course.holes.length - 1}
            style={{ opacity: currentHoleIndex === course.holes.length - 1 ? 0.5 : 1 }}
          >
            &#x25B6;
          </button>
        </div>
      </div>
    );
  };

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
  }, [auth]);



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
    if (!round) {
      setLoading(false); // If round is missing, stop loading
      return;
    }
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
      // Preserve order of courseIds when finding courses
      const foundCourses = courseIds.map(id => allCourses.find(c => c.id === id)).filter(Boolean) as Course[];
      console.log('Found courses:', foundCourses);
      if (foundCourses.length > 0) {
        // Merge holes for multi-nine support
        const mergedCourse: Course = {
          ...foundCourses[0],
          id: courseIds.join(','),
          name: round.courseName || 'Combined Course',
          holes: foundCourses.flatMap(c => c.holes),
          holeCount: foundCourses.reduce((sum, c) => sum + (c.holes?.length || 0), 0),
          par: foundCourses.reduce((sum, c) => sum + (c.par || 0), 0),
        };
        setCourse(mergedCourse);
      } else {
        setCourse(null);
      }
      setLoading(false); // Done loading after course lookup
    } else {
      setLoading(false); // No courses found, stop loading
    }
  }, [round]);

  // (moved above)

  // Subscribe to real-time comment updates
  useEffect(() => {
    if (!roundId) return;

    // Fetch initial comment count
    const fetchCommentCount = async () => {
      try {
        const res = await fetch('/api/get-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundId }),
        });
        const data = await res.json();
        setCommentCount(data.comments?.length || 0);
      } catch (error) {
        console.error('Failed to fetch comments:', error);
      }
    };

    fetchCommentCount();

    // Polling fallback - check for new comments every 3 seconds
    // This ensures we see updates even if real-time subscription doesn't work (e.g., on local dev)
    const pollInterval = setInterval(() => {
      fetchCommentCount();
    }, 3000);

    // Set up Supabase realtime subscription for new comments
    if (!supabase) {
      console.warn('[DEBUG] Supabase client not configured, skipping real-time subscription');
      return () => clearInterval(pollInterval);
    }

    const channel = supabase
      .channel(`comments:${roundId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `round_id=eq.${roundId}`,
        },
        (payload: any) => {
          setCommentCount((prev) => prev + 1);
          // Show toast notification
          const authorName = payload.new.author_name || 'Someone';
          setToastMessage(`📝 ${authorName} just commented on your round!`);
          // Auto-clear toast after 6 seconds
          setTimeout(() => setToastMessage(null), 6000);
          // Optional: Play a subtle sound notification
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
            audio.play().catch(() => {}); // Ignore if autoplay is blocked
          } catch (e) {
            // Silently fail if audio is not supported
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      channel.unsubscribe();
    };
  }, [roundId]);

  // Keep perHoleStatsRef in sync whenever perHoleStats changes
  useEffect(() => {
    perHoleStatsRef.current = perHoleStats;
  }, [perHoleStats]);

  // Debounce timer for per-hole stats sync
  const statsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const statsRequestInFlightRef = useRef(false);

  // Auto-save per-hole stats changes (debounced)
  useEffect(() => {
    if (!round || !course || !isClient) return;

    const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
    if (!user) return;

    // Clear any pending debounce timer
    if (statsDebounceRef.current) {
      clearTimeout(statsDebounceRef.current);
    }

    // Debounce Supabase sync for stats - wait 500ms in case more changes are coming
    statsDebounceRef.current = setTimeout(() => {
      // Skip if a request is already in flight
      if (statsRequestInFlightRef.current) {
        return;
      }

      try {
        statsRequestInFlightRef.current = true;
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
          scores,
          totalScore: scores.reduce((a, b) => a + b, 0),
          notes: round.notes || '',
          in_progress: typeof round.in_progress === 'boolean' ? round.in_progress : true,
          startingHole: (round as any).startingHole || (round as any).starting_hole || 1,
          perHoleStats,
        };

        // Also save to localStorage as a backup
        if (typeof window !== 'undefined') {
          const savedRounds = localStorage.getItem('golfRounds');
          if (savedRounds) {
            try {
              const allRounds = JSON.parse(savedRounds);
              const index = allRounds.findIndex((r: any) => r.id === round.id);
              if (index >= 0) {
                allRounds[index] = updatedRound;
                localStorage.setItem('golfRounds', JSON.stringify(allRounds));
              }
            } catch (e) {
              // Silently fail
            }
          }
        }

        fetch('/api/save-round', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedRound),
        }).catch(e => console.error('Failed to sync per-hole stats to Supabase', e))
          .finally(() => {
            statsRequestInFlightRef.current = false;
          });
      } catch (e) {
        console.error('Error syncing per-hole stats:', e);
        statsRequestInFlightRef.current = false;
      }
    }, 500);

    return () => {
      if (statsDebounceRef.current) {
        clearTimeout(statsDebounceRef.current);
      }
    };
  }, [perHoleStats, scores, round, course, isClient]);

  const handleScoreChange = () => {
    // This function is no longer used - scores are updated directly via button clicks
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
  if (!round || !course) return (
    <div className="p-8 text-center">
      {toastMessage && (
        <div className="bg-amber-100 border-2 border-amber-500 text-amber-900 px-6 py-4 rounded-lg shadow-lg">
          <p className="font-semibold text-lg">{toastMessage}</p>
          <p className="text-sm mt-2">Redirecting to home...</p>
        </div>
      )}
    </div>
  );

  return (
    <PageWrapper title="" userName={round.userName}>
      {/* Toast notification - More prominent with close button */}
      {toastMessage && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 rounded-lg shadow-xl z-50 border-l-4 border-white flex items-center justify-between gap-4">
          <span className="font-semibold">{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-lg font-bold leading-none hover:opacity-70 transition-opacity"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main layout: map as background, overlays for yardage, scoring, and bottom bar */}
      <div className="relative w-full min-h-[100vh] flex flex-col justify-end items-stretch bg-black overflow-hidden">
        {/* Show placeholder image or map */}
        <div className="absolute inset-0 z-0">
          {showMap ? (
            <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
              {/* Close button removed, now in bottom bar as 'Exit Map' */}
              {/* Map itself */}
              {(() => {
                const hole = course.holes[currentHoleIndex];
                const hasValidGreen =
                  hole &&
                  typeof hole.greenLat === 'number' &&
                  !isNaN(hole.greenLat) &&
                  typeof hole.greenLng === 'number' &&
                  !isNaN(hole.greenLng);
                const hasValidUser =
                  userLocation &&
                  typeof userLocation.lat === 'number' &&
                  !isNaN(userLocation.lat) &&
                  typeof userLocation.lng === 'number' &&
                  !isNaN(userLocation.lng);
                if (!hasValidGreen || !hasValidUser) {
                  return (
                    <div style={{ width: '100vw', height: '100vh', background: 'black', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
                      <div className="flex items-center justify-center w-full h-full">
                        <div className="text-white text-lg animate-pulse">Loading map...</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <HoleMap
                    userLat={userLocation?.lat}
                    userLng={userLocation?.lng}
                    greenLat={hole?.greenLat}
                    greenLng={hole?.greenLng}
                    holeName={`Hole ${hole?.holeNumber || ''}`}
                  />
                );
              })()}
            </div>
          ) : (
            <img
              src={randomHoleImages[currentHoleIndex] || '/hole1.png'}
              alt="Hole preview"
              className="w-full h-full object-cover cursor-pointer select-none"
              style={{ width: '100vw', height: '100vh', objectFit: 'cover', background: 'black' }}
              onClick={() => setShowMap(true)}
              draggable={false}
            />
          )}
        </div>

        {/* Modern yardage overlay (left) */}
          {/* Live drive yardage overlay (shows only while measuring drive) */}
          {renderLiveDriveOverlay()}
        <div className="absolute top-8 left-4 z-20 flex flex-col items-center gap-4">
          <div className="bg-black bg-opacity-90 border-2 border-white text-white rounded-2xl px-8 py-5 text-5xl font-extrabold shadow-2xl tracking-wide flex flex-col items-center" style={{boxShadow: '0 4px 24px 0 rgba(0,0,0,0.5)'}}>
            <span className="text-base font-semibold text-gray-300 mb-1">Yards</span>
            {(() => {
              const hole = course.holes[currentHoleIndex];
              if (!hole || !userLocation || typeof hole.greenLat !== 'number' || typeof hole.greenLng !== 'number') return '—';
              const dist = getDistanceYards(userLocation.lat, userLocation.lng, hole.greenLat, hole.greenLng);
              return Math.round(dist);
            })()}
          </div>
        </div>







        {/* Floating drive distance button (above score button) */}
        <div className="fixed bottom-44 right-6 z-50 flex flex-col items-end gap-2">
          <button
            className={`w-32 h-16 rounded-xl ${driveStart ? 'bg-yellow-500' : 'bg-green-700'} text-white text-lg font-bold shadow-2xl flex items-center justify-center border-4 border-white hover:bg-green-800 transition-all`}
            style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.4)' }}
            onClick={handleMeasureDrive}
          >
            <span className="text-base whitespace-nowrap">{driveStart ? 'Save Drive' : 'Track Drive'}</span>
          </button>
          {driveStart && (
            <button
              className="w-32 h-10 rounded-xl bg-gray-300 text-gray-800 text-base font-semibold shadow flex items-center justify-center border-2 border-white hover:bg-gray-400 transition-all"
              style={{ boxShadow: '0 2px 8px 0 rgba(0,0,0,0.15)' }}
              onClick={handleDiscardDrive}
            >
              Cancel
            </button>
          )}
        </div>
        {/* Toast message for drive workflow */}
        {toastMessage && !driveHelpDismissed && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-500 text-white px-6 py-4 rounded-xl shadow-xl flex flex-col gap-2 max-w-md w-full" style={{maxWidth: 400}}>
            <div className="flex justify-between items-start gap-4">
              <span className="font-semibold text-base flex-1">{toastMessage}</span>
              <button
                className="ml-2 text-2xl leading-none hover:text-white/80"
                onClick={() => setToastMessage(null)}
                aria-label="Close message"
              >×</button>
            </div>
            <label className="flex items-center gap-2 text-sm mt-1 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={driveHelpDismissed}
                onChange={e => {
                  setDriveHelpDismissed(e.target.checked);
                  if (e.target.checked) {
                    localStorage.setItem('driveHelpDismissed', 'true');
                    setToastMessage(null);
                  } else {
                    localStorage.removeItem('driveHelpDismissed');
                  }
                }}
                className="w-4 h-4"
              />
              Don't show again
            </label>
            <button
              className="mt-2 self-end bg-white/20 hover:bg-white/30 text-white px-4 py-1 rounded-lg text-sm font-semibold transition"
              onClick={() => setToastMessage(null)}
              aria-label="Close message"
            >Close</button>
          </div>
        )}


      {/* Floating score button (lower right, outside flex/relative containers) */}
      <button
        className="fixed block visible z-50 w-16 h-16 rounded-full bg-blue-700 text-white shadow-2xl flex items-center justify-center border-4 border-white hover:bg-blue-800 transition-all pointer-events-auto bottom-24 right-6"
        style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.4)' }}
        onClick={() => setShowScoreModal(true)}
        aria-label="Enter score"
      >
        <span className="text-2xl font-bold">
          {totalScore > 0 ? `+${totalScore}` : totalScore === 0 ? 'E' : totalScore}
        </span>
        <span className="absolute -bottom-3 -right-3">
          <span className="bg-white rounded-full p-1 shadow-lg flex items-center justify-center" style={{ width: '32px', height: '32px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-blue-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13zm-6 6h12" />
            </svg>
          </span>
        </span>
      </button>

        {/* Bottom bar for hole navigation and info */}
        {renderBottomBar()}
      {/* Score Entry Modal */}

      {showScoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 relative">


            {/* Hole navigation and picker */}
            <div className="flex items-center justify-between mb-4">
              <button
                className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-bold text-lg border hover:bg-gray-300 disabled:opacity-50"
                onClick={() => setCurrentHoleIndex(i => Math.max(0, i - 1))}
                disabled={currentHoleIndex === 0}
                aria-label="Previous Hole"
              >
                &#x25C0;
              </button>
              <div className="flex items-center gap-2">
                <label htmlFor="hole-picker" className="font-semibold text-gray-700">Hole</label>
                <select
                  id="hole-picker"
                  className="border rounded px-2 py-1 text-lg font-bold bg-white text-gray-800"
                  value={currentHoleIndex}
                  onChange={e => setCurrentHoleIndex(Number(e.target.value))}
                >
                  {course?.holes?.map((h, idx) => (
                    <option key={idx} value={idx}>
                      {h.holeNumber ?? idx + 1}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-bold text-lg border hover:bg-gray-300 disabled:opacity-50"
                onClick={() => setCurrentHoleIndex(i => Math.min(course.holes.length - 1, i + 1))}
                disabled={currentHoleIndex === course.holes.length - 1}
                aria-label="Next Hole"
              >
                &#x25B6;
              </button>
            </div>

            <h2 className="text-xl font-bold mb-4 text-gray-800">Enter Score for Hole {course?.holes?.[currentHoleIndex]?.holeNumber ?? currentHoleIndex + 1}</h2>

            {/* Scorecard Table - 9 holes per row, with totals */}
            {course && course.holes && course.holes.length > 0 && (
              <div className="overflow-x-auto mb-6">
                {[0, 9].map((startIdx, sectionIdx) => {
                  const holes = course.holes.slice(startIdx, startIdx + 9);
                  const isFrontNine = startIdx === 0;
                  const parTotal = holes.reduce((sum, h) => sum + (h.par || 0), 0);
                  const scoreTotal = holes.reduce((sum, h, i) => sum + (typeof scores[startIdx + i] === 'number' && scores[startIdx + i] > 0 ? scores[startIdx + i] : 0), 0);
                  // Compute yardages for selected tee
                  const yardages = holes.map(h => h?.[selectedTee]?.yardage ?? '-');
                  const yardageTotal = holes.reduce((sum, h) => sum + (h?.[selectedTee]?.yardage || 0), 0);
                  return (
                    <table key={sectionIdx} className="min-w-full border text-center text-xs mb-2">
                      <thead>
                        <tr>
                          <th className="px-1 py-1 font-bold">Hole</th>
                          {holes.map((h, i) => (
                            <th key={i} className={`px-1 py-1 font-bold ${startIdx + i === currentHoleIndex ? 'bg-blue-100' : ''}`}>{h.holeNumber ?? startIdx + i + 1}</th>
                          ))}
                          <th className="px-1 py-1 font-bold">{isFrontNine ? 'Out' : 'In'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-1 py-1 font-semibold">Yardage</td>
                          {yardages.map((y, i) => (
                            <td key={i} className="px-1 py-1">{y}</td>
                          ))}
                          <td className="px-1 py-1 font-bold bg-gray-100">{yardageTotal > 0 ? yardageTotal : ''}</td>
                        </tr>
                        <tr>
                          <td className="px-1 py-1 font-semibold">Par</td>
                          {holes.map((h, i) => (
                            <td key={i} className={`px-1 py-1 ${startIdx + i === currentHoleIndex ? 'bg-blue-50' : ''}`}>{h.par ?? '-'}</td>
                          ))}
                          <td className="px-1 py-1 font-bold bg-gray-100">{parTotal}</td>
                        </tr>
                        <tr>
                          <td className="px-1 py-1 font-semibold">Score</td>
                          {holes.map((h, i) => (
                            <td key={i} className={`px-1 py-1 ${startIdx + i === currentHoleIndex ? 'bg-blue-200 font-bold' : ''}`}>{typeof scores[startIdx + i] === 'number' && scores[startIdx + i] > 0 ? scores[startIdx + i] : ''}</td>
                          ))}
                          <td className="px-1 py-1 font-bold bg-gray-100">{scoreTotal > 0 ? scoreTotal : ''}</td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })}
                {/* Overall total row if all 18 holes */}
                {course.holes.length === 18 && (
                  <table className="min-w-full border text-center text-xs">
                    <tbody>
                      <tr>
                        <td className="px-1 py-1 font-bold">Total</td>
                        <td colSpan={9} className="px-1 py-1 font-bold bg-gray-200">{course.holes.slice(0, 9).reduce((sum, h) => sum + (h.par || 0), 0)}</td>
                        <td colSpan={9} className="px-1 py-1 font-bold bg-gray-200">{course.holes.slice(9, 18).reduce((sum, h) => sum + (h.par || 0), 0)}</td>
                        <td className="px-1 py-1 font-bold bg-yellow-100">{course.holes.reduce((sum, h) => sum + (h.par || 0), 0)}</td>
                      </tr>
                      <tr>
                        <td className="px-1 py-1 font-bold">Score</td>
                        <td colSpan={9} className="px-1 py-1 font-bold bg-blue-100">{scores.slice(0, 9).reduce((sum, s) => sum + (typeof s === 'number' && s > 0 ? s : 0), 0) || ''}</td>
                        <td colSpan={9} className="px-1 py-1 font-bold bg-blue-100">{scores.slice(9, 18).reduce((sum, s) => sum + (typeof s === 'number' && s > 0 ? s : 0), 0) || ''}</td>
                        <td className="px-1 py-1 font-bold bg-yellow-100">{scores.reduce((sum, s) => sum + (typeof s === 'number' && s > 0 ? s : 0), 0) || ''}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
            <div className="mb-4">
              <label className="block font-semibold mb-2 text-lg">Enter Hole Score</label>
              <div className="flex items-center gap-3">
                <button
                  className="w-10 h-10 rounded bg-gray-200 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                  onClick={() => {
                    setScores(prev => {
                      const updated = [...prev];
                      const current = updated[currentHoleIndex] ?? 0;
                      updated[currentHoleIndex] = Math.max(0, current - 1);
                      return updated;
                    });
                  }}
                  aria-label="Decrease score"
                >−</button>
                <span className="text-2xl font-bold w-10 text-center">{scores[currentHoleIndex] ?? 0}</span>
                <button
                  className="w-10 h-10 rounded bg-gray-200 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                  onClick={() => {
                    setScores(prev => {
                      const updated = [...prev];
                      const current = updated[currentHoleIndex] ?? 0;
                      updated[currentHoleIndex] = Math.min(20, current + 1);
                      return updated;
                    });
                  }}
                  aria-label="Increase score"
                >+</button>
              </div>
              {/* Show drive distance if available */}
              {perHoleStats[currentHoleIndex]?.drive?.yardage != null && (
                <div className="mt-2 flex items-center gap-2 text-lg text-blue-700 font-semibold">
                  <span className="inline-block bg-blue-100 rounded px-2 py-1 text-base font-bold">Drive:</span>
                  <span className="inline-block">{perHoleStats[currentHoleIndex].drive.yardage} yd</span>
                </div>
              )}
            </div>
            <div className="mb-4 flex gap-4">
              <div>
                <label className="block font-semibold mb-1">FIR</label>
                <div className="flex gap-1">
                  {(['L', 'hit', 'R'] as Array<'L' | 'hit' | 'R'>).map(opt => (
                    <button
                      key={opt}
                      className={`px-2 py-1 rounded border font-bold text-sm ${perHoleStats[currentHoleIndex]?.fairwayHit === opt ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                      onClick={() => {
                        setPerHoleStats(stats => {
                          const updated = [...stats];
                          if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                          updated[currentHoleIndex] = { ...updated[currentHoleIndex], fairwayHit: opt };
                          return updated;
                        });
                      }}
                    >{opt}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">GIR</label>
                <div className="flex gap-1">
                  <button
                    className={`px-4 py-1 rounded border font-bold text-sm ${perHoleStats[currentHoleIndex]?.gir ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    onClick={() => {
                      setPerHoleStats(stats => {
                        const updated = [...stats];
                        if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                        updated[currentHoleIndex] = { ...updated[currentHoleIndex], gir: !updated[currentHoleIndex].gir };
                        return updated;
                      });
                    }}
                  >Y</button>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1">Putts</label>
              <div className="flex items-center gap-3 justify-between w-full">
                <div className="flex items-center gap-3">
                  <button
                    className="w-10 h-10 rounded bg-gray-200 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                    onClick={() => {
                      setPerHoleStats(stats => {
                        const updated = [...stats];
                        if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                        const prev = updated[currentHoleIndex].puttDistances;
                        const currentCount = prev.length;
                        const newCount = Math.max(0, currentCount - 1);
                        updated[currentHoleIndex] = {
                          ...updated[currentHoleIndex],
                          puttDistances: Array(newCount).fill(0).map((v, i) => prev[i] || 0),
                        };
                        return updated;
                      });
                    }}
                    aria-label="Decrease putts"
                  >−</button>
                  <span className="text-2xl font-bold w-10 text-center">{perHoleStats[currentHoleIndex]?.puttDistances?.length ?? 0}</span>
                  <button
                    className="w-10 h-10 rounded bg-gray-200 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                    onClick={() => {
                      setPerHoleStats(stats => {
                        const updated = [...stats];
                        if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                        const prev = updated[currentHoleIndex].puttDistances;
                        const currentCount = prev.length;
                        const newCount = Math.min(6, currentCount + 1);
                        updated[currentHoleIndex] = {
                          ...updated[currentHoleIndex],
                          puttDistances: Array(newCount).fill(0).map((v, i) => prev[i] || 0),
                        };
                        return updated;
                      });
                    }}
                    aria-label="Increase putts"
                  >+</button>
                </div>
                <button
                  className="ml-auto px-4 py-2 rounded bg-gray-200 text-gray-700 font-bold text-base border hover:bg-gray-300 transition"
                  onClick={() => setShowScoreModal(false)}
                  aria-label="Close score entry"
                >
                  Close
                </button>
              </div>
            </div>
            {perHoleStats[currentHoleIndex]?.puttDistances?.length > 0 && (
              <div className="mb-4">
                <label className="block font-semibold mb-1">Putt Distances (ft)</label>
                <div className="flex flex-wrap gap-2">
                  {perHoleStats[currentHoleIndex].puttDistances.map((dist, idx) => (
                    <button
                      key={idx}
                      className="w-20 px-2 py-1 border rounded text-center bg-white hover:bg-blue-50 focus:bg-blue-100 transition font-semibold"
                      onClick={() => setPuttEdit({ idx, value: dist })}
                      type="button"
                    >
                      {dist}
                    </button>
                  ))}
                </div>
              </div>
            )}

      {/* Putt Distance Edit Popup */}
      {typeof puttEdit?.idx === 'number' && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs mx-4 relative flex flex-col items-center">
            <button
              className="absolute top-3 right-3 text-2xl text-gray-500 hover:text-gray-800"
              onClick={() => setPuttEdit(null)}
              aria-label="Close putt edit"
            >×</button>
            <h3 className="text-lg font-bold mb-4">Edit Putt {puttEdit.idx + 1} Distance</h3>
            <div className="flex items-center gap-3 mb-4">
              <button
                className="w-10 h-10 rounded bg-gray-200 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                onClick={() => setPuttEdit(edit => (edit ? { idx: edit.idx, value: Math.max(0, (edit.value || 0) - 1) } : null))}
                aria-label="Decrease putt distance"
              >−</button>
              <span className="text-2xl font-bold w-12 text-center">{puttEdit.value}</span>
              <button
                className="w-10 h-10 rounded bg-gray-200 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                onClick={() => setPuttEdit(edit => (edit ? { idx: edit.idx, value: Math.min(100, (edit.value || 0) + 1) } : null))}
                aria-label="Increase putt distance"
              >+</button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[5,10,15,20,25,30,35,40,45,50,60,70,80,90,100].map(val => (
                <button
                  key={val}
                  className={`py-2 px-2 rounded text-sm font-semibold transition ${puttEdit.value === val ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                  onClick={() => setPuttEdit(edit => (edit ? { idx: edit.idx, value: val } : null))}
                  type="button"
                >{val}</button>
              ))}
            </div>
            <button
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 rounded-xl mt-2 text-lg"
              onClick={() => {
                setPerHoleStats(stats => {
                  const updated = [...stats];
                  const puttDistances = [...(updated[currentHoleIndex]?.puttDistances || [])];
                  puttDistances[puttEdit.idx] = puttEdit.value;
                  updated[currentHoleIndex] = { ...updated[currentHoleIndex], puttDistances };
                  return updated;
                });
                setPuttEdit(null);
              }}
            >Save</button>
          </div>
        </div>
      )}
            {scores.length === course?.holes?.length && scores.every(s => typeof s === 'number' && s > 0) ? (
              <button
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2 rounded-xl mt-2 text-lg"
                onClick={() => {
                  setShowScoreModal(false);
                  // Optionally mark round as finished here
                  router.push(`/round-detail/${roundId}`);
                }}
              >Finish Round</button>
            ) : (
              <button
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 rounded-xl mt-2 text-lg"
                onClick={() => {
                  // Save and go to next hole
                  setShowScoreModal(false);
                  setCurrentHoleIndex(idx => {
                    if (!course) return idx;
                    if (idx < course.holes.length - 1) {
                      return idx + 1;
                    }
                    return idx;
                  });
                }}
              >Save and Next Hole</button>
            )}
          </div>
        </div>
      )}

        {/* (Optional) Overlay for comments, stats, etc. can be added here */}
      </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold">GIR</span>
                <input
                  type="checkbox"
                  className="w-8 h-8 rounded border font-bold bg-green-200 border-green-600 accent-green-600"
                  checked={perHoleStats[currentHoleIndex]?.gir ?? false}
                  onChange={e => {
                    setPerHoleStats(stats => {
                      const updated = [...stats];
                      if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
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
                      if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                      const prev = updated[currentHoleIndex].puttDistances;
                      const currentCount = prev.length;
                      const newCount = Math.max(0, currentCount - 1);
                      updated[currentHoleIndex] = {
                        ...updated[currentHoleIndex],
                        puttDistances: Array(newCount).fill(0).map((v, i) => prev[i] || 0),
                        puttExpanded: null // always collapse all on change
                      };
                      return updated;
                    });
                  }}
                  aria-label="Decrease putts"
                >
                  −
                </button>
                <span className="text-lg font-bold w-6 text-center">{perHoleStats[currentHoleIndex]?.puttDistances?.length ?? 0}</span>
                <button
                  type="button"
                  className="w-8 h-8 rounded bg-green-500 text-xl font-bold text-white flex items-center justify-center hover:bg-green-600 border"
                  onClick={() => {
                    setPerHoleStats(stats => {
                      const updated = [...stats];
                      if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                      const prev = updated[currentHoleIndex].puttDistances;
                      const currentCount = prev.length;
                      const newCount = Math.min(6, currentCount + 1);
                      updated[currentHoleIndex] = {
                        ...updated[currentHoleIndex],
                        puttDistances: Array(newCount).fill(0).map((v, i) => prev[i] || 0),
                        puttExpanded: null // always collapse all on change
                      };
                      return updated;
                    });
                  }}
                  aria-label="Increase putts"
                >
                  +
                </button>
              </div>

        {/* Putt Distance Entry */}
        {perHoleStats[currentHoleIndex]?.puttDistances?.length > 0 && (
          <div className="mt-4 p-4 rounded-xl border-2 border-green-600 bg-white relative">
            <div className="font-semibold mb-2">Putt Distance to the Cup.</div>
            {/* Expanded putt editor, absolutely positioned overlay */}
            {typeof perHoleStats[currentHoleIndex]?.puttExpanded === 'number' && (() => {
              const idx = perHoleStats[currentHoleIndex].puttExpanded;
              const dist = perHoleStats[currentHoleIndex].puttDistances[idx];
              return (
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-10">
                  <div className="bg-white bg-opacity-95 rounded-xl shadow-2xl p-6 max-w-xs w-full flex flex-col items-center border-2 border-green-600">
                    <div className="flex items-center gap-2 mb-4 w-full justify-center">
                      <span className="font-semibold whitespace-nowrap">Putt {idx + 1}:</span>
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
                      <input
                        type="number"
                        min={0}
                        className="border rounded px-2 py-1 w-16 text-center mx-1"
                        value={dist}
                        onFocus={e => { e.target.value = ''; }}
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
                      <button
                        type="button"
                        className="w-8 h-8 rounded bg-gray-200 text-xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border ml-1"
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
                      <button
                        type="button"
                        className="ml-4 px-5 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition min-w-[70px]"
                        onClick={() => {
                          setPerHoleStats(stats => {
                            const updated = [...stats];
                            updated[currentHoleIndex] = {
                              ...updated[currentHoleIndex],
                              puttExpanded: null
                            };
                            return updated;
                          });
                        }}
                      >Done</button>
                    </div>
                    <div className="w-full mt-4">
                      <div className="grid grid-cols-5 gap-2">
                        {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100].map(value => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setPerHoleStats(stats => {
                                const updated = [...stats];
                                const puttDistances = [...(updated[currentHoleIndex]?.puttDistances || [])];
                                puttDistances[idx] = value;
                                updated[currentHoleIndex] = { ...updated[currentHoleIndex], puttDistances };
                                return updated;
                              });
                            }}
                            className={`py-2 px-2 rounded text-sm font-semibold transition ${
                              dist === value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <div className="text-center mt-3 font-semibold text-lg">{dist} ft</div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* Collapsed putts grid, excluding expanded */}
            {chunkArray(
              (perHoleStats[currentHoleIndex]?.puttDistances ?? [])
                .map((dist, idx) => ({ dist, idx }))
                .filter(({ idx }) => perHoleStats[currentHoleIndex]?.puttExpanded !== idx),
              2
            ).map((row, rowIdx) => (
              <div key={rowIdx} className="flex flex-row gap-4 mb-2">
                {row.map(({ dist, idx }) => (
                  <div key={idx} className="mb-2 flex-1">
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
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

      {/* Comments Modal */}
      {showCommentsModal && user && (
        <CommentsModal
          roundId={roundId || ''}
          userId={user.id}
          userName={user.name || 'Anonymous'}
          onClose={() => setShowCommentsModal(false)}
          onCommentAdded={() => {
            // Refresh comment count
            fetch('/api/get-comments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roundId }),
            })
              .then((res) => res.json())
              .then((data) => setCommentCount(data.comments?.length || 0))
              .catch((error) => console.error('Failed to refresh comments:', error));
          }}
        />
      )}

      {/* Hole Map Modal */}
      {/* Removed showHoleMap modal logic: map is always visible */}

      {/* Drive Measurement Help Modal */}
      {showDriveHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-gray-800">How to Measure Drive</h2>
            <div className="space-y-3 text-gray-700">
              <div className="flex items-start gap-3">
                <span className="text-lg font-bold bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">①</span>
                <span>Walk to your Ball location after the drive.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg font-bold bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">②</span>
                <span>Tap "Drive Distance" button to measure your drive.</span>
              </div>
              <div className="text-sm text-gray-600 mt-4 p-3 bg-blue-50 rounded">
                Distance calculated as:<br/>
                <strong>Drive = Tee Yardage − Distance to Pin</strong>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="dontShowAgain"
                checked={driveHelpDismissed}
                onChange={(e) => {
                  setDriveHelpDismissed(e.target.checked);
                  if (e.target.checked) {
                    localStorage.setItem('driveHelpDismissed', 'true');
                  } else {
                    localStorage.removeItem('driveHelpDismissed');
                  }
                }}
                className="w-4 h-4"
              />
              <label htmlFor="dontShowAgain" className="text-sm text-gray-600">
                Don't show this again
              </label>
            </div>
            <button
              onClick={() => setShowDriveHelp(false)}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </PageWrapper >
  );
}

export default function TrackRound() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TrackRoundContent />
    </Suspense>
  );
}
