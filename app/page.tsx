'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Round, User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import { calculateHandicap } from '@/lib/handicapCalculator'
import { getRoundsInProgress } from '@/lib/roundsInProgress'

export default function Home() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [courses, setCourses] = useState<any[]>([])
  const [activeRoundsCount, setActiveRoundsCount] = useState(0)
  const router = useRouter()
  const auth = useAuth()

  useEffect(() => {
    setIsClient(true)
  }, [])



  // Only run client-only logic after hydration
  useEffect(() => {
    if (!isClient) return;
    // Get current user
    const user = auth.getCurrentUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);

    // Fetch all rounds for the user from Supabase
    fetch('/api/get-user-rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.rounds)) {
          // Map snake_case fields to camelCase for each round
          const mappedRounds = data.rounds.map((r: any) => ({
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
            perHoleStats: r.perHoleStats || r.per_hole_stats // fallback for perHoleStats if present
          }));
          setRounds(mappedRounds);
        } else {
          setRounds([]);
        }
      })
      .catch(() => setRounds([]));

    // Fetch all courses from Supabase
    fetch('/api/get-courses')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.courses)) {
          setCourses(data.courses);
          // Also save to localStorage for other pages
          localStorage.setItem('golfCourses', JSON.stringify(data.courses));
        } else {
          setCourses([]);
        }
      })
      .catch(() => setCourses([]));

    // Fetch active rounds count
    const fetchActiveRoundsCount = async () => {
      try {
        // Pass user ID to filter only current user's rounds (FIX: prevent cross-user access bug)
        const activeRounds = await getRoundsInProgress(user.id);
        setActiveRoundsCount(activeRounds?.length || 0);
      } catch (err) {
        console.error('Error fetching active rounds:', err);
        setActiveRoundsCount(0);
      }
    };

    fetchActiveRoundsCount();
    // Refresh count every 10 seconds
    const interval = setInterval(fetchActiveRoundsCount, 10000);
    return () => clearInterval(interval);

  }, [isClient]);

  const calculateHandicapLocal = (): number => {
    if (!isClient || rounds.length === 0 || courses.length === 0) return 0
    const completedRounds = rounds.filter(r => !r.in_progress)
    return calculateHandicap(completedRounds, courses)
  }

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

  const handicap = calculateHandicapLocal()
  
  const calculateBestScore = (): number | null => {
    if (!isClient || rounds.length === 0) return null
    const scores = rounds.map(r => r.totalScore || r.total_score || 0).filter(s => s > 0)
    return scores.length > 0 ? Math.min(...scores) : null
  }

  const bestScore = calculateBestScore()

  const calculateScoreDistribution = (): { distribution: { [key: string]: number }; trend: 'improving' | 'declining' | 'stable'; recentBestType: string } => {
    const distribution = {
      'Hole in 1': 0,
      'Eagle': 0,
      'Birdie': 0,
      'Par': 0,
      'Bogey': 0,
      'Double+': 0,
    };
    if (!isClient || courses.length === 0) {
      return { distribution, trend: 'stable', recentBestType: 'Par' };
    }
    // Count score types across all holes in all rounds
    // Only use completed (not in-progress) rounds
    const completedRounds = rounds.filter(r => !r.in_progress);
    for (const round of completedRounds) {
      // Support comma-separated courseId (e.g., '9a,9b')
      let courseIds: string[] = [];
      if (Array.isArray(round.courseId)) {
        courseIds = round.courseId;
      } else if (typeof round.courseId === 'string') {
        courseIds = round.courseId.split(',').map((id: string) => id.trim());
      }
      const selectedCourses = courses.filter((c: any) => courseIds.includes(c.id));
      const holes = selectedCourses.flatMap((c: any) => c.holes || []);
      for (let i = 0; i < holes.length; i++) {
        const hole = holes[i];
        const score = round.scores?.[i];
        if (!score || score === 0) continue; // Skip unentered holes
        const par = hole.par;
        const diff = score - par;
        if (score === 1) {
          distribution['Hole in 1']++;
        } else if (diff <= -2) {
          distribution['Eagle']++;
        } else if (diff === -1) {
          distribution['Birdie']++;
        } else if (diff === 0) {
          distribution['Par']++;
        } else if (diff === 1) {
          distribution['Bogey']++;
        } else {
          distribution['Double+']++;
        }
      }
    }
    // Calculate trend - compare recent holes to overall
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (rounds.length >= 2) {
      const recentRound = rounds[rounds.length - 1];
      const prevRound = rounds[rounds.length - 2];
      const recentScore = recentRound.totalScore || recentRound.total_score;
      const prevScore = prevRound.totalScore || prevRound.total_score;
      if (recentScore && prevScore && recentScore < prevScore - 1) trend = 'improving';
      else if (recentScore && prevScore && recentScore > prevScore + 1) trend = 'declining';
    }
    // Find best recent score type
    let recentBestType = 'Par';
    const recentRound = rounds[rounds.length - 1];
    if (recentRound) {
      const courseId = recentRound.courseId || recentRound.course_id;
      const course = courses.find((c: any) => c.id === courseId);
      if (course?.holes) {
        let bestDiff = 999;
        for (let i = 0; i < course.holes.length; i++) {
          const hole = course.holes[i];
          const score = recentRound.scores?.[i] || 0;
          const diff = score - hole.par;
          if (diff < bestDiff) {
            bestDiff = diff;
            if (diff <= -2) recentBestType = 'Eagle';
            else if (diff === -1) recentBestType = 'Birdie';
            else if (diff === 0) recentBestType = 'Par';
          }
        }
      }
    }
    return { distribution, trend, recentBestType };
  }

  const { distribution, trend: scoreTrend, recentBestType } = calculateScoreDistribution()
  const maxDistribution = Math.max(...Object.values(distribution), 1)

  const calculateAverageDriveDistance = (): number | null => {
    if (!isClient || rounds.length === 0) return null
    let totalDriveDistance = 0
    let driveCount = 0
    
    // Only use completed rounds
    const completedRounds = rounds.filter(r => !r.in_progress)
    
    for (const round of completedRounds) {
      if (round.perHoleStats && Array.isArray(round.perHoleStats)) {
        for (const holeStats of round.perHoleStats) {
          if (holeStats.drive?.yardage && typeof holeStats.drive.yardage === 'number') {
            totalDriveDistance += holeStats.drive.yardage
            driveCount++
          }
        }
      }
    }
    
    if (driveCount === 0) return null
    return Math.round(totalDriveDistance / driveCount)
  }

  const averageDriveDistance = calculateAverageDriveDistance()

  // Calculate FIR stats
  const calculateFIRStats = () => {
    if (!isClient || rounds.length === 0) return null;
    let hit = 0, missLeft = 0, missRight = 0, total = 0;
    const completedRounds = rounds.filter(r => !r.in_progress);
    for (const round of completedRounds) {
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
      total,
    };
  }

  // Calculate GIR stats
  const calculateGIRStats = () => {
    if (!isClient || rounds.length === 0) return null;
    let girCount = 0, totalHoles = 0;
    const completedRounds = rounds.filter(r => !r.in_progress);
    for (const round of completedRounds) {
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
      girCount,
      totalHoles,
    };
  }

  const firStats = calculateFIRStats()
  const girStats = calculateGIRStats()

  // Calculate putt success by distance bucket
  const calculatePuttSuccessByDistance = () => {
    if (!isClient || rounds.length === 0) return null;
    const buckets = {
      range0to3: { attempts: 0, makes: 0, name: "0-3'" },
      range3to6: { attempts: 0, makes: 0, name: "3-6'" },
      range6to10: { attempts: 0, makes: 0, name: "6-10'" },
      range10to15: { attempts: 0, makes: 0, name: "10-15'" },
      range15plus: { attempts: 0, makes: 0, name: "15'+" },
    };
    
    const completedRounds = rounds.filter(r => !r.in_progress);
    for (const round of completedRounds) {
      if (round.perHoleStats && Array.isArray(round.perHoleStats)) {
        for (const stats of round.perHoleStats) {
          if (Array.isArray(stats?.puttDistances) && stats.puttDistances.length > 0) {
            // Last distance is always a make, all others are misses
            for (let i = 0; i < stats.puttDistances.length; i++) {
              const distance = stats.puttDistances[i];
              const isMake = i === stats.puttDistances.length - 1;
              
              if (distance < 3) {
                buckets.range0to3.attempts++;
                if (isMake) buckets.range0to3.makes++;
              } else if (distance < 6) {
                buckets.range3to6.attempts++;
                if (isMake) buckets.range3to6.makes++;
              } else if (distance < 10) {
                buckets.range6to10.attempts++;
                if (isMake) buckets.range6to10.makes++;
              } else if (distance < 15) {
                buckets.range10to15.attempts++;
                if (isMake) buckets.range10to15.makes++;
              } else {
                buckets.range15plus.attempts++;
                if (isMake) buckets.range15plus.makes++;
              }
            }
          }
        }
      }
    }
    
    // Convert to percentages, only return buckets with attempts
    const result: { [key: string]: { percent: number; makes: number; attempts: number; name: string } } = {};
    for (const [key, bucket] of Object.entries(buckets)) {
      if (bucket.attempts > 0) {
        result[key] = {
          percent: Math.round((bucket.makes / bucket.attempts) * 100),
          makes: bucket.makes,
          attempts: bucket.attempts,
          name: bucket.name,
        };
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  }

  const puttSuccessStats = calculatePuttSuccessByDistance()

  // Don't render until client is hydrated and auth checked
  if (!isClient || !currentUser) {
    return null
  }

  const handleViewRounds = () => {
    router.push(`/player?id=${currentUser.id}`)
  }

  const handleViewCourses = () => {
    router.push('/courses')
  }

  const handleViewGolfers = () => {
    router.push('/players')
  }

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: 'var(--green-bg)' }}>
      {/* Debug: Show rounds array for troubleshooting */}
      {/* Debug output removed for production */}
      {/* Welcome Banner */}
      <div className="px-4 pt-8 pb-4 flex justify-between items-start">
        <div>
          <p className="text-xs text-[var(--text-secondary)] mb-1 font-medium">Welcome back</p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{currentUser?.name || 'Golfer'}</h1>
        </div>
        <img src="/apex_tracer.png" alt="ApexTracer Golf" className="h-16 w-16" />
      </div>

      {/* Main Content */}
      <div className="px-4 space-y-4 max-w-md w-full mx-auto pt-8">
        {/* Stats Cards */}
        <div className="flex gap-2 justify-between">
          {/* Rounds Card */}
          <button
            onClick={handleViewRounds}
            className="card flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer hover:shadow-lg hover:bg-opacity-80 transition-all"
          >
            <div className="relative">
              <img src="/scorecard.png" alt="scorecard" className="h-16 w-16 object-contain" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-black">{rounds.length}</span>
              </div>
            </div>
            <div className="text-[9px] text-black text-center font-semibold uppercase tracking-wide mt-0.5 leading-tight">Tap to view<br />round history</div>
          </button>

          {/* Current Active Rounds Card */}
          <button
            onClick={() => router.push('/rounds-in-progress')}
            className="card flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="relative">
              <div className="text-2xl">🏌️</div>
              {activeRoundsCount > 0 && (
                <div className="absolute -top-2 -right-3 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {activeRoundsCount}
                </div>
              )}
            </div>
            <div className="text-sm font-bold leading-tight text-center" style={{ color: '#007aff' }}>
              Live<br />Leaderboard
            </div>
            <div className="text-[10px] text-center font-semibold uppercase tracking-wide mt-0.5" style={{ color: '#007aff' }}>Rounds in Progress</div>
          </button>

          {/* Handicap Card */}
          <div className="card flex-1 flex flex-col items-center justify-center gap-1 min-w-0">
            <div className="flex items-center gap-0.5 min-w-0">
              <div className={`text-4xl font-bold truncate ${getHandicapColor(handicap)}`}>
                {isClient && rounds.length > 0 && courses.length > 0 ? handicap : '—'}
              </div>
              {getHandicapTrend() && <div className={`text-sm flex-shrink-0 ${getHandicapColor(handicap)}`}>{getHandicapTrend()}</div>}
            </div>
            <div className={`text-[10px] text-center font-semibold uppercase tracking-wide mt-0.5 ${getHandicapColor(handicap)}`}>My HCP</div>
          </div>
        </div>

        {/* Performance Breakdown: Always show, even if no rounds */}
        <div className="card p-4">
          <h3 className="text-lg font-bold mb-4">Performance Breakdown</h3>
          {/* Column Headers */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Type</span>
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase w-8 text-center">Total</span>
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase w-12 text-right">Avg/Rnd</span>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(distribution).map(([type, count]) => {
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
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{emojis[type]}</span>
                      <span className="text-sm font-semibold">{type}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold w-8 text-center">{count}</span>
                      <span className="text-xs w-12 text-right">{rounds.length > 0 ? (count / rounds.length).toFixed(2) : '0.00'}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`bg-gradient-to-r ${colors[type]} h-2 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Drive Distance Stats */}
        {averageDriveDistance !== null && (
          <div className="card p-4 bg-blue-50 border-l-4 border-l-blue-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📏</span>
                <span className="font-semibold">Avg Drive Distance</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">{averageDriveDistance} yd</span>
            </div>
          </div>
        )}

        {/* FIR Stats */}
        {firStats !== null && (
          <div className="card p-4 bg-green-50 border-l-4 border-l-green-600">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⛳</span>
                  <span className="font-semibold">Fairway Hit Rate</span>
                </div>
                <span className="text-2xl font-bold text-green-600">{firStats.hitPercent}%</span>
              </div>
              <div className="text-xs text-gray-600 space-y-1 pl-6">
                <div>Miss Left: {firStats.missLeftPercent}%</div>
                <div>Miss Right: {firStats.missRightPercent}%</div>
              </div>
            </div>
          </div>
        )}

        {/* GIR Stats */}
        {girStats !== null && (
          <div className="card p-4 bg-indigo-50 border-l-4 border-l-indigo-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <span className="font-semibold">Green in Regulation</span>
              </div>
              <span className="text-2xl font-bold text-indigo-600">{girStats.girPercent}%</span>
            </div>
          </div>
        )}

        {/* Putt Success by Distance */}
        {puttSuccessStats !== null && (
          <div className="card p-4 bg-orange-50 border-l-4 border-l-orange-600">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>🏌️</span>
              <span>Putt Success Rate</span>
            </h3>
            <div className="space-y-2">
              {Object.entries(puttSuccessStats).map(([key, stats]) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">{stats.name}</span>
                    <span className="text-xs text-gray-500">({stats.makes}/{stats.attempts})</span>
                  </div>
                  <span className="text-lg font-bold text-orange-600">{stats.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Courses and Golfers */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={handleViewCourses}
            className="btn-secondary flex items-center justify-center gap-2 text-xs font-semibold py-2"
            style={{ color: 'black' }}
          >
            <span className="text-base">⛳</span>
            <span>Courses</span>
          </button>

          <button
            onClick={handleViewGolfers}
            className="btn-secondary flex items-center justify-center gap-2 text-xs font-semibold py-2"
            style={{ color: 'black' }}
          >
            <span className="text-base">👥</span>
            <span>Golfers</span>
          </button>
        </div>
      </div>


    </div>
  )
}
