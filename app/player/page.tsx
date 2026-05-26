'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ScoreHistory from '@/components/ScoreHistory'
import PageWrapper from '@/components/PageWrapper'
import { Round, User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { calculateHandicap } from '@/lib/handicapCalculator'

function PlayerProfileContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const playerId = searchParams ? searchParams.get('id') : null
  const auth = useAuth()

  const [player, setPlayer] = useState<User | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isClient, setIsClient] = useState(false)

  // ...existing code...

  // Helper: is this the logged-in user's profile?
  const isOwnProfile = currentUser?.id === player?.id;
  // Show Golf Costs button only for the logged-in user viewing their own profile
  const showGolfCostsButton = isOwnProfile;

  // Set hydration flag
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Refresh data when returning to this page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible, refreshing data...')
        setRefreshKey(prev => prev + 1)
      }
    }

    // Also check if we just navigated to this page from somewhere else
    const handleBeforeUnload = () => {
      // Mark that we're about to navigate away
      sessionStorage.setItem('navigating', 'true')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Force refresh on initial load and whenever the search params change
  useEffect(() => {
    console.log('🔄 Profile page dependencies changed, triggering refresh:', { playerId, refreshKey })
    // Reset the navigating flag
    sessionStorage.removeItem('navigating')
  }, [playerId, refreshKey])

  useEffect(() => {
    if (!playerId) return;

    const loadPlayerData = async () => {
      try {
        // Get current user
        const user = auth.getCurrentUser();
        setCurrentUser(user);

        // Find the player locally first
        let allUsers = auth.getAllUsers();
        let foundPlayer = allUsers.find(u => u.id === playerId);

        // If not found locally, try Supabase
        if (!foundPlayer && isSupabaseConfigured() && supabase) {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', playerId)
            .single();
          if (!error && data) {
            foundPlayer = {
              id: data.id,
              name: data.name,
              password: '',
              is_admin: data.is_admin
            };
          }
        }

        if (foundPlayer) {
          setPlayer(foundPlayer);

          // Fetch player's rounds directly from Supabase
          if (isSupabaseConfigured() && supabase) {
            const { data, error } = await supabase
              .from('rounds')
              .select('*')
              .eq('user_id', playerId)
              .order('date', { ascending: false });
            console.log('[DEBUG] Supabase rounds fetch:', { error, data });
            if (error) {
              setRounds([]);
            } else if (data) {
              // Fetch course IDs for each round from round_courses join table
              const playerRounds: Round[] = await Promise.all(data.map(async (r: any) => {
                let courseId = '';
                if (r.id && supabase) {
                  const { data: courseData, error: courseError } = await supabase
                    .from('round_courses')
                    .select('course_id')
                    .eq('round_id', r.id)
                    .order('course_order', { ascending: true });
                  if (!courseError && courseData && courseData.length > 0) {
                    courseId = courseData.map((rc: any) => rc.course_id).join(',');
                  }
                }
                return {
                  id: r.id,
                  userId: r.user_id,
                  userName: r.user_name,
                  courseId: courseId,
                  courseName: '',
                  selectedTee: r.selected_tee,
                  date: r.date,
                  scores: r.scores,
                  totalScore: r.total_score,
                  notes: r.notes,
                  in_progress: r.in_progress,
                  perHoleStats: r.perHoleStats || r.per_hole_stats,
                };
              }));
              console.log('[DEBUG] Parsed playerRounds:', playerRounds);
              setRounds(playerRounds);
            }
          } else {
            setRounds([]);
          }
        } else {
          setPlayer(null);
        }
      } catch (error) {
        setRounds([]);
      }
      setLoading(false);
    };

    loadPlayerData();
  }, [playerId, refreshKey]);

  // Real-time subscription to update rounds when they change in Supabase
  useEffect(() => {
    if (!playerId || !isSupabaseConfigured() || !supabase) return;

    const getRoundsForPlayer = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('rounds')
          .select('*')
          .eq('user_id', playerId)
          .order('date', { ascending: false });

        if (!error && data) {
          // Fetch course IDs for each round from round_courses join table
          const playerRounds: Round[] = await Promise.all(data.map(async (r: any) => {
            let courseId = '';
            if (r.id && supabase) {
              const { data: courseData, error: courseError } = await supabase
                .from('round_courses')
                .select('course_id')
                .eq('round_id', r.id)
                .order('course_order', { ascending: true });
              if (!courseError && courseData && courseData.length > 0) {
                courseId = courseData.map((rc: any) => rc.course_id).join(',');
              }
            }
            return {
              id: r.id,
              userId: r.user_id,
              userName: r.user_name,
              courseId: courseId,
              courseName: '',
              selectedTee: r.selected_tee,
              date: r.date,
              scores: r.scores,
              totalScore: r.total_score,
              notes: r.notes,
              in_progress: r.in_progress,
              perHoleStats: r.perHoleStats || r.per_hole_stats,
            };
          }));
          setRounds(playerRounds);
        }
      } catch (error) {
        console.error('Error fetching updated rounds:', error);
      }
    };

    const subscription = supabase
      .channel(`player-rounds:${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `user_id=eq.${playerId}`,
        },
        () => {
          // Refetch rounds when they change
          getRoundsForPlayer();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [playerId]);

  if (loading) {
    return (
      <PageWrapper title="Player Profile">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center">
            <p className="text-gray-500">Loading profile...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!player) {
    return (
      <PageWrapper title="Player Profile">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center">
            <p className="text-gray-500">Player not found</p>
            <Link href="/">
              <button className="btn-primary mt-4">Back to Home</button>
            </Link>
          </div>
        </div>
      </PageWrapper>
    );
  }

  const calculateHandicapLocal = (): number => {
    if (!isClient) return 0
    const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')
    if (rounds.length === 0 || courses.length === 0) return 0
    const completedRounds = rounds.filter(r => !r.in_progress)
    return calculateHandicap(completedRounds, courses)
  }

  const handicap = calculateHandicapLocal()

  const getHandicapColor = (hcp: number) => {
    if (hcp <= 10) return 'text-green-600'; // Good
    if (hcp <= 20) return 'text-yellow-600'; // OK
    return 'text-red-600'; // Needs improvement
  }

  const getHandicapTrend = () => {
    if (rounds.length < 2) return null;
    const completedRounds = rounds.filter(r => !r.in_progress).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (completedRounds.length < 2) return null;

    const lastRounds = completedRounds.slice(0, 3);
    let totalBefore = 0;
    let totalAfter = 0;

    if (lastRounds.length >= 2) {
      totalAfter = lastRounds[0].totalScore || 0;
      totalBefore = lastRounds[lastRounds.length - 1].totalScore || 0;

      if (totalAfter < totalBefore) return '↓'; // Improving (scores going down)
      if (totalAfter > totalBefore) return '↑'; // Declining (scores going up)
    }
    return null;
  }

  const calculateAverageDriveDistance = (): number | null => {
    let totalDriveDistance = 0
    let driveCount = 0

    // for (const round of rounds) {
    //   if (round.perHoleStats && Array.isArray(round.perHoleStats)) {
    //     for (const holeStats of round.perHoleStats) {
    //       if (holeStats.drive?.yardage && typeof holeStats.drive.yardage === 'number') {
    //         totalDriveDistance += holeStats.drive.yardage
    //         driveCount++
    //       }
    //     }
    //   }
    for (const round of rounds) {
      // Guard: Skip if there are no stats for this round
      if (!round?.perHoleStats || !Array.isArray(round.perHoleStats)) continue;

      for (const holeStats of round.perHoleStats) {
        // Guard: Skip if the hole data itself is null or undefined
        if (!holeStats) continue;

        const yardage = holeStats.drive?.yardage;

        // Now it's 100% safe to check and add the yardage
        if (typeof yardage === 'number') {
          totalDriveDistance += yardage;
          driveCount++;
        }
      }
    }

    if (driveCount === 0) return null
    return Math.round(totalDriveDistance / driveCount)
  }

  const averageDriveDistance = calculateAverageDriveDistance()

  const calculateFIRStats = () => {
    let hit = 0, missLeft = 0, missRight = 0, total = 0;
    for (const round of rounds) {
      if (round.perHoleStats && Array.isArray(round.perHoleStats)) {
        for (const stats of round.perHoleStats) {
          if (stats?.fairwayHit) {
            total++;
            if (stats.fairwayHit === 'hit') hit++;
            else if (stats.fairwayHit === 'L') missLeft++;
            else if (stats.fairwayHit === 'R') missRight++;
          }
        }
      }
    }
    if (total === 0) return null;
    return {
      hitPercent: Math.round((hit / total) * 100),
      missLeftPercent: Math.round((missLeft / total) * 100),
      missRightPercent: Math.round((missRight / total) * 100),
    };
  }

  const calculateGIRStats = () => {
    let girCount = 0, totalHoles = 0;
    for (const round of rounds) {
      if (round.perHoleStats && Array.isArray(round.perHoleStats)) {
        for (const stats of round.perHoleStats) {
          // Count all holes in perHoleStats
          totalHoles++;
          // Only count as GIR if explicitly checked (true)
          if (stats?.gir === true) girCount++;
        }
      }
    }
    if (totalHoles === 0) return null;
    return {
      girPercent: Math.round((girCount / totalHoles) * 100),
    };
  }

  const firStats = calculateFIRStats()
  const girStats = calculateGIRStats()

  const handleDeleteRound = (roundId: string) => {
    const updated = rounds.filter(r => r.id !== roundId)
    setRounds(updated)
    localStorage.setItem('golfRounds', JSON.stringify(updated))
  }

  return (
    <>
      <PageWrapper title={player.name} userName={isOwnProfile ? 'Your profile' : undefined}>
        <div className="max-w-4xl mx-auto space-y-6 pb-32">
          {/* Back Button */}
          <Link href="/players">
            <button className="mb-4 bg-white/90 hover:bg-white text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all border border-white/20">
              ← Back to Golfers
            </button>
          </Link>

          {/* Header Stats - Compact */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-black bg-opacity-70 rounded-2xl shadow-2xl border border-green-400 text-center flex flex-col items-center justify-center min-w-0 p-3" style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)'}}>
              <div className="flex items-center gap-1 justify-center min-w-0">
                <div className={`text-3xl font-bold truncate text-green-400`}>{handicap}</div>
                {getHandicapTrend() && <div className="text-sm flex-shrink-0 text-green-400">{getHandicapTrend()}</div>}
              </div>
              <div className="text-xs font-semibold uppercase mt-2 text-green-400">HCP</div>
            </div>
            <div className="bg-black bg-opacity-70 rounded-2xl shadow-2xl border border-green-400 text-center flex flex-col items-center justify-center min-w-0 p-3" style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)'}}>
              <div className="w-12 h-12 flex items-center justify-center mb-1 mx-auto">
                <img src="/scorecard.png" alt="scorecard" className="w-full h-full object-contain" />
              </div>
              <div className="text-xl font-bold text-white mb-1">{rounds.length}</div>
              <div className="text-xs text-green-400 font-semibold uppercase">Rounds</div>
            </div>
            <div className="bg-black bg-opacity-70 rounded-2xl shadow-2xl border border-green-400 text-center flex flex-col items-center justify-center min-w-0 p-3" style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)'}}>
              <div className="text-2xl mb-1 text-white">⛳</div>
              <div className="text-lg font-bold text-green-400">{firStats ? `${firStats.hitPercent}%` : '—'}</div>
              <div className="text-xs text-green-400 font-semibold uppercase">FIR</div>
            </div>
            <div className="bg-black bg-opacity-70 rounded-2xl shadow-2xl border border-green-400 text-center flex flex-col items-center justify-center min-w-0 p-3" style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)'}}>
              <div className="text-2xl mb-1 text-white">🎯</div>
              <div className="text-lg font-bold text-green-400">{girStats ? `${girStats.girPercent}%` : '—'}</div>
              <div className="text-xs text-green-400 font-semibold uppercase">GIR</div>
            </div>
          </div>

          {/* Statistics */}
          {rounds.length > 0 && (() => {
            // Find best 18-hole round
            const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]');
            const rounds18 = rounds.filter(r => {
              // Support multi-child rounds (comma-separated courseId)
              const courseIdStr = r.courseId || r.course_id || '';
              const courseIds = courseIdStr.split(',');
              // Find all matching courses
              const childCourses = courses.filter((c: any) => courseIds.includes(c.id));
              // If any child course has 18 holes, treat as 18-hole round
              if (childCourses.length > 0) {
                const totalHoles = childCourses.reduce((sum: number, c: any) => sum + (c.holes?.length || 0), 0);
                return totalHoles === 18;
              }
              // fallback: single course logic
              const course = courses.find((c: any) => c.id === courseIdStr);
              return course && course.holes.length === 18;
            });
            if (rounds18.length === 0) return null;
            const best18 = rounds18.reduce((best, current) => {
              const currentScore = current.totalScore || current.total_score || 999;
              const bestScore = best.totalScore || best.total_score || 999;
              return currentScore < bestScore ? current : best
            });
            // Parent/child display logic (copied from ScoreHistory)
            let parentName = '';
            let childNames: string[] = [];
            if (courses && courses.length && (best18.courseId || best18.course_id)) {
              const courseIdStr = best18.courseId || best18.course_id || '';
              const courseIds = typeof courseIdStr === 'string' ? courseIdStr.split(',') : [];
              const childCourses = courses.filter((c: any) => courseIds.includes(c.id));
              if (childCourses.length > 0) {
                const parentId = childCourses[0].parent_id;
                if (parentId) {
                  const parent = courses.find((c: any) => c.id === parentId);
                  if (parent) parentName = parent.name;
                }
                childNames = childCourses.map((c: any) => c.name);
              } else {
                const course = courses.find((c: any) => c.id === best18.courseId);
                if (course && course.parent_id) {
                  const parent = courses.find((c: any) => c.id === course.parent_id);
                  if (parent) parentName = parent.name;
                  childNames = [course.name];
                } else if (course) {
                  childNames = [course.name];
                }
              }
            } else if (best18.courseName) {
              childNames = [best18.courseName];
            }
            const dateStr = best18.date ? new Date(best18.date).toLocaleDateString() : '';
            return (
              <div
                className="bg-black bg-opacity-70 rounded-2xl shadow-2xl border border-green-400 mb-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg px-5 py-3"
                style={{boxShadow: '0 2px 16px 0 rgba(0,0,0,0.5)', minHeight: 0}}
                onClick={() => router.push(`/round-detail?id=${best18.id}`)}
                title="View this round"
              >
                <div className="flex flex-row items-center justify-between relative" style={{ minHeight: 0 }}>
                  <div className="flex flex-col justify-center py-1">
                    <h2 className="text-base font-bold mb-1 text-green-400">Best 18 Hole Round</h2>
                    {parentName && (
                      <span className="font-semibold text-white text-xs md:text-sm leading-tight">{parentName}</span>
                    )}
                    {childNames.map((name, idx) => (
                      <span key={idx} className="text-xs text-green-400 mt-0.5">{name}</span>
                    ))}
                  </div>
                  <div className="flex flex-col items-end ml-auto pl-2">
                    <span className="text-lg font-bold text-green-400">{best18.totalScore}</span>
                    <span className="absolute top-1 right-2 text-xs text-gray-300">{dateStr}</span>
                  </div>
                  <div className="text-xl text-green-400 ml-2">→</div>
                </div>
              </div>
            );
          })()}

          {/* Recent Rounds */}
          {rounds.length > 0 ? (
            <ScoreHistory rounds={rounds} onDelete={handleDeleteRound} readOnly={!isOwnProfile} userId={player?.id} />
          ) : (
            <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
              <p className="text-gray-500 text-lg">No rounds recorded yet</p>
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
  );
}

export default function PlayerProfile() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-6"><div className="card text-center"><p className="text-gray-500">Loading profile...</p></div></div>}>
      <PlayerProfileContent />
    </Suspense>
  )
}
