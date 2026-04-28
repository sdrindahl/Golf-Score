'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ScoreHistory from '@/components/ScoreHistory'
import PageWrapper from '@/components/PageWrapper'
import { Round, User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

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

  // ...existing code...

  // Helper: is this the logged-in user's profile?
  const isOwnProfile = currentUser?.id === player?.id;
  // Show Golf Costs button only for the logged-in user viewing their own profile
  const showGolfCostsButton = isOwnProfile;

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
                const playerRounds: Round[] = data.map((r: any) => ({
                  id: r.id,
                  userId: r.user_id,
                  userName: r.user_name,
                  courseId: r.course_id,
                  courseName: r.course_name,
                  selectedTee: r.selected_tee,
                  date: r.date,
                  scores: r.scores,
                  totalScore: r.total_score,
                  notes: r.notes,
                  in_progress: r.in_progress,
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

  const calculateHandicap = (): number => {
    if (rounds.length === 0) return 0
    
    let handicap = 0
    
    // Get course data to find course ratings
    const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]')

    // Debug: log all course IDs in localStorage
    const courseIdsInStorage = courses.map((c: any) => c.id);
    console.log('📊 All courses in storage:', courses);
    console.log('📊 Course IDs in storage:', courseIdsInStorage);
    console.log('📊 Calculating handicap for', rounds.length, 'rounds');

    // Debug: log courseId for each round
    rounds.forEach((round, idx) => {
      console.log(`[DEBUG] Round #${idx + 1} courseId:`, round.courseId);
    });

    // Calculate handicap differential for each round
    // Formula: (Score - Course Rating) × 113 / Slope Rating
    const differentials = rounds
      .map(round => {
        // Support multi-child rounds (comma-separated courseId)
        const courseIds = typeof round.courseId === 'string' ? round.courseId.split(',') : [round.courseId];
        const childCourses = courses.filter((c: any) => courseIds.includes(c.id));
        if (childCourses.length === 0) {
          return null;
        }
        // Sum up ratings and slopes for all child courses
        let totalRating = 0;
        let totalSlope = 0;
        let totalHoles = 0;
        let allHaveSlope = true;
        childCourses.forEach((course: any) => {
          let courseRating = course.courseRating;
          let slopeRating = course.slopeRating;
          if (!courseRating && course.holes) {
            courseRating = course.holes.reduce((sum: number, h: any) => sum + h.par, 0);
          }
          if (!courseRating) courseRating = 36;
          if (!slopeRating) slopeRating = 113;
          totalRating += courseRating;
          totalSlope += slopeRating;
          totalHoles += course.holes ? course.holes.length : 9;
          if (!slopeRating) allHaveSlope = false;
        });
        if (!allHaveSlope) {
          return null;
        }
        // If this is a full 18-hole round, use as is; if 9, double it
        let adjustedScore = round.totalScore;
        let adjustedRating = totalRating;
        let adjustedSlope = totalSlope;
        if (totalHoles === 9) {
          adjustedScore = round.totalScore * 2;
          adjustedRating = totalRating * 2;
          adjustedSlope = totalSlope * 2;
        }
        // For 18 holes, use as is
        const differential = (adjustedScore - adjustedRating) * 113 / adjustedSlope;
        return differential;
      })
      .filter((d: any) => d !== null) as number[];

    console.log('📊 Valid differentials:', differentials)

    // Use best X of last 20 in the calculation based on USGA rules
    if (differentials.length > 0) {
      const recentDifferentials = differentials.slice(-20)
      const sortedDifferentials = recentDifferentials.sort((a, b) => a - b)
      
      // USGA Handicap calculation based on number of scores
      let bestCount = 1
      const roundCount = sortedDifferentials.length
      if (roundCount >= 6) bestCount = 2
      if (roundCount >= 7) bestCount = 3
      if (roundCount >= 9) bestCount = 4
      if (roundCount >= 11) bestCount = 5
      if (roundCount >= 13) bestCount = 6
      if (roundCount >= 15) bestCount = 7
      if (roundCount >= 17) bestCount = 8
      
      const bestDifferentials = sortedDifferentials.slice(0, bestCount)
      handicap = Math.round(bestDifferentials.reduce((a, b) => a + b, 0) / bestCount * 10) / 10
      
      console.log(`🎯 Handicap calculation: ${roundCount} differentials, using best ${bestCount}`)
      console.log(`   Best: ${bestDifferentials.map(d => d.toFixed(1)).join(', ')}`)
      console.log(`   Handicap: ${handicap}`)
    } else {
      console.log('❌ No valid differentials calculated')
    }

    return handicap
  }

  const handicap = calculateHandicap()

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

          {/* Header Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/95 backdrop-blur rounded-3xl p-7 shadow-lg border border-white/20">
              <div className="text-5xl mb-3 text-center">⛳</div>
              <div className="text-3xl font-bold text-center text-gray-800">{handicap}</div>
              <div className="text-xs text-gray-600 text-center font-semibold uppercase tracking-wide">Handicap</div>
            </div>
            <div className="bg-white/95 backdrop-blur rounded-3xl p-7 shadow-lg border border-white/20">
              <div className="text-5xl mb-3 text-center">🏌️</div>
              <div className="text-3xl font-bold text-center text-gray-800">{rounds.length}</div>
              <div className="text-xs text-gray-600 text-center font-semibold uppercase tracking-wide">Rounds</div>
            </div>
          </div>

          {/* Statistics */}
          {rounds.length > 0 && (() => {
            // Find best 18-hole round
            const courses = JSON.parse(localStorage.getItem('golfCourses') || '[]');
            const rounds18 = rounds.filter(r => {
              // Support multi-child rounds (comma-separated courseId)
              const courseIds = r.courseId.split(',');
              // Find all matching courses
              const childCourses = courses.filter((c: any) => courseIds.includes(c.id));
              // If any child course has 18 holes, treat as 18-hole round
              if (childCourses.length > 0) {
                const totalHoles = childCourses.reduce((sum: number, c: any) => sum + (c.holes?.length || 0), 0);
                return totalHoles === 18;
              }
              // fallback: single course logic
              const course = courses.find((c: any) => c.id === r.courseId);
              return course && course.holes.length === 18;
            });
            if (rounds18.length === 0) return null;
            const best18 = rounds18.reduce((best, current) =>
              current.totalScore < best.totalScore ? current : best
            );
            // Parent/child display logic (copied from ScoreHistory)
            let parentName = '';
            let childNames: string[] = [];
            if (courses && courses.length && best18.courseId) {
              const courseIds = typeof best18.courseId === 'string' ? best18.courseId.split(',') : [];
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
                className="bg-gradient-to-r from-green-100 via-emerald-50 to-green-200 rounded-2xl shadow border border-green-200/60 mb-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                style={{ padding: '0.5rem 0.5rem 0.5rem 1.25rem', minHeight: 0 }}
                onClick={() => router.push(`/round-detail?id=${best18.id}`)}
                title="View this round"
              >
                <div className="flex flex-row items-center justify-between relative" style={{ minHeight: 0 }}>
                  <div className="flex flex-col justify-center py-1">
                    <h2 className="text-base font-bold mb-1 text-emerald-800">Best 18 Hole Round</h2>
                    {parentName && (
                      <span className="font-semibold text-gray-800 text-xs md:text-sm leading-tight">{parentName}</span>
                    )}
                    {childNames.map((name, idx) => (
                      <span key={idx} className="text-xs text-gray-600 mt-0.5">{name}</span>
                    ))}
                  </div>
                  <div className="flex flex-col items-end ml-auto pl-2">
                    <span className="text-lg font-bold text-gray-800">{best18.totalScore}</span>
                    <span className="absolute top-1 right-2 text-xs text-gray-500">{dateStr}</span>
                  </div>
                  <div className="text-xl text-emerald-400 ml-2">→</div>
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
