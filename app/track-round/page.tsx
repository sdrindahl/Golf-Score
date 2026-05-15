
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
import { getRoundsInProgress, subscribeToRoundsInProgress } from '@/lib/roundsInProgress';
import { supabase } from '@/lib/supabase';

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
  const [commentCount, setCommentCount] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  // Removed showHoleMap logic: map is always visible
  const [showDriveHelp, setShowDriveHelp] = useState(false);
  const [driveHelpDismissed, setDriveHelpDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('driveHelpDismissed') === 'true';
    }
    return false;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
  // Drive tracking state - now captures tee location first
  // Drive tracking state (no longer used - kept for compatibility)
  // const [isTrackingDrive, setIsTrackingDrive] = useState(false);
  
  // Measure drive: single tap at ball location
  // Calculate: Drive = Tee Yardage - (Distance from ball to pin)
  const handleMeasureDrive = () => {
    if (!userLocation) {
      alert('Location not available. Please enable GPS.');
      return;
    }

    const hole = course?.holes[currentHoleIndex];
    if (!hole || typeof hole.greenLat !== 'number' || typeof hole.greenLng !== 'number') {
      alert('Pin location not available for this hole.');
      return;
    }

    // Get tee yardage based on selectedTee (e.g., "men", "women", "senior", "championship")
    const teeKey = (selectedTee || 'men').toLowerCase() as 'men' | 'women' | 'senior' | 'championship';
    const teeBox = hole[teeKey] || hole.men;
    const teeYardage = teeBox?.yardage;

    console.log('[DEBUG] handleMeasureDrive:', {
      selectedTee,
      teeKey,
      teeBox,
      teeYardage,
      hole: hole.holeNumber,
      greenLat: hole.greenLat,
      greenLng: hole.greenLng,
      userLocation
    });

    if (!teeYardage || teeYardage === 0) {
      alert(`Tee yardage not available (key: ${teeKey})`);
      return;
    }

    // Calculate distance from current location (ball) to pin
    const distBallToPin = getDistanceYards(
      userLocation.lat,
      userLocation.lng,
      hole.greenLat,
      hole.greenLng
    );

    // Drive distance = Tee Yardage - Distance to Pin
    const driveDistance = Math.round(teeYardage - distBallToPin);

    console.log('[DEBUG] Drive calculation:', {
      teeYardage,
      distBallToPin: Math.round(distBallToPin),
      driveDistance,
      formula: `${teeYardage} - ${Math.round(distBallToPin)} = ${driveDistance}`
    });

    // Validate the measurement makes sense
    // If distance to pin is way too far (>2x tee yardage), GPS is probably wrong
    if (distBallToPin > teeYardage * 2) {
      console.warn('[DEBUG] GPS location too far from pin - likely GPS error');
      alert(`⚠️ GPS Error: You appear to be ${Math.round(distBallToPin)} yards from the pin.\n\nMake sure:\n• You're at the ball location\n• GPS is enabled and working\n• Course coordinates are correct`);
      return;
    }

    // Cap at tee yardage (you can't hit farther than the hole)
    const finalDriveDistance = Math.max(0, Math.min(driveDistance, teeYardage));

    if (driveDistance < 0) {
      console.warn('[DEBUG] Negative drive distance, capping to tee yardage');
    }

    setPerHoleStats(stats => {
      const updated = [...stats];
      // Ensure stat exists
      if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
      updated[currentHoleIndex] = {
        ...updated[currentHoleIndex],
        drive: {
          start: { ...userLocation },
          end: null,
          yardage: finalDriveDistance,
        },
      };
      return updated;
    });
  };

  // Discard completed drive measurement
  const handleDiscardDrive = () => {
    setPerHoleStats(stats => {
      const updated = [...stats];
      if (!updated[currentHoleIndex]) updated[currentHoleIndex] = defaultPerHoleStat();
      updated[currentHoleIndex] = { ...updated[currentHoleIndex], drive: null };
      return updated;
    });
  };
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

  // Save current hole index to localStorage whenever it changes
  useEffect(() => {
    if (!roundId || !isClient) return;
    localStorage.setItem(`currentHoleIndex_${roundId}`, currentHoleIndex.toString());
  }, [currentHoleIndex, roundId, isClient]);





  // Helper function to find the first unscored hole (next hole to play)
  const getNextUnscoredholeIndex = (roundScores: number[]): number => {
    if (!roundScores) return 0;
    // Find first hole with score of 0 or null
    const unscored = roundScores.findIndex(score => !score || score === 0);
    // If all holes are scored, return the last hole for review
    return unscored >= 0 ? unscored : roundScores.length - 1;
  };


  useEffect(() => {
    if (!isClient || !roundId) return;
    let subscription: any;
    getRoundsInProgress().then(async (data) => {
      let found = data?.find((r: any) => r.id === roundId);
      
      // Fallback: if not found in in-progress list, try fetching by ID
      // This handles auto-completed rounds that are no longer "in progress"
      if (!found) {
        console.log('[DEBUG] Round not in in-progress list, trying get-round-by-id API');
        try {
          const res = await fetch(`/api/get-round-by-id?id=${roundId}`);
          if (res.ok) {
            const { round: roundData } = await res.json();
            found = roundData;
          }
        } catch (err) {
          console.error('[DEBUG] Failed to fetch round by ID:', err);
        }
      }
      
      setRound(found || null);
      setScores(found?.scores || []);
      // Set current hole index to the first unscored hole
      if (found?.scores) {
        const nextHoleIdx = getNextUnscoredholeIndex(found.scores);
        setCurrentHoleIndex(nextHoleIdx);
      }
      // Initialize perHoleStats: load from saved data or create empty objects
      if (found && found.scores) {
        const savedStats = found.perHoleStats || found.per_hole_stats || [];
        if (Array.isArray(savedStats) && savedStats.length === found.scores.length) {
          // Use saved stats if available and correct length, but fill with defaults for missing fields
          setPerHoleStats(savedStats.map((stat: any) => ({
            ...defaultPerHoleStat(),
            ...stat,
            drive: stat?.drive ?? null,
            puttDistances: Array.isArray(stat?.puttDistances) ? stat.puttDistances : [],
            fairwayHit: stat?.fairwayHit ?? null,
            gir: stat?.gir ?? false,
            puttExpanded: typeof stat?.puttExpanded === 'number' ? stat.puttExpanded : null,
          })));
        } else {
          // Create default stats for all holes
          setPerHoleStats(Array(found.scores.length).fill(0).map(() => defaultPerHoleStat()));
        }
      }
      setLoading(false);
      subscription = subscribeToRoundsInProgress(() => {
        // Subscription is just a notification that data changed on Supabase.
        // We don't fetch or update UI state here to avoid race conditions with local changes.
        // The auto-save effect handles syncing local changes TO Supabase.
        // Real-time syncing happens through the fetch on page load; subscription is just for awareness.
      });
    }).catch(() => setLoading(false));
    return () => {
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };
  }, [isClient, roundId]);

  // 1A: Keep round active by updating its timestamp every 30 seconds
  // This prevents the auto-complete feature from completing active rounds
  // Also does a full save to ensure round_courses join table is populated
  // Use refs to access latest state values without recreating interval
  const roundRef = useRef(round);
  const scoresRef = useRef(scores);
  const selectedTeeRef = useRef(selectedTee);
  const courseRef = useRef(course);
  
  // Update refs whenever state changes
  useEffect(() => {
    roundRef.current = round;
    scoresRef.current = scores;
    selectedTeeRef.current = selectedTee;
    courseRef.current = course;
  }, [round, scores, selectedTee, course]);

  useEffect(() => {
    // Don't start heartbeat until round data is loaded
    if (!roundId || loading) return;
    
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let isPageVisible = !document.hidden;
    
    // Function to start the heartbeat
    const startHeartbeat = () => {
      if (heartbeatInterval) return; // Don't start if already running
      
      console.log('[DEBUG] Heartbeat started');
      heartbeatInterval = setInterval(async () => {
        console.log('[DEBUG] Heartbeat interval fired');
        try {
          const currentRound = roundRef.current;
          if (!currentRound) {
            console.log('[DEBUG] Heartbeat skipped - no round data');
            return;
          }

          // Get current round data from refs (latest state)
          const currentUser = auth.getCurrentUser();
          const heartbeatRound = {
            id: roundId,
            userId: currentUser?.id,
            userName: currentUser?.name,
            courseId: currentRound.courseId || (currentRound as any).course_id || courseRef.current?.id,
            courseName: courseRef.current?.name,
            selectedTee: selectedTeeRef.current || currentRound.selectedTee || (currentRound as any).selected_tee,
            date: currentRound.date,
            scores: scoresRef.current.length > 0 ? scoresRef.current : currentRound.scores,
            totalScore: currentRound.totalScore || (currentRound as any).total_score,
            notes: currentRound.notes,
            in_progress: currentRound.in_progress !== false,
            // FIX: Use perHoleStatsRef for current user edits, not old database data
            perHoleStats: perHoleStatsRef.current.length > 0 ? perHoleStatsRef.current : (currentRound as any).perHoleStats || (currentRound as any).per_hole_stats || [],
          };
          
          console.log('[DEBUG] Heartbeat sending courseId:', heartbeatRound.courseId);
          
          const res = await fetch('/api/save-round', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(heartbeatRound),
          });
          
          if (res.ok) {
            console.log('[DEBUG] Heartbeat: Updated round and round_courses join table');
          } else {
            console.warn('[DEBUG] Heartbeat save failed:', res.status);
          }
        } catch (err) {
          console.error('[DEBUG] Heartbeat update failed:', err);
        }
      }, 30000); // Update every 30 seconds
    };
    
    // Function to stop the heartbeat
    const stopHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        console.log('[DEBUG] Heartbeat stopped - page hidden');
      }
    };
    
    // Listen for visibility changes
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible;
      isPageVisible = !document.hidden;
      
      console.log('[DEBUG] Visibility changed - isPageVisible:', isPageVisible, '(was:', wasVisible, ')');
      
      if (!isPageVisible && heartbeatInterval) {
        stopHeartbeat();
      } else if (isPageVisible && !heartbeatInterval) {
        startHeartbeat();
      }
    };
    
    // Start heartbeat if page is initially visible
    if (isPageVisible) {
      startHeartbeat();
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopHeartbeat();
    };
  }, [roundId, loading]);

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
    }
  }, [round]);

  const perHoleStatsRef = useRef<any[]>([]);

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
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 rounded-lg shadow-xl z-50 border-l-4 border-white flex items-center justify-between gap-4 animate-bounce">
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
        {/* Map always visible as background */}
        <div className="absolute inset-0 z-0">
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

        {/* Modern yardage overlay (left) */}
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



        {/* Floating scoring button (lower right) */}
        <div className="absolute bottom-24 right-6 z-20">
          {/* TODO: Replace with actual scoring button logic */}
          <button className="bg-green-500 hover:bg-green-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl text-3xl font-bold border-4 border-white">
            ✏️
          </button>
        </div>


        {/* Bottom bar for hole navigation and info removed as requested */}

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
