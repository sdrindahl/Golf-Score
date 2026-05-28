"use client";
import { useState, useEffect, useRef, Suspense } from 'react';
// ...existing code...

// Add pressed state for TapIt button
function useTapItPressed() {
  const [pressed, setPressed] = useState(false);
  const press = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 150);
  };
  return [pressed, press] as const;
}

// Helper to chunk an array into subarrays of given size
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}


// Wrap in Suspense to support useSearchParams
export default function TrackRoundPageWrapper(props: any) {
  return (
    <Suspense>
      <TrackRoundContent {...props} />
    </Suspense>
  );
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
import { Round, Course, User } from '@/types';
import { useAuth } from '@/lib/useAuth';
import PageWrapper from '@/components/PageWrapper';
import CommentsModal from '@/components/CommentsModal';
import HoleMap from '@/components/HoleMap';
import { useMemo, useCallback } from 'react';
import { getRoundsInProgress, subscribeToRoundsInProgress } from '@/lib/roundsInProgress';
import { supabase } from '@/lib/supabase';

function TrackRoundContent() {
  // Ref for menu and button to handle outside clicks (must be at top level)
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // State for 3-dot menu (must be before useEffect that uses it)
  const [showMenu, setShowMenu] = useState(false);

  // Close menu on outside click (must be at top level, not inside JSX)
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      const menu = menuRef.current;
      const btn = menuButtonRef.current;
      if (menu && !menu.contains(e.target as Node) && btn && !btn.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);
  const [tapItPressed, tapItPress] = useTapItPressed();
  // Move useAuth to the very top to ensure 'auth' is always initialized before any usage
  const auth = useAuth();
  // Add missing state for Add Players modal
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  // State for selected players (up to 3)
  const [selectedPlayers, setSelectedPlayers] = useState<User[]>([]);
  // State for all available players
  const [allPlayers, setAllPlayers] = useState<User[]>([]);

  // Get current user
  const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;

  // Load all players on mount (simulate API call or useAuth)
  useEffect(() => {
    async function fetchPlayers() {
      if (auth && auth.getAllUsersAsync) {
        const users = await auth.getAllUsersAsync();
        setAllPlayers(users.filter(u => u.id !== user?.id)); // Exclude self
      }
    }
    if (showAddPlayers) fetchPlayers();
  }, [showAddPlayers, auth, user]);
        // ...existing code...
      // Ensure isClient is true in browser for immediate saves
      // (Only declare once at the top of the component)
    // Live drive yardage overlay (shows only while measuring drive)
    console.log('[DEBUG] TrackRoundContent mounted');
    // Removed yellow Drive yd overlay per user request
  // State for editing a putt distance
  const [puttEdit, setPuttEdit] = useState<{ idx: number, value: number } | null>(null);

  // Show map or image?
  const [showMap, setShowMap] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = searchParams ? searchParams.get('id') : null;
  const [round, setRound] = useState<Round | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  // Use typeof window !== 'undefined' for client-only logic
  // Restore last viewed hole index from localStorage, URL, or round.startingHole
  const [currentHoleIndex, setCurrentHoleIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const idx = localStorage.getItem('currentHoleIndex');
      if (idx !== null) return Number(idx);
    }
    return 0;
  });

  // Set currentHoleIndex from URL (?hole=) or round.startingHole after round/searchParams are loaded
  useEffect(() => {
    // Only run after round and searchParams are available
    if (!round) return;
    // Try to get ?hole= from URL
    const holeParam = searchParams ? searchParams.get('hole') : null;
    if (holeParam && !isNaN(Number(holeParam))) {
      setCurrentHoleIndex(Math.max(0, Number(holeParam) - 1));
      return;
    }
    // Else, use round.startingHole if present
    const startingHole = (round as any).startingHole || (round as any).starting_hole;
    if (startingHole && !isNaN(Number(startingHole))) {
      setCurrentHoleIndex(Math.max(0, Number(startingHole) - 1));
    }
  }, [round, searchParams]);
  const [scores, setScores] = useState<number[]>([]);

  // Restore scores from round when round is loaded
  useEffect(() => {
    if (round && Array.isArray(round.scores)) {
      setScores(round.scores);
      // Find the first hole with no score (null, undefined, or 0)
      const firstUnscored = round.scores.findIndex((s: number) => s == null || s === 0);
      if (firstUnscored !== -1) {
        setCurrentHoleIndex(firstUnscored);
      } else {
        // All holes scored: go to the last hole
        setCurrentHoleIndex(round.scores.length - 1);
      }
    }
    // Restore perHoleStats if present, normalizing types, skip null/undefined
    if (round && Array.isArray(round.perHoleStats)) {
      const normalizedStats = round.perHoleStats
        .filter((stat: any) => stat != null)
        .map((stat: any) => ({
          ...stat,
          fairwayHit: stat.fairwayHit === undefined ? null : stat.fairwayHit,
        }));
      setPerHoleStats(normalizedStats);
    }
  }, [round]);

  // Score entry modal state
  const [showScoreModal, setShowScoreModal] = useState(false);

  // Helper: calculate total score (sum of scores array)
  const totalScore = scores.reduce((sum, s) => sum + (typeof s === 'number' ? s : 0), 0);
  const [commentCount, setCommentCount] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  // ...other state declarations...

  // --- All state/vars must be declared before this point ---
  const isClient = typeof window !== 'undefined';

  // List of available hole images (after course is declared)
  const holeImages = [
    '/hole1.png',
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
  // Persist currentHoleIndex to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentHoleIndex', String(currentHoleIndex));
    }
  }, [currentHoleIndex]);
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
    console.log('[handleFinishRound] called');
    setFinishing(true);
    setShowIncompleteWarning(false);
    
    try {
      const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
      // Robustly determine selectedTee: state, round.selectedTee, round.selected_tee
      let teeToSend = selectedTee || round?.selectedTee || (round && (round as any).selected_tee) || '';
      const updatedRound = {
        ...round,
        scores,
        completed_at: new Date().toISOString(),
        userId: round?.userId || user?.id,
        userName: round?.userName || user?.name,
        courseId: round?.courseId || course?.id,
        courseName: round?.courseName || course?.name,
        selectedTee: teeToSend,
        // Always use the perHoleStats state
        perHoleStats,
        in_progress: false, // Always set LAST to override any previous value
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
                console.log('[handleFinishRound] Outgoing payload:', JSON.stringify(updatedRound));
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
        // Determine the result for the current hole
        let holeResultLabel = null;
        const score = scores[currentHoleIndex];
        const par = hole?.par;
        if (typeof score === 'number' && typeof par === 'number' && score > 0) {
          const diff = score - par;
          if (score === 1) {
            holeResultLabel = { label: 'Ace', color: 'bg-yellow-400 text-black' };
          } else if (diff <= -3) {
            holeResultLabel = { label: 'Albatross', color: 'bg-blue-700 text-white' };
          } else if (diff === -2) {
            holeResultLabel = { label: 'Eagle', color: 'bg-blue-500 text-white' };
          } else if (diff === -1) {
            holeResultLabel = { label: 'Birdie', color: 'bg-green-500 text-white' };
          } else if (diff === 0) {
            holeResultLabel = { label: 'Par', color: 'bg-gray-500 text-white' };
          } else if (diff === 1) {
            holeResultLabel = { label: 'Bogey', color: 'bg-orange-500 text-white' };
          } else if (diff === 2) {
            holeResultLabel = { label: 'Double Bogey', color: 'bg-orange-700 text-white' };
          } else if (diff === 3) {
            holeResultLabel = { label: 'Triple Bogey', color: 'bg-red-600 text-white' };
          } else if (diff > 3) {
            holeResultLabel = { label: `${diff}+ Bogey`, color: 'bg-red-900 text-white' };
          }
        }
    return (
      <div className="fixed bottom-0 left-0 w-full flex justify-center items-end z-50 pb-2 pointer-events-none">
        <div className="bg-gray-800 bg-opacity-95 rounded-t-2xl shadow-2xl flex items-center justify-center w-[95vw] max-w-md mx-auto h-24 relative pointer-events-auto">
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

          {/* Map Icon Button */}
          <button
            className={`absolute left-16 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center border border-gray-600 shadow transition ${showMap ? 'bg-green-700' : 'bg-gray-700'} hover:bg-green-700`}
            onClick={() => setShowMap((prev) => !prev)}
            aria-label="Show Map"
            title="Show Map"
            type="button"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={showMap ? '#4ade80' : 'white'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </button>

          {/* Center Info */}
          <div className="flex flex-col items-center justify-center px-12">
            <div className="w-12 h-1 rounded-full bg-gray-600 mb-1" />
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-white">{hole?.holeNumber ?? currentHoleIndex + 1}</span>
              <span className="text-lg text-gray-300 font-semibold ml-1">Par {hole?.par ?? '-'}</span>
              {/* Result indicator */}
              {holeResultLabel ? (
                <span className={`ml-2 px-2 py-0.5 rounded-full ${holeResultLabel.color} text-xs font-bold`}>{holeResultLabel.label}</span>
              ) : (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-500 text-white text-xs font-bold">Not Scored</span>
              )}
            </div>
            <div className="text-sm text-gray-400 font-medium">Hdcp {hole?.handicap ?? '-'}</div>
            {/* Show current total score */}
            <div className="mt-1 text-base font-bold text-green-300">Current Score: {totalScore}</div>
          </div>
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

  // Debounced auto-save for per-hole stats (for background/heartbeat)
  useEffect(() => {
    if (!round || !course || !isClient) return;
    const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
    if (!user) return;
    if (statsDebounceRef.current) {
      clearTimeout(statsDebounceRef.current);
    }
    statsDebounceRef.current = setTimeout(() => {
      if (statsRequestInFlightRef.current) return;
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
        if (isClient) {
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


  // Helper: Immediate save-round API call (must be above debouncedImmediateSaveRound)
  const immediateSaveRound = async () => {
    console.log('[DEBUG] immediateSaveRound called', { round, course, isClient, scores, perHoleStats });
    if (!round || !course || !isClient) {
      console.log('[DEBUG] immediateSaveRound abort: missing round/course/isClient', { round, course, isClient });
      return;
    }
    const user = auth.getCurrentUser ? auth.getCurrentUser() : undefined;
    if (!user) {
      console.log('[DEBUG] immediateSaveRound abort: missing user');
      return;
    }
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
    try {
      console.log('[DEBUG] immediateSaveRound sending fetch', updatedRound);
      await fetch('/api/save-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRound),
      });
    } catch (e) {
      // Optionally show error/toast
      console.error('Immediate save-round failed', e);
    }
  };

  // --- Debounced Immediate Save for Score Modal ---
  // This debounce persists across renders and only fires after user pauses
  const popupSaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedImmediateSaveRound = useCallback(() => {
    if (popupSaveDebounceRef.current) {
      clearTimeout(popupSaveDebounceRef.current);
    }
    popupSaveDebounceRef.current = setTimeout(() => {
      immediateSaveRound();
    }, 300);
  }, [immediateSaveRound]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (popupSaveDebounceRef.current) {
        clearTimeout(popupSaveDebounceRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    // Only debounce saves in the popup
    if (!showScoreModal) return;
    if (!round || !course || !isClient) return;
    debouncedImmediateSaveRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, perHoleStats, showScoreModal]);
  useEffect(() => {
    return () => {
      if (popupSaveDebounceRef.current) {
        clearTimeout(popupSaveDebounceRef.current);
      }
    };
  }, []);

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
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  const handleDeleteRound = async () => {
    if (deleting) return;
    if (!round) return;
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

  if (loading || !auth || !user) return <div className="p-8 text-center">Loading user and round data...</div>;
  if (!round || !course) return (
    <PageWrapper title="" userName={round?.userName}>
      <div className="p-8 text-center">
        <div className="bg-red-100 border-2 border-red-500 text-red-900 px-6 py-4 rounded-lg shadow-lg mb-4">
          <p className="font-semibold text-lg">Track Round Error</p>
          <p className="text-sm mt-2">{!round ? 'No round found for this ID.' : 'No course found for this round.'}</p>
          <p className="text-xs mt-2">Debug info:</p>
          <pre className="text-xs text-left whitespace-pre-wrap bg-white p-2 rounded border mt-2 overflow-x-auto" style={{maxWidth: 400, margin: '0 auto'}}>
            roundId: {JSON.stringify(roundId)}
            round: {JSON.stringify(round, null, 2)}
            course: {JSON.stringify(course, null, 2)}
            localStorage.golfRounds: {typeof window !== 'undefined' ? localStorage.getItem('golfRounds') : ''}
            localStorage.golfCourses: {typeof window !== 'undefined' ? localStorage.getItem('golfCourses') : ''}
          </pre>
        </div>
        {toastMessage && (
          <div className="bg-amber-100 border-2 border-amber-500 text-amber-900 px-6 py-4 rounded-lg shadow-lg">
            <p className="font-semibold text-lg">{toastMessage}</p>
            <p className="text-sm mt-2">Redirecting to home...</p>
          </div>
        )}
      </div>
    </PageWrapper>
  );


  return (
    <PageWrapper title="" userName={round.userName}>
      {/* Top: Course Name Banner with Parent */}

      {course && (() => {
        // Get parent name
        let parentName = '';
        if (course.parent_id) {
          try {
            const savedCourses = typeof window !== 'undefined' ? localStorage.getItem('golfCourses') : null;
            if (savedCourses) {
              const allCourses = JSON.parse(savedCourses);
              const parent = allCourses.find((c: any) => c.id === course.parent_id);
              if (parent) parentName = parent.name;
            }
          } catch {}
        }
        // Determine child course label (Front 9 or Back 9)
        let childLabel = course.name;
        if (course.holeCount === 9 && parentName) {
          childLabel = course.name;
        } else if (course.holes && course.holes.length === 18 && parentName) {
          childLabel = currentHoleIndex < 9 ? 'Front 9' : 'Back 9';
        }
        if (parentName && course.holeCount === 18) {
          try {
            const savedCourses = typeof window !== 'undefined' ? localStorage.getItem('golfCourses') : null;
            if (savedCourses) {
              const allCourses = JSON.parse(savedCourses);
              const children = allCourses.filter((c: any) => c.parent_id === course.parent_id);
              if (children.length === 2) {
                childLabel = currentHoleIndex < 9 ? children[0].name : children[1].name;
              }
            }
          } catch {}
        }
        return (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-row items-center justify-center"
            style={{
              top: 'calc(env(safe-area-inset-top) + 16px)',
              width: 'min(420px, 95vw)',
            }}
          >
            <div
              className="w-full flex flex-row items-center gap-3 px-5 py-2 border-t-2 border-b-2 border-green-400 bg-black/70 backdrop-blur-md shadow-lg relative"
              style={{
                borderRadius: '14px',
                background: 'rgba(10, 20, 10, 0.65)',
                WebkitBackdropFilter: 'blur(12px)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 2px 16px 0 rgba(0,0,0,0.35)',
              }}
            >
              {/* Location icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21c-4.97-6.16-7.5-10.16-7.5-13.25A7.5 7.5 0 0 1 12 0a7.5 7.5 0 0 1 7.5 7.75C19.5 10.84 16.97 14.84 12 21z" fill="#14532d"/>
                <circle cx="12" cy="8.5" r="3.5" fill="#4ade80"/>
              </svg>
              {/* Course name (childLabel) - always fully visible */}
              <span
                className="text-base md:text-lg font-bold leading-tight text-white whitespace-nowrap"
                style={{
                  display: 'inline-block',
                  verticalAlign: 'bottom',
                }}
                title={childLabel}
              >
                {childLabel}
              </span>
              {/* Vertical green bar */}
              <span className="mx-2 text-green-300 font-bold text-xl">|</span>
              {/* Parent name - ellipsis if too long */}
              {parentName && (
                <span
                  className="text-base md:text-lg font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis opacity-90"
                  style={{
                    maxWidth: '120px',
                    display: 'inline-block',
                    verticalAlign: 'bottom',
                  }}
                  title={parentName}
                >
                  {parentName}
                </span>
              )}
              {/* Hamburger menu button inside header */}
              <button
                ref={menuButtonRef}
                className="ml-auto p-2 rounded-full bg-black bg-opacity-60 hover:bg-opacity-90 shadow border border-gray-700 flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2"
                aria-label="Menu"
                onClick={() => setShowMenu(prev => !prev)}
                style={{height: 36, width: 36}}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="8" width="18" height="2.5" rx="1.25" fill="#fff" />
                  <rect x="5" y="13" width="18" height="2.5" rx="1.25" fill="#fff" />
                  <rect x="5" y="18" width="18" height="2.5" rx="1.25" fill="#fff" />
                </svg>
              </button>
            </div>
          </div>
        );
      })()}
      {/* Top Right Corner 3-dot Menu */}
      {/* Hamburger is now inside the header */}
        {showMenu && (
          <div
            ref={menuRef}
            className="absolute right-0 mt-2 w-44 bg-black bg-opacity-70 rounded-2xl shadow-2xl border border-green-400 z-50 backdrop-blur-md"
            style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)'}}>
            <ul className="py-2">
              <li>
                <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-800 text-white font-medium" onClick={() => { setShowMenu(false); setShowIncompleteWarning(true); }}>
                  <span role="img" aria-label="Save" className="text-lg">💾</span> Save Incomplete
                </button>
              </li>
              <li>
                <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-800 text-red-400 font-medium" onClick={() => { setShowMenu(false); setShowDeleteWarning(true); }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M6 7h12M9 7V5a3 3 0 0 1 6 0v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="#f87171" strokeWidth="2" strokeLinecap="round"/></svg> Discard Round
                </button>
              </li>
              <li>
                <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-800 text-white font-medium" onClick={() => { setShowMenu(false); setShowAddPlayers(true); }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-8 0v2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="#fff" strokeWidth="2"/><path d="M22 11v2m-1 1h2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg> Add Players
                </button>
              </li>
              <li>
                <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-800 text-white font-medium" onClick={() => { setShowMenu(false); router.push('/'); }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M9 17v-2a4 4 0 0 1 8 0v2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="#fff" strokeWidth="2"/><path d="M19 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg> Home
                </button>
              </li>
            </ul>
          </div>
        )}
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



      {/* Top Left Corner Card - Yardage, Hole Info, Track Drive */}
      {course && course.holes && course.holes[currentHoleIndex] && (
        <div className="fixed left-4 z-40 flex flex-col items-center gap-2 min-w-[170px] max-w-xs" style={{ top: 'calc(env(safe-area-inset-top) + 96px)' }}> 
          {/* Offset below header/banner and safe area inset */}
         <div className="bg-black bg-opacity-70 rounded-2xl shadow-2xl px-6 py-4 flex flex-col items-start w-full border border-green-400 relative" style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)'}}>
            {/* Main yardage/score card content */}
            <div>
              {/* ...existing yardage, hole, par, hcp, and drive button code... */}
            </div>
                  {/* Add Players Modal */}
                  {showAddPlayers && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 relative">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Add Players (up to 3)</h2>
                        <button className="absolute top-3 right-3 text-2xl text-gray-500 hover:text-gray-800" onClick={() => setShowAddPlayers(false)} aria-label="Close">×</button>
                        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                          {allPlayers.length === 0 && <div className="text-gray-500 text-center py-8">No other players found.</div>}
                          {allPlayers.map(player => {
                            const alreadyAdded = selectedPlayers.some(p => p.id === player.id);
                            return (
                              <div key={player.id} className="flex items-center justify-between px-2 py-2 rounded hover:bg-gray-100">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: '#2e3a2f' }}>
                                    {player.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
                                  </div>
                                  <span className="font-semibold text-gray-800">{player.name}</span>
                                </div>
                                <button
                                  className={`ml-2 p-2 rounded-full ${alreadyAdded || selectedPlayers.length >= 3 ? 'bg-gray-300 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                  disabled={alreadyAdded || selectedPlayers.length >= 3}
                                  onClick={() => {
                                    if (!alreadyAdded && selectedPlayers.length < 3) {
                                      setSelectedPlayers(prev => [...prev, player]);
                                    }
                                  }}
                                  aria-label="Add player"
                                >
                                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-bold text-base border hover:bg-gray-300" onClick={() => setShowAddPlayers(false)}>Done</button>
                          {selectedPlayers.length > 0 && (
                            <button className="px-4 py-2 rounded bg-red-600 text-white font-bold text-base border hover:bg-red-700" onClick={() => setSelectedPlayers([])}>Clear</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
            <div className="flex items-end gap-2">
              <span className="text-5xl font-extrabold text-white leading-none">
                {(() => {
                  const hole = course.holes[currentHoleIndex];
                  if (!hole || typeof userLocation?.lat !== 'number' || typeof userLocation?.lng !== 'number' || typeof hole.greenLat !== 'number' || typeof hole.greenLng !== 'number') return '—';
                  const yards = Math.round(getDistanceYards(userLocation.lat, userLocation.lng, hole.greenLat, hole.greenLng));
                  return String(yards).slice(0, 3);
                })()}
              </span>
              <span className="text-lg font-bold text-green-400 mb-1">yds</span>
            </div>
            <div className="mt-1 text-white text-base font-semibold flex gap-2 items-center">
              Hole {currentHoleIndex + 1}
              <span className="text-xl font-light text-white">•</span>
              Par {course.holes[currentHoleIndex].par ?? '-'}
            </div>
            <div className="text-green-200 text-sm font-medium mb-2">Hcp {course.holes[currentHoleIndex].handicap ?? '-'}</div>
            {/* Track Drive Button Workflow */}
            {(() => {
              const drive = perHoleStats[currentHoleIndex]?.drive;
              // Step 2: Tracking (driveStart is set, not finished)
              if (driveStart && userLocation) {
                const liveDistance = Math.round(getDistanceYards(driveStart.lat, driveStart.lng, userLocation.lat, userLocation.lng));
                return (
                  <div className="flex flex-col gap-2 mt-1 items-start">
                    {/* Tracking label */}
                    <hr className="w-full border-t border-green-500 opacity-60 my-2" />
                    <div className="flex items-center gap-2 mt-1 mb-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="2.2" fill="none" />
                        <path d="M12 6v6l4 2" stroke="#22c55e" strokeWidth="2.2" fill="none" />
                      </svg>
                      <span className="text-green-400 text-base">Tracking Drive...</span>
                    </div>
                    {/* Live distance with Save icon */}
                    <div className="flex items-end gap-2 mt-2 mb-2">
                      <span className="text-5xl font-semibold text-white leading-none">{liveDistance}</span>
                      <span className="text-lg font-bold text-green-400 mb-1">yds</span>
                      <button
                        className="ml-2 flex items-center justify-center p-1 rounded-full bg-green-700 hover:bg-green-800 transition"
                        style={{ border: '1.5px solid #22c55e' }}
                        onClick={() => {
                          // Finish drive
                          const start = driveStart;
                          const end = userLocation;
                          const driveDistance = Math.round(getDistanceYards(start.lat, start.lng, end.lat, end.lng));
                          setPerHoleStats(stats => {
                            const updated = [...stats];
                            if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                            updated[currentHoleIndex] = {
                              ...updated[currentHoleIndex],
                              drive: { start, end, yardage: driveDistance },
                            };
                            return updated;
                          });
                          setDriveStart(null);
                        }}
                        aria-label="Save Drive"
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11.17a2 2 0 0 1 1.41.59l2.83 2.83A2 2 0 0 1 21 7.83V19a2 2 0 0 1-2 2z"/>
                          <polyline points="17 21 17 13 7 13 7 21"/>
                          <polyline points="7 3 7 8 15 8"/>
                        </svg>
                      </button>
                      <button
                        className="ml-1 flex items-center justify-center p-1 rounded-full bg-gray-700 hover:bg-red-600 transition border border-gray-400"
                        onClick={() => {
                          setDriveStart(null);
                        }}
                        aria-label="Cancel Drive Tracking"
                        title="Cancel Drive Tracking"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              }
              // Step 3: Drive saved (show drive distance, allow new drive)
              if (drive && drive.yardage != null) {
                return (
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500 bg-black bg-opacity-60 text-green-400 font-bold shadow text-base">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="2.5" fill="none" />
                        <path d="M8 12.5l2.5 2.5 5-5" stroke="#22c55e" strokeWidth="2.5" fill="none" />
                      </svg>
                      <span className="font-semibold">Drive:</span>
                      <span className="ml-1 text-lg font-bold">{drive.yardage} yds</span>
                    </div>
                  </div>
                );
              }
              // Step 1: Idle (ready to start tracking)
              return (
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-400 bg-black bg-opacity-40 hover:bg-green-900 text-green-200 font-bold shadow transition-transform duration-100 active:scale-95 text-base mt-1"
                  onClick={() => {
                    if (!userLocation) return;
                    setDriveStart({ ...userLocation });
                  }}
                  aria-label="Track Drive"
                >
                  <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="4" cy="12" r="2" fill="#4ade80"/>
                    <circle cx="10" cy="14" r="1.5" fill="#4ade80"/>
                    <circle cx="16" cy="10" r="1" fill="#4ade80"/>
                    <rect x="17.5" y="2" width="3" height="8" rx="1.5" fill="#4ade80"/>
                  </svg>
                  <span className="text-green-200 font-semibold">Track Drive</span>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {selectedPlayers.length > 0 && (
        <div
          className="fixed z-40 flex flex-col items-start justify-start gap-2"
          style={{ 
            top: '600px',
            left: '20px'
          }}
        >
          {selectedPlayers.map((p, idx) => (
            <div key={p.id} className="flex flex-row items-center gap-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-[12px] shrink-0" style={{ background: idx === 0 ? '#3b5d3a' : idx === 1 ? '#3a4a5d' : '#4b3a5d' }}>
                {p.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              {/* Score badge */}
              <span className="text-xs font-black px-1.5 py-0.5 rounded bg-black/40 min-w-[20px] text-center" style={{ color: idx === 0 ? '#7fff7a' : idx === 1 ? '#6ec1ff' : '#c17fff' }}>
                E
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Main layout: map as background, overlays for yardage, scoring, and bottom bar */}
      {/* Main layout: add a class to hide background image when map is open */}
      <div className={`relative w-full min-h-[100vh] flex flex-col justify-end items-stretch overflow-hidden ${showMap ? 'bg-black' : 'bg-transparent'}`}> 
          {/* Golf Ball Icon above Bottom NavBar (hidden in map view) */}
          {!showMap && (
            <div className="fixed bottom-28 left-0 w-full flex justify-center items-center z-50 pointer-events-none">
              <button
                className={`focus:outline-none pointer-events-auto group rounded-full shadow-lg p-2 transition-all duration-100
                  ${tapItPressed ? 'scale-90 bg-black/60 border-4 border-blue-400 shadow-inner' : 'bg-transparent border-0'}`}
                style={{ border: tapItPressed ? '4px solid #60a5fa' : 'none', padding: 0, position: 'relative', width: 140, height: 140 }}
                onClick={() => { tapItPress(); setShowScoreModal(true); }}
                aria-label="Just Tap It to enter your score"
              >
                <img
                  src="/JustTapIt_Logo.png"
                  alt="JustTapIt Logo"
                  className="w-32 h-32 object-contain select-none drop-shadow-lg"
                  style={{
                    border: '2px solid rgb(57, 255, 20)',
                    boxShadow: '0 0 24px rgb(57, 255, 20), 0 2px 24px rgba(0,0,0,0.667)',
                    borderRadius: '24px',
                    background: '#111',
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                  }}
                  draggable={false}
                />
              </button>
            </div>
          )}
        {/* Modern Bottom Action Bar with Icons */}
        <div className="fixed bottom-0 left-0 w-full flex flex-col items-center pb-4 z-50">
          <div className="flex gap-4 mb-2"></div>
          <button
            className="flex items-center gap-2 w-56 py-4 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg transition-transform duration-100 active:scale-95"
            onClick={() => {/* TODO: Hook up Track Drive logic here */}}
            aria-label="Track Drive"
          >
            <span role="img" aria-label="Track Drive">🚩</span> Track Drive
          </button>
        </div>

        {/* Delete Round Modal */}
        {showDeleteWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center">
              <div className="text-lg font-semibold text-gray-900 mb-6 text-center">
                Are you sure you want to delete this round?<br />This action cannot be undone.
              </div>
              <div className="flex gap-4 mt-2">
                <button
                  className="px-6 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold text-lg transition"
                  onClick={() => setShowDeleteWarning(false)}
                >
                  No
                </button>
                <button
                  className="px-6 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold text-lg transition"
                  onClick={async () => {
                    setShowDeleteWarning(false);
                    await handleDeleteRound();
                  }}
                  autoFocus
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Incomplete Round Modal */}
        {showIncompleteWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center">
              <div className="text-lg font-semibold text-gray-900 mb-6 text-center">
                You haven't entered scores for all holes.<br />Are you sure you want to save and end round?
              </div>
              <div className="flex gap-4 mt-2">
                <button
                  className="px-6 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold text-lg transition"
                  onClick={() => setShowIncompleteWarning(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold text-lg transition"
                  onClick={async () => {
                    setShowIncompleteWarning(false);
                    await handleFinishRound();
                  }}
                  autoFocus
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Show map overlay if enabled, otherwise nothing (background handled globally) */}
        {showMap && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100vw', height: '100vh' }}>
            <HoleMap
              userLat={userLocation?.lat ?? 0}
              userLng={userLocation?.lng ?? 0}
              greenLat={course.holes[currentHoleIndex]?.greenLat ?? 0}
              greenLng={course.holes[currentHoleIndex]?.greenLng ?? 0}
              holeName={`Hole ${course.holes[currentHoleIndex]?.holeNumber || ''}`}
            />
          </div>
        )}

        {/* Modern yardage overlay (left) */}
          {/* Live drive yardage overlay (shows only while measuring drive) */}
          {/* Removed renderLiveDriveOverlay per user request */}








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




        {/* Bottom bar for hole navigation and info */}
        {renderBottomBar()}
      {/* Score Entry Modal */}

      {showScoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 relative overflow-y-auto max-h-[90vh]">


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
                  // Only allow known tee names to avoid type error
                  const teeNames = ['men', 'women', 'senior', 'championship'] as const;
                  const isValidTee = (tee: string): tee is typeof teeNames[number] => teeNames.includes(tee as any);
                  const yardages = holes.map(h =>
                    isValidTee(selectedTee) ? h[selectedTee]?.yardage ?? '-' : '-'
                  );
                  const yardageTotal = holes.reduce((sum, h) =>
                    isValidTee(selectedTee) ? sum + (h[selectedTee]?.yardage || 0) : sum
                  , 0);
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
                          {holes.map((h, i) => {
                            const score = scores[startIdx + i];
                            const par = h.par ?? 0;
                            let shape = '';
                            let bg = '';
                            let text = 'text-gray-900';
                            let border = '';
                            let label = '';
                            if (typeof score === 'number' && score > 0) {
                              const diff = score - par;
                              if (score === 1) {
                                // Ace
                                shape = 'rounded-full';
                                bg = 'bg-yellow-400';
                                border = 'border-2 border-yellow-600';
                                label = 'Ace';
                              } else if (diff <= -2) {
                                // Eagle or better
                                shape = 'rounded-full';
                                bg = 'bg-blue-400';
                                border = 'border-2 border-blue-700';
                                label = 'Eagle';
                              } else if (diff === -1) {
                                // Birdie
                                shape = 'rounded-full';
                                bg = 'bg-red-400';
                                border = 'border-2 border-red-600';
                                label = 'Birdie';
                              } else if (diff === 0) {
                                // Par
                                shape = 'rounded-full';
                                bg = 'bg-gray-200';
                                border = 'border-2 border-gray-400';
                                label = 'Par';
                              } else if (diff === 1) {
                                // Bogey
                                shape = 'rounded';
                                bg = 'bg-yellow-200';
                                border = 'border-2 border-yellow-400';
                                label = 'Bogey';
                              } else if (diff === 2) {
                                // Double Bogey
                                shape = 'rounded';
                                bg = 'bg-orange-300';
                                border = 'border-2 border-orange-500';
                                label = 'Double Bogey';
                              } else if (diff > 2) {
                                // Worse
                                shape = 'rounded';
                                bg = 'bg-black text-white';
                                border = 'border-2 border-black';
                                text = 'text-white';
                                label = 'Triple+';
                              }
                            }
                            return (
                              <td key={i} className={`px-1 py-1 ${startIdx + i === currentHoleIndex ? 'bg-blue-200 font-bold' : ''}`}
                                title={label}
                              >
                                {typeof score === 'number' && score > 0 ? (
                                  <span className={`inline-flex items-center justify-center w-6 h-6 ${shape} ${bg} ${border} ${text} font-semibold text-xs`}>
                                    {score}
                                  </span>
                                ) : ''}
                              </td>
                            );
                          })}
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
                    debouncedImmediateSaveRound();
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
                    debouncedImmediateSaveRound();
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
                      onClick={async () => {
                        setPerHoleStats(stats => {
                          const updated = [...stats];
                          if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                          updated[currentHoleIndex] = { ...updated[currentHoleIndex], fairwayHit: opt };
                          return updated;
                        });
                        await immediateSaveRound();
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
                    onClick={async () => {
                      setPerHoleStats(stats => {
                        const updated = [...stats];
                        if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
                        updated[currentHoleIndex] = { ...updated[currentHoleIndex], gir: !updated[currentHoleIndex].gir };
                        return updated;
                      });
                      await immediateSaveRound();
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
                    onClick={async () => {
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
                      await immediateSaveRound();
                    }}
                    aria-label="Decrease putts"
                  >−</button>
                  <span className="text-2xl font-bold w-12 text-center">{perHoleStats[currentHoleIndex]?.puttDistances?.length ?? 0}</span>
                  <button
                    className="w-10 h-10 rounded bg-gray-200 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-300 border"
                    onClick={async () => {
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
                      await immediateSaveRound();
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
                onClick={async () => {
                  await handleFinishRound();
                  setShowScoreModal(false);
                }}
              >Finish Round</button>
            ) : (
              <button
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 rounded-xl mt-2 text-lg"
                onClick={async () => {
                  await immediateSaveRound();
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

              {/* GIR checkbox removed as requested */}
              {/* Putts (Stepper) */}
              {/* Putts stepper removed as requested */}

        {/* Putt Distance Entry only inside modal */}

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
    </PageWrapper>
  );
}
